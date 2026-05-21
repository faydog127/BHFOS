param(
  [Parameter(Mandatory = $true)]
  [string] $Url,

  [ValidateSet("all", "valid", "missing_secret", "bad_mode", "missing_required", "empty_before_photos")]
  [string] $Case = "all",

  # If n8n basic auth is enabled, webhooks require auth (otherwise they may appear as 404).
  [string] $BasicAuthUser,
  [string] $BasicAuthPassword,

  # Required: must match $env.TIS_PILOT_SECRET inside the n8n instance.
  [string] $TisSecret
)

function Read-DotEnvFile {
  param([Parameter(Mandatory = $true)][string] $Path)

  if (-not (Test-Path -LiteralPath $Path)) { return @{} }

  $map = @{}
  foreach ($line in (Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)) {
    if (-not $line) { continue }
    $trimmed = $line.Trim()
    if ($trimmed.StartsWith("#")) { continue }
    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }
    $k = $trimmed.Substring(0, $idx).Trim()
    $v = $trimmed.Substring($idx + 1).Trim()
    if ([string]::IsNullOrWhiteSpace($k)) { continue }
    $map[$k] = $v
  }
  return $map
}

function Resolve-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string] $Key,
    [hashtable] $DotEnv
  )

  $v = [Environment]::GetEnvironmentVariable($Key)
  if (-not [string]::IsNullOrWhiteSpace($v)) { return $v }
  if ($DotEnv -and $DotEnv.ContainsKey($Key) -and -not [string]::IsNullOrWhiteSpace($DotEnv[$Key])) { return $DotEnv[$Key] }
  return $null
}

function Get-AuthHeaders {
  $headers = @{}

  if (-not [string]::IsNullOrWhiteSpace($BasicAuthUser) -and -not [string]::IsNullOrWhiteSpace($BasicAuthPassword)) {
    $bytes = [Text.Encoding]::UTF8.GetBytes(("{0}:{1}" -f $BasicAuthUser, $BasicAuthPassword))
    $token = [Convert]::ToBase64String($bytes)
    $headers.Authorization = ("Basic {0}" -f $token)
  }

  if (-not [string]::IsNullOrWhiteSpace($TisSecret)) {
    $headers["X-TIS-Secret"] = $TisSecret
  }

  return $headers
}

function Try-ParseJson([string] $Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  try { return $Text | ConvertFrom-Json -Depth 50 } catch { return $null }
}

function Assert-True([bool] $Condition, [string] $Message) {
  if (-not $Condition) { throw $Message }
}

function Invoke-Test($name, $payload, [scriptblock] $Assert) {
  $json = $payload | ConvertTo-Json -Depth 20
  $headers = Get-AuthHeaders

  try {
    $resp = Invoke-WebRequest -Method Post -Uri $Url -ContentType "application/json" -Body $json -Headers $headers -SkipHttpErrorCheck -TimeoutSec 45
    Write-Host ("`n=== {0} ===" -f $name)
    Write-Host ("HTTP {0}" -f $resp.StatusCode)
    if ($resp.Content) { Write-Output $resp.Content } else { Write-Output "<empty body>" }

    if ($Assert) {
      $parsed = Try-ParseJson -Text $resp.Content
      & $Assert $resp $parsed
    }
  } catch {
    Write-Host ("`n=== {0} ===" -f $name)
    Write-Host ("Request failed: {0}" -f $_.Exception.Message)
    throw
  }
}

$valid = [ordered]@{
  mode = "pilot_non_production"
  job_id = "pilot-001"
  property_address = "730 Scott Ave SW, Palm Bay, FL"
  service_date = "2026-04-14"
  notes = "Observed contamination on coil and blower."
  before_photos = @(
    [ordered]@{ url = "https://example.com/before-1.jpg"; label = "coil" }
  )
  after_photos = @()
  documents = @()
}

$badMode = [ordered]@{
  mode = "production"
  job_id = "pilot-001"
  property_address = "730 Scott Ave SW, Palm Bay, FL"
  service_date = "2026-04-14"
  notes = "Observed contamination on coil and blower."
  before_photos = @(
    [ordered]@{ url = "https://example.com/before-1.jpg"; label = "coil" }
  )
  after_photos = @()
  documents = @()
}

