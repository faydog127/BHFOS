param(
  [string]$TenantId = 'tvg',
  [string]$RunPrefix = 'rvh-p0-a',
  [switch]$SkipStart,
  [switch]$SupabaseDebug,
  [switch]$BestEffortCleanup
)

$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  exit 2
}

function Redact-Text([string]$Text) {
  if (-not $Text) { return '' }
  $t = $Text
  $t = $t -replace '(Authorization:\\s*Bearer)\\s+[^\\s\\r\\n]+', '$1 [REDACTED]'
  $t = $t -replace '(apikey:\\s*)[^\\s\\r\\n]+', '$1[REDACTED]'
  $t = $t -replace '\\beyJ[a-zA-Z0-9_\\-\\.]+\\b', '[REDACTED_JWT]'
  return $t
}

function Resolve-SupabaseCli {
  $cmd = Get-Command supabase -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $candidate = Join-Path $env:USERPROFILE '.supabase\bin\supabase.exe'
  if (Test-Path $candidate) { return $candidate }

  Fail "Supabase CLI not found (expected at $candidate)."
}

function Parse-EnvOutput {
  param([string[]]$Lines)
  $map = @{}
  foreach ($lineObj in $Lines) {
    $line = [string]$lineObj
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

function Get-EdgeContainerName {
  param([string]$ProjectId)
  $name = "supabase_edge_runtime_$ProjectId"
  $found = docker ps --format "{{.Names}}" | Where-Object { $_ -eq $name } | Select-Object -First 1
  if (-not $found) { throw "Edge runtime container not found: $name (is `supabase start` running?)" }
  return $found
}

function Invoke-Edge {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$AnonKey,
    [hashtable]$Headers = @{},
    [string]$BodyJson
  )

  $args = @('-s', '-i', '-X', $Method, $Url,
    '-H', "Authorization: Bearer $AnonKey",
    '-H', "apikey: $AnonKey"
  )

  foreach ($k in $Headers.Keys) {
    $args += @('-H', "$($k): $($Headers[$k])")
  }

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

function Mask([string]$Value) {
  if (-not $Value) { return '' }
  if ($Value.Length -le 8) { return '********' }
  return ($Value.Substring(0, 4) + '…' + $Value.Substring($Value.Length - 4))
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

$workdir = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
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
if (-not $functionsUrl -and $envMap['API_URL']) {
  $functionsUrl = ($envMap['API_URL'].TrimEnd('/') + '/functions/v1')
}

if (-not $anon -or -not $functionsUrl) {
  Fail "Could not read ANON_KEY / FUNCTIONS_URL from supabase status. Run `supabase status -o env` to confirm local is up."
}
if ($functionsUrl -notmatch '^https?://(127\.0\.0\.1|localhost)') {
  Fail "Refusing to run revenue chain unless FUNCTIONS_URL is local. Got: $functionsUrl"
}

$runId = "$RunPrefix-$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$date = Get-Date -Format 'yyyy-MM-dd'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$baseDir = Join-Path $repoRoot ("tmp\\runtime\\$date\\local\\$runId")
$chainDir = Join-Path $baseDir 'chainA'
New-Item -ItemType Directory -Force -Path $chainDir | Out-Null

@{
  run_id = $runId
  environment = 'local'
  chain = 'RVH-P0-A'
  tenant_id = $TenantId
  started_at = (Get-Date).ToString('o')
} | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $baseDir 'run.json') -Encoding UTF8

Set-Content -Path (Join-Path $baseDir 'artifacts_index.md') -Encoding UTF8 -Value @"
# RVH Artifacts Index
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Environment: local
Run ID: $runId

- run.json -- run metadata (no secrets)
- preflight.log -- environment safety gate result
- chainA/public-invoice.http.txt -- public invoice view response
- chainA/public-pay.http.txt -- pay initiation response
- chainA/stripe-webhook.http.txt -- webhook response
- chainA/stripe-webhook-replay.http.txt -- webhook replay response
- chainA/db_invoice.txt -- DB evidence: invoice row after webhook
- chainA/db_transactions_count.txt -- DB evidence: transaction count assertion
- chainA/db_stripe_webhook_events_count.txt -- DB evidence: webhook event idempotency
"@

# ----------------
# Preflight (safety gate)
# ----------------
$preflightLog = Join-Path $baseDir 'preflight.log'
try {
  $pf = & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'assert-env-safe.ps1') -Environment local 2>&1 | Out-String
  Set-Content -Path $preflightLog -Encoding UTF8 -Value (Redact-Text $pf)
  if ($LASTEXITCODE -ne 0) { Fail "Preflight failed. See: $preflightLog" }
} catch {
  Set-Content -Path $preflightLog -Encoding UTF8 -Value (Redact-Text ($_.Exception.Message))
  Fail "Preflight failed. See: $preflightLog"
}

$configPath = Join-Path $workdir 'supabase\config.toml'
$projectId = Get-ProjectIdFromConfig -ConfigPath $configPath
$dbContainer = Get-DbContainerName -ProjectId $projectId
$edgeContainer = Get-EdgeContainerName -ProjectId $projectId

Write-Host "RVH-P0-A (LOCAL) Revenue Chain"
Write-Host "Run ID:        $runId"
Write-Host "Functions URL: $functionsUrl"
Write-Host "DB container:  $dbContainer"

# Ensure TEST_MODE is enabled for webhook bypass in local.
try {
  & $supabase --workdir $workdir secrets set TEST_MODE=true | Out-Null
  docker restart $edgeContainer | Out-Null
} catch {
  Fail "Could not enable TEST_MODE for local edge functions. Error: $($_.Exception.Message)"
}

# Save and then force payments_mode=stripe for this run.
$prevMode = docker exec $dbContainer psql -U postgres -d postgres -At -c "select value from public.global_config where key='payments_mode' limit 1;"
$prevTestMode = docker exec $dbContainer psql -U postgres -d postgres -At -c "select value from public.global_config where key='test_mode' limit 1;"

$ids = @{
  property_id = $null
  contact_id = $null
  lead_id = $null
  quote_id = $null
  invoice_id = $null
  job_id = $null
  invoice_token = $null
  payment_intent_id = $null
}

try {
  Set-PaymentsMode -DbContainer $dbContainer -TenantId $TenantId -Mode 'stripe'
  # Enable explicit test mode for local-only bypasses (read by edge functions via global_config).
  $hasTenantId = Test-GlobalConfigTenantId -DbContainer $dbContainer
  if ($hasTenantId) {
    docker exec $dbContainer psql -U postgres -d postgres -c "insert into public.global_config (tenant_id,key,value,updated_at) values ('$TenantId','test_mode','1',now()) on conflict (key) do update set tenant_id=excluded.tenant_id, value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
  } else {
    docker exec $dbContainer psql -U postgres -d postgres -c "insert into public.global_config (key,value,updated_at) values ('test_mode','1',now()) on conflict (key) do update set value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
  }

  $seedSql = @"
WITH ins_property AS (
  INSERT INTO public.properties (tenant_id, address1, city, state, zip)
  VALUES ('$TenantId', '999 RVH Revenue Way', 'Testville', 'TX', '00000')
  RETURNING id
),
ins_contact AS (
  INSERT INTO public.contacts (tenant_id, first_name, last_name, email, phone)
  VALUES (
    '$TenantId',
    'RVH',
    'Revenue',
    concat('rvh-revenue+', extract(epoch from now())::bigint, '@example.com'),
    '555-1212'
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
    'RVH',
    'Revenue',
    'rvh-revenue@test.local',
    '555-1212',
    'SmokeTest',
    'rvh',
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
    'RVH-QUOTE-REVENUE',
    'sent',
    100,
    0,
    0,
    100,
    current_date + 7,
    'RVH revenue quote',
    'Thanks',
    now(),
    now()
  FROM ins_lead
  RETURNING id
),
ins_job AS (
  INSERT INTO public.jobs (
    tenant_id,
    lead_id,
    quote_id,
    status,
    payment_status,
    total_amount,
    created_at,
    updated_at
  )
  SELECT
    '$TenantId',
    ins_lead.id,
    ins_quote.id,
    'unscheduled',
    'unpaid',
    100,
    now(),
    now()
  FROM ins_lead, ins_quote
  RETURNING id
),
ins_invoice AS (
  INSERT INTO public.invoices (
    tenant_id,
    lead_id,
    quote_id,
    job_id,
    invoice_number,
    status,
    invoice_type,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
    amount_paid,
    balance_due,
    due_date,
    created_at,
    updated_at,
    is_test_data
  )
  SELECT
    '$TenantId',
    ins_lead.id,
    ins_quote.id,
    ins_job.id,
    concat('RVH-INV-', extract(epoch from now())::bigint),
    'draft',
    'final',
    100,
    0,
    0,
    100,
    0,
    100,
    current_date + 7,
    now(),
    now(),
    true
  FROM ins_lead, ins_quote, ins_job
  RETURNING id, public_token
)
SELECT
  (SELECT id FROM ins_property) AS property_id,
  (SELECT id FROM ins_contact) AS contact_id,
  (SELECT id FROM ins_lead) AS lead_id,
  (SELECT id FROM ins_quote) AS quote_id,
  (SELECT id FROM ins_job) AS job_id,
  (SELECT id FROM ins_invoice) AS invoice_id,
  (SELECT public_token FROM ins_invoice) AS invoice_token;
"@

  $seedCsv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c $seedSql
  $seedParts = $seedCsv.Trim().Split(',')
  if ($seedParts.Count -ne 7) { throw "Unexpected seed output (expected 7 csv fields)." }

  $ids.property_id = $seedParts[0]
  $ids.contact_id = $seedParts[1]
  $ids.lead_id = $seedParts[2]
  $ids.quote_id = $seedParts[3]
  $ids.job_id = $seedParts[4]
  $ids.invoice_id = $seedParts[5]
  $ids.invoice_token = $seedParts[6]

  Write-Host "Seeded invoice_id=$($ids.invoice_id) token=$(Mask $ids.invoice_token)"

  # A) Pay link lookup
  $invoiceView = Invoke-Edge -Method 'GET' -Url "$functionsUrl/public-invoice?token=$($ids.invoice_token)&tenant_id=$TenantId&run_id=$runId-iv1" -AnonKey $anon
  $invoiceViewText = $invoiceView -join "`n"
  Set-Content -Path (Join-Path $chainDir 'public-invoice.http.txt') -Encoding UTF8 -Value (Redact-Text $invoiceViewText)
  if ($invoiceViewText -notmatch 'HTTP/1\.1 200') {
    throw "Expected public-invoice to return 200."
  }

  # B) Payment intent creation (public-pay)
  $payBody = @{ token = $ids.invoice_token; tenant_id = $TenantId; method = 'card'; run_id = "$runId-pay1" } | ConvertTo-Json
  # Local-only bypass: avoids needing real Stripe keys while still exercising idempotency + DB write paths.
  $payHeaders = @{ 'x-test-pay' = '1' }
  $payOut = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-pay" -AnonKey $anon -Headers $payHeaders -BodyJson $payBody
  $payText = $payOut -join "`n"
  Set-Content -Path (Join-Path $chainDir 'public-pay.http.txt') -Encoding UTF8 -Value (Redact-Text $payText)
  if ($payText -notmatch 'HTTP/1\.1 200') {
    $status = ($payText | Select-String -Pattern 'HTTP/1\.[01]\s+(\d{3})' | Select-Object -First 1).Matches.Groups[1].Value
    $body = Extract-JsonBody -CurlOutput $payOut
    $err = $null
    try { if ($body) { $err = ($body | ConvertFrom-Json) } } catch { $err = $null }
    $errMsg = if ($err -and $err.error) { [string]$err.error } else { 'unknown_error' }
    $blocked = if ($err -and ($err.PSObject.Properties.Name -contains 'blocked')) { [string]$err.blocked } else { '' }

    if ($payText -match 'STRIPE_SECRET_KEY' -or $errMsg -match 'STRIPE_SECRET_KEY') {
      Fail "public-pay failed ($status). Likely missing local STRIPE_SECRET_KEY. Fix: `supabase secrets set STRIPE_SECRET_KEY=...` then restart local."
    }
    $suffix = if ($blocked) { "(blocked=$blocked)" } else { "" }
    Fail ("public-pay failed ($status): $errMsg $suffix")
  }

  $payJson = Extract-JsonBody -CurlOutput $payOut
  if (-not $payJson) { throw "Could not parse public-pay JSON body." }
  $pay = $payJson | ConvertFrom-Json
  $providerId = $null
  if ($pay.PSObject.Properties.Name -contains 'provider_payment_id') { $providerId = $pay.provider_payment_id }
  if (-not $providerId -and ($pay.PSObject.Properties.Name -contains 'payment_intent_id')) { $providerId = $pay.payment_intent_id }
  if (-not $providerId) { throw "Expected provider_payment_id (or payment_intent_id legacy) from public-pay." }
  $ids.payment_intent_id = [string]$providerId

  Write-Host "payment_intent_id=$(Mask $ids.payment_intent_id)"

  # C) Stripe webhook simulation (test bypass)
  $eventId = "evt_test_$($runId)_1"
  $event = @{
    id = $eventId
    type = 'payment_intent.succeeded'
    created = [int][double]::Parse((Get-Date -UFormat %s))
    livemode = $false
    data = @{
      object = @{
        id = $ids.payment_intent_id
        amount_received = 10000
        currency = 'usd'
        metadata = @{
          invoice_id = $ids.invoice_id
        }
      }
    }
  } | ConvertTo-Json -Depth 10

  $hookHeaders = @{ 'x-test-webhook' = '1' }
  $hook1 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/stripe-webhook" -AnonKey $anon -Headers $hookHeaders -BodyJson $event
  $hook1Text = $hook1 -join "`n"
  Set-Content -Path (Join-Path $chainDir 'stripe-webhook.http.txt') -Encoding UTF8 -Value (Redact-Text $hook1Text)
  if ($hook1Text -notmatch 'HTTP/1\.[01]\s+200') {
    $status = ($hook1Text | Select-String -Pattern 'HTTP/1\.[01]\s+(\d{3})' | Select-Object -First 1).Matches.Groups[1].Value
    $body = Extract-JsonBody -CurlOutput $hook1
    $err = $null
    try { if ($body) { $err = ($body | ConvertFrom-Json) } } catch { $err = $null }
    $errMsg = if ($err -and $err.error) { [string]$err.error } else { 'unknown_error' }
    $details = if ($err -and ($err.PSObject.Properties.Name -contains 'details')) { [string]$err.details } else { '' }
    Fail ("stripe-webhook failed ($status): $errMsg" + $(if ($details) { " -- $details" } else { "" }))
  }

  $hook2 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/stripe-webhook" -AnonKey $anon -Headers $hookHeaders -BodyJson $event
  $hook2Text = $hook2 -join "`n"
  Set-Content -Path (Join-Path $chainDir 'stripe-webhook-replay.http.txt') -Encoding UTF8 -Value (Redact-Text $hook2Text)
  if ($hook2Text -notmatch 'HTTP/1\.[01]\s+200') {
    Fail "stripe-webhook replay failed (non-200)."
  }

  Write-Host "`n=== DB ASSERTIONS ==="
  $invOut = docker exec $dbContainer psql -U postgres -d postgres -c "select id,status,paid_at,amount_paid,balance_due,provider_payment_id,provider_payment_status,is_test_data from public.invoices where id='$($ids.invoice_id)'::uuid;"
  $invOut | Write-Host
  Set-Content -Path (Join-Path $chainDir 'db_invoice.txt') -Encoding UTF8 -Value $invOut

  $txCount = docker exec $dbContainer psql -U postgres -d postgres -At -c "select count(*) from public.transactions where invoice_id='$($ids.invoice_id)'::uuid;"
  Write-Host "transactions_count=$($txCount.Trim())"
  Set-Content -Path (Join-Path $chainDir 'db_transactions_count.txt') -Encoding UTF8 -Value $txCount
  if ([int]$txCount.Trim() -lt 1) { throw "Expected at least one transaction row for invoice after webhook." }
  if ([int]$txCount.Trim() -gt 1) { throw "Expected idempotent webhook processing; got >1 transaction row." }

  $paid = docker exec $dbContainer psql -U postgres -d postgres -At -c "select (lower(status)='paid') from public.invoices where id='$($ids.invoice_id)'::uuid;"
  if ($paid.Trim().ToLower() -ne 't') { throw "Expected invoice status to be paid after webhook." }

  $eventCount = docker exec $dbContainer psql -U postgres -d postgres -At -c "select count(*) from public.stripe_webhook_events where event_id='$eventId';"
  Write-Host "stripe_webhook_events_count=$($eventCount.Trim())"
  Set-Content -Path (Join-Path $chainDir 'db_stripe_webhook_events_count.txt') -Encoding UTF8 -Value $eventCount

  Write-Host "`nOK: RVH-P0-A revenue chain (local) completed." -ForegroundColor Green
  Write-Host "Artifacts: $baseDir" -ForegroundColor Green
} finally {
  # Restore payments_mode
  if ($prevMode) {
    Set-PaymentsMode -DbContainer $dbContainer -TenantId $TenantId -Mode $prevMode
  } else {
    docker exec $dbContainer psql -U postgres -d postgres -c "delete from public.global_config where key='payments_mode';" | Out-Null
  }

  if ($prevTestMode) {
    $hasTenantId = Test-GlobalConfigTenantId -DbContainer $dbContainer
    if ($hasTenantId) {
      docker exec $dbContainer psql -U postgres -d postgres -c "insert into public.global_config (tenant_id,key,value,updated_at) values ('$TenantId','test_mode','$prevTestMode',now()) on conflict (key) do update set tenant_id=excluded.tenant_id, value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
    } else {
      docker exec $dbContainer psql -U postgres -d postgres -c "insert into public.global_config (key,value,updated_at) values ('test_mode','$prevTestMode',now()) on conflict (key) do update set value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
    }
  } else {
    docker exec $dbContainer psql -U postgres -d postgres -c "delete from public.global_config where key='test_mode';" | Out-Null
  }

  if ($BestEffortCleanup -and $ids.invoice_id) {
    Write-Host "`nCleanup (best-effort)..." -ForegroundColor Yellow
    $cleanupTemplate = @'
do $$
begin
  delete from public.public_events where invoice_id='__INVOICE_ID__'::uuid or quote_id='__QUOTE_ID__'::uuid;
  delete from public.events where entity_id in ('__INVOICE_ID__'::uuid,'__QUOTE_ID__'::uuid);
  delete from public.crm_tasks where source_id in ('__INVOICE_ID__'::uuid,'__QUOTE_ID__'::uuid);
  delete from public.transactions where invoice_id='__INVOICE_ID__'::uuid;
  delete from public.stripe_webhook_events where event_id like 'evt_test___RUN_ID__%';
  delete from public.invoices where id='__INVOICE_ID__'::uuid;
  delete from public.jobs where quote_id='__QUOTE_ID__'::uuid;
  delete from public.quotes where id='__QUOTE_ID__'::uuid;
  delete from public.leads where id='__LEAD_ID__'::uuid;
  delete from public.contacts where id='__CONTACT_ID__'::uuid;
  delete from public.properties where id='__PROPERTY_ID__'::uuid;
exception when others then
  -- ignore cleanup errors
  null;
end $$;
'@
    $cleanupSql = $cleanupTemplate.
      Replace('__INVOICE_ID__', $ids.invoice_id).
      Replace('__QUOTE_ID__', $ids.quote_id).
      Replace('__LEAD_ID__', $ids.lead_id).
      Replace('__CONTACT_ID__', $ids.contact_id).
      Replace('__PROPERTY_ID__', $ids.property_id).
      Replace('__RUN_ID__', $runId)

    docker exec $dbContainer psql -U postgres -d postgres -c $cleanupSql 2>$null | Out-Null
  }
}
