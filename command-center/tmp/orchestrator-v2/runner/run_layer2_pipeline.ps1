param(
  [int]$Iterations = 100,
  [ValidateSet("all","capture","evaluate")][string]$Mode = "all",
  [string]$BundleRoot = ""
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

if ($Mode -eq "capture" -or $Mode -eq "all") {
  Write-Host "Layer2 Pipeline: capturing observed artifacts (full + soak)..."
  $out = & pwsh -NoProfile -File ./tmp/orchestrator-v2/runner/capture_observed_success.ps1 -Iterations $Iterations 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "capture_observed_success.ps1 failed with exit_code=$LASTEXITCODE"
  }
  $line = $out | Select-Object -Last 1
  if ($line -notmatch "^OBSERVED_BUNDLE_DIR=") {
    throw "capture_observed_success.ps1 did not emit OBSERVED_BUNDLE_DIR. Last line: $line"
  }
  $BundleRoot = $line.Replace("OBSERVED_BUNDLE_DIR=","").Trim()
  Write-Host "Observed bundle: $BundleRoot"
}

if (-not $BundleRoot -or $BundleRoot.Trim() -eq "") {
  throw "BundleRoot is required for evaluation. Run with -Mode capture or pass -BundleRoot."
}

if ($Mode -eq "evaluate" -or $Mode -eq "all") {
  $observedSoak = Join-Path $BundleRoot "soak"
  $eval1 = Join-Path $BundleRoot "layer2_eval_1"
  $eval2 = Join-Path $BundleRoot "layer2_eval_2"

  Write-Host "Layer2 Pipeline: evaluating observed soak bundle twice for determinism..."
  ExecNode @("./tmp/orchestrator-v2/eval/evaluate_bundle.mjs", $observedSoak, $eval1)
  ExecNode @("./tmp/orchestrator-v2/eval/evaluate_bundle.mjs", $observedSoak, $eval2)

  ExecNode @("./tmp/orchestrator-v2/eval/validate_judgment.mjs", (Join-Path $eval1 "judgment.md"))
  ExecNode @("./tmp/orchestrator-v2/eval/validate_judgment.mjs", (Join-Path $eval2 "judgment.md"))

  $j1 = Get-Content -Raw (Join-Path $eval1 "judgment.json")
  $j2 = Get-Content -Raw (Join-Path $eval2 "judgment.json")
  Assert ($j1 -eq $j2) "Determinism check failed: judgment.json differs between runs."

  $judgment = $j1 | ConvertFrom-Json
  Assert ($judgment.test_run_verdict -eq "DEPLOY_CONFIDENCE_INCREASED") "Observed success expected DEPLOY_CONFIDENCE_INCREASED, got $($judgment.test_run_verdict)"
  Assert ($judgment.proven_property_status.single_winner_credit_allocation -eq "proven") "Expected single_winner_credit_allocation proven."
  Assert ($judgment.proven_property_status.refund_cap_under_contention -eq "proven") "Expected refund_cap_under_contention proven."

  Write-Host "Layer2 Pipeline: evaluating negative controls with same evaluator..."
  $envBundle = "./tmp/orchestrator-v2/examples/03_environment_failure"
  $invBundle = "./tmp/orchestrator-v2/examples/04_invariant_violation_deploy_blocked"

  $envOut = Join-Path $BundleRoot "layer2_eval_env_control"
  $invOut = Join-Path $BundleRoot "layer2_eval_invariant_control"

  ExecNode @("./tmp/orchestrator-v2/eval/evaluate_bundle.mjs", $envBundle, $envOut)
  ExecNode @("./tmp/orchestrator-v2/eval/evaluate_bundle.mjs", $invBundle, $invOut)

  $envJ = Get-Content -Raw (Join-Path $envOut "judgment.json") | ConvertFrom-Json
  $invJ = Get-Content -Raw (Join-Path $invOut "judgment.json") | ConvertFrom-Json

  Assert ($envJ.test_run_verdict -eq "DEPLOY_CAUTION") "Env control expected DEPLOY_CAUTION, got $($envJ.test_run_verdict)"
  Assert ($envJ.next_action_type -eq "environment_fix") "Env control expected next_action_type environment_fix, got $($envJ.next_action_type)"

  Assert ($invJ.test_run_verdict -eq "DEPLOY_BLOCKED") "Invariant control expected DEPLOY_BLOCKED, got $($invJ.test_run_verdict)"
  Assert ($invJ.next_action_type -eq "code_fix") "Invariant control expected next_action_type code_fix, got $($invJ.next_action_type)"

  Write-Host "LAYER2 PIPELINE PASSED"
}

Write-Host "BUNDLE_ROOT=$BundleRoot"
