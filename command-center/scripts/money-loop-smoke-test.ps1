param(
  [string]$TenantId = 'tvg',
  [string]$RunPrefix = 'smoke',
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
      $val = $parts[1]
      $val = $val.Trim()
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

function Test-GlobalConfigTenantId {
  param([string]$DbContainer)

  $result = docker exec $DbContainer psql -U postgres -d postgres -At -c "select case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='global_config' and column_name='tenant_id') then '1' else '0' end;"
  return ($result | Select-Object -Last 1).Trim() -eq '1'
}

function Get-PaymentsModeUpsertSql {
  param(
    [string]$TenantId,
    [string]$Mode,
    [bool]$HasTenantId
  )

  if ($HasTenantId) {
    return "INSERT INTO public.global_config (tenant_id, key, value, updated_at) VALUES ('$TenantId', 'payments_mode', '$Mode', now()) ON CONFLICT (key) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, value = EXCLUDED.value, updated_at = EXCLUDED.updated_at RETURNING 1"
  }

  return "INSERT INTO public.global_config (key, value, updated_at) VALUES ('payments_mode', '$Mode', now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at RETURNING 1"
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

$globalConfigHasTenantId = Test-GlobalConfigTenantId -DbContainer $dbContainer
$paymentsModeUpsertSql = Get-PaymentsModeUpsertSql -TenantId $TenantId -Mode 'mock' -HasTenantId:$globalConfigHasTenantId

$seedSql = @"
WITH upsert_payments_mode AS (
  $paymentsModeUpsertSql
),
ins_property AS (
    INSERT INTO public.properties (tenant_id, address1, city, state, zip)
    VALUES ('$TenantId', '123 Smoke Test St', 'Testville', 'TX', '00000')
    RETURNING id
  ),
ins_contact AS (
  INSERT INTO public.contacts (tenant_id, first_name, last_name, email, phone)
  VALUES (
    '$TenantId',
    'Smoke',
    'Test',
    concat('smoke+', extract(epoch from now())::bigint, '@example.com'),
    '555-0000'
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
    'Smoke',
    'Test',
    'smoke@test.local',
    '555-0000',
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
    'SMOKE-QUOTE-1',
    'sent',
    100,
    0,
    0,
    100,
    current_date + 7,
    'Smoke quote',
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
  (SELECT id FROM ins_contact) AS contact_id,
  (SELECT id FROM ins_lead) AS lead_id,
  (SELECT id FROM ins_quote) AS quote_id,
  (SELECT public_token FROM ins_quote) AS quote_token
FROM upsert_payments_mode;
"@

$seedCsv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c $seedSql
$seedParts = $seedCsv.Trim().Split(',')
if ($seedParts.Count -ne 4) {
  throw "Unexpected seed output: $seedCsv"
}

$contactId = $seedParts[0]
$leadId = $seedParts[1]
$quoteId = $seedParts[2]
$quoteToken = $seedParts[3]
$invoiceId = $null
$invoiceToken = $null

Write-Host "Seeded quote_id=$quoteId token=$quoteToken"

Write-Host "`n=== CALLS ==="

# A) Quote view (twice)
$quoteView1 = Invoke-Edge -Method 'GET' -Url "$functionsUrl/public-quote?token=$quoteToken&tenant_id=$TenantId&run_id=$runId-qv1" -AnonKey $anon
$quoteView2 = Invoke-Edge -Method 'GET' -Url "$functionsUrl/public-quote?token=$quoteToken&tenant_id=$TenantId&run_id=$runId-qv2" -AnonKey $anon

# B) Quote approve ACCEPT (twice)
$approveBody1 = @{ token = $quoteToken; tenant_id = $TenantId; action = 'accept'; run_id = "$runId-qa1" } | ConvertTo-Json
$approveBody2 = @{ token = $quoteToken; tenant_id = $TenantId; action = 'accept'; run_id = "$runId-qa2" } | ConvertTo-Json
$quoteApprove1 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-quote-approve" -AnonKey $anon -BodyJson $approveBody1
$quoteApprove2 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-quote-approve" -AnonKey $anon -BodyJson $approveBody2

# C) Seed invoice after quote approval using the linked work order required by guardrails.
$jobId = docker exec $dbContainer psql -U postgres -d postgres -At -c "select id from public.jobs where quote_id='$quoteId'::uuid order by created_at desc limit 1;"
if (-not $jobId) { throw "Expected a job for quote_id=$quoteId before invoice seed, but none found." }

$invoiceSeedSql = @"
WITH ins_invoice AS (
  INSERT INTO public.invoices (
    tenant_id,
    lead_id,
    quote_id,
    job_id,
    invoice_number,
    status,
    subtotal,
    tax_rate,
    tax_amount,
    total_amount,
    amount_paid,
    balance_due,
    due_date,
    invoice_type,
    release_approved,
    release_approved_at,
    created_at,
    updated_at
  )
  VALUES (
    '$TenantId',
    '$leadId'::uuid,
    '$quoteId'::uuid,
    '$jobId'::uuid,
    concat('SMOKE-INV-', extract(epoch from now())::bigint),
    'sent',
    100,
    0,
    0,
    100,
    0,
    100,
    current_date + 7,
    'final',
    true,
    now(),
    now(),
    now()
  )
  RETURNING id, public_token
),
ins_invoice_item AS (
  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, total_price)
  SELECT ins_invoice.id, 'Invoice item', 1, 100, 100 FROM ins_invoice
  RETURNING id
)
SELECT
  (SELECT id FROM ins_invoice) AS invoice_id,
  (SELECT public_token FROM ins_invoice) AS invoice_token;
"@

$invoiceSeedCsv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c $invoiceSeedSql
$invoiceSeedParts = $invoiceSeedCsv.Trim().Split(',')
if ($invoiceSeedParts.Count -ne 2) {
  throw "Unexpected invoice seed output: $invoiceSeedCsv"
}

$invoiceId = $invoiceSeedParts[0]
$invoiceToken = $invoiceSeedParts[1]

Write-Host "Seeded invoice_id=$invoiceId token=$invoiceToken"

# D) Invoice view
$invoiceView = Invoke-Edge -Method 'GET' -Url "$functionsUrl/public-invoice?token=$invoiceToken&tenant_id=$TenantId&run_id=$runId-iv1" -AnonKey $anon

# E) Payment attempt (may be BLOCKED if RPC missing)
$payBody1 = @{ token = $invoiceToken; tenant_id = $TenantId; amount = 100; method = 'card'; run_id = "$runId-pay1" } | ConvertTo-Json
$payBody2 = @{ token = $invoiceToken; tenant_id = $TenantId; amount = 100; method = 'card'; run_id = "$runId-pay2" } | ConvertTo-Json
$payment1 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-pay" -AnonKey $anon -BodyJson $payBody1
$payment2 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-pay" -AnonKey $anon -BodyJson $payBody2

Write-Host "`n(public-quote #1)`n$quoteView1"
Write-Host "`n(public-quote #2)`n$quoteView2"
Write-Host "`n(public-quote-approve #1)`n$quoteApprove1"
Write-Host "`n(public-quote-approve #2)`n$quoteApprove2"
Write-Host "`n(public-invoice)`n$invoiceView"
Write-Host "`n(public-pay #1)`n$payment1"
Write-Host "`n(public-pay #2)`n$payment2"

$payment1Text = $payment1 -join "`n"
if ($payment1Text -notmatch 'HTTP/1\.1 200') {
  throw "Expected public-pay #1 to return 200. Got:`n$payment1Text"
}

Write-Host "`n=== EVIDENCE (DB) ==="

Write-Host "`n--- job_id (for quote_id) ---"
if (-not $jobId) { throw "Expected a job for quote_id=$quoteId but none found." }
Write-Host $jobId

Write-Host "`n--- jobs (quote_id) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select id,status,quote_id,lead_id,tenant_id,created_at from public.jobs where quote_id='$quoteId'::uuid;"

Write-Host "`n--- events (quote/invoice/job) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select event_type,entity_type,entity_id,actor_type,created_at from public.events where entity_id in ('$quoteId'::uuid,'$invoiceId'::uuid,'$jobId'::uuid) order by created_at asc;"

Write-Host "`n--- suspensions ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select tenant_id,entity_type,entity_id,reason,suspended_at,resumed_at from public.automation_suspensions where entity_id in ('$quoteId'::uuid,'$invoiceId'::uuid) order by suspended_at asc;"

Write-Host "`n--- tasks ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select title,status,source_type,source_id,tenant_id,created_at from public.crm_tasks where source_id in ('$quoteId'::uuid,'$invoiceId'::uuid,'$jobId'::uuid) order by created_at asc;"

Write-Host "`n--- now_queue (tenant) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select priority,subpriority,item_type,entity_id,lead_id,title,created_at from public.now_queue where tenant_id='$TenantId' order by priority asc, subpriority asc, created_at asc limit 25;"

Write-Host "`n--- invoice (post-pay) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select id,status,paid_at,amount_paid,balance_due,payment_method,tenant_id from public.invoices where id='$invoiceId'::uuid;"

Write-Host "`n--- transactions (invoice_id) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select id,invoice_id,amount,method,status,tenant_id,created_at from public.transactions where invoice_id='$invoiceId'::uuid order by created_at asc;"

Write-Host "`n--- lead (post-pay status) ---"
$leadStatus = docker exec $dbContainer psql -U postgres -d postgres -At -c "select status from public.leads where id='$leadId'::uuid;"
if (-not $leadStatus) { throw "Expected lead status to exist for lead_id=$leadId" }
Write-Host $leadStatus
if ($leadStatus.Trim().ToLower() -ne 'paid') {
  throw "Expected lead status to be 'paid' after payment. Got: $leadStatus"
}

Write-Host "`n--- invoice tasks (should be closed after pay) ---"
$openInvoiceTasks = docker exec $dbContainer psql -U postgres -d postgres -At -c "select count(*) from public.crm_tasks where source_type='invoice' and source_id='$invoiceId'::uuid and status in ('open','new','pending','PENDING','in-progress');"
Write-Host "Open invoice tasks: $openInvoiceTasks"
if ([int]$openInvoiceTasks -gt 0) {
  throw "Expected invoice follow-up tasks to be completed after payment."
}

Write-Host "`n--- receipt event ---"
$receiptEvents = docker exec $dbContainer psql -U postgres -d postgres -At -c "select count(*) from public.events where entity_type='invoice' and entity_id='$invoiceId'::uuid and event_type='ReceiptSent';"
Write-Host "ReceiptSent events: $receiptEvents"
if ([int]$receiptEvents -lt 1) {
  throw "Expected at least one ReceiptSent event for invoice_id=$invoiceId."
}

Write-Host "`n--- contact (post-pay convert) ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select id,is_customer,customer_created_at,manual_convert_reason,tenant_id from public.contacts where id='$contactId'::uuid;"

Write-Host "`n--- public_events ---"
docker exec $dbContainer psql -U postgres -d postgres -c "select kind,status,tenant_id,quote_id,invoice_id,created_at from public.public_events where quote_id='$quoteId'::uuid or invoice_id='$invoiceId'::uuid order by created_at asc;"

Write-Host "`nDONE"
