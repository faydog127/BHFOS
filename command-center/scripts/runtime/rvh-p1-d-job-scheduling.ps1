param(
  [string]$TenantId = 'tvg',
  [string]$Environment = 'local',
  [switch]$SkipStart,
  [switch]$SupabaseDebug,
  [switch]$BestEffortCleanup
)

$ErrorActionPreference = 'Stop'

function Fail([string]$Message, [int]$ExitCode = 1) {
  Write-Host $Message -ForegroundColor Red
  exit $ExitCode
}

function New-RunId {
  $short = [Guid]::NewGuid().ToString('N').Substring(0, 6)
  return "rvh_p1-d_$(Get-Date -Format 'yyyyMMdd_HHmmss')_$short"
}

function Mask([string]$Value) {
  if (-not $Value) { return '' }
  if ($Value.Length -le 8) { return '********' }
  return ($Value.Substring(0, 4) + '…' + $Value.Substring($Value.Length - 4))
}

function Redact-Text([string]$Text) {
  if (-not $Text) { return '' }
  $t = $Text
  $t = $t -replace '(Authorization:\s*Bearer)\s+[^\s\r\n]+', '$1 [REDACTED]'
  $t = $t -replace '(apikey:\s*)[^\s\r\n]+', '$1[REDACTED]'
  $t = $t -replace '\beyJ[a-zA-Z0-9_\-\.]+\b', '[REDACTED_JWT]'
  return $t
}

function Resolve-SupabaseCli {
  $cmd = Get-Command supabase -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  $candidate = Join-Path $env:USERPROFILE '.supabase\\bin\\supabase.exe'
  if (Test-Path $candidate) { return $candidate }
  Fail "Supabase CLI not found (expected at $candidate)." 2
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

function Base64UrlEncode([byte[]]$Bytes) {
  $b64 = [Convert]::ToBase64String($Bytes)
  return $b64.TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-HS256Jwt {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Claims,
    [Parameter(Mandatory = $true)][string]$Secret
  )

  $headerJson = (@{ alg = 'HS256'; typ = 'JWT' } | ConvertTo-Json -Compress)
  $payloadJson = ($Claims | ConvertTo-Json -Compress -Depth 6)
  $header = Base64UrlEncode ([Text.Encoding]::UTF8.GetBytes($headerJson))
  $payload = Base64UrlEncode ([Text.Encoding]::UTF8.GetBytes($payloadJson))
  $unsigned = "$header.$payload"
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
  $sigBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned))
  $sig = Base64UrlEncode $sigBytes
  return "$unsigned.$sig"
}

function Invoke-Edge {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [string]$BearerJwt,
    [hashtable]$Headers = @{},
    [string]$BodyJson
  )

  $args = @('-s', '-i', '-X', $Method, $Url, '-H', "apikey: $ApiKey")
  if ($BearerJwt) {
    $args += @('-H', "Authorization: Bearer $BearerJwt")
  } else {
    $args += @('-H', "Authorization: Bearer $ApiKey")
  }

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

function Extract-FirstUuid {
  param([string[]]$Lines)
  foreach ($line in $Lines) {
    $t = ([string]$line).Trim()
    if ($t -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
      return $t
    }
  }
  return $null
}

if ($Environment -ne 'local') {
  Fail "RVH-P1-D only supports Environment=local right now (no staging exists; prod is read-only)." 2
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$date = Get-Date -Format 'yyyy-MM-dd'
$runId = New-RunId
$baseDir = Join-Path $repoRoot ("tmp\\runtime\\$date\\$Environment\\$runId")
$chainDir = Join-Path $baseDir 'chainD'
New-Item -ItemType Directory -Force -Path $chainDir | Out-Null

@{
  run_id = $runId
  environment = $Environment
  chain = 'RVH-P1-D'
  tenant_id = $TenantId
  started_at = (Get-Date).ToString('o')
} | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $baseDir 'run.json') -Encoding UTF8

Set-Content -Path (Join-Path $baseDir 'artifacts_index.md') -Encoding UTF8 -Value @"
# RVH Artifacts Index
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Environment: $Environment
Run ID: $runId

