param(
  [string]$ContainerName = "bhfos_billing_ledger_race_db",
  [int]$HostPort = 55433,
  [string]$PhpImage = "bhfos-ledger-php-test"
)

$ErrorActionPreference = "Stop"

function Cleanup {
  try { docker rm -f $ContainerName 2>$null | Out-Null } catch { }
}

function Exec {
  param([Parameter(Mandatory = $true)][string]$Cmd)
  & pwsh -NoProfile -Command $Cmd
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Cmd" }
}

Cleanup

Write-Host "Starting Postgres container: $ContainerName (port $HostPort)"
docker run -d --rm --name $ContainerName `
  -e POSTGRES_PASSWORD=postgres `
  -p ${HostPort}:5432 `
  -v "${PWD}\\tmp\\billing-ledger-php:/work" `
  postgres:16 | Out-Null

try {
  Write-Host "Waiting for Postgres..."
  for ($i=0; $i -lt 30; $i++) {
    docker exec $ContainerName pg_isready -U postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 300
  }
  if ($LASTEXITCODE -ne 0) { throw "Postgres did not become ready." }

  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0000_schema.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0001_idempotency_registry.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0002_partial_refund_linkage.sql"
  Exec "docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /work/sql/0003_views_balance_and_availability.sql"

  Write-Host "Building PHP test runner image..."
  Exec "docker build -t $PhpImage -f tmp/billing-ledger-php/tests/php/Dockerfile tmp/billing-ledger-php/tests/php"

  Write-Host "Running PHP race tests..."
  Exec "pwsh -NoProfile -File .\\tmp\\billing-ledger-php\\tests\\006_php_race.ps1 -ContainerName $ContainerName -HostPort $HostPort -PhpImage $PhpImage"

  Write-Host "RACE TESTS PASSED"
} finally {
  Cleanup
}

