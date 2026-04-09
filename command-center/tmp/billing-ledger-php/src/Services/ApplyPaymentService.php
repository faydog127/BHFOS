<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Services;

use BHFOS\BillingLedger\Contracts\EventSink;
use BHFOS\BillingLedger\Contracts\UuidGenerator;
use BHFOS\BillingLedger\Db\MoneyDb;
use BHFOS\BillingLedger\Domain\ApplyMode;
use BHFOS\BillingLedger\Domain\Errors\InsufficientAvailableAmount;
use BHFOS\BillingLedger\Domain\Errors\NotAllocatable;
use BHFOS\BillingLedger\Domain\Errors\ScopeMismatch;
use BHFOS\BillingLedger\Infra\NullEventSink;
use BHFOS\BillingLedger\Repo\IdempotencyRepo;
use BHFOS\BillingLedger\Repo\InvoiceRepo;
use BHFOS\BillingLedger\Repo\MoneyQueries;
use BHFOS\BillingLedger\Repo\PaymentRepo;
use BHFOS\BillingLedger\Util\RequestHasher;

final class ApplyPaymentService
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
     * Lock order (non-negotiable):
     * 1) idempotency begin
     * 2) payment FOR UPDATE
     * 3) invoice(s) FOR UPDATE ordered by id
     *
     * @return array{applied_cents:int, remaining_invoice_balance_cents:int, remaining_payment_available_cents:int}
     */
    public function apply(
        string $idempotencyKey,
        string $paymentRecordId,
        string $invoiceRecordId,
        int $requestedCents,
        string $createdByUserId,
        string $mode = ApplyMode::CLAMP
    ): array {
        ApplyMode::assertValid($mode);
        if ($requestedCents <= 0) {
            throw new \InvalidArgumentException('Requested amount must be positive.');
        }

        $requestHash = RequestHasher::hash([
            'payment_record_id' => $paymentRecordId,
            'invoice_record_id' => $invoiceRecordId,
            'requested_cents' => $requestedCents,
            'mode' => $mode,
        ]);

        $didReplay = false;
        $response = $this->db->transactional(function () use (
            $idempotencyKey,
            $requestHash,
            $paymentRecordId,
            $invoiceRecordId,
            $requestedCents,
            $createdByUserId,
            $mode,
            &$didReplay
        ) {
            $begin = $this->idempotency->begin($idempotencyKey, 'apply_payment', $requestHash);
            if ($begin['is_replay']) {
                $didReplay = true;
                return $begin['response'];
            }

            $payment = $this->payments->lockPayment($paymentRecordId);
            $invoice = $this->invoices->lockInvoices([$invoiceRecordId])[$invoiceRecordId];

            if ((string)$payment['status'] !== 'settled') {
                throw new NotAllocatable('Only settled payments can be allocated.');
            }

            $invoiceStatus = (string)$invoice['status'];
            if ($invoiceStatus === 'draft' || $invoiceStatus === 'void') {
                throw new NotAllocatable('Invoice is not allocatable.');
            }

            if ((string)$payment['payer_id'] !== (string)$invoice['payer_id']) {
                throw new ScopeMismatch('Payment payer does not match invoice payer.');
            }

            if ((string)$payment['currency_code'] !== (string)$invoice['currency_code']) {
                throw new ScopeMismatch('Payment currency does not match invoice currency.');
            }

            $invoiceBalance = $this->queries->getInvoiceLiveBalance($invoiceRecordId);
            $paymentAvailable = $this->queries->getSettledPaymentAvailableAmount($paymentRecordId);

            $applyCents = min($requestedCents, $invoiceBalance, $paymentAvailable);

            if ($mode === ApplyMode::STRICT && $applyCents !== $requestedCents) {
                throw new InsufficientAvailableAmount('Requested amount cannot be fully applied.', [
                    'requested_cents' => $requestedCents,
                    'invoice_balance_cents' => $invoiceBalance,
                    'payment_available_cents' => $paymentAvailable,
                ]);
            }

            if ($applyCents <= 0) {
                throw new InsufficientAvailableAmount('No allocatable amount remains.', [
                    'invoice_balance_cents' => $invoiceBalance,
                    'payment_available_cents' => $paymentAvailable,
                ]);
            }

            $stmt = $this->db->pdo()->prepare(
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
                    null
                 )"
            );

            $stmt->execute([
                ':id' => $this->uuid->uuidV4(),
                ':payment_id' => $paymentRecordId,
                ':invoice_id' => $invoiceRecordId,
                ':payer_id' => (string)$invoice['payer_id'],
                ':currency_code' => (string)$invoice['currency_code'],
                ':billing_case_id' => (string)$invoice['billing_case_id'],
                ':applied_cents' => $applyCents,
                ':idempotency_key' => $idempotencyKey,
                ':created_by_user_id' => $createdByUserId,
            ]);

            $response = [
                'applied_cents' => $applyCents,
                'remaining_invoice_balance_cents' => $invoiceBalance - $applyCents,
                'remaining_payment_available_cents' => $paymentAvailable - $applyCents,
            ];

            $this->idempotency->complete($idempotencyKey, $response);
            return $response;
        });

        if (!$didReplay) {
            $this->events->emit('money.apply_payment', [
                'idempotency_key' => $idempotencyKey,
                'payment_record_id' => $paymentRecordId,
                'invoice_record_id' => $invoiceRecordId,
                'requested_cents' => $requestedCents,
                'applied_cents' => $response['applied_cents'] ?? null,
                'mode' => $mode,
                'created_by_user_id' => $createdByUserId,
            ]);
        }

        return $response;
    }
}