- run.json -- run metadata (no secrets)
- preflight.log -- environment safety gate result
- chainD/public-quote-approve.http.txt -- quote approval response (redacted)
- chainD/work-order-update-missing-tech.http.txt -- scheduling patch missing technician (redacted)
- chainD/work-order-update.http.txt -- scheduling patch response (redacted)
- chainD/work-order-update-v1-fields.http.txt -- v1 fields patch response (redacted)
- chainD/db_job_before.txt -- DB evidence: job before scheduling
- chainD/db_job_after.txt -- DB evidence: job after scheduling
- chainD/db_appointment_after.txt -- DB evidence: appointment mirror after scheduling
- chainD/db_job_v1_fields.csv.txt -- DB evidence: v1 fields persisted
- chainD/db_operational_state_after.txt -- dispatch projection after scheduling
"@

# ----------------
# Preflight
# ----------------
$preflightLog = Join-Path $baseDir 'preflight.log'
try {
  $pf = & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'assert-env-safe.ps1') -Environment local 2>&1 | Out-String
  Set-Content -Path $preflightLog -Encoding UTF8 -Value (Redact-Text $pf)
  if ($LASTEXITCODE -ne 0) { Fail "Preflight failed. See: $preflightLog" 2 }
} catch {
  Set-Content -Path $preflightLog -Encoding UTF8 -Value (Redact-Text ($_.Exception.Message))
  Fail "Preflight failed. See: $preflightLog" 2
}

# ----------------
# Resolve local supabase env + containers
# ----------------
$supabase = Resolve-SupabaseCli
$workdir = (Resolve-Path $repoRoot).Path

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
$apiUrl = $envMap['API_URL']
$functionsUrl = $envMap['FUNCTIONS_URL']
if (-not $functionsUrl -and $apiUrl) {
  $functionsUrl = ($apiUrl.TrimEnd('/') + '/functions/v1')
}
if (-not $anon -or -not $apiUrl -or -not $functionsUrl) {
  Fail "Could not read ANON_KEY / API_URL / FUNCTIONS_URL from supabase status -o env." 2
}

$configPath = Join-Path $workdir 'supabase\\config.toml'
$projectId = Get-ProjectIdFromConfig -ConfigPath $configPath
$dbContainer = Get-DbContainerName -ProjectId $projectId

Write-Host "RVH-P1-D Job Scheduling (LOCAL) — Work Order Update"
Write-Host "Run ID:        $runId"
Write-Host "API URL:       $apiUrl"
Write-Host "Functions URL: $functionsUrl"
Write-Host "DB container:  $dbContainer"

# Ensure global_config.test_mode is enabled (local-only bypasses depend on it).
$hasTenantId = (docker exec $dbContainer psql -U postgres -d postgres -At -c "select case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='global_config' and column_name='tenant_id') then '1' else '0' end;" | Select-Object -Last 1).Trim() -eq '1'
if ($hasTenantId) {
  docker exec $dbContainer psql -U postgres -d postgres -c "insert into public.global_config (tenant_id,key,value,updated_at) values ('$TenantId','test_mode','1',now()) on conflict (key) do update set tenant_id=excluded.tenant_id, value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
} else {
  docker exec $dbContainer psql -U postgres -d postgres -c "insert into public.global_config (key,value,updated_at) values ('test_mode','1',now()) on conflict (key) do update set value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
}

# ----------------
# Seed: quote + lead + job via quote approval path
# ----------------
$quoteNumber = "RVH-SCHED-" + (Get-Date -Format 'yyyyMMddHHmmss')
$seedSql = @"
WITH ins_property AS (
  INSERT INTO public.properties (tenant_id, address1, city, state, zip)
  VALUES ('$TenantId', '333 Job Schedule Rd', 'Testville', 'TX', '00000')
  RETURNING id
),
ins_contact AS (
  INSERT INTO public.contacts (tenant_id, first_name, last_name, email, phone)
  VALUES ('$TenantId', 'Job', 'Scheduler', concat('rvh-job+', extract(epoch from now())::bigint, '@example.com'), '555-3333')
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
    status,
    created_at,
    updated_at
  )
  SELECT
    '$TenantId',
    ins_contact.id,
    ins_property.id,
    'Job',
    'Scheduler',
    concat('rvh-job+', extract(epoch from now())::bigint, '@example.com'),
    '555-3333',
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
    updated_at,
    sent_at,
    service_address
  )
  SELECT
    '$TenantId',
    ins_lead.id,
    '$quoteNumber',
    'sent',
    100,
    0,
    0,
    100,
    current_date + 7,
    'RVH schedule quote',
    'Thanks',
    now(),
    now(),
    now(),
    '333 Job Schedule Rd, Testville, TX, 00000'
  FROM ins_lead
  RETURNING id, public_token, lead_id
)
SELECT
  (SELECT id FROM ins_quote) AS quote_id,
  (SELECT public_token FROM ins_quote) AS quote_token,
  (SELECT lead_id FROM ins_quote) AS lead_id,
  (SELECT id FROM ins_property) AS property_id,
  (SELECT id FROM ins_contact) AS contact_id;
