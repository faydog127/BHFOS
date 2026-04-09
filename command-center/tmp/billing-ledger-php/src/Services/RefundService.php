<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Services;

use BHFOS\BillingLedger\Contracts\EventSink;
use BHFOS\BillingLedger\Contracts\UuidGenerator;
use BHFOS\BillingLedger\Db\MoneyDb;
use BHFOS\BillingLedger\Domain\Errors\NotAllocatable;
use BHFOS\BillingLedger\Domain\Errors\RefundExceedsRefundable;
use BHFOS\BillingLedger\Domain\Errors\ScopeMismatch;
use BHFOS\BillingLedger\Infra\NullEventSink;
use BHFOS\BillingLedger\Repo\IdempotencyRepo;
use BHFOS\BillingLedger\Repo\InvoiceRepo;
use BHFOS\BillingLedger\Repo\MoneyQueries;
use BHFOS\BillingLedger\Repo\PaymentRepo;
use BHFOS\BillingLedger\Util\RequestHasher;
use PDO;

final class RefundService
{
    public function __construct(
        private MoneyDb $db,
        private IdempotencyRepo $idempotency,
        private PaymentRepo $payments,
        private InvoiceRepo $invoices,
        private MoneyQueries $queries,
        private UuidGenerator $uuid,
        ?EventSink $events = null
    ) {
        $this->events = $events ?? new NullEventSink();
    }

    private EventSink $events;

