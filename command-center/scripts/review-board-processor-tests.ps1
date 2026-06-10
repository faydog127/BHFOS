param(
  [Parameter(Mandatory = $true)]
  [string] $Url,

  [ValidateSet("all", "valid", "missing_field", "invalid_stage", "oversized")]
  [string] $Case = "all",

  # If n8n basic auth is enabled, webhooks require auth (otherwise they may appear as 404).
  [string] $BasicAuthUser,
  [string] $BasicAuthPassword,

  # When set, the "valid" case must succeed end-to-end (OpenAI + Drive).
  # If not set, "valid" is allowed to fail later (e.g., missing OPENAI_API_KEY) as long as input validation passes.
  [switch] $ExpectSuccess
)

function Get-AuthHeaders {
  if ([string]::IsNullOrWhiteSpace($BasicAuthUser) -or [string]::IsNullOrWhiteSpace($BasicAuthPassword)) {
    return @{}
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes(("{0}:{1}" -f $BasicAuthUser, $BasicAuthPassword))
  $token = [Convert]::ToBase64String($bytes)
  return @{ Authorization = ("Basic {0}" -f $token) }
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

  try {
    $headers = Get-AuthHeaders
    $resp = Invoke-WebRequest -Method Post -Uri $Url -ContentType "application/json" -Body $json -Headers $headers -SkipHttpErrorCheck -TimeoutSec 45
    Write-Host ("`n=== {0} ===" -f $name)
    $status = $resp.StatusCode
    if (-not $status) { $status = "<unknown>" }
    Write-Host ("HTTP {0}" -f $status)
    if ($resp.Content) { Write-Output $resp.Content }
    else { Write-Output "<empty body>" }

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
  artifact_name    = "Test Review"
  source           = "Manual"
  current_stage    = "Draft Workflow"
  decision_needed  = "Harden"
  risk_level       = "Medium"
  main_concern     = "Testing Review Board"
  artifact_text    = "This is a test artifact for review."
}

$missingField = [ordered]@{
  artifact_name    = ""
  source           = "Manual"
  current_stage    = "Draft Workflow"
  decision_needed  = "Harden"
  risk_level       = "Medium"
  main_concern     = "Testing Review Board"
  artifact_text    = "This should fail because artifact_name is empty."
}

$invalidStage = [ordered]@{
  artifact_name    = "Bad Stage Test"
  source           = "Manual"
  current_stage    = "Draft"
  decision_needed  = "Harden"
  risk_level       = "Medium"
  main_concern     = "Testing Review Board"
  artifact_text    = "This should fail because current_stage is invalid."
}

$oversized = [ordered]@{
  artifact_name    = "Oversize Test"
  source           = "Manual"
  current_stage    = "Draft Workflow"
  decision_needed  = "Harden"
  risk_level       = "Medium"
  main_concern     = "Testing Review Board"
  artifact_text    = ("A" * 26001)
}

if ($Case -eq "all" -or $Case -eq "valid") {
  Invoke-Test "Valid" $valid {
    param($resp, $body)
    # Valid input should not fail at validation stage.
    Assert-True ($resp.StatusCode -ne 400) "Valid case returned 400 (validation failure)."
    if ($ExpectSuccess) {
      Assert-True ($resp.StatusCode -eq 200) "Expected HTTP 200 for valid case, got $($resp.StatusCode)."
      Assert-True ($body -and $body.status -eq "success") "Expected JSON {status:'success'} for valid case."
    }
  }
}

if ($Case -eq "all" -or $Case -eq "missing_field") {
  Invoke-Test "Missing field" $missingField {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for missing_field, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for missing_field."
    Assert-True (($body.missing_fields -contains "artifact_name")) "Expected missing_fields to include artifact_name."
  }
}

if ($Case -eq "all" -or $Case -eq "invalid_stage") {
  Invoke-Test "Invalid stage" $invalidStage {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for invalid_stage, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for invalid_stage."
    Assert-True (($body.invalid_fields -contains "current_stage")) "Expected invalid_fields to include current_stage."
  }
}

if ($Case -eq "all" -or $Case -eq "oversized") {
  Invoke-Test "Oversized payload" $oversized {
    param($resp, $body)
    Assert-True ($resp.StatusCode -eq 400) "Expected HTTP 400 for oversized, got $($resp.StatusCode)."
    Assert-True ($body -and $body.status -eq "error") "Expected JSON {status:'error'} for oversized."
    Assert-True (($body.invalid_fields -contains "artifact_text")) "Expected invalid_fields to include artifact_text."
  }
}

Write-Host "`nAll requested cases passed."
