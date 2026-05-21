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
  return "rvh_p1-c_$(Get-Date -Format 'yyyyMMdd_HHmmss')_$short"
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

function Invoke-Http {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [Parameter(Mandatory = $true)][string]$BearerJwt,
    [hashtable]$Headers = @{},
    [string]$BodyJson
  )

  $args = @('-s', '-i', '-X', $Method, $Url,
    '-H', "Authorization: Bearer $BearerJwt",
    '-H', "apikey: $ApiKey"
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
  Fail "RVH-P1-C only supports Environment=local right now (no staging exists; prod is read-only)." 2
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$date = Get-Date -Format 'yyyy-MM-dd'
$runId = New-RunId
$baseDir = Join-Path $repoRoot ("tmp\\runtime\\$date\\$Environment\\$runId")
$chainDir = Join-Path $baseDir 'chainC'
New-Item -ItemType Directory -Force -Path $chainDir | Out-Null

@{
  run_id = $runId
  environment = $Environment
  chain = 'RVH-P1-C'
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
- chainC/create-appointment.http.txt -- create-appointment response (redacted)
- chainC/appointments-list-1.http.txt -- appointments list (redacted)
- chainC/appointments-list-2.http.txt -- appointments list after reload (redacted)
- chainC/db_appointment.txt -- DB evidence: appointment row
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

$restUrl = ($apiUrl.TrimEnd('/') + '/rest/v1')
$configPath = Join-Path $workdir 'supabase\\config.toml'
$projectId = Get-ProjectIdFromConfig -ConfigPath $configPath
$dbContainer = Get-DbContainerName -ProjectId $projectId

Write-Host "RVH-P1-C Scheduling Chain (LOCAL) — Appointments"
Write-Host "Run ID:        $runId"
Write-Host "API URL:       $apiUrl"
Write-Host "Functions URL: $functionsUrl"
Write-Host "DB container:  $dbContainer"

# ----------------
# Seed lead (customer) for appointment creation
# ----------------
$seedSql = @"
WITH ins_property AS (
  INSERT INTO public.properties (tenant_id, address1, city, state, zip)
  VALUES ('$TenantId', '222 Schedule St', 'Testville', 'TX', '00000')
  RETURNING id
),
ins_contact AS (
  INSERT INTO public.contacts (tenant_id, first_name, last_name, email, phone)
  VALUES ('$TenantId', 'Sched', 'Tester', concat('rvh-sched+', extract(epoch from now())::bigint, '@example.com'), '555-2222')
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
    'Sched',
    'Tester',
    concat('rvh-sched+', extract(epoch from now())::bigint, '@example.com'),
    '555-2222',
    'new',
    now(),
    now()
  FROM ins_contact, ins_property
  RETURNING id
)
SELECT
  (SELECT id FROM ins_property) AS property_id,
  (SELECT id FROM ins_contact) AS contact_id,
  (SELECT id FROM ins_lead) AS lead_id;
"@

$seedCsv = docker exec $dbContainer psql -U postgres -d postgres -At -F"," -c $seedSql
$seedCsv = ($seedCsv | Select-Object -Last 1)
if (-not $seedCsv -or -not $seedCsv.Trim()) {
  Fail "FAIL: seed SQL did not return ids (property, contact, lead). Check local leads schema." 1
}
$seedParts = $seedCsv.Trim().Split(',')
if ($seedParts.Count -ne 3) { Fail "Unexpected seed output (expected property_id, contact_id, lead_id)." 1 }
$propertyId = $seedParts[0]
$contactId = $seedParts[1]
$leadId = $seedParts[2]

# ----------------
# JWT for local edge functions that require Authorization
# ----------------
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

Write-Host "Seeded lead_id=$leadId jwt=$(Mask $jwt)"

# ----------------
# Runtime calls (create appointment → list appointments → reload list)
# ----------------
$scheduledStart = (Get-Date).AddHours(26).ToUniversalTime().ToString('o')
$createBody = @{
  tenant_id = $TenantId
  lead_id = $leadId
  scheduled_start = $scheduledStart
  duration_minutes = 60
  service_name = 'RVH Scheduling Appointment'
  service_address = '222 Schedule St, Testville, TX, 00000'
  customer_notes = "run_id=$runId"
} | ConvertTo-Json

$createOut = Invoke-Http -Method 'POST' -Url "$functionsUrl/create-appointment" -ApiKey $anon -BearerJwt $jwt -BodyJson $createBody
$createText = Redact-Text ($createOut -join "`n")
Set-Content -Path (Join-Path $chainDir 'create-appointment.http.txt') -Encoding UTF8 -Value $createText

if (($createOut -join "`n") -notmatch 'HTTP/1\.[01]\s+200') {
  Fail "FAIL: create-appointment returned non-200. See: $chainDir\\create-appointment.http.txt" 1
}

$createJson = Extract-JsonBody -CurlOutput $createOut
if (-not $createJson) { Fail "FAIL: could not parse create-appointment JSON body." 1 }
$createObj = $createJson | ConvertFrom-Json
$appointmentId = $createObj.appointment.id
if (-not $appointmentId) { Fail "FAIL: create-appointment did not return appointment.id" 1 }

$select = [uri]::EscapeDataString('*,technicians(full_name),leads(id,first_name,last_name,email,phone,company)')
$listUrl = "$restUrl/appointments?select=$select&tenant_id=eq.$TenantId&order=scheduled_start.asc"

$list1 = Invoke-Http -Method 'GET' -Url $listUrl -ApiKey $anon -BearerJwt $jwt
$list1Text = Redact-Text ($list1 -join "`n")
Set-Content -Path (Join-Path $chainDir 'appointments-list-1.http.txt') -Encoding UTF8 -Value $list1Text
if (($list1 -join "`n") -notmatch 'HTTP/1\.[01]\s+200') {
  Fail "FAIL: appointments list returned non-200. See: $chainDir\\appointments-list-1.http.txt" 1
}

Start-Sleep -Milliseconds 250
$list2 = Invoke-Http -Method 'GET' -Url $listUrl -ApiKey $anon -BearerJwt $jwt
$list2Text = Redact-Text ($list2 -join "`n")
Set-Content -Path (Join-Path $chainDir 'appointments-list-2.http.txt') -Encoding UTF8 -Value $list2Text
if (($list2 -join "`n") -notmatch 'HTTP/1\.[01]\s+200') {
  Fail "FAIL: appointments list (reload) returned non-200. See: $chainDir\\appointments-list-2.http.txt" 1
}

$appointmentsJson = Extract-JsonBody -CurlOutput $list2
if (-not $appointmentsJson) { Fail "FAIL: could not parse appointments list JSON body." 1 }
$appointments = $appointmentsJson | ConvertFrom-Json
$found = $false
foreach ($a in $appointments) {
  if ($a.id -eq $appointmentId) { $found = $true; break }
}
if (-not $found) {
  Fail "FAIL: appointment not found in appointments list (calendar reload). appointment_id=$appointmentId" 1
}

# ----------------
# DB assertions
# ----------------
$dbOut = docker exec $dbContainer psql -U postgres -d postgres -c "select id,tenant_id,lead_id,technician_id,service_name,scheduled_start,scheduled_end,status,service_address,created_at,updated_at from public.appointments where id='$appointmentId'::uuid;"
Set-Content -Path (Join-Path $chainDir 'db_appointment.txt') -Encoding UTF8 -Value $dbOut

Write-Host "OK: appointment created and calendar list reload returned it."
Write-Host "appointment_id=$appointmentId scheduled_start=$scheduledStart"

if ($BestEffortCleanup) {
  Write-Host "Cleanup (best-effort)..." -ForegroundColor Yellow
  $cleanupTemplate = @'
do $$
begin
  delete from public.appointments where id='__APPT_ID__'::uuid;
  delete from public.leads where id='__LEAD_ID__'::uuid;
  delete from public.contacts where id='__CONTACT_ID__'::uuid;
  delete from public.properties where id='__PROPERTY_ID__'::uuid;
exception when others then
  null;
end $$;
'@
  $cleanupSql = $cleanupTemplate.
    Replace('__APPT_ID__', $appointmentId).
    Replace('__LEAD_ID__', $leadId).
    Replace('__CONTACT_ID__', $contactId).
    Replace('__PROPERTY_ID__', $propertyId)
  docker exec $dbContainer psql -U postgres -d postgres -c $cleanupSql 2>$null | Out-Null
}

Write-Host "Artifacts: $baseDir" -ForegroundColor Green
exit 0
