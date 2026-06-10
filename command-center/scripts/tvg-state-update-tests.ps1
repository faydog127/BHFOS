param(
  [Parameter(Mandatory = $true)]
  [string] $Url,

  [ValidateSet("all", "valid", "missing_secret", "missing_field")]
  [string] $Case = "all",

  # If n8n basic auth is enabled, webhooks require auth (otherwise they may appear as 404).
  [string] $BasicAuthUser,
  [string] $BasicAuthPassword,

  # Optional override (otherwise read from env or .env.n8n)
  [string] $StateSecret
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-DotEnvFile {
  param([Parameter(Mandatory = $true)][string] $Path)
  if (-not (Test-Path -LiteralPath $Path)) { return @{} }
  $map = @{}
  foreach ($line in (Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)) {
    if (-not $line) { continue }
    $trimmed = $line.Trim()
    if ($trimmed.StartsWith("#") -or $trimmed -eq "") { continue }
    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }
    $k = $trimmed.Substring(0, $idx).Trim()
    $v = $trimmed.Substring($idx + 1).Trim()
    if ($k) { $map[$k] = $v }
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

  if (-not [string]::IsNullOrWhiteSpace($StateSecret)) {
    $headers["X-State-Secret"] = $StateSecret
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

  $resp = Invoke-WebRequest -Method Post -Uri $Url -ContentType "application/json" -Body $json -Headers $headers -SkipHttpErrorCheck -TimeoutSec 45
  Write-Host ("`n=== {0} ===" -f $name)
  Write-Host ("HTTP {0}" -f $resp.StatusCode)
  if ($resp.Content) { Write-Output $resp.Content } else { Write-Output "<empty body>" }

  if ($Assert) {
    $parsed = Try-ParseJson -Text $resp.Content
    & $Assert $resp $parsed
  }
}

$dotEnv = Read-DotEnvFile -Path (Join-Path $PSScriptRoot "..\\.env.n8n")

if ([string]::IsNullOrWhiteSpace($StateSecret)) {
  $StateSecret = Resolve-EnvValue -Key "TVG_STATE_SECRET" -DotEnv $dotEnv
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
  $BasicAuthUser = $null
  $BasicAuthPassword = $null
}

$valid = [ordered]@{
  last_updated = "2026-04-15"
  completed = @("State update workflow created")
  in_progress = @("TIS → n8n pilot intake testing")
  next_step = @("Run one real pilot payload from TIS")
}

$missingField = [ordered]@{
  completed = @("x")
  in_progress = @()
  # next_step missing
}

if ($Case -eq "all" -or $Case -eq "valid") {
  if ([string]::IsNullOrWhiteSpace($StateSecret)) { throw "Missing TVG state secret. Set TVG_STATE_SECRET in .env.n8n or pass -StateSecret." }
  Invoke-Test "Valid" $valid {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 200) "Expected HTTP 200 for valid case, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "success") "Expected JSON {status:'success'} for valid case."
  }
}

if ($Case -eq "all" -or $Case -eq "missing_secret") {
  $saved = $StateSecret
  $script:StateSecret = $null
  Invoke-Test "Missing secret" $valid {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 401 -or $resp.StatusCode -eq 500) "Expected 401/500 for missing_secret, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for missing_secret."
  }
  $script:StateSecret = $saved
}

if ($Case -eq "all" -or $Case -eq "missing_field") {
  Invoke-Test "Missing field" $missingField {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for missing_field, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for missing_field."
  }
}

Write-Host "`nAll requested cases passed."