    /**
     * Invoice-impacting refund (atomic):
     * - Inserts payment_refunds row (processor truth)
     * - Inserts negative payment_allocations row linked via refund_of_payment_allocation_id (invoice truth)
     *
     * @return array{refund_cents:int, remaining_refundable_cents:int, invoice_balance_cents:int}
     */
    public function refundInvoiceImpacting(
        string $idempotencyKey,
        string $paymentRecordId,
        string $invoiceRecordId,
        string $originalPaymentAllocationId,
        int $refundCents,
        string $processorRefundId,
        string $createdByUserId
    ): array {
        if ($refundCents <= 0) {
            throw new \InvalidArgumentException('Refund amount must be positive.');
        }

        $requestHash = RequestHasher::hash([
            'payment_record_id' => $paymentRecordId,
            'invoice_record_id' => $invoiceRecordId,
            'original_payment_allocation_id' => $originalPaymentAllocationId,
            'refund_cents' => $refundCents,
            'processor_refund_id' => $processorRefundId,
        ]);

        $didReplay = false;
        $response = $this->db->transactional(function () use (
            $idempotencyKey,
            $requestHash,
            $paymentRecordId,
            $invoiceRecordId,
            $originalPaymentAllocationId,
            $refundCents,
            $processorRefundId,
            $createdByUserId,
            &$didReplay
        ) {
            $begin = $this->idempotency->begin($idempotencyKey, 'refund_invoice_impacting', $requestHash);
            if ($begin['is_replay']) {
                $didReplay = true;
                return $begin['response'];
            }

            // Lock order: payment, invoices, dependent ledger rows.
            $payment = $this->payments->lockPayment($paymentRecordId);
            $invoice = $this->invoices->lockInvoices([$invoiceRecordId])[$invoiceRecordId];

            if ((string)$payment['status'] !== 'settled') {
                throw new NotAllocatable('Only settled payments can be refunded.');
            }

            if ((string)$payment['payer_id'] !== (string)$invoice['payer_id'] || (string)$payment['currency_code'] !== (string)$invoice['currency_code']) {
                throw new ScopeMismatch('Payment scope does not match invoice scope.');
            }

            $allocationStmt = $this->db->pdo()->prepare(
                "select *
                 from payment_allocations
                 where payment_allocation_id = :id
                 for update"
            );
            $allocationStmt->execute([':id' => $originalPaymentAllocationId]);
            $originalAllocation = $allocationStmt->fetch(PDO::FETCH_ASSOC);

            if (!$originalAllocation) {
                throw new \RuntimeException('Original allocation not found.');
            }

            if ((string)$originalAllocation['payment_record_id'] !== $paymentRecordId ||
                (string)$originalAllocation['invoice_record_id'] !== $invoiceRecordId) {
                throw new ScopeMismatch('Original allocation does not match payment/invoice.');
            }

            $originalApplied = (int)$originalAllocation['applied_cents'];
            if ($originalApplied <= 0) {
                throw new NotAllocatable('Original allocation must be a positive applied row.');
            }

            $alreadyRefunded = $this->queries->getRefundedAgainstAllocation($originalPaymentAllocationId);
            $remainingRefundable = max(0, $originalApplied - $alreadyRefunded);

            if ($refundCents > $remainingRefundable) {
                throw new RefundExceedsRefundable($refundCents, $remainingRefundable, [
                    'original_applied_cents' => $originalApplied,
                    'already_refunded_cents' => $alreadyRefunded,
                ]);
            }

            $refundStmt = $this->db->pdo()->prepare(
                "insert into payment_refunds (
                    refund_id,
                    payment_record_id,
                    refund_amount_cents,
                    status,
                    processor_refund_id,
                    refunded_at,
                    created_at
                 ) values (
                    :id,
                    :payment_id,
                    :amount,
                    'settled',
                    :processor_refund_id,
                    now(),
                    now()
                 )"
            );
            $refundStmt->execute([
                ':id' => $this->uuid->uuidV4(),
                ':payment_id' => $paymentRecordId,
                ':amount' => $refundCents,
                ':processor_refund_id' => $processorRefundId,
            ]);

            $adjustStmt = $this->db->pdo()->prepare(
                "insert into payment_allocations (
                    payment_allocation_id,
                    payment_record_id,
                    invoice_record_id,
                    payer_id,
                    currency_code,
                    billing_case_id,
                    applied_cents,
                    effective_at,
                    idempotency_key,
                    created_by_user_id,
                    created_at,
                    reversal_of_payment_allocation_id,
                    refund_of_payment_allocation_id
                 ) values (
                    :id,
                    :payment_id,
                    :invoice_id,
                    :payer_id,
                    :currency_code,
                    :billing_case_id,
                    :applied_cents,
                    now(),
                    :idempotency_key,
                    :created_by_user_id,
                    now(),
                    null,
                    :refund_of
                 )"
            );

            $adjustStmt->execute([
                ':id' => $this->uuid->uuidV4(),
                ':payment_id' => $paymentRecordId,
                ':invoice_id' => $invoiceRecordId,
                ':payer_id' => (string)$invoice['payer_id'],
                ':currency_code' => (string)$invoice['currency_code'],
                ':billing_case_id' => (string)$invoice['billing_case_id'],
                ':applied_cents' => -$refundCents,
                ':idempotency_key' => $idempotencyKey,
                ':created_by_user_id' => $createdByUserId,
                ':refund_of' => $originalPaymentAllocationId,
            ]);

            $invoiceBalance = $this->queries->getInvoiceLiveBalance($invoiceRecordId);

            $response = [
                'refund_cents' => $refundCents,
                'remaining_refundable_cents' => $remainingRefundable - $refundCents,
                'invoice_balance_cents' => $invoiceBalance,
            ];

            $this->idempotency->complete($idempotencyKey, $response);
            return $response;
        });

        if (!$didReplay) {
            $this->events->emit('money.refund_invoice_impacting', [
                'idempotency_key' => $idempotencyKey,
                'payment_record_id' => $paymentRecordId,
                'invoice_record_id' => $invoiceRecordId,
                'original_payment_allocation_id' => $originalPaymentAllocationId,
                'refund_cents' => $refundCents,
                'processor_refund_id' => $processorRefundId,
                'created_by_user_id' => $createdByUserId,
            ]);
        }

        return $response;
    }
}
