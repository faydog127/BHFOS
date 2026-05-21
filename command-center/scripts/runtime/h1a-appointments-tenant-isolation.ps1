param(
  [string]$RunId = "",
  [string]$RunIdIso = "",
  [string]$RunRoot = "",
  [string]$ApiUrl = "http://127.0.0.1:25431",
  [string]$TenantA = "tvg",
  [string]$TenantB = "other-tenant"
)

$ErrorActionPreference = "Stop"

function Read-DotEnvFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )
  $map = @{}
  if (!(Test-Path -LiteralPath $Path)) { return $map }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (!$line) { return }
    if ($line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    if ($key) { $map[$key] = $val }
  }
  return $map
}

function Base64UrlEncodeBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  $b64 = [Convert]::ToBase64String($Bytes)
  return $b64.TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Base64UrlEncodeJson {
  param([Parameter(Mandatory = $true)][object]$Object)
  $json = ($Object | ConvertTo-Json -Compress -Depth 10)
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  return Base64UrlEncodeBytes -Bytes $bytes
}

function New-JwtHs256 {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Payload,
    [Parameter(Mandatory = $true)][string]$Secret
  )
  $header = @{ alg = "HS256"; typ = "JWT" }
  $h = Base64UrlEncodeJson -Object $header
  $p = Base64UrlEncodeJson -Object $Payload
  $data = [Text.Encoding]::UTF8.GetBytes("$h.$p")
  $key = [Text.Encoding]::UTF8.GetBytes($Secret)
  $hmac = [System.Security.Cryptography.HMACSHA256]::new($key)
  $sig = $hmac.ComputeHash($data)
  $hmac.Dispose()
  $s = Base64UrlEncodeBytes -Bytes $sig
  return "$h.$p.$s"
}

function Redact-Token {
  param([string]$Value)
  if (!$Value) { return "" }
  if ($Value.Length -le 12) { return "REDACTED" }
  return ($Value.Substring(0, 4) + "..." + $Value.Substring($Value.Length - 4))
}

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  $payload = $null
  if ($null -ne $Body) {
    $payload = ($Body | ConvertTo-Json -Compress -Depth 20)
  }

  try {
    $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $payload -UseBasicParsing
    $content = $resp.Content
    $json = $null
    if ($content) {
      try { $json = $content | ConvertFrom-Json } catch { $json = $content }
    }
    return @{
      ok = $true
      status = [int]$resp.StatusCode
      body = $json
      raw = $content
    }
  } catch {
    $we = $_.Exception
    $resp = $we.Response
    $status = $null
    $content = $null
    if ($resp) {
      try { $status = [int]$resp.StatusCode } catch { $status = $null }
      try {
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $content = $sr.ReadToEnd()
        $sr.Close()
      } catch { $content = $null }
    }
    $json = $null
    if ($content) {
      try { $json = $content | ConvertFrom-Json } catch { $json = $content }
    }
    return @{
      ok = $false
      status = $status
      body = $json
      raw = $content
      error = ($we.Message)
    }
  }
}

if (!$RunId -or !$RunIdIso -or !$RunRoot) {
  throw "RunId, RunIdIso, and RunRoot are required (pass from the orchestrating run folder)."
}

$logPath = Join-Path $RunRoot "logs/h1a_verification_stdout.log"
$errPath = Join-Path $RunRoot "logs/h1a_verification_stderr.log"
$resultPath = Join-Path $RunRoot "outputs/h1a_verification_result.json"

New-Item -ItemType Directory -Force -Path (Split-Path $logPath) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $resultPath) | Out-Null

$runIdLine = "run_id: $RunIdIso"
Set-Content -Encoding utf8 -Path $logPath -Value $runIdLine
Set-Content -Encoding utf8 -Path $errPath -Value $runIdLine

