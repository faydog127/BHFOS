param(
  [string]$TenantId = 'tvg',
  [string]$RunPrefix = 'stripe-intent',
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

function Extract-JsonBody {
  param([string[]]$CurlOutput)
  $text = $CurlOutput -join "`n"
  $parts = $text -split "\r?\n\r?\n", 2
  if ($parts.Count -lt 2) { return $null }
  return $parts[1].Trim()
}

function Format-CurlOutputForLog {
  param([string[]]$CurlOutput)
  $text = $CurlOutput -join "`n"
  return ($text -replace '"client_secret"\s*:\s*"[^"]+"', '"client_secret":"[REDACTED]"')
}

function Test-GlobalConfigTenantId {
  param([string]$DbContainer)

  $result = docker exec $DbContainer psql -U postgres -d postgres -At -c "select case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='global_config' and column_name='tenant_id') then '1' else '0' end;"
  return ($result | Select-Object -Last 1).Trim() -eq '1'
}

function Set-PaymentsMode {
  param(
    [string]$DbContainer,
    [string]$TenantId,
    [string]$Mode
  )

  $hasTenantId = Test-GlobalConfigTenantId -DbContainer $DbContainer
  if ($hasTenantId) {
    docker exec $DbContainer psql -U postgres -d postgres -c "insert into public.global_config (tenant_id,key,value,updated_at) values ('$TenantId','payments_mode','$Mode',now()) on conflict (key) do update set tenant_id=excluded.tenant_id, value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
    return
  }

  docker exec $DbContainer psql -U postgres -d postgres -c "insert into public.global_config (key,value,updated_at) values ('payments_mode','$Mode',now()) on conflict (key) do update set value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
}

$workdir = Split-Path $PSScriptRoot -Parent
$supabase = Resolve-SupabaseCli

if (-not $SkipStart) {
  $startArgs = @('--workdir', $workdir)
  if ($SupabaseDebug) { $startArgs += '--debug' }
  & $supabase @startArgs start --exclude logflare | Out-Null
}

$statusArgs = @('--workdir', $workdir, 'status', '-o', 'env')
if ($SupabaseDebug) { $statusArgs += '--debug' }
$envLines = & $supabase @statusArgs 2>&1
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

# Save and then force payments_mode=stripe for this run.
$prevMode = docker exec $dbContainer psql -U postgres -d postgres -At -c "select value from public.global_config where key='payments_mode' limit 1;"

try {
  Set-PaymentsMode -DbContainer $dbContainer -TenantId $TenantId -Mode 'stripe'

  $seedSql = @"
WITH ins_property AS (
  INSERT INTO public.properties (tenant_id, address1, city, state, zip)
  VALUES ('$TenantId', '999 Stripe Intent Way', 'Testville', 'TX', '00000')
  RETURNING id
),
ins_contact AS (
  INSERT INTO public.contacts (tenant_id, first_name, last_name, email, phone)
  VALUES (
    '$TenantId',
    'Stripe',
    'Intent',
    concat('stripe-intent+', extract(epoch from now())::bigint, '@example.com'),
    '555-2222'
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
    'Stripe',
    'Intent',
    'stripe-intent@test.local',
    '555-2222',
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
    'SMOKE-QUOTE-STRIPE',
    'sent',
    100,
    0,
    0,
    100,
    current_date + 7,
    'Stripe intent quote',
    'Thanks',
    now(),
    now()
  FROM ins_lead
  RETURNING id
),
ins_invoice AS (
  INSERT INTO public.invoices (
    tenant_id,
    lead_id,
    invoice_number,
    status,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
    amount_paid,
    balance_due,
    due_date,
    created_at,
    updated_at
  )
  SELECT
    '$TenantId',
    ins_lead.id,
    'SMOKE-INV-STRIPE',
    'sent',
    100,
    0,
    0,
    100,
    0,
    100,
    current_date + 7,
    now(),
    now()
  FROM ins_lead
  RETURNING id, public_token
)
SELECT
  (SELECT id FROM ins_invoice) AS invoice_id,
  (SELECT public_token FROM ins_invoice) AS invoice_token;
"@

  $seedCsv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c $seedSql
  $seedParts = $seedCsv.Trim().Split(',')
  if ($seedParts.Count -ne 2) { throw "Unexpected seed output: $seedCsv" }

  $invoiceId = $seedParts[0]
  $invoiceToken = $seedParts[1]

  Write-Host "Seeded invoice_id=$invoiceId token=$invoiceToken"

  Write-Host "`n=== CALLS ==="
  $payBody1 = @{ token = $invoiceToken; tenant_id = $TenantId; method = 'card'; run_id = "$runId-pay1" } | ConvertTo-Json
  $payBody2 = @{ token = $invoiceToken; tenant_id = $TenantId; method = 'card'; run_id = "$runId-pay2" } | ConvertTo-Json

  $payment1 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-pay" -AnonKey $anon -BodyJson $payBody1
  $payment2 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-pay" -AnonKey $anon -BodyJson $payBody2

  Write-Host "`n(public-pay #1)`n$(Format-CurlOutputForLog -CurlOutput $payment1)"
  Write-Host "`n(public-pay #2)`n$(Format-CurlOutputForLog -CurlOutput $payment2)"

  $p1Text = $payment1 -join "`n"
  if ($p1Text -notmatch 'HTTP/1\.1 200') {
    throw "Expected public-pay #1 to return 200. Got:`n$p1Text`n`nIf this says STRIPE_SECRET_KEY is missing, set it via: supabase secrets set STRIPE_SECRET_KEY=... then restart local."
  }

  $p1Json = Extract-JsonBody -CurlOutput $payment1
  $p2Json = Extract-JsonBody -CurlOutput $payment2
  if (-not $p1Json -or -not $p2Json) { throw "Could not parse JSON responses." }

  $p1 = $p1Json | ConvertFrom-Json
  $p2 = $p2Json | ConvertFrom-Json

  if ($p1.mode -ne 'stripe') { throw "Expected mode=stripe in response #1. Got: $($p1.mode)" }
  if ($p2.mode -ne 'stripe') { throw "Expected mode=stripe in response #2. Got: $($p2.mode)" }
  if (-not $p1.payment_intent_id) { throw "Expected payment_intent_id in response #1." }
  if ($p2.payment_intent_id -ne $p1.payment_intent_id) {
    throw "Expected second call to reuse same payment_intent_id. Got: $($p1.payment_intent_id) then $($p2.payment_intent_id)"
  }
  if ($p2.reuse -ne $true) { throw "Expected reuse=true in response #2." }

  Write-Host "`n=== EVIDENCE (DB) ==="
  docker exec $dbContainer psql -U postgres -d postgres -c "select id,provider_payment_id,provider_payment_status,status,paid_at,amount_paid,balance_due from public.invoices where id='$invoiceId'::uuid;"

  Write-Host "`nDONE"
} finally {
  if ($prevMode) {
    Set-PaymentsMode -DbContainer $dbContainer -TenantId $TenantId -Mode $prevMode
  } else {
    docker exec $dbContainer psql -U postgres -d postgres -c "delete from public.global_config where key='payments_mode';"
  }
}
