# A-EXEC-2 Verification Test Runner
# Run from command-center directory

$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:25431/functions/v1"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$verificationDir = Join-Path $scriptDir "verification"

Write-Host "`n=== A-EXEC-2 Stop Gate A-2 Verification ===" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# Check if Supabase is running
try {
    $healthCheck = docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -c "SELECT 1 as ok;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Supabase DB not accessible. Start local Supabase first." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Supabase DB accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to connect to Supabase: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n--- Step 1: Setup Test Data ---" -ForegroundColor Yellow

# Get or create test lead/quote/invoice
$setupSql = @"
-- Get existing test data or show what's needed
SELECT 
    l.id as lead_id,
    l.contact_id,
    l.status as lead_status,
    q.id as quote_id,
    q.public_token as quote_token,
    q.status as quote_status,
    i.id as invoice_id,
    i.public_token as invoice_token,
    i.status as invoice_status,
    i.balance_due
FROM leads l
LEFT JOIN quotes q ON q.lead_id = l.id
LEFT JOIN invoices i ON i.lead_id = l.id
WHERE l.tenant_id = 'tvg'
ORDER BY l.created_at DESC
LIMIT 1;
"@

Write-Host "Checking for existing test data..." -ForegroundColor Gray
$testDataRaw = docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -t -c $setupSql 2>&1

if ($testDataRaw -match "(\S+)\s+\|\s+(\S+)\s+\|\s+\w+\s+\|\s+(\S+)\s+\|\s+(\S+)") {
    $leadId = $matches[1]
    $contactId = $matches[2]
    $quoteId = $matches[3]
    $quoteToken = $matches[4]
    
    Write-Host "✅ Found test data:" -ForegroundColor Green
    Write-Host "  Lead ID: $leadId" -ForegroundColor Gray
    Write-Host "  Quote ID: $quoteId" -ForegroundColor Gray
    Write-Host "  Quote Token: $quoteToken" -ForegroundColor Gray
} else {
    Write-Host "⚠️  No complete test data found. Please create:" -ForegroundColor Yellow
    Write-Host "  1. A lead with contact_id" -ForegroundColor Gray
    Write-Host "  2. A quote linked to that lead with public_token" -ForegroundColor Gray
    Write-Host "  3. An invoice linked to that lead with public_token" -ForegroundColor Gray
    Write-Host "`nRun this SQL to create test data:" -ForegroundColor Yellow
    Write-Host @"
-- In Supabase Studio or psql
INSERT INTO contacts (tenant_id, email, phone, first_name, last_name)
VALUES ('tvg', 'test@example.com', '5555551234', 'Test', 'Customer')
RETURNING id;

-- Use contact_id from above
INSERT INTO leads (tenant_id, contact_id, status, first_name, last_name, email, phone, service)
VALUES ('tvg', '<contact_id>'::uuid, 'NEW', 'Test', 'Customer', 'test@example.com', '5555551234', 'residential')
RETURNING id;

-- Use lead_id from above
INSERT INTO quotes (tenant_id, lead_id, status, total_amount, public_token)
VALUES ('tvg', '<lead_id>'::uuid, 'DRAFT', 1000.00, gen_random_uuid()::text)
RETURNING id, public_token;

INSERT INTO invoices (tenant_id, lead_id, status, total_amount, balance_due, public_token)
VALUES ('tvg', '<lead_id>'::uuid, 'DRAFT', 1000.00, 1000.00, gen_random_uuid()::text)
RETURNING id, public_token;
"@ -ForegroundColor Gray
    exit 1
}

Write-Host "`n--- Step 2: Clear Previous Events/Suspensions ---" -ForegroundColor Yellow
$cleanupSql = @"
DELETE FROM automation_suspensions WHERE entity_id IN ('$leadId'::uuid, '$quoteId'::uuid);
DELETE FROM events WHERE entity_id IN ('$leadId'::uuid, '$quoteId'::uuid);
UPDATE leads SET last_human_signal_at = NULL WHERE id = '$leadId'::uuid;
"@
docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -c $cleanupSql 2>&1 | Out-Null
Write-Host "✅ Cleaned up previous test data" -ForegroundColor Green

Write-Host "`n--- Scenario 1: Quote View Flow ---" -ForegroundColor Yellow

# Call public-quote endpoint
try {
    $quoteViewResponse = Invoke-WebRequest -Uri "$baseUrl/public-quote?token=$quoteToken&tenant_id=tvg" -Method GET -ErrorAction Stop
    Write-Host "✅ Quote view endpoint: $($quoteViewResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Quote view failed: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Verify events
$verifyEventsSql = @"
SELECT event_type, entity_type, actor_type, 
       payload->>'signal_type' as signal_type,
       payload->>'source' as source
FROM events 
WHERE entity_id IN ('$quoteId'::uuid, '$leadId'::uuid)
  AND event_type IN ('QuoteViewed', 'HumanSignalReceived', 'AutomationSuspended', 'TaskCreated')
ORDER BY created_at DESC;
"@

Write-Host "`nEvents emitted:" -ForegroundColor Gray
docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -c $verifyEventsSql

# Verify suspensions
$verifySuspensionsSql = @"
SELECT entity_type, reason, resumed_at IS NULL as active
FROM automation_suspensions
WHERE entity_id IN ('$quoteId'::uuid, '$leadId'::uuid)
ORDER BY suspended_at DESC;
"@

Write-Host "`nSuspensions created:" -ForegroundColor Gray
docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -c $verifySuspensionsSql

# Verify lead timestamp
$verifyTimestampSql = "SELECT id, last_human_signal_at FROM leads WHERE id = '$leadId'::uuid;"
Write-Host "`nLead timestamp:" -ForegroundColor Gray
docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -c $verifyTimestampSql

Write-Host "`n--- Scenario 1 Checklist ---" -ForegroundColor Yellow
Write-Host "Manually verify above output:" -ForegroundColor Gray
Write-Host "  ☐ QuoteViewed event present" -ForegroundColor Gray
Write-Host "  ☐ HumanSignalReceived with signal_type='quote_view', source='public_link'" -ForegroundColor Gray
Write-Host "  ☐ AutomationSuspended event (should be 2: one for quote, one for lead)" -ForegroundColor Gray
Write-Host "  ☐ TaskCreated event" -ForegroundColor Gray
Write-Host "  ☐ Actor type = 'external_customer' for HumanSignalReceived" -ForegroundColor Gray
Write-Host "  ☐ 2 active suspensions (quote-level, lead-level)" -ForegroundColor Gray
Write-Host "  ☐ last_human_signal_at is populated" -ForegroundColor Gray

Write-Host "`n--- Idempotency Test: View Quote Again ---" -ForegroundColor Yellow
try {
    $quoteView2 = Invoke-WebRequest -Uri "$baseUrl/public-quote?token=$quoteToken&tenant_id=tvg" -Method GET -ErrorAction Stop
    Write-Host "✅ Second view: $($quoteView2.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Second view failed: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

$countEventsSql = @"
SELECT event_type, COUNT(*) as count
FROM events 
WHERE entity_id IN ('$quoteId'::uuid, '$leadId'::uuid)
  AND event_type IN ('QuoteViewed', 'AutomationSuspended')
GROUP BY event_type;
"@

Write-Host "`nEvent counts (AutomationSuspended should still be 2, not 4):" -ForegroundColor Gray
docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -c $countEventsSql

Write-Host "`n--- Next Steps ---" -ForegroundColor Cyan
Write-Host "1. Review output above and check off items" -ForegroundColor Gray
Write-Host "2. Continue with Scenario 2 (Quote Accept) manually if needed" -ForegroundColor Gray
Write-Host "3. Test webhook scenarios using Stripe CLI:" -ForegroundColor Gray
Write-Host "   stripe listen --forward-to http://localhost:25431/functions/v1/payment-webhook" -ForegroundColor Gray
Write-Host "4. Document results in docs/verification/a-exec-2.md" -ForegroundColor Gray

Write-Host "`n=== Verification Script Complete ===" -ForegroundColor Cyan
