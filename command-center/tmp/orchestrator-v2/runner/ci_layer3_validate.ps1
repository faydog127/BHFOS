param(
  [string]$BaselineConfigPath = "./tmp/orchestrator-v2/baseline.json"
)

$ErrorActionPreference = "Stop"

function Assert([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function ExecNode {
  param(
    [Parameter(Mandatory = $true)][string[]]$Args
  )
  & node @Args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw ("node failed (exit_code={0}): node {1}" -f $LASTEXITCODE, ($Args -join " "))
  }
}

Assert (Test-Path $BaselineConfigPath) "Missing baseline config: $BaselineConfigPath"
$cfg = Get-Content -Raw $BaselineConfigPath | ConvertFrom-Json

$json = [string]$cfg.baseline_layer2_judgment_json
Assert ($json -and $json.Trim() -ne "") "Invalid baseline config: missing baseline_layer2_judgment_json"

Write-Host "Layer3 CI validation using baseline judgment JSON:"
Write-Host "- $json"

$jsonRel = ($json -replace '^[.][\\/]+', '')
$jsonPath = "./$jsonRel"
ExecNode @("./tmp/orchestrator-v2/eval/validate_tenant_scope.mjs", $jsonPath)

ExecNode @("./tmp/orchestrator-v2/layer3/validate_layer3_output.mjs", "--mode", "exact", "--json", $jsonPath, "--doc", "./docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md")
ExecNode @("./tmp/orchestrator-v2/layer3/validate_layer3_review_output.mjs", "--mode", "exact", "--json", $jsonPath, "--doc", "./docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_REVIEW_v1.md")

Write-Host "CI Layer3 validation: PASS"