$missingRequired = [ordered]@{
  mode = "pilot_non_production"
  job_id = "pilot-001"
  property_address = ""
  service_date = ""
  notes = ""
  before_photos = @(
    [ordered]@{ url = "https://example.com/before-1.jpg"; label = "coil" }
  )
  after_photos = @()
  documents = @()
}

$emptyBefore = [ordered]@{
  mode = "pilot_non_production"
  job_id = "pilot-001"
  property_address = "730 Scott Ave SW, Palm Bay, FL"
  service_date = "2026-04-14"
  notes = "Observed contamination on coil and blower."
  before_photos = @()
  after_photos = @()
  documents = @()
}

$dotEnv = Read-DotEnvFile -Path (Join-Path $PSScriptRoot "..\\.env.n8n")

# Resolve secrets/credentials without putting them on the command line.
if ([string]::IsNullOrWhiteSpace($TisSecret)) {
  $TisSecret = Resolve-EnvValue -Key "TIS_PILOT_SECRET" -DotEnv $dotEnv
}

$basicAuthActive = (Resolve-EnvValue -Key "N8N_BASIC_AUTH_ACTIVE" -DotEnv $dotEnv)
$basicAuthActive = if ($basicAuthActive) { $basicAuthActive.Trim().ToLowerInvariant() } else { "" }
$isBasicAuthActive = ($basicAuthActive -eq "true" -or $basicAuthActive -eq "1" -or $basicAuthActive -eq "yes")

if ($isBasicAuthActive) {
  if ([string]::IsNullOrWhiteSpace($BasicAuthUser)) {
    $BasicAuthUser = Resolve-EnvValue -Key "N8N_BASIC_AUTH_USER" -DotEnv $dotEnv
  }
  if ([string]::IsNullOrWhiteSpace($BasicAuthPassword)) {
    $BasicAuthPassword = Resolve-EnvValue -Key "N8N_BASIC_AUTH_PASSWORD" -DotEnv $dotEnv
  }

  if ([string]::IsNullOrWhiteSpace($BasicAuthUser) -or [string]::IsNullOrWhiteSpace($BasicAuthPassword)) {
    throw "n8n basic auth is active but N8N_BASIC_AUTH_USER/PASSWORD are not set (env or .env.n8n)."
  }
} else {
  # Make sure we don't accidentally send partial auth.
  $BasicAuthUser = $null
  $BasicAuthPassword = $null
}

if ($Case -eq "all" -or $Case -eq "valid") {
  if ([string]::IsNullOrWhiteSpace($TisSecret)) { throw "Missing TIS secret. Set TIS_PILOT_SECRET in .env.n8n (no quotes, no trailing spaces) or pass -TisSecret." }
  Invoke-Test "Valid" $valid {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 200) "Expected HTTP 200 for valid case, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "accepted") "Expected JSON {status:'accepted'} for valid case."
    Assert-True (-not [string]::IsNullOrWhiteSpace($body.intake_id)) "Expected intake_id to be present."
    Assert-True ($body.mode -eq "pilot_non_production") "Expected mode to be pilot_non_production."
    Assert-True ($body.next_step -eq "ready_for_report_generation") "Expected next_step to be ready_for_report_generation."
  }
}

if ($Case -eq "all" -or $Case -eq "missing_secret") {
  $saved = $TisSecret
  $script:TisSecret = $null
  Invoke-Test "Missing secret" $valid {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 401 -or $resp.StatusCode -eq 500) "Expected 401/500 for missing_secret, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for missing_secret."
  }
  $script:TisSecret = $saved
}

if ($Case -eq "all" -or $Case -eq "bad_mode") {
  Invoke-Test "Bad mode" $badMode {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for bad_mode, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for bad_mode."
  }
}

if ($Case -eq "all" -or $Case -eq "missing_required") {
  Invoke-Test "Missing required fields" $missingRequired {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for missing_required, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for missing_required."
  }
}

if ($Case -eq "all" -or $Case -eq "empty_before_photos") {
  Invoke-Test "Empty before_photos" $emptyBefore {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for empty_before_photos, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for empty_before_photos."
  }
}

Write-Host "`nAll requested cases passed."