Start-Transcript -Path $logPath -Append | Out-Null
try {
  $dotenv = Read-DotEnvFile -Path ".env.local"
  $anonKey = $dotenv["VITE_SUPABASE_ANON_KEY"]
  if (!$anonKey) { $anonKey = $dotenv["SUPABASE_ANON_KEY"] }
  $serviceRoleKey = $dotenv["SUPABASE_SERVICE_ROLE_KEY"]

  if (!$anonKey) { throw "Missing VITE_SUPABASE_ANON_KEY in .env.local" }
  if (!$serviceRoleKey) { throw "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local" }

  $now = [DateTimeOffset]::UtcNow

  $authHeaders = @{
    apikey = $anonKey
  }
  $adminHeaders = @{
    apikey = $serviceRoleKey
    Authorization = "Bearer $serviceRoleKey"
  }

  # Auth A/B: create temporary users with tenant_id in app_metadata, then login to get real tokens.
  $suffix = ([guid]::NewGuid().ToString("N").Substring(0, 8))
  $emailA = "h1a-a-$RunId-$suffix@example.com"
  $passA = ([guid]::NewGuid().ToString("N") + "aA!")

  $emailB = "h1a-b-$RunId-$suffix@example.com"
  $passB = ([guid]::NewGuid().ToString("N") + "aA!")

  $createA = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/auth/v1/admin/users" -Headers $adminHeaders -Body @{
    email = $emailA
    password = $passA
    email_confirm = $true
    app_metadata = @{ tenant_id = $TenantA }
  }
  if (!$createA.ok -or !$createA.body.id) {
    throw "Failed to create tenantA user via admin API (status=$($createA.status))."
  }
  $userAId = [string]$createA.body.id

  $currentTenantA = $null
  try { $currentTenantA = $createA.body.app_metadata.tenant_id } catch { $currentTenantA = $null }
  if ($currentTenantA -ne $TenantA) {
    $updateA = Invoke-JsonRequest -Method "PUT" -Url "$ApiUrl/auth/v1/admin/users/$userAId" -Headers $adminHeaders -Body @{
      app_metadata = @{ tenant_id = $TenantA }
    }
    if (!$updateA.ok) {
      throw "Created tenantA user but failed to set app_metadata.tenant_id (status=$($updateA.status))."
    }
  }

  $authA = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/auth/v1/token?grant_type=password" -Headers $authHeaders -Body @{
    email = $emailA
    password = $passA
  }
  if (!$authA.ok -or !$authA.body.access_token) {
    throw "Failed to obtain tenantA access_token (status=$($authA.status))."
  }
  $jwtA = [string]$authA.body.access_token

  $createB = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/auth/v1/admin/users" -Headers $adminHeaders -Body @{
    email = $emailB
    password = $passB
    email_confirm = $true
    app_metadata = @{ tenant_id = $TenantB }
  }
  if (!$createB.ok -or !$createB.body.id) {
    throw "Failed to create tenantB user via admin API (status=$($createB.status))."
  }
  $userBId = [string]$createB.body.id

  # Ensure tenant_id actually landed in app_metadata (some GoTrue versions require a follow-up update).
  $currentTenantB = $null
  try { $currentTenantB = $createB.body.app_metadata.tenant_id } catch { $currentTenantB = $null }
  if ($currentTenantB -ne $TenantB) {
    $updateB = Invoke-JsonRequest -Method "PUT" -Url "$ApiUrl/auth/v1/admin/users/$userBId" -Headers $adminHeaders -Body @{
      app_metadata = @{ tenant_id = $TenantB }
    }
    if (!$updateB.ok) {
      throw "Created tenantB user but failed to set app_metadata.tenant_id (status=$($updateB.status))."
    }
  }

  $authB = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/auth/v1/token?grant_type=password" -Headers $authHeaders -Body @{
    email = $emailB
    password = $passB
  }
  if (!$authB.ok -or !$authB.body.access_token) {
    throw "Failed to obtain tenantB access_token (status=$($authB.status))."
  }
  $jwtB = [string]$authB.body.access_token

  Write-Output "run_id_slug=$RunId"
  Write-Output "run_id_iso=$RunIdIso"
  Write-Output "api_url=$ApiUrl"
  Write-Output "tenant_a=$TenantA jwt_a=$(Redact-Token $jwtA)"
  Write-Output "tenant_b=$TenantB jwt_b=$(Redact-Token $jwtB)"

  $headersA = @{
    apikey = $anonKey
    Authorization = "Bearer $jwtA"
    Prefer = "return=representation"
  }
  $headersB = @{
    apikey = $anonKey
    Authorization = "Bearer $jwtB"
    Prefer = "return=representation"
  }
  $headersAnon = @{
    apikey = $anonKey
    Prefer = "return=representation"
  }

  # Fixture: create one lead per tenant for edge-function paths (DB superuser insert).
  $leadA = ([guid]::NewGuid().ToString())
  $leadB = ([guid]::NewGuid().ToString())
  $sql = @"
insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('$leadA', '$TenantA', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('$leadB', '$TenantB', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
"@
  $sqlPath = Join-Path $RunRoot "evidence/fixture_insert_leads.sql"
  $sql | Set-Content -Encoding utf8 $sqlPath
  $psqlOut = Join-Path $RunRoot "evidence/fixture_insert_leads.out.txt"
  Get-Content -LiteralPath $sqlPath -Raw |
    & docker exec -i supabase_db_tvg-web-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 |
    Out-File -Encoding utf8 $psqlOut

  # Fixture: a tenant-scoped job row for work-order-update tests.
  # Prefer an existing job; if none exist, insert a minimal job record.
  $jobId = ""
  $jobCreatedFromFixture = $false
  try {
    $jobIdRaw = (& docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -At -q -c "select id from public.jobs where tenant_id='$TenantA' order by created_at desc limit 1;") -join "`n"
    $jobId = ($jobIdRaw -split "`n" | Where-Object { $_ -match '^[0-9a-fA-F-]{36}$' } | Select-Object -First 1).Trim()
  } catch {
    $jobId = ""
  }
  if (!$jobId) {
    $jobInsertRaw = (& docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -At -q -c "insert into public.jobs (tenant_id, lead_id, status) values ('$TenantA', '$leadA'::uuid, 'unscheduled') returning id;") -join "`n"
    $jobId = ($jobInsertRaw -split "`n" | Where-Object { $_ -match '^[0-9a-fA-F-]{36}$' } | Select-Object -First 1).Trim()
    if ($jobId) { $jobCreatedFromFixture = $true }
  }

  $scenarios = @()

  function Add-ScenarioResult {
    param([string]$Name, [string]$Outcome, [hashtable]$Details)
    $script:scenarios += @{
      scenario = $Name
      outcome = $Outcome
      details = $Details
    }
  }

  # 1) Authorized same-tenant write (REST)
  $start = $now.AddDays(1).ToString("o")
  $end = $now.AddDays(1).AddHours(2).ToString("o")
  $insertBody = @{
    tenant_id = $TenantA
    service_name = "H1a RLS Smoke"
    scheduled_start = $start
    scheduled_end = $end
    status = "pending"
  }
  $respInsert = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/rest/v1/appointments" -Headers $headersA -Body $insertBody
  $apptId = $null
  if ($respInsert.ok -and $respInsert.status -ge 200 -and $respInsert.status -lt 300 -and $respInsert.body) {
    $apptId = $respInsert.body[0].id
    Add-ScenarioResult -Name "authorized_same_tenant_write_rest" -Outcome "PASS" -Details @{
      status = $respInsert.status
      appointment_id = $apptId
    }
  } else {
    Add-ScenarioResult -Name "authorized_same_tenant_write_rest" -Outcome "FAIL" -Details @{
      status = $respInsert.status
      error = $respInsert.error
      body = $respInsert.body
    }
  }

  # 2) Authorized same-tenant read (REST)
  if ($apptId) {
    $respReadA = Invoke-JsonRequest -Method "GET" -Url "$ApiUrl/rest/v1/appointments?id=eq.$apptId&select=id,tenant_id" -Headers $headersA
    $ok = $respReadA.ok -and ($respReadA.body | Measure-Object).Count -ge 1
    Add-ScenarioResult -Name "authorized_same_tenant_read_rest" -Outcome ($ok ? "PASS" : "FAIL") -Details @{
      status = $respReadA.status
      rows = (($respReadA.body | Measure-Object).Count)
      body = $respReadA.body
    }
  } else {
    Add-ScenarioResult -Name "authorized_same_tenant_read_rest" -Outcome "UNVERIFIED" -Details @{ reason = "no appointment_id from prior step" }
  }

  # 3) Unauthorized read blocked (anon)
  if ($apptId) {
    $respAnonRead = Invoke-JsonRequest -Method "GET" -Url "$ApiUrl/rest/v1/appointments?id=eq.$apptId&select=id,tenant_id" -Headers $headersAnon
    $rows = ($respAnonRead.body | Measure-Object).Count
    $blocked = (!$respAnonRead.ok) -or ($rows -eq 0)
    Add-ScenarioResult -Name "unauthorized_read_blocked_rest" -Outcome ($blocked ? "PASS" : "FAIL") -Details @{
      status = $respAnonRead.status
      rows = $rows
      body = $respAnonRead.body
    }
  } else {
    Add-ScenarioResult -Name "unauthorized_read_blocked_rest" -Outcome "UNVERIFIED" -Details @{ reason = "no appointment_id from prior step" }
  }

  # 4) Cross-tenant read blocked (TenantB token)
  if ($apptId) {
    $respReadB = Invoke-JsonRequest -Method "GET" -Url "$ApiUrl/rest/v1/appointments?id=eq.$apptId&select=id,tenant_id" -Headers $headersB
    $rows = ($respReadB.body | Measure-Object).Count
    $blocked = (!$respReadB.ok) -or ($rows -eq 0)
    Add-ScenarioResult -Name "cross_tenant_read_blocked_rest" -Outcome ($blocked ? "PASS" : "FAIL") -Details @{
      status = $respReadB.status
      rows = $rows
      body = $respReadB.body
    }
  } else {
    Add-ScenarioResult -Name "cross_tenant_read_blocked_rest" -Outcome "UNVERIFIED" -Details @{ reason = "no appointment_id from prior step" }
  }

  # 4b) Unauthorized update blocked (anon PATCH)
  if ($apptId) {
    $respBeforeUpdate = Invoke-JsonRequest -Method "GET" -Url "$ApiUrl/rest/v1/appointments?id=eq.$apptId&select=id,service_name" -Headers $headersA
    $originalServiceName = $null
    try {
      $row = $respBeforeUpdate.body
      if ($row -is [System.Array]) { $row = $row[0] }
      $originalServiceName = $row.service_name
    } catch { $originalServiceName = $null }

    $respAnonUpdate = Invoke-JsonRequest -Method "PATCH" -Url "$ApiUrl/rest/v1/appointments?id=eq.$apptId" -Headers $headersAnon -Body @{
      service_name = "H1a Anon Update Attempt"
    }

    $respAfterUpdate = Invoke-JsonRequest -Method "GET" -Url "$ApiUrl/rest/v1/appointments?id=eq.$apptId&select=id,service_name" -Headers $headersA
    $afterServiceName = $null
    try {
      $row = $respAfterUpdate.body
      if ($row -is [System.Array]) { $row = $row[0] }
      $afterServiceName = $row.service_name
    } catch { $afterServiceName = $null }

    $blockedByStatus = (!$respAnonUpdate.ok) -and ($respAnonUpdate.status -eq 401 -or $respAnonUpdate.status -eq 403)
    $blockedByNoChange = ($originalServiceName -ne $null) -and ($afterServiceName -eq $originalServiceName)
    $blockedUpdate = $blockedByStatus -or $blockedByNoChange

    Add-ScenarioResult -Name "unauthorized_update_blocked_rest" -Outcome ($blockedUpdate ? "PASS" : "FAIL") -Details @{
      status = $respAnonUpdate.status
      body = $respAnonUpdate.body
      error = $respAnonUpdate.error
      original_service_name = $originalServiceName
      after_service_name = $afterServiceName
    }
  } else {
    Add-ScenarioResult -Name "unauthorized_update_blocked_rest" -Outcome "UNVERIFIED" -Details @{ reason = "no appointment_id from prior step" }
  }

  # 4c) Cross-tenant update blocked (TenantB PATCH)
  if ($apptId) {
    $respCrossUpdate = Invoke-JsonRequest -Method "PATCH" -Url "$ApiUrl/rest/v1/appointments?id=eq.$apptId" -Headers $headersB -Body @{
      service_name = "H1a CrossTenant Update Attempt"
    }
    $respAfterUpdate = Invoke-JsonRequest -Method "GET" -Url "$ApiUrl/rest/v1/appointments?id=eq.$apptId&select=id,service_name" -Headers $headersA
    $afterServiceName = $null
    try {
      $row = $respAfterUpdate.body
      if ($row -is [System.Array]) { $row = $row[0] }
      $afterServiceName = $row.service_name
    } catch { $afterServiceName = $null }

    $blockedByStatus = (!$respCrossUpdate.ok) -and ($respCrossUpdate.status -eq 401 -or $respCrossUpdate.status -eq 403)
    $blockedByNoChange = ($originalServiceName -ne $null) -and ($afterServiceName -eq $originalServiceName)
    $blockedUpdate = $blockedByStatus -or $blockedByNoChange
    Add-ScenarioResult -Name "cross_tenant_update_blocked_rest" -Outcome ($blockedUpdate ? "PASS" : "FAIL") -Details @{
      status = $respCrossUpdate.status
      body = $respCrossUpdate.body
      error = $respCrossUpdate.error
      original_service_name = $originalServiceName
      after_service_name = $afterServiceName
    }
  } else {
    Add-ScenarioResult -Name "cross_tenant_update_blocked_rest" -Outcome "UNVERIFIED" -Details @{ reason = "no appointment_id from prior step" }
  }

  # 5) Cross-tenant write blocked (TenantB token attempts tenant_id=TenantA)
  $respCrossWrite = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/rest/v1/appointments" -Headers $headersB -Body $insertBody
  $blockedWrite = (!$respCrossWrite.ok)
  Add-ScenarioResult -Name "cross_tenant_write_blocked_rest" -Outcome ($blockedWrite ? "PASS" : "FAIL") -Details @{
    status = $respCrossWrite.status
    body = $respCrossWrite.body
    error = $respCrossWrite.error
  }

  # 6) Spoofed tenant_id in edge function blocked (tenant mismatch)
  $edgeSpoof = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/create-appointment" -Headers $headersB -Body @{
    tenant_id = $TenantA
    lead_id = $leadB
    scheduled_start = $start
    duration_minutes = 60
    service_name = "H1a Edge Spoof"
  }
  $spoofBlocked = (!$edgeSpoof.ok) -and ($edgeSpoof.status -eq 403 -or $edgeSpoof.status -eq 401)
  Add-ScenarioResult -Name "spoofed_tenant_id_blocked_edge_create_appointment" -Outcome ($spoofBlocked ? "PASS" : "FAIL") -Details @{
    status = $edgeSpoof.status
    body = $edgeSpoof.body
  }

  # 7) Authorized same-tenant write via edge (no tenant_id in body)
  $edgeCreate = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/create-appointment" -Headers $headersA -Body @{
    lead_id = $leadA
    scheduled_start = $start
    duration_minutes = 60
    service_name = "H1a Edge Happy"
  }
  $edgeApptId = $null
  if ($edgeCreate.ok -and $edgeCreate.body.success -eq $true -and $edgeCreate.body.appointment.id) {
    $edgeApptId = $edgeCreate.body.appointment.id
    Add-ScenarioResult -Name "authorized_same_tenant_write_edge_create_appointment" -Outcome "PASS" -Details @{
      status = $edgeCreate.status
      appointment_id = $edgeApptId
    }
  } else {
    Add-ScenarioResult -Name "authorized_same_tenant_write_edge_create_appointment" -Outcome "FAIL" -Details @{
      status = $edgeCreate.status
      body = $edgeCreate.body
      error = $edgeCreate.error
    }
  }

  # 8) Unauthorized edge invocation blocked (missing auth)
  $edgeNoAuth = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/create-appointment" -Headers $headersAnon -Body @{
    lead_id = $leadA
    scheduled_start = $start
    duration_minutes = 60
    service_name = "H1a Edge NoAuth"
  }
  $noAuthBlocked = (!$edgeNoAuth.ok) -and ($edgeNoAuth.status -eq 401 -or $edgeNoAuth.status -eq 403)
  Add-ScenarioResult -Name "unauthorized_write_blocked_edge_create_appointment" -Outcome ($noAuthBlocked ? "PASS" : "FAIL") -Details @{
    status = $edgeNoAuth.status
    body = $edgeNoAuth.body
  }

  # 9) Cross-tenant update blocked (TenantB attempts update-appointment-status on TenantA appointment)
  if ($edgeApptId) {
    $edgeUpdateCross = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/update-appointment-status" -Headers $headersB -Body @{
      appointment_id = $edgeApptId
      status = "confirmed"
    }
    $blocked = (!$edgeUpdateCross.ok) -and ($edgeUpdateCross.status -eq 404 -or $edgeUpdateCross.status -eq 403)
    Add-ScenarioResult -Name "cross_tenant_update_blocked_edge_update_appointment_status" -Outcome ($blocked ? "PASS" : "FAIL") -Details @{
      status = $edgeUpdateCross.status
      body = $edgeUpdateCross.body
    }
  } else {
    Add-ScenarioResult -Name "cross_tenant_update_blocked_edge_update_appointment_status" -Outcome "UNVERIFIED" -Details @{ reason = "no edge appointment_id from prior step" }
  }

  # 10) Authorized update (TenantA) via edge
  if ($edgeApptId) {
    $edgeUpdateA = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/update-appointment-status" -Headers $headersA -Body @{
      appointment_id = $edgeApptId
      status = "confirmed"
      reminders_enabled = $false
    }
    $ok = $edgeUpdateA.ok -and $edgeUpdateA.body.success -eq $true -and $edgeUpdateA.body.appointment.id -eq $edgeApptId
    Add-ScenarioResult -Name "authorized_same_tenant_update_edge_update_appointment_status" -Outcome ($ok ? "PASS" : "FAIL") -Details @{
      status = $edgeUpdateA.status
      body = $edgeUpdateA.body
      error = $edgeUpdateA.error
    }
  } else {
    Add-ScenarioResult -Name "authorized_same_tenant_update_edge_update_appointment_status" -Outcome "UNVERIFIED" -Details @{ reason = "no edge appointment_id from prior step" }
  }

  # 11) Tenant mismatch body rejected on run-appointment-reminders
  $reminderMismatch = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/run-appointment-reminders" -Headers $headersB -Body @{
    tenant_id = $TenantA
    dry_run = $true
    limit = 1
  }
  $blocked = (!$reminderMismatch.ok) -and ($reminderMismatch.status -eq 403 -or $reminderMismatch.status -eq 401)
  Add-ScenarioResult -Name "spoofed_tenant_id_blocked_edge_run_appointment_reminders" -Outcome ($blocked ? "PASS" : "FAIL") -Details @{
    status = $reminderMismatch.status
    body = $reminderMismatch.body
  }

  # 12) work-order-update tenant isolation + auth (this function can upsert appointment mirrors)
  $woNoAuth = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/work-order-update" -Headers $headersAnon -Body @{
    job_id = $jobId
    patch = @{ access_notes = "H1a NoAuth" }
  }
  $blocked = (!$woNoAuth.ok) -and ($woNoAuth.status -eq 401 -or $woNoAuth.status -eq 403)
  Add-ScenarioResult -Name "unauthorized_blocked_edge_work_order_update" -Outcome ($blocked ? "PASS" : "FAIL") -Details @{
    status = $woNoAuth.status
    body = $woNoAuth.body
  }

  $woSpoofTenant = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/work-order-update" -Headers $headersB -Body @{
    job_id = $jobId
    tenant_id = $TenantA
    patch = @{ access_notes = "H1a SpoofTenant" }
  }
  $blocked = (!$woSpoofTenant.ok) -and ($woSpoofTenant.status -eq 403 -or $woSpoofTenant.status -eq 401)
  Add-ScenarioResult -Name "spoofed_tenant_id_blocked_edge_work_order_update" -Outcome ($blocked ? "PASS" : "FAIL") -Details @{
    status = $woSpoofTenant.status
    body = $woSpoofTenant.body
  }

  $woCrossTenant = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/work-order-update" -Headers $headersB -Body @{
    job_id = $jobId
    tenant_id = $TenantB
    patch = @{ access_notes = "H1a CrossTenant" }
  }
  $blocked = (!$woCrossTenant.ok) -and ($woCrossTenant.status -eq 404 -or $woCrossTenant.status -eq 403)
  Add-ScenarioResult -Name "cross_tenant_write_blocked_edge_work_order_update" -Outcome ($blocked ? "PASS" : "FAIL") -Details @{
    status = $woCrossTenant.status
    body = $woCrossTenant.body
  }

  $woHappy = Invoke-JsonRequest -Method "POST" -Url "$ApiUrl/functions/v1/work-order-update" -Headers $headersA -Body @{
    job_id = $jobId
    patch = @{ access_notes = "H1a Happy" }
  }
  $ok = $woHappy.ok -and $woHappy.body.job.id -eq $jobId
  Add-ScenarioResult -Name "authorized_same_tenant_write_edge_work_order_update" -Outcome ($ok ? "PASS" : "FAIL") -Details @{
    status = $woHappy.status
    body = $woHappy.body
  }

  $result = @{
    run_id = $RunIdIso
    domain_tag = "tenant_isolation"
    api_url = $ApiUrl
    tenants = @{
      a = $TenantA
      b = $TenantB
    }
    fixtures = @{
      leads = @($leadA, $leadB)
      job_id = $jobId
      job_fixture_created = $jobCreatedFromFixture
      user_ids = @{
        a = $userAId
        b = $userBId
      }
      appointments = @{
        rest = $apptId
        edge = $edgeApptId
      }
    }
    scenarios = $scenarios
  }

  $result | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 $resultPath
} catch {
  $_ | Out-String | Out-File -Encoding utf8 $errPath -Append
  throw
} finally {
  # Best-effort cleanup (LOCAL only). Do not fail the run if cleanup fails; record outcomes.
  $cleanup = @{
    run_id = $RunIdIso
    attempted_at = [DateTimeOffset]::UtcNow.ToString('o')
    deleted = @()
    errors = @()
  }

  function Cleanup-Try {
    param([string]$Label, [scriptblock]$Block)
    try {
      & $Block | Out-Null
      $cleanup.deleted += $Label
    } catch {
      $cleanup.errors += @{ label = $Label; error = ($_.Exception.Message) }
    }
  }

  # Delete appointments created by this harness.
  if ($apptId) {
    Cleanup-Try -Label "appointments.rest:$apptId" -Block {
      & docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "delete from public.appointments where id='$apptId'::uuid;"
    }
  }
  if ($edgeApptId) {
    Cleanup-Try -Label "appointments.edge:$edgeApptId" -Block {
      & docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "delete from public.appointments where id='$edgeApptId'::uuid;"
    }
  }

  # Delete fixture leads.
  if ($leadA) {
    Cleanup-Try -Label "leads:$leadA" -Block {
      & docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "delete from public.leads where id='$leadA'::uuid;"
    }
  }
  if ($leadB) {
    Cleanup-Try -Label "leads:$leadB" -Block {
      & docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "delete from public.leads where id='$leadB'::uuid;"
    }
  }

  # Delete fixture job only if we created it.
  if ($jobCreatedFromFixture -and $jobId) {
    Cleanup-Try -Label "jobs.fixture:$jobId" -Block {
      & docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "delete from public.jobs where id='$jobId'::uuid;"
    }
  }

  # Delete temporary auth users created for this run.
  if ($userAId) {
    Cleanup-Try -Label "auth.users:$userAId" -Block {
      $null = Invoke-JsonRequest -Method "DELETE" -Url "$ApiUrl/auth/v1/admin/users/$userAId" -Headers $adminHeaders
    }
  }
  if ($userBId) {
    Cleanup-Try -Label "auth.users:$userBId" -Block {
      $null = Invoke-JsonRequest -Method "DELETE" -Url "$ApiUrl/auth/v1/admin/users/$userBId" -Headers $adminHeaders
    }
  }

  try {
    $cleanupPath = Join-Path $RunRoot "evidence/cleanup.json"
    $cleanup | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $cleanupPath
  } catch {
    # ignore cleanup write failures
  }

  Stop-Transcript | Out-Null
}