"@

$seedCsv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c $seedSql
$seedCsv = ($seedCsv | Select-Object -Last 1)
if (-not $seedCsv -or -not $seedCsv.Trim()) { Fail "Seed failed." 1 }
$seedParts = $seedCsv.Trim().Split(',')
if ($seedParts.Count -ne 5) { Fail "Unexpected seed output (expected 5 csv fields)." 1 }
$quoteId = $seedParts[0]
$quoteToken = $seedParts[1]
$leadId = $seedParts[2]
$propertyId = $seedParts[3]
$contactId = $seedParts[4]

$approveBody = @{ token = $quoteToken; tenant_id = $TenantId; action = 'approved'; run_id = "$runId-qa1" } | ConvertTo-Json
$approveOut = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-quote-approve" -ApiKey $anon -BodyJson $approveBody
$approveText = Redact-Text ($approveOut -join "`n")
Set-Content -Path (Join-Path $chainDir 'public-quote-approve.http.txt') -Encoding UTF8 -Value $approveText
if (($approveOut -join "`n") -notmatch 'HTTP/1\.[01]\s+200') {
  Fail "FAIL: public-quote-approve returned non-200. See: $chainDir\\public-quote-approve.http.txt" 1
}

$jobId = docker exec $dbContainer psql -U postgres -d postgres -At -c "select id from public.jobs where quote_id='$quoteId'::uuid order by created_at desc limit 1;"
$jobId = ($jobId | Select-Object -Last 1).Trim()
if (-not $jobId) { Fail "FAIL: job not created for quote. quote_id=$quoteId" 1 }

$jobBefore = docker exec $dbContainer psql -U postgres -d postgres -c "select id,status,scheduled_start,scheduled_end,technician_id,service_address,work_order_number from public.jobs where id='$jobId'::uuid;"
Set-Content -Path (Join-Path $chainDir 'db_job_before.txt') -Encoding UTF8 -Value $jobBefore

# ----------------
# Seed technician + schedule via work-order-update (requires JWT with tenant claim)
# ----------------
$techOut = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c "insert into public.technicians (user_id, full_name, phone, email, is_active, is_primary_default) values (gen_random_uuid(),'RVH Tech','555-4444',concat('rvh-tech+', extract(epoch from now())::bigint, '@example.com'),true,true) returning id, user_id;"
$techCsv = ($techOut | Where-Object { $_ -match '^[0-9a-fA-F-]{36},[0-9a-fA-F-]{36}$' } | Select-Object -First 1).Trim()
if (-not $techCsv) { Fail "FAIL: could not create technician." 1 }
$techParts = $techCsv.Split(',')
if ($techParts.Count -lt 2) { Fail "FAIL: unexpected technician seed output. output=$techCsv" 1 }
$techRowId = $techParts[0].Trim()
$techUserId = $techParts[1].Trim()
if (-not $techRowId -or -not $techUserId) { Fail "FAIL: technician seed returned empty ids. output=$techCsv" 1 }

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$claims = @{
  iss = ($apiUrl.TrimEnd('/') + '/auth/v1')
  aud = 'authenticated'
  role = 'authenticated'
  sub = ([Guid]::NewGuid().ToString())
  iat = $now
  exp = $now + 3600
  app_metadata = @{ tenant_id = $TenantId }
}
$jwtSecret = 'super-secret-jwt-token-with-at-least-32-characters-long'
$jwt = New-HS256Jwt -Claims $claims -Secret $jwtSecret

$scheduledStart = (Get-Date).AddHours(30).ToUniversalTime().ToString('o')
$scheduledEnd = (Get-Date).AddHours(32).ToUniversalTime().ToString('o')

$serviceAddress = docker exec $dbContainer psql -U postgres -d postgres -At -c "select coalesce(service_address,'') from public.jobs where id='$jobId'::uuid;"
$serviceAddress = ($serviceAddress | Select-Object -Last 1).Trim()
if (-not $serviceAddress) { $serviceAddress = '111 Dispatch Way, Testville, TX, 00000' }

# Negative proof: scheduling without technician must be rejected (Packet 009 invariant)
$patchMissingTechBody = @{
  tenant_id = $TenantId
  job_id = $jobId
  patch = @{
    status = 'scheduled'
    scheduled_start = $scheduledStart
    scheduled_end = $scheduledEnd
    service_address = $serviceAddress
  }
} | ConvertTo-Json -Depth 6

