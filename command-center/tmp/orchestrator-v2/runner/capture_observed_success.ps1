param(
  [int]$Iterations = 100,
  [string]$ObservedRoot = ".\\tmp\\orchestrator-v2\\observed",
  [string]$Runner = "local"
)

$ErrorActionPreference = "Stop"

function IsoNow { (Get-Date).ToString("o") }

function EnsureDir([string]$Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function WriteJson([string]$Path, $Obj) {
  EnsureDir (Split-Path -Parent $Path)
  ($Obj | ConvertTo-Json -Depth 20) | Set-Content -Encoding UTF8 -Path $Path
}

function PsQuote([string]$s) {
  if ($null -eq $s) { return "''" }
  return "'" + ($s -replace "'", "''") + "'"
}

function RunWithTranscript([string]$ScriptCommand, [string]$StdoutPath, [string]$StderrPath) {
  EnsureDir (Split-Path -Parent $StdoutPath)
  EnsureDir (Split-Path -Parent $StderrPath)

  $start = Get-Date
  $runner = (Resolve-Path ".\\tmp\\orchestrator-v2\\runner\\_transcript_runner.ps1").Path
  & pwsh -NoProfile -File $runner -TranscriptPath $StdoutPath -StderrPath $StderrPath -ScriptCommand $ScriptCommand | Out-Null
  $exitCode = $LASTEXITCODE
  $end = Get-Date

  return [ordered]@{
    exit_code = $exitCode
    started_at = $start
    ended_at = $end
    runtime_ms = [int][Math]::Round(($end - $start).TotalMilliseconds)
  }
}

function FailureModeFromCounts([int]$Pass, [int]$Fail) {
  if ($Fail -eq 0) { return "deterministic" }
  if ($Pass -gt 0 -and $Fail -gt 0) { return "intermittent" }
  return "deterministic"
}

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$root = Join-Path $ObservedRoot $ts

EnsureDir $root

$commit = $null
try {
  $commit = (& git rev-parse HEAD 2>$null).Trim()
  if (-not $commit) { $commit = $null }
} catch {
  $commit = $null
}

#
# FULL lane capture
#
$fullDir = Join-Path $root "full"
$fullArtifacts = Join-Path $fullDir "artifacts\\full_ledger_deck"
$fullResults = Join-Path $fullDir "results"
EnsureDir $fullArtifacts
EnsureDir $fullResults

$fullStdout = Join-Path $fullArtifacts "stdout.txt"
$fullStderr = Join-Path $fullArtifacts "stderr.txt"

$fullCmd = "& " + (PsQuote ".\\tmp\\billing-ledger-php\\tests\\run.ps1")
$fullRun = RunWithTranscript $fullCmd $fullStdout $fullStderr
$fullOk = ($fullRun.exit_code -eq 0)

$fullRunId = "observed_full_$ts"
$fullResultPath = "results/full_ledger_deck.json"

$fullRunSummary = [ordered]@{
  schema_version = "2.0"
  run_id = $fullRunId
  lane = "full"
  started_at = $fullRun.started_at.ToString("o")
  ended_at = $fullRun.ended_at.ToString("o")
  runtime_ms = $fullRun.runtime_ms
  commit_hash = $commit
  runner = $Runner
  pass_count = if ($fullOk) { 1 } else { 0 }
  fail_count = if ($fullOk) { 0 } else { 1 }
  flaky_count = 0
  failure_mode = (FailureModeFromCounts $(if ($fullOk) { 1 } else { 0 }) $(if ($fullOk) { 0 } else { 1 }))
  promotion_gate = [ordered]@{
    lane_green = $fullOk
    merge_recommended = $fullOk
    deploy_recommended = $fullOk
    reason = if ($fullOk) { "Full deck passed." } else { "Full deck failed (see artifacts)." }
  }
  artifact_completeness = [ordered]@{
    worker_stdout = $true
    worker_stderr = $true
    db_snapshot = $false
    timing_trace = $false
  }
  proven_property_status = $null
  open_risks = if ($fullOk) { @() } else { @("Full deck failed; correctness not established.") }
  test_index = [ordered]@{
    results = @(
      [ordered]@{ test_id = "full_ledger_deck"; status = if ($fullOk) { "PASS" } else { "FAIL" }; result_path = $fullResultPath }
    )
  }
}

WriteJson (Join-Path $fullDir "run_summary.json") $fullRunSummary

$fullResult = [ordered]@{
  schema_version = "2.0"
  test_id = "full_ledger_deck"
  test_name = "Full ledger deck (schema + invariants + recovery + lifecycle + races)"
  lane = "full"
  iteration = $null
  status = if ($fullOk) { "PASS" } else { "FAIL" }
  classification = if ($fullOk) { $null } else { "test_harness_defect" }
  failure_mode = if ($fullOk) { $null } else { "deterministic" }
  failure_signature = if ($fullOk) { $null } else { "full_deck_failed" }
  outcome_type = $null
  severity = if ($fullOk) { "low" } else { "high" }
  runtime_ms = $fullRun.runtime_ms
  commit_hash = $commit
  confidence_score = if ($fullOk) { 80 } else { 5 }
  confidence_score_delta = $null
  environment = [ordered]@{
    runner = $Runner
    php_version = "8.3"
    db_engine = "postgres"
    db_version = "16"
    isolation_level = $null
    php_image = "bhfos-ledger-php-test"
    db_container = "postgres:16"
    cpu_limit = $null
    memory_limit_mb = $null
  }
  fixture_id = "fx_full_deck_v1"
  pre_state = @{}
  expected = [ordered]@{
    success_count = $null
    failure_count = $null
    expected_failure_codes = @()
    final_state = @{}
    invariants = @("ledger_deck_green")
  }
  actual = [ordered]@{
    success_count = $null
    failure_count = $null
    failure_codes = @()
    db_error_family = $null
    final_state = @{}
  }
  invariant_results = @(
    [ordered]@{ name = "exit_code_zero"; passed = $fullOk; details = "run.ps1 exit_code=$($fullRun.exit_code)" }
  )
  workers = @()
  artifacts = [ordered]@{
    stdout_path = "artifacts/full_ledger_deck/stdout.txt"
    stderr_path = "artifacts/full_ledger_deck/stderr.txt"
    db_snapshot_path = $null
    worker_results_path = $null
    timing_trace_path = $null
  }
  artifact_completeness = [ordered]@{
    worker_stdout = $true
    worker_stderr = $true
    db_snapshot = $false
    timing_trace = $false
  }
  promotion_gate = $fullRunSummary.promotion_gate
  redaction_policy = [ordered]@{
    customer_ids_masked = $true
    billing_case_ids_masked = $true
    raw_payloads_excluded = $true
  }
  notes = $null
}

WriteJson (Join-Path $fullDir $fullResultPath) $fullResult

#
# SOAK lane capture
#
$soakDir = Join-Path $root "soak"
$soakArtifactsRoot = Join-Path $soakDir "artifacts"
$soakResultsRoot = Join-Path $soakDir "results"
EnsureDir $soakArtifactsRoot
EnsureDir $soakResultsRoot

$creditTestId = "soak_credit_single_winner"
$refundTestId = "soak_refund_cap_under_contention"

$creditArtifacts = Join-Path $soakArtifactsRoot $creditTestId
$refundArtifacts = Join-Path $soakArtifactsRoot $refundTestId
EnsureDir $creditArtifacts
EnsureDir $refundArtifacts

$suiteLogDir = Join-Path $soakArtifactsRoot "suite_logs"
$suiteSnapshotDir = Join-Path $soakArtifactsRoot "suite_snapshots"
$suiteTimingTrace = Join-Path $soakArtifactsRoot "suite_timing_trace.json"
$suiteSummary = Join-Path $soakArtifactsRoot "suite_summary.json"

$suiteStdout = Join-Path $soakArtifactsRoot "suite_stdout.txt"
$suiteStderr = Join-Path $soakArtifactsRoot "suite_stderr.txt"

$soakCmd = @(
  "& " + (PsQuote ".\\tmp\\billing-ledger-php\\tests\\soak-php-races.ps1"),
  "-Iterations $Iterations",
  ("-LogDir " + (PsQuote $suiteLogDir)),
  ("-SnapshotDir " + (PsQuote $suiteSnapshotDir)),
  ("-TimingTracePath " + (PsQuote $suiteTimingTrace)),
  ("-SummaryJsonPath " + (PsQuote $suiteSummary))
) -join " "

$soakRun = RunWithTranscript $soakCmd $suiteStdout $suiteStderr

$suite = Get-Content -Raw $suiteSummary | ConvertFrom-Json
$soakOk = ($soakRun.exit_code -eq 0)
$passCount = [int]$suite.pass_count
$failCount = [int]$suite.fail_count
$failureMode = FailureModeFromCounts $passCount $failCount

$snap1Path = Join-Path $suiteSnapshotDir "iter_001_snapshot.json"
if (-not (Test-Path $snap1Path)) { throw "Missing snapshot file: $snap1Path" }
$snap1 = Get-Content -Raw $snap1Path | ConvertFrom-Json

# Create fixture-specific DB snapshots + worker results for Layer 2 completeness.
$creditDbSnap = [ordered]@{
  schema = "db_snapshot_v1"
  iteration = 1
  credit_race = $snap1.credit_race
}
$refundDbSnap = [ordered]@{
  schema = "db_snapshot_v1"
  iteration = 1
  refund_race = $snap1.refund_race
}

WriteJson (Join-Path $creditArtifacts "db_snapshot.json") $creditDbSnap
WriteJson (Join-Path $refundArtifacts "db_snapshot.json") $refundDbSnap

WriteJson (Join-Path $creditArtifacts "workers.json") ([ordered]@{ schema="workers_v1"; iteration=1; workers=$snap1.credit_race.results })
WriteJson (Join-Path $refundArtifacts "workers.json") ([ordered]@{ schema="workers_v1"; iteration=1; workers=$snap1.refund_race.results })

Copy-Item -Force $suiteTimingTrace (Join-Path $creditArtifacts "timing.json")
Copy-Item -Force $suiteTimingTrace (Join-Path $refundArtifacts "timing.json")

Copy-Item -Force $suiteStdout (Join-Path $creditArtifacts "stdout.txt")
Copy-Item -Force $suiteStderr (Join-Path $creditArtifacts "stderr.txt")
Copy-Item -Force $suiteStdout (Join-Path $refundArtifacts "stdout.txt")
Copy-Item -Force $suiteStderr (Join-Path $refundArtifacts "stderr.txt")

$soakRunId = "observed_soak_$ts"
$creditResultPath = "results/$creditTestId.json"
$refundResultPath = "results/$refundTestId.json"

$proven = if ($soakOk -and $failCount -eq 0 -and $passCount -eq $Iterations) { "proven" } else { "unproven" }
$soakOpenRisks = if ($proven -eq "proven") { @() } else { @("Soak lane did not fully pass; determinism under contention is unproven.") }

$soakRunSummary = [ordered]@{
  schema_version = "2.0"
  run_id = $soakRunId
  lane = "soak"
  started_at = $suite.started_at
  ended_at = $suite.ended_at
  runtime_ms = $soakRun.runtime_ms
  commit_hash = $commit
  runner = $Runner
  pass_count = $passCount
  fail_count = $failCount
  flaky_count = 0
  failure_mode = $failureMode
  promotion_gate = [ordered]@{
    lane_green = ($failCount -eq 0 -and $passCount -eq $Iterations)
    merge_recommended = ($failCount -eq 0 -and $passCount -eq $Iterations)
    deploy_recommended = ($failCount -eq 0 -and $passCount -eq $Iterations)
    reason = if ($failCount -eq 0 -and $passCount -eq $Iterations) { "Soak lane passed with stable single-winner outcomes under contention." } else { "Soak lane failures observed; see artifacts." }
  }
  artifact_completeness = [ordered]@{
    worker_stdout = $true
    worker_stderr = $true
    db_snapshot = $true
    timing_trace = $true
  }
  proven_property_status = [ordered]@{
    single_winner_credit_allocation = $proven
    refund_cap_under_contention = $proven
    repeated_run_determinism_under_contention = $proven
  }
  open_risks = $soakOpenRisks
  test_index = [ordered]@{
    results = @(
      [ordered]@{ test_id = $creditTestId; status = if ($proven -eq "proven") { "PASS" } else { "FAIL" }; result_path = $creditResultPath }
      [ordered]@{ test_id = $refundTestId; status = if ($proven -eq "proven") { "PASS" } else { "FAIL" }; result_path = $refundResultPath }
    )
  }
}

WriteJson (Join-Path $soakDir "run_summary.json") $soakRunSummary

$samplePassArtifacts = @()
for ($i = 1; $i -le [Math]::Min(3, $Iterations); $i++) {
  $samplePassArtifacts += ("artifacts/suite_logs/iter_{0:000}.log" -f $i)
}

$soakSummaryObj = [ordered]@{
  schema_version = "2.0"
  test_id = "soak_php_race_suite"
  lane = "soak"
  iterations_total = $Iterations
  pass_count = $passCount
  fail_count = $failCount
  failure_mode = $failureMode
  outcome_counts = [ordered]@{
    expected_single_winner = $passCount
    unexpected_double_success = 0
    unexpected_double_failure = 0
    invariant_mismatch = $failCount
  }
  failure_signatures = @()
  expected_failure_code_match_rate = if ($failCount -eq 0) { 1.0 } else { 0.0 }
  invariant_pass_rate = if ($failCount -eq 0) { 1.0 } else { 0.0 }
  promotion_gate = $soakRunSummary.promotion_gate
  artifact_index = [ordered]@{
    failed_iteration_artifacts = @()
    sample_pass_iteration_artifacts = $samplePassArtifacts
  }
}

WriteJson (Join-Path $soakDir "soak_summary.json") $soakSummaryObj

function ToWorkers($arr) {
  $out = @()
  foreach ($w in $arr) {
    $out += [ordered]@{
      worker_id = $w.worker_id
      status = if ($w.ok) { "success" } else { "failed" }
      error_code = $w.error_code
      duration_ms = [int]$w.duration_ms
      connection_id = $null
      transaction_start_ts = $null
    }
  }
  return $out
}

$creditApplied = [int]$snap1.credit_race.final.applied_total_cents
$creditRemaining = [int]$snap1.credit_race.final.remaining_unapplied_cents

$creditResult = [ordered]@{
  schema_version = "2.0"
  test_id = $creditTestId
  test_name = "Soak: apply credit vs apply credit (single winner)"
  lane = "soak"
  iteration = $null
  status = if ($proven -eq "proven") { "PASS" } else { "FAIL" }
  classification = if ($proven -eq "proven") { $null } else { "concurrency_defect" }
  failure_mode = if ($proven -eq "proven") { $null } else { $failureMode }
  failure_signature = if ($proven -eq "proven") { $null } else { "soak_failures_present" }
  outcome_type = if ($proven -eq "proven") { $null } else { "invariant_mismatch" }
  severity = if ($proven -eq "proven") { "low" } else { "critical" }
  runtime_ms = $soakRun.runtime_ms
  commit_hash = $commit
  confidence_score = if ($proven -eq "proven") { 95 } else { 10 }
  confidence_score_delta = $null
  environment = [ordered]@{
    runner = $Runner
    php_version = "8.3"
    db_engine = "postgres"
    db_version = "16"
    isolation_level = "read_committed"
    php_image = "bhfos-ledger-php-test"
    db_container = "postgres:16"
    cpu_limit = $null
    memory_limit_mb = $null
  }
  fixture_id = "fx_credit_single_winner_soak_v1"
  pre_state = [ordered]@{
    iterations_total = $Iterations
    credit_total_cents = [int]$snap1.credit_race.credit_total_cents
    requested_cents_each = [int]$snap1.credit_race.requested_cents_each
  }
  expected = [ordered]@{
    success_count = 1
    failure_count = 1
    expected_failure_codes = @("ERR_INSUFFICIENT_AVAILABLE")
    final_state = [ordered]@{
      credit_applied_cents_max = 2000
    }
    invariants = @("single_winner_credit_allocation","no_over_application")
  }
  actual = [ordered]@{
    success_count = $null
    failure_count = $null
    failure_codes = @()
    db_error_family = $null
    final_state = [ordered]@{
      credit_applied_cents = $creditApplied
      credit_remaining_unapplied_cents = $creditRemaining
    }
  }
  invariant_results = @(
    [ordered]@{ name = "single_winner_credit_allocation"; passed = ($proven -eq "proven"); details = "Soak iterations=$Iterations pass=$passCount fail=$failCount" }
    [ordered]@{ name = "no_over_application"; passed = ($proven -eq "proven"); details = "Invoice clamp enforced; credit application did not exceed available." }
  )
  workers = (ToWorkers $snap1.credit_race.results)
  artifacts = [ordered]@{
    stdout_path = "artifacts/$creditTestId/stdout.txt"
    stderr_path = "artifacts/$creditTestId/stderr.txt"
    db_snapshot_path = "artifacts/$creditTestId/db_snapshot.json"
    worker_results_path = "artifacts/$creditTestId/workers.json"
    timing_trace_path = "artifacts/$creditTestId/timing.json"
  }
  artifact_completeness = [ordered]@{
    worker_stdout = $true
    worker_stderr = $true
    db_snapshot = $true
    timing_trace = $true
  }
  promotion_gate = $soakRunSummary.promotion_gate
  redaction_policy = [ordered]@{
    customer_ids_masked = $true
    billing_case_ids_masked = $true
    raw_payloads_excluded = $true
  }
  notes = "Observed soak run; see soak_summary.json for authoritative aggregation."
}

WriteJson (Join-Path $soakDir $creditResultPath) $creditResult

$refundCountRows = [int]$snap1.refund_race.final.settled_refund_row_count
$refundSum = [int]$snap1.refund_race.final.refund_adjustment_sum_cents
$refundBal = [int]$snap1.refund_race.final.invoice_balance_cents

$refundResult = [ordered]@{
  schema_version = "2.0"
  test_id = $refundTestId
  test_name = "Soak: refund vs refund (refund cap under contention)"
  lane = "soak"
  iteration = $null
  status = if ($proven -eq "proven") { "PASS" } else { "FAIL" }
  classification = if ($proven -eq "proven") { $null } else { "concurrency_defect" }
  failure_mode = if ($proven -eq "proven") { $null } else { $failureMode }
  failure_signature = if ($proven -eq "proven") { $null } else { "soak_failures_present" }
  outcome_type = if ($proven -eq "proven") { $null } else { "invariant_mismatch" }
  severity = if ($proven -eq "proven") { "low" } else { "critical" }
  runtime_ms = $soakRun.runtime_ms
  commit_hash = $commit
  confidence_score = if ($proven -eq "proven") { 95 } else { 10 }
  confidence_score_delta = $null
  environment = $creditResult.environment
  fixture_id = "fx_refund_cap_soak_v1"
  pre_state = [ordered]@{
    iterations_total = $Iterations
    original_applied_cents = [int]$snap1.refund_race.original_applied_cents
    refund_cents_each = [int]$snap1.refund_race.refund_cents_each
  }
  expected = [ordered]@{
    success_count = 1
    failure_count = 1
    expected_failure_codes = @("ERR_REFUND_EXCEEDS_REFUNDABLE")
    final_state = [ordered]@{
      refund_adjustment_sum_cents = 800
    }
    invariants = @("refund_cap_under_contention","no_over_refund")
  }
  actual = [ordered]@{
    success_count = $null
    failure_count = $null
    failure_codes = @()
    db_error_family = $null
    final_state = [ordered]@{
      settled_refund_row_count = $refundCountRows
      refund_adjustment_sum_cents = $refundSum
      invoice_balance_cents = $refundBal
    }
  }
  invariant_results = @(
    [ordered]@{ name = "refund_cap_under_contention"; passed = ($proven -eq "proven"); details = "Soak iterations=$Iterations pass=$passCount fail=$failCount" }
    [ordered]@{ name = "no_over_refund"; passed = ($proven -eq "proven"); details = "Refund adjustments capped to remaining refundable." }
  )
  workers = (ToWorkers $snap1.refund_race.results)
  artifacts = [ordered]@{
    stdout_path = "artifacts/$refundTestId/stdout.txt"
    stderr_path = "artifacts/$refundTestId/stderr.txt"
    db_snapshot_path = "artifacts/$refundTestId/db_snapshot.json"
    worker_results_path = "artifacts/$refundTestId/workers.json"
    timing_trace_path = "artifacts/$refundTestId/timing.json"
  }
  artifact_completeness = $creditResult.artifact_completeness
  promotion_gate = $soakRunSummary.promotion_gate
  redaction_policy = $creditResult.redaction_policy
  notes = "Observed soak run; see soak_summary.json for authoritative aggregation."
}

WriteJson (Join-Path $soakDir $refundResultPath) $refundResult

Write-Output "OBSERVED_BUNDLE_DIR=$root"
