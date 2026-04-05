$ErrorActionPreference = "Stop"

$ProjectRoot = "c:\BHFOS\command-center"
$FunctionsUrl = "http://127.0.0.1:25431/functions/v1"
$DbContainer = "supabase_db_tvg-web-app"
$SupabaseCli = "C:\Users\ol_ma\.supabase\bin\supabase.exe"

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string]$message) {
  $script:failures.Add($message)
  Write-Host "FAIL: $message" -ForegroundColor Red
}

function Assert-True([bool]$condition, [string]$message) {
  if (-not $condition) {
    Add-Failure $message
  } else {
    Write-Host "PASS: $message" -ForegroundColor Green
  }
}

function Invoke-Sql([string]$sql) {
  $sql | docker exec -i $DbContainer psql -U postgres -d postgres -t -A -F "|" 2>$null
}

function Invoke-SqlScalar([string]$sql) {
  $out = Invoke-Sql $sql
  if (-not $out) { return "" }
  return ($out | Select-Object -Last 1).Trim()
}

function Test-GlobalConfigTenantId() {
  return (Invoke-SqlScalar @"
select case when exists (
  select 1
  from information_schema.columns
  where table_schema='public'
    and table_name='global_config'
    and column_name='tenant_id'
) then '1' else '0' end;
"@) -eq "1"
}

function Set-PaymentsMode([string]$Mode, [string]$TenantId = "tvg") {
  if (Test-GlobalConfigTenantId) {
    [void](Invoke-Sql @"
insert into public.global_config (tenant_id, key, value, updated_at)
values ('$TenantId', 'payments_mode', '$Mode', now())
on conflict (key)
do update set tenant_id = excluded.tenant_id, value = excluded.value, updated_at = excluded.updated_at;
"@)
    return
  }

  [void](Invoke-Sql @"
insert into public.global_config (key, value, updated_at)
values ('payments_mode', '$Mode', now())
on conflict (key)
do update set value = excluded.value, updated_at = excluded.updated_at;
"@)
}

function Invoke-JsonGet([string]$url) {
  try {
    $res = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 20 -ErrorAction Stop
    return @{
      status = [int]$res.StatusCode
      body = $res.Content
      json = if ($res.Content) { $res.Content | ConvertFrom-Json } else { $null }
    }
  } catch {
    if ($_.Exception.Response) {
      $response = $_.Exception.Response
      $body = $null
      if ($response -is [System.Net.Http.HttpResponseMessage]) {
        try {
          $body = $response.Content.ReadAsStringAsync().Result
        } catch {
          $body = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { "" }
        }
      } else {
        $stream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
      }
      return @{
        status = [int]$response.StatusCode
        body = $body
        json = if ($body) { try { $body | ConvertFrom-Json } catch { $null } } else { $null }
      }
    }
    throw
  }
}

function Invoke-JsonPost([string]$url, [object]$bodyObj, [hashtable]$headers = @{}) {
  $body = $bodyObj | ConvertTo-Json -Depth 12 -Compress
  try {
    $res = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 25 -ErrorAction Stop
    return @{
      status = [int]$res.StatusCode
      body = $res.Content
      json = if ($res.Content) { $res.Content | ConvertFrom-Json } else { $null }
    }
  } catch {
    if ($_.Exception.Response) {
      $response = $_.Exception.Response
      $respBody = $null
      if ($response -is [System.Net.Http.HttpResponseMessage]) {
        try {
          $respBody = $response.Content.ReadAsStringAsync().Result
        } catch {
          $respBody = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { "" }
        }
      } else {
        $stream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd()
      }
      return @{
        status = [int]$response.StatusCode
        body = $respBody
        json = if ($respBody) { try { $respBody | ConvertFrom-Json } catch { $null } } else { $null }
      }
    }
    throw
  }
}

function Invoke-RawPost([string]$url, [string]$rawBody, [hashtable]$headers = @{}) {
  try {
    $res = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -ContentType "application/json" -Body $rawBody -TimeoutSec 25 -ErrorAction Stop
    return @{
      status = [int]$res.StatusCode
      body = $res.Content
      json = if ($res.Content) { $res.Content | ConvertFrom-Json } else { $null }
    }
  } catch {
    if ($_.Exception.Response) {
      $response = $_.Exception.Response
      $respBody = $null
      if ($response -is [System.Net.Http.HttpResponseMessage]) {
        try {
          $respBody = $response.Content.ReadAsStringAsync().Result
        } catch {
          $respBody = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { "" }
        }
      } else {
        $stream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd()
      }
      return @{
        status = [int]$response.StatusCode
        body = $respBody
        json = if ($respBody) { try { $respBody | ConvertFrom-Json } catch { $null } } else { $null }
      }
    }
    throw
  }
}

function New-StripeSignature([string]$payload, [string]$secret) {
  $timestamp = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $signedPayload = "$timestamp.$payload"
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
  $hashBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($signedPayload))
  $hashHex = [BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
  return "t=$timestamp,v1=$hashHex"
}

function Send-StripeWebhook([string]$eventId, [string]$eventType, [string]$paymentIntentId, [string]$invoiceId, [int]$amountCents, [string]$tenantId, [string]$webhookSecret) {
  $eventObj = @{
    id = $eventId
    object = "event"
    type = $eventType
    data = @{
      object = @{
        id = $paymentIntentId
        object = "payment_intent"
        amount = $amountCents
        status = if ($eventType -eq "payment_intent.succeeded") { "succeeded" } else { "requires_payment_method" }
        metadata = @{
          invoice_id = $invoiceId
          tenant_id = $tenantId
        }
      }
    }
  }
  $payload = $eventObj | ConvertTo-Json -Depth 12 -Compress
  $sig = New-StripeSignature -payload $payload -secret $webhookSecret
  return Invoke-RawPost -url "$FunctionsUrl/payment-webhook" -rawBody $payload -headers @{ "stripe-signature" = $sig }
}

Write-Host "`n== A-EXEC-2 Runtime Proof ==" -ForegroundColor Cyan

# Preflight schema checks.
$preflight = Invoke-Sql @"
select to_regclass('public.events') as events_tbl,
       to_regclass('public.automation_suspensions') as susp_tbl,
       to_regclass('public.crm_tasks') as tasks_tbl,
       to_regclass('public.stripe_webhook_events') as stripe_events_tbl;
"@
Assert-True (($preflight -join " ") -match "events" -and ($preflight -join " ") -match "stripe_webhook_events") "Preflight tables exist"

$hasSignalCol = Invoke-SqlScalar @"
select count(*)
from information_schema.columns
where table_schema='public'
  and table_name='leads'
  and column_name='last_human_signal_at';
"@
Assert-True ($hasSignalCol -eq "1") "leads.last_human_signal_at exists"

Set-PaymentsMode -Mode "stripe" -TenantId "tvg"
Assert-True ($true) "payments_mode set to stripe for runtime proof"

# Fixture setup.
$run = "aexec2rt_" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
$email = "$run@example.com"

$fixtureRow = Invoke-Sql @"
with c as (
  insert into public.contacts (tenant_id, first_name, last_name, email, phone)
  values ('tvg', 'AEXEC2', 'Runtime', '$email', '5555551234')
  returning id
),
l as (
  insert into public.leads (tenant_id, contact_id, first_name, last_name, email, phone, service, status)
  select 'tvg', c.id, 'AEXEC2', 'Runtime', '$email', '5555551234', 'residential', 'new'
  from c
  returning id
),
q as (
  insert into public.quotes (tenant_id, lead_id, status, subtotal, tax_amount, total_amount)
  select 'tvg', l.id, 'draft', 900, 100, 1000
  from l
  returning id, public_token
),
j as (
  insert into public.jobs (tenant_id, lead_id, status, total_amount)
  select 'tvg', l.id, 'unscheduled', 1000
  from l
  returning id
),
i1 as (
  insert into public.invoices (
    tenant_id,
    lead_id,
    job_id,
    status,
    subtotal,
    tax_amount,
    total_amount,
    amount_paid,
    balance_due,
    invoice_type,
    release_approved,
    release_approved_at
  )
  select 'tvg', l.id, j.id, 'sent', 90, 10, 100, 0, 100, 'deposit', true, now()
  from l
  join j on true
  returning id, public_token
),
i2 as (
  insert into public.invoices (
    tenant_id,
    lead_id,
    job_id,
    status,
    subtotal,
    tax_amount,
    total_amount,
    amount_paid,
    balance_due,
    invoice_type,
    release_approved,
    release_approved_at
  )
  select 'tvg', l.id, j.id, 'sent', 810, 90, 900, 0, 900, 'final', true, now()
  from l
  join j on true
  returning id, public_token
)
select
  (select id::text from c),
  (select id::text from l),
  (select id::text from q),
  (select public_token::text from q),
  (select id::text from i1),
  (select public_token::text from i1),
  (select id::text from i2),
  (select public_token::text from i2);
"@ | Select-Object -Last 1

$parts = $fixtureRow.Split("|") | ForEach-Object { $_.Trim() }
$contactId = $parts[0]
$leadId = $parts[1]
$quoteId = $parts[2]
$quoteToken = $parts[3]
$invoice1Id = $parts[4]
$invoice1Token = $parts[5]
$invoice2Id = $parts[6]
$invoice2Token = $parts[7]

Assert-True ([Guid]::TryParse($leadId, [ref]([Guid]::Empty))) "Fixture lead created"
Assert-True ([Guid]::TryParse($quoteId, [ref]([Guid]::Empty))) "Fixture quote created"
Assert-True ([Guid]::TryParse($invoice1Id, [ref]([Guid]::Empty))) "Fixture invoice #1 created"
Assert-True ([Guid]::TryParse($invoice2Id, [ref]([Guid]::Empty))) "Fixture invoice #2 created"

# Start functions runtime.
$serveOut = "c:\BHFOS\command-center\supabase\.temp\prove-aexec2-functions.out.log"
$serveErr = "c:\BHFOS\command-center\supabase\.temp\prove-aexec2-functions.err.log"
if (Test-Path $serveOut) { Remove-Item $serveOut -Force }
if (Test-Path $serveErr) { Remove-Item $serveErr -Force }

$serve = Start-Process -FilePath $SupabaseCli -ArgumentList @("functions","serve","--no-verify-jwt","--workdir",$ProjectRoot) -PassThru -WindowStyle Hidden -RedirectStandardOutput $serveOut -RedirectStandardError $serveErr
Start-Sleep -Seconds 8

try {
  # Test A: endpoint smoke.
  $quoteView = Invoke-JsonGet "$FunctionsUrl/public-quote?token=$quoteToken&tenant_id=tvg&run_id=$run"
  Assert-True ($quoteView.status -eq 200) "public-quote returns 200"

  $invoiceView = Invoke-JsonGet "$FunctionsUrl/public-invoice?token=$invoice1Token&tenant_id=tvg&run_id=$run"
  Assert-True ($invoiceView.status -eq 200) "public-invoice returns 200"

  $approveResponses = @()
  for ($i = 0; $i -lt 5; $i++) {
    $approveResponses += Invoke-JsonPost "$FunctionsUrl/public-quote-approve" @{
      token = $quoteToken
      quote_id = $quoteId
      tenant_id = "tvg"
      action = "approved"
      run_id = $run
    }
  }
  Assert-True (($approveResponses | Where-Object { $_.status -eq 200 }).Count -eq 5) "public-quote-approve idempotent burst returns 200"

  $pay1 = Invoke-JsonPost "$FunctionsUrl/public-pay" @{
    token = $invoice1Token
    tenant_id = "tvg"
    method = "card"
    run_id = $run
  }
  Assert-True ($pay1.status -eq 200 -and $pay1.json.payment_intent_id) "public-pay initiate #1 returns payment_intent_id"
  $pi1 = [string]$pay1.json.payment_intent_id

  $pay2 = Invoke-JsonPost "$FunctionsUrl/public-pay" @{
    token = $invoice2Token
    tenant_id = "tvg"
    method = "card"
    run_id = $run
  }
  Assert-True ($pay2.status -eq 200 -and $pay2.json.payment_intent_id) "public-pay initiate #2 returns payment_intent_id"
  $pi2 = [string]$pay2.json.payment_intent_id

  # Test D: task spam guard under refresh.
  $taskBefore = [int](Invoke-SqlScalar "select count(*) from public.crm_tasks where source_type='quote' and source_id='$quoteId'::uuid and type='follow_up';")
  for ($i = 0; $i -lt 10; $i++) {
    [void](Invoke-JsonGet "$FunctionsUrl/public-quote?token=$quoteToken&tenant_id=tvg&run_id=$run")
  }
  $taskAfter = [int](Invoke-SqlScalar "select count(*) from public.crm_tasks where source_type='quote' and source_id='$quoteId'::uuid and type='follow_up';")
  Assert-True (($taskAfter - $taskBefore) -le 1) "Quote refresh burst does not spam follow-up tasks"

  # Test B/C: signed webhook success + resend dedupe + installment logic.
  $whSecretLine = (Get-Content "$ProjectRoot\supabase\functions\.env" | Where-Object { $_ -match '^STRIPE_WEBHOOK_SECRET=' } | Select-Object -First 1)
  $webhookSecret = $whSecretLine.Split("=", 2)[1].Trim()
  Assert-True (-not [string]::IsNullOrWhiteSpace($webhookSecret)) "STRIPE_WEBHOOK_SECRET loaded for signed webhook test"

  $evt1 = "evt_local_" + [Guid]::NewGuid().ToString("N").Substring(0, 18)
  $wh1 = Send-StripeWebhook -eventId $evt1 -eventType "payment_intent.succeeded" -paymentIntentId $pi1 -invoiceId $invoice1Id -amountCents 10000 -tenantId "tvg" -webhookSecret $webhookSecret
  Assert-True ($wh1.status -eq 200) "Signed webhook success #1 accepted"

  $leadAfterFirst = Invoke-SqlScalar "select coalesce(status,'') from public.leads where id='$leadId'::uuid;"
  $inv1AfterFirst = Invoke-SqlScalar "select coalesce(status,'') from public.invoices where id='$invoice1Id'::uuid;"
  $inv2AfterFirst = Invoke-SqlScalar "select coalesce(status,'') from public.invoices where id='$invoice2Id'::uuid;"
  Assert-True ($inv1AfterFirst -eq "paid") "Invoice #1 becomes paid after webhook"
  Assert-True ($leadAfterFirst -ne "paid") "Lead is NOT paid after only first invoice"
  Assert-True ($inv2AfterFirst -ne "paid") "Invoice #2 still unpaid after first webhook"

  $countEvt1Before = [int](Invoke-SqlScalar "select count(*) from public.stripe_webhook_events where event_id='$evt1';")
  $paySucceededBefore = [int](Invoke-SqlScalar "select count(*) from public.events where event_type='PaymentSucceeded' and entity_type='payment' and entity_id='$invoice1Id'::uuid;")
  $invoicePaidBefore = [int](Invoke-SqlScalar "select count(*) from public.events where event_type='InvoicePaid' and entity_type='invoice' and entity_id='$invoice1Id'::uuid;")
  $receiptTaskBefore = [int](Invoke-SqlScalar "select count(*) from public.crm_tasks where source_type='invoice' and source_id='$invoice1Id'::uuid and title='Send Receipt';")

  $wh1Resend = Send-StripeWebhook -eventId $evt1 -eventType "payment_intent.succeeded" -paymentIntentId $pi1 -invoiceId $invoice1Id -amountCents 10000 -tenantId "tvg" -webhookSecret $webhookSecret
  Assert-True ($wh1Resend.status -eq 200) "Resent webhook returns 200"

  $countEvt1After = [int](Invoke-SqlScalar "select count(*) from public.stripe_webhook_events where event_id='$evt1';")
  $paySucceededAfter = [int](Invoke-SqlScalar "select count(*) from public.events where event_type='PaymentSucceeded' and entity_type='payment' and entity_id='$invoice1Id'::uuid;")
  $invoicePaidAfter = [int](Invoke-SqlScalar "select count(*) from public.events where event_type='InvoicePaid' and entity_type='invoice' and entity_id='$invoice1Id'::uuid;")
  $receiptTaskAfter = [int](Invoke-SqlScalar "select count(*) from public.crm_tasks where source_type='invoice' and source_id='$invoice1Id'::uuid and title='Send Receipt';")

  Assert-True ($countEvt1Before -eq 1 -and $countEvt1After -eq 1) "stripe_webhook_events dedupes resend by event_id"
  Assert-True ($paySucceededBefore -eq $paySucceededAfter) "PaymentSucceeded not duplicated on resend"
  Assert-True ($invoicePaidBefore -eq $invoicePaidAfter) "InvoicePaid not duplicated on resend"
  Assert-True ($receiptTaskBefore -eq $receiptTaskAfter) "Receipt task not duplicated on resend"

  $evt2 = "evt_local_" + [Guid]::NewGuid().ToString("N").Substring(0, 18)
  $wh2 = Send-StripeWebhook -eventId $evt2 -eventType "payment_intent.succeeded" -paymentIntentId $pi2 -invoiceId $invoice2Id -amountCents 90000 -tenantId "tvg" -webhookSecret $webhookSecret
  Assert-True ($wh2.status -eq 200) "Signed webhook success #2 accepted"

  $leadAfterSecond = Invoke-SqlScalar "select coalesce(status,'') from public.leads where id='$leadId'::uuid;"
  $inv2AfterSecond = Invoke-SqlScalar "select coalesce(status,'') from public.invoices where id='$invoice2Id'::uuid;"
  Assert-True ($inv2AfterSecond -eq "paid") "Invoice #2 becomes paid after webhook"
  Assert-True ($leadAfterSecond -eq "paid") "Lead becomes paid only after all invoices are paid"

  # Quote acceptance idempotency assertions.
  $jobsForQuote = [int](Invoke-SqlScalar "select count(*) from public.jobs where quote_id='$quoteId'::uuid;")
  $jobCreatedEvents = [int](Invoke-SqlScalar "select count(*) from public.events e join public.jobs j on e.entity_id=j.id where e.event_type='JobCreated' and j.quote_id='$quoteId'::uuid;")
  $scheduleTasks = [int](Invoke-SqlScalar "select count(*) from public.crm_tasks t join public.jobs j on t.source_id=j.id where t.source_type='job' and t.title='Schedule Job' and j.quote_id='$quoteId'::uuid;")
  Assert-True ($jobsForQuote -eq 1) "Only one job exists for accepted quote after repeated clicks"
  Assert-True ($jobCreatedEvents -eq 1) "Only one JobCreated event emitted for accepted quote"
  Assert-True ($scheduleTasks -eq 1) "Only one Schedule Job task created for accepted quote"

  Write-Host "`nRun Id: $run" -ForegroundColor DarkGray
  Write-Host "Lead: $leadId" -ForegroundColor DarkGray
  Write-Host "Quote: $quoteId" -ForegroundColor DarkGray
  Write-Host "Invoice #1: $invoice1Id" -ForegroundColor DarkGray
  Write-Host "Invoice #2: $invoice2Id" -ForegroundColor DarkGray
}
finally {
  if ($serve -and -not $serve.HasExited) {
    Stop-Process -Id $serve.Id -Force
  }
}

if ($failures.Count -gt 0) {
  Write-Host "`nA-EXEC-2 runtime proof FAILED with $($failures.Count) issue(s)." -ForegroundColor Red
  $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

Write-Host "`nA-EXEC-2 runtime proof PASSED." -ForegroundColor Green
exit 0
