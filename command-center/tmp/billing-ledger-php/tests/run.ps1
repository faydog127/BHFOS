param(
  [string]$ContainerName = "bhfos_billing_ledger_test_db",
  [int]$HostPort = 55432,
  [string]$PhpImage = "bhfos-ledger-php-test"
)

$ErrorActionPreference = "Stop"

function Cleanup {
  try { docker rm -f $ContainerName 2>$null | Out-Null } catch { }
}

function Exec {
  param([Parameter(Mandatory = $true)][string]$Cmd)
  & pwsh -NoProfile -Command $Cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $Cmd"
  }
}

Cleanup

Write-Host "Starting Postgres container: $ContainerName (port $HostPort)"
docker run -d --rm --name $ContainerName `
  -e POSTGRES_PASSWORD=postgres `
  -p ${HostPort}:5432 `
  -v "${PWD}\\tmp\\billing-ledger-php:/work" `
  postgres:16 | Out-Null

try {
  $running = docker ps -q -f "name=$ContainerName"
  if (-not $running) {
    throw "Postgres container did not start: $ContainerName"
  }

  Write-Host "Waiting for Postgres..."
  for ($i=0; $i -lt 30; $i++) {
    $ready = docker exec $ContainerName pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 300
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Postgres did not become ready."
  }

  Write-Host "Applying schema + addenda..."
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0000_schema.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0001_idempotency_registry.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0002_partial_refund_linkage.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0003_views_balance_and_availability.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0004_immutability_trigger.sql"

  Write-Host "Re-applying SQL to validate idempotent migrations..."
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0000_schema.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0001_idempotency_registry.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0002_partial_refund_linkage.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0003_views_balance_and_availability.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0004_immutability_trigger.sql"

  Write-Host "Running invariant tests..."
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/tests/001_invariants.sql"

  Write-Host "Running constraint-breaker tests..."
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/tests/003_constraints.sql"

  Write-Host "Running replay/recovery tests..."
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/tests/004_recovery.sql"

  Write-Host "Running lifecycle sequence tests..."
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/tests/005_lifecycle.sql"

  Write-Host "Building PHP test runner image..."
  Exec "docker build -t $PhpImage -f tmp/billing-ledger-php/tests/php/Dockerfile tmp/billing-ledger-php/tests/php"

  Write-Host "Running PHP race tests (services against real DB)..."
  Exec "pwsh -NoProfile -File .\\tmp\\billing-ledger-php\\tests\\006_php_race.ps1 -ContainerName $ContainerName -HostPort $HostPort -PhpImage $PhpImage"

  Write-Host "Running concurrency tests..."
  pwsh -NoProfile -File .\\tmp\\billing-ledger-php\\tests\\002_concurrency.ps1 -ContainerName $ContainerName

  Write-Host "ALL TESTS PASSED"
} finally {
  Cleanup
}
