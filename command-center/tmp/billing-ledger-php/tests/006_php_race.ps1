param(
  [Parameter(Mandatory = $true)][string]$ContainerName,
  [int]$HostPort = 55432,
  [string]$PhpImage = "bhfos-ledger-php-test",
  [string]$SnapshotPath = ""
)

$ErrorActionPreference = "Stop"

function PsqlScalar {
  param([Parameter(Mandatory = $true)][string]$Sql)
  $out = docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -c $Sql
  return ($out | Select-Object -Last 1).Trim()
}

function PsqlExec {
  param([Parameter(Mandatory = $true)][string]$Sql)
  docker exec $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c $Sql | Out-Null
}

function RunPhp {
  param(
    [Parameter(Mandatory = $true)][string[]]$Args,
    [Parameter(Mandatory = $true)][string]$LedgerRoot
  )
  $envs = @(
    "-e","DB_HOST=host.docker.internal",
    "-e","DB_PORT=$HostPort",
    "-e","DB_NAME=postgres",
    "-e","DB_USER=postgres",
    "-e","DB_PASS=postgres"
  )

  $mount = "${LedgerRoot}:/work"

  $cmd = @("docker","run","--rm","-v",$mount,"-w","/work") + $envs + @($PhpImage,"php") + $Args
  & $cmd 2>$null
}