$woOutMissingTech = Invoke-Edge -Method 'POST' -Url "$functionsUrl/work-order-update" -ApiKey $anon -BearerJwt $jwt -BodyJson $patchMissingTechBody
$woTextMissingTech = Redact-Text ($woOutMissingTech -join "`n")
Set-Content -Path (Join-Path $chainDir 'work-order-update-missing-tech.http.txt') -Encoding UTF8 -Value $woTextMissingTech
$woMissingTextRaw = ($woOutMissingTech -join "`n")
if ($woMissingTextRaw -notmatch 'HTTP/1\.[01]\s+400') {
  Fail "FAIL: expected work-order-update missing-tech to return 400. See: $chainDir\\work-order-update-missing-tech.http.txt" 1
}
if ($woMissingTextRaw -notmatch 'Technician') {
  Fail "FAIL: expected missing-tech error to mention Technician. See: $chainDir\\work-order-update-missing-tech.http.txt" 1
}

$patchBody = @{
  tenant_id = $TenantId
  job_id = $jobId
  patch = @{
    status = 'scheduled'
    technician_id = $techUserId
    scheduled_start = $scheduledStart
    scheduled_end = $scheduledEnd
  }
} | ConvertTo-Json -Depth 6

$woOut = Invoke-Edge -Method 'POST' -Url "$functionsUrl/work-order-update" -ApiKey $anon -BearerJwt $jwt -BodyJson $patchBody
$woText = Redact-Text ($woOut -join "`n")
Set-Content -Path (Join-Path $chainDir 'work-order-update.http.txt') -Encoding UTF8 -Value $woText
if (($woOut -join "`n") -notmatch 'HTTP/1\.[01]\s+200') {
  Fail "FAIL: work-order-update returned non-200. See: $chainDir\\work-order-update.http.txt" 1
}

$jobAfter = docker exec $dbContainer psql -U postgres -d postgres -c "select id,status,scheduled_start,scheduled_end,technician_id,service_address,work_order_number from public.jobs where id='$jobId'::uuid;"
Set-Content -Path (Join-Path $chainDir 'db_job_after.txt') -Encoding UTF8 -Value $jobAfter

$apptAfter = docker exec $dbContainer psql -U postgres -d postgres -c "select id,job_id,tenant_id,scheduled_start,scheduled_end,technician_id,status,service_address from public.appointments where job_id='$jobId'::uuid;"
Set-Content -Path (Join-Path $chainDir 'db_appointment_after.txt') -Encoding UTF8 -Value $apptAfter
$apptTech = docker exec $dbContainer psql -U postgres -d postgres -At -c "select technician_id from public.appointments where job_id='$jobId'::uuid limit 1;"
$apptTech = ($apptTech | Select-Object -Last 1).Trim()
if (-not $apptTech) { Fail "FAIL: expected appointment mirror row for job_id=$jobId" 1 }
if ($apptTech -ne $techUserId) { Fail "FAIL: appointment mirror technician_id mismatch. expected=$techUserId got=$apptTech" 1 }

$status = docker exec $dbContainer psql -U postgres -d postgres -At -c "select lower(coalesce(status,'')) from public.jobs where id='$jobId'::uuid;"
$status = ($status | Select-Object -Last 1).Trim()
if ($status -ne 'scheduled') {
  Fail "FAIL: expected job.status=scheduled, got '$status' (job_id=$jobId)" 1
}

$woNum = docker exec $dbContainer psql -U postgres -d postgres -At -c "select coalesce(work_order_number,'') from public.jobs where id='$jobId'::uuid;"
$woNum = ($woNum | Select-Object -Last 1).Trim()
if (-not $woNum) { Fail "FAIL: expected jobs.work_order_number to be set (job_id=$jobId)" 1 }
if ($woNum -notmatch '^WO-\d{4}-\d{4}$') { Fail "FAIL: unexpected work_order_number format. got='$woNum' job_id=$jobId" 1 }

$opAfter = docker exec $dbContainer psql -U postgres -d postgres -c "select id,operational_stage,next_action_label,is_overdue,overdue_reason from public.job_operational_state_v1 where id='$jobId'::uuid;"
Set-Content -Path (Join-Path $chainDir 'db_operational_state_after.txt') -Encoding UTF8 -Value $opAfter

