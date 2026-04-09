<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Repo;

use BHFOS\BillingLedger\Domain\Errors\NotFound;
use PDO;

final class MoneyQueries
{
    public function __construct(private PDO $pdo) {}

    public function getInvoiceLiveBalance(string $invoiceRecordId): int
    {
        $sql = <<<SQL
        select
          case
            when i.status = 'void' then 0
            else greatest(
              0,
              i.grand_total_cents
              - coalesce((
                select sum(pa.applied_cents)
                from payment_allocations pa
                join payments p on p.payment_record_id = pa.payment_record_id
                where pa.invoice_record_id = i.invoice_record_id
                  and p.status = 'settled'
              ), 0)
              - coalesce((
                select sum(ca.applied_cents)
                from credit_applications ca
                join credit_memos cm on cm.credit_memo_record_id = ca.credit_memo_record_id
                where ca.invoice_record_id = i.invoice_record_id
                  and cm.status = 'issued'
              ), 0)
              - coalesce((
                select sum(iw.applied_cents)
                from invoice_writeoffs iw
                where iw.invoice_record_id = i.invoice_record_id
              ), 0)
            )
          end as balance_due_cents
        from invoices i
        where i.invoice_record_id = :invoice_id
        SQL;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':invoice_id' => $invoiceRecordId]);
        $value = $stmt->fetchColumn();

        if ($value === false) {
            throw new NotFound('invoice', $invoiceRecordId);
        }

        return (int)$value;
    }

    public function getSettledPaymentAvailableAmount(string $paymentRecordId): int
    {
        $sql = <<<SQL
        select
          case
            when p.status <> 'settled' then 0
            else greatest(
              0,
              p.amount_cents
              - coalesce((
                select sum(pr.refund_amount_cents)
                from payment_refunds pr
                where pr.payment_record_id = p.payment_record_id
                  and pr.status = 'settled'
              ), 0)
              - coalesce((
                select sum(pa.applied_cents)
                from payment_allocations pa
                where pa.payment_record_id = p.payment_record_id
              ), 0)
            )
          end as available_cents
        from payments p
        where p.payment_record_id = :payment_id
        SQL;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':payment_id' => $paymentRecordId]);
        $value = $stmt->fetchColumn();

        if ($value === false) {
            throw new NotFound('payment', $paymentRecordId);
        }

        return (int)$value;
    }

    public function getIssuedCreditAvailableAmount(string $creditMemoRecordId): int
    {
        $sql = <<<SQL
        select
          case
            when cm.status <> 'issued' then 0
            else greatest(0,
              cm.credit_total_cents
              - coalesce((
                select sum(ca.applied_cents)
                from credit_applications ca
                where ca.credit_memo_record_id = cm.credit_memo_record_id
              ), 0)
            )
          end as available_cents
        from credit_memos cm
        where cm.credit_memo_record_id = :credit_memo_id
        SQL;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':credit_memo_id' => $creditMemoRecordId]);
        $value = $stmt->fetchColumn();

        if ($value === false) {
            throw new NotFound('credit_memo', $creditMemoRecordId);
        }

        return (int)$value;
    }

    public function getRefundedAgainstAllocation(string $paymentAllocationId): int
    {
        $stmt = $this->pdo->prepare(
            "select coalesce(sum(-pa.applied_cents), 0) as refunded_cents
             from payment_allocations pa
             where pa.refund_of_payment_allocation_id = :id
               and pa.applied_cents < 0"
        );
        $stmt->execute([':id' => $paymentAllocationId]);
        return (int)($stmt->fetchColumn() ?: 0);
    }
}