function Assert {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

$LedgerRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$userId = [guid]::NewGuid().ToString()

$snap = [ordered]@{
  schema = "php_race_snapshot_v1"
  captured_at = (Get-Date).ToString("o")
  credit_race = $null
  refund_race = $null
}

Write-Host "PHP Race 1: apply credit vs apply credit (same credit memo balance)"

$payer = [guid]::NewGuid().ToString()
$bc = [guid]::NewGuid().ToString()
$invA = [guid]::NewGuid().ToString()
$invB = [guid]::NewGuid().ToString()
$cm = [guid]::NewGuid().ToString()

PsqlExec "insert into billing_cases (billing_case_id, payer_id, currency_code) values ('$bc','$payer','USD')"
PsqlExec @"
insert into invoices (invoice_record_id,billing_case_id,payer_id,currency_code,invoice_number,status,collection_status,issue_date,due_date,issued_at,grand_total_cents)
values
  ('$invA','$bc','$payer','USD','INV-RACE-A-$([guid]::NewGuid())','issued','active',current_date,current_date,now(),100000),
  ('$invB','$bc','$payer','USD','INV-RACE-B-$([guid]::NewGuid())','issued','active',current_date,current_date,now(),100000)
"@

PsqlExec "insert into credit_memos (credit_memo_record_id,billing_case_id,payer_id,currency_code,credit_memo_number,issue_date,credit_total_cents,status,issued_at) values ('$cm','$bc','$payer','USD','CM-RACE-$([guid]::NewGuid())',current_date,3000,'issued',now())"

$idem1 = "race:credit:" + [guid]::NewGuid().ToString()
$idem2 = "race:credit:" + [guid]::NewGuid().ToString()

$job1Start = Get-Date
$job1 = Start-Job -ScriptBlock {
  param($idem,$cm,$inv,$user,$root,$img,$port)
  $env:DB_PORT = $port
  docker run --rm -v "${root}:/work" -w /work `
    -e DB_HOST=host.docker.internal -e DB_PORT=$port -e DB_NAME=postgres -e DB_USER=postgres -e DB_PASS=postgres `
    $img php /work/tests/php/bin/apply_credit.php $idem $cm $inv 2000 $user strict
} -ArgumentList $idem1,$cm,$invA,$userId,$LedgerRoot,$PhpImage,$HostPort

$job2Start = Get-Date
$job2 = Start-Job -ScriptBlock {
  param($idem,$cm,$inv,$user,$root,$img,$port)
  $env:DB_PORT = $port
  docker run --rm -v "${root}:/work" -w /work `
    -e DB_HOST=host.docker.internal -e DB_PORT=$port -e DB_NAME=postgres -e DB_USER=postgres -e DB_PASS=postgres `
    $img php /work/tests/php/bin/apply_credit.php $idem $cm $inv 2000 $user strict
} -ArgumentList $idem2,$cm,$invB,$userId,$LedgerRoot,$PhpImage,$HostPort

$out1 = Receive-Job $job1 -Wait -AutoRemoveJob
$job1Dur = (Get-Date) - $job1Start
$out2 = Receive-Job $job2 -Wait -AutoRemoveJob
$job2Dur = (Get-Date) - $job2Start

$r1 = $out1 | ConvertFrom-Json
$r2 = $out2 | ConvertFrom-Json

Assert (($r1.ok -eq $true) -xor ($r2.ok -eq $true)) "Expected exactly one apply_credit to succeed in strict mode."
Assert ((($r1.ok -eq $false) -and ($r1.error.code -eq 'ERR_INSUFFICIENT_AVAILABLE')) -or (($r2.ok -eq $false) -and ($r2.error.code -eq 'ERR_INSUFFICIENT_AVAILABLE'))) "Expected losing apply_credit to fail with ERR_INSUFFICIENT_AVAILABLE."

$applied = [int](PsqlScalar "select coalesce(sum(applied_cents),0) from credit_applications where credit_memo_record_id = '$cm'")
Assert ($applied -eq 2000) "Expected total applied credits 2000, got $applied."

$remaining = [int](PsqlScalar "select unapplied_cents from credit_memo_available_balance_view where credit_memo_record_id = '$cm'")
Assert ($remaining -eq 1000) "Expected remaining credit 1000, got $remaining."

$snap.credit_race = [ordered]@{
  credit_memo_record_id = $cm
  billing_case_id = $bc
  payer_id = $payer
  currency_code = "USD"
  requested_cents_each = 2000
  credit_total_cents = 3000
  results = @(
    [ordered]@{ worker_id = "w1"; ok = $r1.ok; error_code = if ($r1.ok) { $null } else { $r1.error.code }; duration_ms = [int][Math]::Round($job1Dur.TotalMilliseconds) }
    [ordered]@{ worker_id = "w2"; ok = $r2.ok; error_code = if ($r2.ok) { $null } else { $r2.error.code }; duration_ms = [int][Math]::Round($job2Dur.TotalMilliseconds) }
  )
  final = [ordered]@{
    applied_total_cents = $applied
    remaining_unapplied_cents = $remaining
  }
}

Write-Host "OK"

Write-Host "PHP Race 2: refund vs refund (same original allocation)"

$payer2 = [guid]::NewGuid().ToString()
$bc2 = [guid]::NewGuid().ToString()
$inv = [guid]::NewGuid().ToString()
$pay = [guid]::NewGuid().ToString()
$alloc = [guid]::NewGuid().ToString()

PsqlExec "insert into billing_cases (billing_case_id, payer_id, currency_code) values ('$bc2','$payer2','USD')"
PsqlExec "insert into invoices (invoice_record_id,billing_case_id,payer_id,currency_code,invoice_number,status,collection_status,issue_date,due_date,issued_at,grand_total_cents) values ('$inv','$bc2','$payer2','USD','INV-RACE-RF-$([guid]::NewGuid())','issued','active',current_date,current_date,now(),1000)"
PsqlExec "insert into payments (payment_record_id,payer_id,currency_code,payment_date,amount_cents,status,processor,processor_transaction_id) values ('$pay','$payer2','USD',current_date,1000,'settled','test','tx-race-rf-$([guid]::NewGuid())')"
PsqlExec "insert into payment_allocations (payment_allocation_id,payment_record_id,invoice_record_id,payer_id,currency_code,billing_case_id,applied_cents,idempotency_key) values ('$alloc','$pay','$inv','$payer2','USD','$bc2',1000,'race:alloc:$([guid]::NewGuid())')"

$idemR1 = "race:refund:" + [guid]::NewGuid().ToString()
$idemR2 = "race:refund:" + [guid]::NewGuid().ToString()
$proc1 = "proc_rf_" + [guid]::NewGuid().ToString()
$proc2 = "proc_rf_" + [guid]::NewGuid().ToString()

$jobR1Start = Get-Date
$jobR1 = Start-Job -ScriptBlock {
  param($idem,$pay,$inv,$alloc,$cents,$proc,$user,$root,$img,$port)
  docker run --rm -v "${root}:/work" -w /work `
    -e DB_HOST=host.docker.internal -e DB_PORT=$port -e DB_NAME=postgres -e DB_USER=postgres -e DB_PASS=postgres `
    $img php /work/tests/php/bin/refund_invoice_impacting.php $idem $pay $inv $alloc $cents $proc $user
} -ArgumentList $idemR1,$pay,$inv,$alloc,800,$proc1,$userId,$LedgerRoot,$PhpImage,$HostPort

$jobR2Start = Get-Date
$jobR2 = Start-Job -ScriptBlock {
  param($idem,$pay,$inv,$alloc,$cents,$proc,$user,$root,$img,$port)
  docker run --rm -v "${root}:/work" -w /work `
    -e DB_HOST=host.docker.internal -e DB_PORT=$port -e DB_NAME=postgres -e DB_USER=postgres -e DB_PASS=postgres `
    $img php /work/tests/php/bin/refund_invoice_impacting.php $idem $pay $inv $alloc $cents $proc $user
} -ArgumentList $idemR2,$pay,$inv,$alloc,800,$proc2,$userId,$LedgerRoot,$PhpImage,$HostPort

$o1 = Receive-Job $jobR1 -Wait -AutoRemoveJob
$jobR1Dur = (Get-Date) - $jobR1Start
$o2 = Receive-Job $jobR2 -Wait -AutoRemoveJob
$jobR2Dur = (Get-Date) - $jobR2Start

$rr1 = $o1 | ConvertFrom-Json
$rr2 = $o2 | ConvertFrom-Json

Assert (($rr1.ok -eq $true) -xor ($rr2.ok -eq $true)) "Expected exactly one refund to succeed (second should exceed refundable)."
Assert ((($rr1.ok -eq $false) -and ($rr1.error.code -eq 'ERR_REFUND_EXCEEDS_REFUNDABLE')) -or (($rr2.ok -eq $false) -and ($rr2.error.code -eq 'ERR_REFUND_EXCEEDS_REFUNDABLE'))) "Expected losing refund to fail with ERR_REFUND_EXCEEDS_REFUNDABLE."

$refundCount = [int](PsqlScalar "select count(*) from payment_refunds where payment_record_id = '$pay' and status = 'settled'")
Assert ($refundCount -eq 1) "Expected exactly 1 settled refund row, got $refundCount."

$refundSum = [int](PsqlScalar "select coalesce(sum(-applied_cents),0) from payment_allocations where refund_of_payment_allocation_id = '$alloc' and applied_cents < 0")
Assert ($refundSum -eq 800) "Expected total refund adjustments 800, got $refundSum."

$invBalance = [int](PsqlScalar "select balance_due_cents from invoice_balance_view where invoice_record_id = '$inv'")
Assert ($invBalance -eq 800) "Expected invoice balance 800 after refund, got $invBalance."

$snap.refund_race = [ordered]@{
  payment_record_id = $pay
  invoice_record_id = $inv
  original_payment_allocation_id = $alloc
  billing_case_id = $bc2
  payer_id = $payer2
  currency_code = "USD"
  refund_cents_each = 800
  original_applied_cents = 1000
  results = @(
    [ordered]@{ worker_id = "w1"; ok = $rr1.ok; error_code = if ($rr1.ok) { $null } else { $rr1.error.code }; duration_ms = [int][Math]::Round($jobR1Dur.TotalMilliseconds) }
    [ordered]@{ worker_id = "w2"; ok = $rr2.ok; error_code = if ($rr2.ok) { $null } else { $rr2.error.code }; duration_ms = [int][Math]::Round($jobR2Dur.TotalMilliseconds) }
  )
  final = [ordered]@{
    settled_refund_row_count = $refundCount
    refund_adjustment_sum_cents = $refundSum
    invoice_balance_cents = $invBalance
  }
}

Write-Host "OK"

if ($SnapshotPath -and $SnapshotPath.Trim() -ne "") {
  $dir = Split-Path -Parent $SnapshotPath
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  ($snap | ConvertTo-Json -Depth 10) | Set-Content -Encoding UTF8 -Path $SnapshotPath
}
