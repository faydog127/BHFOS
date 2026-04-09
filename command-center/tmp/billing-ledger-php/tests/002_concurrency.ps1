param(
  [Parameter(Mandatory = $true)][string]$ContainerName
)

$ErrorActionPreference = "Stop"

function ExecPsql {
  param([Parameter(Mandatory = $true)][string]$Sql)
  docker exec $ContainerName psql -U postgres -d postgres -t -A -c $Sql
}

Write-Host "Concurrency: idempotency_begin blocks + replays"

$key = "concurrency:key:1"
$op = "op_concurrency"
$hash = "hash_concurrency"

$jobA = Start-Job -ScriptBlock {
  param($c, $key, $op, $hash)
  docker exec $c psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -c "begin; select idempotency_begin('$key','$op','$hash'); select pg_sleep(2); select idempotency_complete('$key', '{""ok"":true}'::jsonb); commit;"
} -ArgumentList $ContainerName, $key, $op, $hash

Start-Sleep -Milliseconds 200

$jobB = Start-Job -ScriptBlock {
  param($c, $key, $op, $hash)
  docker exec $c psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -c "select idempotency_begin('$key','$op','$hash');"
} -ArgumentList $ContainerName, $key, $op, $hash

$outA = Receive-Job $jobA -Wait -AutoRemoveJob
$outB = Receive-Job $jobB -Wait -AutoRemoveJob

Write-Host "A output:"; Write-Host $outA
Write-Host "B output:"; Write-Host $outB

if ($outB -notmatch '"kind"\s*:\s*"replay"' -and $outB -notmatch 'replay') {
  throw "Expected second concurrent begin to replay after blocking."
}

Write-Host "OK"
