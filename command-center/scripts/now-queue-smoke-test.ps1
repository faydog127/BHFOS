param(
  [string]$TenantId = 'tvg',
  [string]$RunPrefix = 'nowqueue',
  [switch]$SkipStart,
  [switch]$SupabaseDebug
)

$ErrorActionPreference = 'Stop'

function Resolve-SupabaseCli {
  $cmd = Get-Command supabase -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $candidate = Join-Path $env:USERPROFILE '.supabase\bin\supabase.exe'
  if (Test-Path $candidate) { return $candidate }

  throw "Supabase CLI not found. Install it, or add it to PATH. Expected at: $candidate"
}

function Parse-EnvOutput {
  param([string[]]$Lines)

  $map = @{}
  foreach ($line in $Lines) {
    if ($line -match '^[A-Z0-9_]+=' ) {
      $parts = $line.Split('=', 2)
      $key = $parts[0]
      $val = $parts[1].Trim()
      if ($val.StartsWith('"') -and $val.EndsWith('"')) {
        $val = $val.Substring(1, $val.Length - 2)
      }
      $map[$key] = $val
    }
  }
  return $map
}

function Get-ProjectIdFromConfig {
  param([string]$ConfigPath)

  $match = Select-String -Path $ConfigPath -Pattern "^\s*project_id\s*=\s*'([^']+)'" -ErrorAction Stop |
    Select-Object -First 1
  if (-not $match) { throw "Could not find project_id in $ConfigPath" }
  return $match.Matches[0].Groups[1].Value
}

function Get-DbContainerName {
  param([string]$ProjectId)
  $name = "supabase_db_$ProjectId"
  $found = docker ps --format "{{.Names}}" | Where-Object { $_ -eq $name } | Select-Object -First 1
  if (-not $found) { throw "Database container not found: $name (is `supabase start` running?)" }
  return $found
}

function Invoke-Edge {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$AnonKey,
    [string]$BodyJson
  )

  $args = @('-s', '-i', '-X', $Method, $Url,
    '-H', "Authorization: Bearer $AnonKey",
    '-H', "apikey: $AnonKey"
  )

  if ($BodyJson) {
    $args += @('-H', 'Content-Type: application/json', '--data', $BodyJson)
  }

  return & curl.exe @args
}

$workdir = Split-Path $PSScriptRoot -Parent
$supabase = Resolve-SupabaseCli

if (-not $SkipStart) {
  Push-Location $workdir
  try {
    $startArgs = @('start', '--exclude', 'logflare')
    if ($SupabaseDebug) { $startArgs += '--debug' }
    & $supabase @startArgs | Out-Null
  } finally {
    Pop-Location
  }
}

Push-Location $workdir
try {
  $statusArgs = @('status', '-o', 'env')
  if ($SupabaseDebug) { $statusArgs += '--debug' }
  $envLines = & $supabase @statusArgs 2>&1
} finally {
  Pop-Location
}
$envMap = Parse-EnvOutput -Lines $envLines

$anon = $envMap['ANON_KEY']
$functionsUrl = $envMap['FUNCTIONS_URL']
if (-not $anon -or -not $functionsUrl) {
  throw "Could not read ANON_KEY / FUNCTIONS_URL from supabase status. Output:`n$($envLines -join "`n")"
}

$runId = "$RunPrefix-$(Get-Date -Format 'yyyyMMdd_HHmmss')"

$configPath = Join-Path $workdir 'supabase\config.toml'
$projectId = Get-ProjectIdFromConfig -ConfigPath $configPath
$dbContainer = Get-DbContainerName -ProjectId $projectId

Write-Host "Using project_id=$projectId"
Write-Host "Functions URL: $functionsUrl"
Write-Host "DB container:  $dbContainer"
Write-Host "Run ID:        $runId"

$seedSql = @"
WITH ins_property AS (
  INSERT INTO public.properties (tenant_id, address1, city, state, zip)
  VALUES ('$TenantId', '456 Now Queue Ave', 'Testville', 'TX', '00000')
  RETURNING id
),
ins_contact AS (
  INSERT INTO public.contacts (tenant_id, first_name, last_name, email, phone)
  VALUES (
    '$TenantId',
    'Queue',
    'Test',
    concat('queue+', extract(epoch from now())::bigint, '@example.com'),
    '555-1111'
  )
  RETURNING id
),
ins_lead AS (
  INSERT INTO public.leads (
    tenant_id,
    contact_id,
    property_id,
    first_name,
    last_name,
    email,
    phone,
    service,
    source,
    status,
    stage,
    created_at,
    updated_at
  )
  SELECT
    '$TenantId',
    ins_contact.id,
    ins_property.id,
    'Queue',
    'Test',
    'queue@test.local',
    '555-1111',
    'SmokeTest',
    'smoke',
    'new',
    'new',
    now(),
    now()
  FROM ins_contact, ins_property
  RETURNING id
),
ins_quote AS (
  INSERT INTO public.quotes (
    tenant_id,
    lead_id,
    quote_number,
    status,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
    valid_until,
    header_text,
    footer_text,
    created_at,
    updated_at
  )
  SELECT
    '$TenantId',
    ins_lead.id,
    'SMOKE-QUOTE-Q',
    'sent',
    100,
    0,
    0,
    100,
    current_date + 7,
    'Queue quote',
    'Thanks',
    now(),
    now()
  FROM ins_lead
  RETURNING id, public_token
),
ins_quote_item AS (
  INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price)
  SELECT ins_quote.id, 'Test item', 1, 100, 100 FROM ins_quote
  RETURNING id
)
SELECT
  (SELECT id FROM ins_lead) AS lead_id,
  (SELECT id FROM ins_quote) AS quote_id,
  (SELECT public_token FROM ins_quote) AS quote_token;
"@

$seedCsv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c $seedSql
$seedParts = $seedCsv.Trim().Split(',')
if ($seedParts.Count -ne 3) {
  throw "Unexpected seed output: $seedCsv"
}

$leadId = $seedParts[0]
$quoteId = $seedParts[1]
$quoteToken = $seedParts[2]

Write-Host "Seeded lead_id=$leadId"
Write-Host "Seeded quote_id=$quoteId token=$quoteToken"

Write-Host "`n=== CALLS ==="
$quoteView = Invoke-Edge -Method 'GET' -Url "$functionsUrl/public-quote?token=$quoteToken&tenant_id=$TenantId&run_id=$runId-qv1" -AnonKey $anon
Write-Host "`n(public-quote)`n$quoteView"

Write-Host "`n=== EVIDENCE (DB) ==="

Write-Host "`n--- quote follow-up tasks ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select title,status,source_type,source_id,tenant_id,created_at from public.crm_tasks where source_type='quote' and source_id='$quoteId'::uuid order by created_at asc;"

Write-Host "`n--- now_queue (lead/quote) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select priority,subpriority,item_type,entity_id,lead_id,title,created_at from public.now_queue where tenant_id='$TenantId' and (lead_id='$leadId'::uuid or entity_id='$quoteId'::uuid) order by priority asc, subpriority asc, created_at asc;"

Write-Host "`n--- suspensions (quote) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select tenant_id,entity_type,entity_id,reason,suspended_at,resumed_at from public.automation_suspensions where entity_type='quote' and entity_id='$quoteId'::uuid order by suspended_at asc;"

Write-Host "`n--- jobs (should be none; no approval called) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select id,status,quote_id,lead_id,tenant_id,created_at from public.jobs where quote_id='$quoteId'::uuid;"

Write-Host "`nDONE"
