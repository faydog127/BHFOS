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
  return "rvh_p1-b_$(Get-Date -Format 'yyyyMMdd_HHmmss')_$short"
}

function Mask([string]$Value) {
  if (-not $Value) { return '' }
  if ($Value.Length -le 8) { return '********' }
  return ($Value.Substring(0, 4) + '…' + $Value.Substring($Value.Length - 4))
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

if ($Environment -ne 'local') {
  Fail "RVH-P1-B only supports Environment=local right now (no staging exists; prod is read-only)." 2
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$date = Get-Date -Format 'yyyy-MM-dd'
$runId = New-RunId
$baseDir = Join-Path $repoRoot ("tmp\\runtime\\$date\\$Environment\\$runId")
$chainDir = Join-Path $baseDir 'chainB'
New-Item -ItemType Directory -Force -Path $chainDir | Out-Null

@{
  run_id = $runId
  environment = $Environment
  chain = 'RVH-P1-B'
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
- chainB/public-quote.http.txt -- public quote view response (redacted)
- chainB/public-quote-approve.http.txt -- approval response (redacted)
- chainB/db_jobs.txt -- DB evidence: jobs row(s) for quote
- chainB/db_job_operational_state.txt -- DB evidence: dispatch projection for job
- chainB/db_tasks.txt -- DB evidence: schedule task creation (if any)
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
$functionsUrl = $envMap['FUNCTIONS_URL']
if (-not $functionsUrl -and $envMap['API_URL']) {
  $functionsUrl = ($envMap['API_URL'].TrimEnd('/') + '/functions/v1')
}
if (-not $anon -or -not $functionsUrl) {
  Fail "Could not read ANON_KEY/FUNCTIONS_URL from supabase status -o env." 2
}

$configPath = Join-Path $workdir 'supabase\\config.toml'
$projectId = Get-ProjectIdFromConfig -ConfigPath $configPath
$dbContainer = Get-DbContainerName -ProjectId $projectId

# Ensure global_config.test_mode is enabled (public-pay/webhook local bypasses depend on it).
$hasTenantId = (docker exec $dbContainer psql -U postgres -d postgres -At -c "select case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='global_config' and column_name='tenant_id') then '1' else '0' end;" | Select-Object -Last 1).Trim() -eq '1'
if ($hasTenantId) {
  docker exec $dbContainer psql -U postgres -d postgres -c "insert into public.global_config (tenant_id,key,value,updated_at) values ('$TenantId','test_mode','1',now()) on conflict (key) do update set tenant_id=excluded.tenant_id, value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
} else {
  docker exec $dbContainer psql -U postgres -d postgres -c "insert into public.global_config (key,value,updated_at) values ('test_mode','1',now()) on conflict (key) do update set value=excluded.value, updated_at=excluded.updated_at;" | Out-Null
}

Write-Host "RVH-P1-B Quote → Job → Dispatch (LOCAL)"
Write-Host "Run ID:        $runId"
Write-Host "Functions URL: $functionsUrl"
Write-Host "DB container:  $dbContainer"

# ----------------
# Seed fixtures
# ----------------
$quoteNumber = "RVH-QJD-$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
$seedSql = @"
WITH ins_property AS (
  INSERT INTO public.properties (tenant_id, address1, city, state, zip)
  VALUES ('$TenantId', '111 Dispatch Way', 'Testville', 'TX', '00000')
  RETURNING id
),
ins_contact AS (
  INSERT INTO public.contacts (tenant_id, first_name, last_name, email, phone)
  VALUES ('$TenantId', 'RVH', 'Dispatch', concat('rvh-dispatch+', extract(epoch from now())::bigint, '@example.com'), '555-3333')
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
    'Dispatch',
    'rvh-dispatch@test.local',
    '555-3333',
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
    updated_at,
    sent_at
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
    'RVH dispatch quote',
    'Thanks',
    now(),
    now(),
    now()
  FROM ins_lead
  RETURNING id, public_token, lead_id
)
SELECT
  (SELECT id FROM ins_quote) AS quote_id,
  (SELECT public_token FROM ins_quote) AS quote_token,
  (SELECT lead_id FROM ins_quote) AS lead_id;
"@

$seedCsv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c $seedSql
$seedParts = $seedCsv.Trim().Split(',')
if ($seedParts.Count -ne 3) { Fail "Unexpected seed output (expected quote_id, quote_token, lead_id)." 1 }
$quoteId = $seedParts[0]
$quoteToken = $seedParts[1]
$leadId = $seedParts[2]

Write-Host "Seeded quote_id=$quoteId token=$(Mask $quoteToken)"

# ----------------
# Runtime calls
# ----------------
$publicQuote = Invoke-Edge -Method 'GET' -Url "$functionsUrl/public-quote?token=$quoteToken&tenant_id=$TenantId&run_id=$runId-qv1" -AnonKey $anon
$publicQuoteText = Redact-Text ($publicQuote -join "`n")
Set-Content -Path (Join-Path $chainDir 'public-quote.http.txt') -Encoding UTF8 -Value $publicQuoteText

$approveBody = @{ token = $quoteToken; tenant_id = $TenantId; action = 'approved'; run_id = "$runId-qa1" } | ConvertTo-Json
$approve = Invoke-Edge -Method 'POST' -Url "$functionsUrl/public-quote-approve" -AnonKey $anon -BodyJson $approveBody
$approveText = Redact-Text ($approve -join "`n")
Set-Content -Path (Join-Path $chainDir 'public-quote-approve.http.txt') -Encoding UTF8 -Value $approveText

$approveJoined = $approve -join "`n"
if ($approveJoined -notmatch 'HTTP/1\.[01]\s+200') {
  Fail "FAIL: public-quote-approve returned non-200. See: $chainDir\\public-quote-approve.http.txt" 1
}

# ----------------
# DB assertions (Job + dispatch projection)
# ----------------
$jobsOut = docker exec $dbContainer psql -U postgres -d postgres -c "select id,tenant_id,quote_id,lead_id,status,work_order_number,service_address,payment_status,total_amount,created_at,updated_at from public.jobs where quote_id='$quoteId'::uuid order by created_at desc;"
Set-Content -Path (Join-Path $chainDir 'db_jobs.txt') -Encoding UTF8 -Value $jobsOut

$jobId = docker exec $dbContainer psql -U postgres -d postgres -At -c "select id from public.jobs where quote_id='$quoteId'::uuid order by created_at desc limit 1;"
$jobId = ($jobId | Select-Object -Last 1).Trim()
if (-not $jobId) {
  Fail "FAIL: quote approval did not create a job for quote_id=$quoteId. See: $chainDir\\db_jobs.txt" 1
}

$jobStatus = docker exec $dbContainer psql -U postgres -d postgres -At -c "select lower(coalesce(status,'')) from public.jobs where id='$jobId'::uuid;"
$jobStatus = ($jobStatus | Select-Object -Last 1).Trim()
if ($jobStatus -ne 'unscheduled') {
  Fail "FAIL: job.status expected 'unscheduled' but got '$jobStatus'. job_id=$jobId" 1
}

$opOut = docker exec $dbContainer psql -U postgres -d postgres -c "select id,work_order_number,service_address,operational_stage,is_overdue,overdue_reason,next_action_label from public.job_operational_state_v1 where id='$jobId'::uuid;"
Set-Content -Path (Join-Path $chainDir 'db_job_operational_state.txt') -Encoding UTF8 -Value $opOut

$opStage = docker exec $dbContainer psql -U postgres -d postgres -At -c "select lower(coalesce(operational_stage,'')) from public.job_operational_state_v1 where id='$jobId'::uuid;"
$opStage = ($opStage | Select-Object -Last 1).Trim()
if ($opStage -and $opStage -ne 'unscheduled') {
  Fail "FAIL: dispatch operational_stage expected 'unscheduled' but got '$opStage'. job_id=$jobId" 1
}

$taskOut = docker exec $dbContainer psql -U postgres -d postgres -c "select id,title,status,source_type,source_id,created_at from public.crm_tasks where source_type='job' and source_id='$jobId'::uuid order by created_at desc limit 25;"
Set-Content -Path (Join-Path $chainDir 'db_tasks.txt') -Encoding UTF8 -Value $taskOut

$svc = docker exec $dbContainer psql -U postgres -d postgres -At -c "select coalesce(service_address,'') from public.jobs where id='$jobId'::uuid;"
$svc = ($svc | Select-Object -Last 1).Trim()
if (-not $svc) {
  Fail "FAIL: job.service_address is empty (dispatch blocker). job_id=$jobId" 1
}

$wo = docker exec $dbContainer psql -U postgres -d postgres -At -c "select coalesce(work_order_number,'') from public.jobs where id='$jobId'::uuid;"
$wo = ($wo | Select-Object -Last 1).Trim()
if (-not $wo) {
  Fail "FAIL: job.work_order_number is empty (dispatch traceability gap). job_id=$jobId" 1
}

Write-Host "OK: job created and dispatch projection exists."
Write-Host "job_id=$jobId work_order_number=$wo"

if ($BestEffortCleanup) {
  Write-Host "Cleanup (best-effort)..." -ForegroundColor Yellow
  $cleanupTemplate = @'
do $$
begin
  delete from public.crm_tasks where source_type='job' and source_id='__JOB_ID__'::uuid;
  delete from public.jobs where id='__JOB_ID__'::uuid;
  delete from public.quotes where id='__QUOTE_ID__'::uuid;
  delete from public.leads where id='__LEAD_ID__'::uuid;
exception when others then
  null;
end $$;
'@
  $cleanupSql = $cleanupTemplate.Replace('__JOB_ID__', $jobId).Replace('__QUOTE_ID__', $quoteId).Replace('__LEAD_ID__', $leadId)
  docker exec $dbContainer psql -U postgres -d postgres -c $cleanupSql 2>$null | Out-Null
}

Write-Host "Artifacts: $baseDir" -ForegroundColor Green
exit 0
