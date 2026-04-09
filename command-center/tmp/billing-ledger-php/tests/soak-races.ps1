param(
  [int]$Iterations = 25,
  [string]$LogDir = ".\\tmp\\billing-ledger-php\\tests\\_soak_logs",
  [int]$SleepMsBetween = 0
)

$ErrorActionPreference = "Stop"

if ($Iterations -lt 1) { throw "Iterations must be >= 1" }

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$pass = 0
$fail = 0
$failedIterations = New-Object System.Collections.Generic.List[int]
$start = Get-Date

Write-Host "SOAK: Running $Iterations iterations of run-races.ps1"
Write-Host "SOAK: Logs -> $LogDir"

for ($i = 1; $i -le $Iterations; $i++) {
  $iterStart = Get-Date
  $logPath = Join-Path $LogDir ("iter_{0:000}.log" -f $i)
  Write-Host ""
  Write-Host ("SOAK ITER {0}/{1} -> {2}" -f $i, $Iterations, $logPath)

  try {
    & pwsh -NoProfile -File .\tmp\billing-ledger-php\tests\run-races.ps1 2>&1 | Tee-Object -FilePath $logPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "run-races.ps1 exited $LASTEXITCODE" }
    $pass++
    $dur = (Get-Date) - $iterStart
    Write-Host ("SOAK ITER {0}: PASS ({1:n1}s)" -f $i, $dur.TotalSeconds)
  } catch {
    $fail++
    $failedIterations.Add($i) | Out-Null
    $dur = (Get-Date) - $iterStart
    Write-Host ("SOAK ITER {0}: FAIL ({1:n1}s) -> {2}" -f $i, $dur.TotalSeconds, $_.Exception.Message)
  }

  if ($SleepMsBetween -gt 0) {
    Start-Sleep -Milliseconds $SleepMsBetween
  }
}

$totalDur = (Get-Date) - $start
Write-Host ""
Write-Host "SOAK SUMMARY"
Write-Host ("- iterations_total: {0}" -f $Iterations)
Write-Host ("- pass_count: {0}" -f $pass)
Write-Host ("- fail_count: {0}" -f $fail)
Write-Host ("- runtime_seconds: {0:n1}" -f $totalDur.TotalSeconds)
if ($fail -gt 0) {
  Write-Host ("- failed_iterations: {0}" -f (($failedIterations | Sort-Object) -join ", "))
  exit 1
}

exit 0

