param(
  [Parameter(Mandatory = $true)]
  [string] $Url,

  # Secret required by the workflow (header X-Review-Secret).
  [string] $ReviewSecret,

  # If n8n basic auth is enabled, webhooks require auth (otherwise they may appear as 404).
  [string] $BasicAuthUser,
  [string] $BasicAuthPassword,

  [ValidateSet("all", "missing_secret", "missing_field", "short_content", "valid")]
  [string] $Case = "all"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-BasicAuthHeader {
  if ([string]::IsNullOrWhiteSpace($BasicAuthUser) -or [string]::IsNullOrWhiteSpace($BasicAuthPassword)) {
    return $null
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes(("{0}:{1}" -f $BasicAuthUser, $BasicAuthPassword))
  $token = [Convert]::ToBase64String($bytes)
  return ("Basic {0}" -f $token)
}

function Try-ParseJson([string] $Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  try { return $Text | ConvertFrom-Json -Depth 50 } catch { return $null }
}

function Assert-True([bool] $Condition, [string] $Message) {
  if (-not $Condition) { throw $Message }
}

function Invoke-Case($name, $payload, [hashtable] $headers, [scriptblock] $assert) {
  $json = $payload | ConvertTo-Json -Depth 30
  $resp = Invoke-WebRequest -Method Post -Uri $Url -ContentType "application/json" -Body $json -Headers $headers -SkipHttpErrorCheck -TimeoutSec 45

  Write-Host ("`n=== {0} ===" -f $name)
  Write-Host ("HTTP {0}" -f $resp.StatusCode)
  if ($resp.Content) { Write-Output $resp.Content } else { Write-Output "<empty body>" }

  $body = Try-ParseJson -Text $resp.Content
  if ($assert) { & $assert $resp $body }
}

$headersBase = @{}
$basic = Get-BasicAuthHeader
if ($basic) { $headersBase["Authorization"] = $basic }

$valid = [ordered]@{
  artifact_id      = "report-730-scott"
  artifact_title   = "730 Scott — Report Package"
  artifact_type    = "report"
  artifact_version = "v1"
  review_type      = "structured_review"
  submitted_by     = "Operator"
  content          = ("This is a substantive payload for review. " * 10).Trim()
  high_stakes      = "false"
}

$missingField = [ordered]@{
  artifact_id      = ""
  artifact_title   = "Missing Field Test"
  artifact_type    = "report"
  artifact_version = "v1"
  review_type      = "structured_review"
  submitted_by     = "Operator"
  content          = ("This is a substantive payload for review. " * 10).Trim()
}

$shortContent = [ordered]@{
  artifact_id      = "short-content"
  artifact_title   = "Short Content Test"
  artifact_type    = "report"
  artifact_version = "v1"
  review_type      = "structured_review"
  submitted_by     = "Operator"
  content          = "Too short."
}

if ($Case -eq "all" -or $Case -eq "missing_secret") {
  $headers = @{}
  $headersBase.GetEnumerator() | ForEach-Object { $headers[$_.Key] = $_.Value }

  Invoke-Case "Missing secret" $valid $headers {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 401) "Expected HTTP 401 for missing_secret, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for missing_secret."
    Assert-True ($body.error_type -eq "auth_failed") "Expected error_type=auth_failed for missing_secret."
  }
}

if ($Case -ne "missing_secret" -and [string]::IsNullOrWhiteSpace($ReviewSecret)) {
  throw "Missing -ReviewSecret (required for all cases except missing_secret)."
}

if ($Case -eq "all" -or $Case -eq "missing_field") {
  $headers = @{}
  $headersBase.GetEnumerator() | ForEach-Object { $headers[$_.Key] = $_.Value }
  $headers["X-Review-Secret"] = $ReviewSecret

  Invoke-Case "Missing field" $missingField $headers {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for missing_field, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for missing_field."
    Assert-True ($body.error_type -eq "validation_failed") "Expected error_type=validation_failed for missing_field."
  }
}

if ($Case -eq "all" -or $Case -eq "short_content") {
  $headers = @{}
  $headersBase.GetEnumerator() | ForEach-Object { $headers[$_.Key] = $_.Value }
  $headers["X-Review-Secret"] = $ReviewSecret

  Invoke-Case "Short content" $shortContent $headers {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for short_content, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for short_content."
    Assert-True ($body.error_type -eq "validation_failed") "Expected error_type=validation_failed for short_content."
  }
}

if ($Case -eq "all" -or $Case -eq "valid") {
  $headers = @{}
  $headersBase.GetEnumerator() | ForEach-Object { $headers[$_.Key] = $_.Value }
  $headers["X-Review-Secret"] = $ReviewSecret

  Invoke-Case "Valid (may fail later without creds)" $valid $headers {
    param($resp, $body)
    # Valid payload must not fail at auth/validation stage.
    Assert-True ($resp.StatusCode -ne 401) "Valid case returned 401 (auth failure)."
    Assert-True ($resp.StatusCode -ne 400) "Valid case returned 400 (validation failure)."
  }
}

Write-Host "`nAll requested cases passed."