# ----------------
# Work Order v1 field write proof (Packet 006)
# ----------------
$patch2Body = @{
  tenant_id = $TenantId
  job_id = $jobId
  patch = @{
    scope_summary = "RVH Scope Summary $runId"
    special_conditions = "RVH Special Conditions $runId"
    property_notes = "RVH Property Notes $runId"
    follow_up_required = $true
    follow_up_notes = "RVH Follow-up Notes $runId"
    execution_checklist = @(
      @{ id = 'chk-1'; label = 'Arrive on site'; done = $true },
      @{ id = 'chk-2'; label = 'Photo before'; done = $false }
    )
    execution_findings = @(
      @{ kind = 'note'; text = "Finding $runId" }
    )
    execution_photos = @(
      @{ kind = 'before'; ref = "drive://before/$runId" },
      @{ kind = 'after'; ref = "drive://after/$runId" }
    )
    customer_summary = "RVH Customer Summary $runId"
    report_url = "https://example.com/report/$runId"
  }
} | ConvertTo-Json -Depth 10

$woOut2 = Invoke-Edge -Method 'POST' -Url "$functionsUrl/work-order-update" -ApiKey $anon -BearerJwt $jwt -BodyJson $patch2Body
$woText2 = Redact-Text ($woOut2 -join "`n")
Set-Content -Path (Join-Path $chainDir 'work-order-update-v1-fields.http.txt') -Encoding UTF8 -Value $woText2
if (($woOut2 -join "`n") -notmatch 'HTTP/1\.[01]\s+200') {
  Fail "FAIL: work-order-update (v1 fields) returned non-200. See: $chainDir\\work-order-update-v1-fields.http.txt" 1
}

$v1Csv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c "select coalesce(scope_summary,''), follow_up_required::text, coalesce(follow_up_notes,''), jsonb_array_length(execution_checklist) from public.jobs where id='$jobId'::uuid;"
$v1Csv = ($v1Csv | Where-Object { $_ -match ',' } | Select-Object -Last 1).Trim()
Set-Content -Path (Join-Path $chainDir 'db_job_v1_fields.csv.txt') -Encoding UTF8 -Value $v1Csv
if (-not $v1Csv) { Fail "FAIL: could not read v1 fields back from DB for job_id=$jobId" 1 }
$v1Parts = $v1Csv.Split(',')
if ($v1Parts.Count -lt 4) { Fail "FAIL: unexpected v1 fields csv output. output=$v1Csv" 1 }
if ($v1Parts[0] -notmatch "RVH Scope Summary") { Fail "FAIL: scope_summary did not persist. output=$v1Csv" 1 }
if ($v1Parts[1].Trim().ToLower() -ne 'true') { Fail "FAIL: follow_up_required did not persist. output=$v1Csv" 1 }
if ($v1Parts[3].Trim() -ne '2') { Fail "FAIL: execution_checklist length unexpected (expected 2). output=$v1Csv" 1 }

Write-Host "OK: job scheduled via work-order-update."
Write-Host "job_id=$jobId technician_user_id=$techUserId technician_row_id=$techRowId scheduled_start=$scheduledStart"

if ($BestEffortCleanup) {
  Write-Host "Cleanup (best-effort)..." -ForegroundColor Yellow
  $cleanupTemplate = @'
do $$
begin
  delete from public.crm_tasks where source_type='job' and source_id='__JOB_ID__'::uuid;
  delete from public.appointments where job_id='__JOB_ID__'::uuid;
  delete from public.jobs where id='__JOB_ID__'::uuid;
  delete from public.quotes where id='__QUOTE_ID__'::uuid;
  delete from public.leads where id='__LEAD_ID__'::uuid;
  delete from public.contacts where id='__CONTACT_ID__'::uuid;
  delete from public.properties where id='__PROPERTY_ID__'::uuid;
  delete from public.technicians where id='__TECH_ID__'::uuid;
exception when others then
  null;
end $$;
'@
  $cleanupSql = $cleanupTemplate.
    Replace('__JOB_ID__', $jobId).
    Replace('__QUOTE_ID__', $quoteId).
    Replace('__LEAD_ID__', $leadId).
    Replace('__CONTACT_ID__', $contactId).
    Replace('__PROPERTY_ID__', $propertyId).
    Replace('__TECH_ID__', $techRowId)
  docker exec $dbContainer psql -U postgres -d postgres -c $cleanupSql 2>$null | Out-Null
}

Write-Host "Artifacts: $baseDir" -ForegroundColor Green
exit 0
