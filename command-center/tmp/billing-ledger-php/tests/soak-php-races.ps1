param(
  [int]$Iterations = 100,
  [string]$ContainerName = "bhfos_billing_ledger_soak_db",
  [int]$HostPort = 55434,
  [string]$PhpImage = "bhfos-ledger-php-test",
  [string]$LogDir = ".\\tmp\\billing-ledger-php\\tests\\_soak_php_race_logs",
  [int]$SleepMsBetween = 0,
  [string]$SnapshotDir = "",
  [string]$TimingTracePath = "",
  [string]$SummaryJsonPath = ""
)

$ErrorActionPreference = "Stop"

if ($Iterations -lt 1) { throw "Iterations must be >= 1" }

function Cleanup {
  try { docker rm -f $ContainerName 2>$null | Out-Null } catch { }
}

function Exec {
  param([Parameter(Mandatory = $true)][string]$Cmd)
  & pwsh -NoProfile -Command $Cmd
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Cmd" }
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
if ($SnapshotDir -and $SnapshotDir.Trim() -ne "") {
  New-Item -ItemType Directory -Force -Path $SnapshotDir | Out-Null
}

Cleanup

Write-Host "SOAK(PHP): Starting Postgres container: $ContainerName (port $HostPort)"
docker run -d --rm --name $ContainerName `
  -e POSTGRES_PASSWORD=postgres `
  -p ${HostPort}:5432 `
  -v "${PWD}\\tmp\\billing-ledger-php:/work" `
  postgres:16 | Out-Null

try {
  Write-Host "SOAK(PHP): Waiting for Postgres..."
  for ($i=0; $i -lt 60; $i++) {
    docker exec $ContainerName pg_isready -U postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 250
  }
  if ($LASTEXITCODE -ne 0) { throw "Postgres did not become ready." }

  Write-Host "SOAK(PHP): Applying schema + addenda once..."
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0000_schema.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0001_idempotency_registry.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0002_partial_refund_linkage.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0003_views_balance_and_availability.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0004_immutability_trigger.sql"

  Write-Host "SOAK(PHP): Building PHP image once..."
  Exec "docker build -t $PhpImage -f tmp/billing-ledger-php/tests/php/Dockerfile tmp/billing-ledger-php/tests/php"

  $pass = 0
  $fail = 0
  $failedIterations = New-Object System.Collections.Generic.List[int]
  $start = Get-Date
  $timing = New-Object System.Collections.Generic.List[object]

  Write-Host ("SOAK(PHP): Running {0} iterations of 006_php_race.ps1" -f $Iterations)
  Write-Host ("SOAK(PHP): Logs -> {0}" -f $LogDir)

  for ($iter = 1; $iter -le $Iterations; $iter++) {
    $iterStart = Get-Date
    $logPath = Join-Path $LogDir ("iter_{0:000}.log" -f $iter)
    $snapshotPath = $null
    if ($SnapshotDir -and $SnapshotDir.Trim() -ne "") {
      $snapshotPath = Join-Path $SnapshotDir ("iter_{0:000}_snapshot.json" -f $iter)
    }
    Write-Host ""
    Write-Host ("SOAK(PHP) ITER {0}/{1} -> {2}" -f $iter, $Iterations, $logPath)

    try {
      $args = @(
        "-NoProfile","-File",".\\tmp\\billing-ledger-php\\tests\\006_php_race.ps1",
        "-ContainerName",$ContainerName,
        "-HostPort",$HostPort,
        "-PhpImage",$PhpImage
      )
      if ($snapshotPath) {
        $args += @("-SnapshotPath",$snapshotPath)
      }

      & pwsh @args 2>&1 `
        | Tee-Object -FilePath $logPath | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "006_php_race.ps1 exited $LASTEXITCODE" }

      $pass++
      $dur = (Get-Date) - $iterStart
      Write-Host ("SOAK(PHP) ITER {0}: PASS ({1:n1}s)" -f $iter, $dur.TotalSeconds)
      $timing.Add([ordered]@{
        iteration = $iter
        started_at = $iterStart.ToString("o")
        ended_at = (Get-Date).ToString("o")
        duration_ms = [int][Math]::Round($dur.TotalMilliseconds)
        status = "PASS"
        snapshot_path = $snapshotPath
      }) | Out-Null
    } catch {
      $fail++
      $failedIterations.Add($iter) | Out-Null
      $dur = (Get-Date) - $iterStart
      Write-Host ("SOAK(PHP) ITER {0}: FAIL ({1:n1}s) -> {2}" -f $iter, $dur.TotalSeconds, $_.Exception.Message)

      $timing.Add([ordered]@{
        iteration = $iter
        started_at = $iterStart.ToString("o")
        ended_at = (Get-Date).ToString("o")
        duration_ms = [int][Math]::Round($dur.TotalMilliseconds)
        status = "FAIL"
        snapshot_path = $snapshotPath
        error = $_.Exception.Message
      }) | Out-Null
    }

    if ($SleepMsBetween -gt 0) {
      Start-Sleep -Milliseconds $SleepMsBetween
    }
  }

  $totalDur = (Get-Date) - $start
  Write-Host ""
  Write-Host "SOAK(PHP) SUMMARY"
  Write-Host ("- iterations_total: {0}" -f $Iterations)
  Write-Host ("- pass_count: {0}" -f $pass)
  Write-Host ("- fail_count: {0}" -f $fail)
  Write-Host ("- runtime_seconds: {0:n1}" -f $totalDur.TotalSeconds)

  if ($TimingTracePath -and $TimingTracePath.Trim() -ne "") {
    $dir = Split-Path -Parent $TimingTracePath
    if ($dir -and -not (Test-Path $dir)) {
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $trace = [ordered]@{
      schema = "soak_timing_trace_v1"
      started_at = $start.ToString("o")
      ended_at = (Get-Date).ToString("o")
      iterations_total = $Iterations
      pass_count = $pass
      fail_count = $fail
      iterations = $timing.ToArray()
    }
    ($trace | ConvertTo-Json -Depth 8) | Set-Content -Encoding UTF8 -Path $TimingTracePath
  }

  if ($SummaryJsonPath -and $SummaryJsonPath.Trim() -ne "") {
    $dir = Split-Path -Parent $SummaryJsonPath
    if ($dir -and -not (Test-Path $dir)) {
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $summary = [ordered]@{
      schema = "soak_run_summary_v1"
      started_at = $start.ToString("o")
      ended_at = (Get-Date).ToString("o")
      iterations_total = $Iterations
      pass_count = $pass
      fail_count = $fail
      failed_iterations = @($failedIterations.ToArray() | Sort-Object)
    }
    ($summary | ConvertTo-Json -Depth 6) | Set-Content -Encoding UTF8 -Path $SummaryJsonPath
  }

  if ($fail -gt 0) {
    Write-Host ("- failed_iterations: {0}" -f (($failedIterations | Sort-Object) -join ", "))
    throw "SOAK(PHP) FAIL: $fail failures"
  }
} finally {
  Cleanup
}
