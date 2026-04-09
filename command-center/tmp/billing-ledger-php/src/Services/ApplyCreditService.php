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
use BHFOS\BillingLedger\Repo\CreditMemoRepo;
use BHFOS\BillingLedger\Repo\IdempotencyRepo;
use BHFOS\BillingLedger\Repo\InvoiceRepo;
use BHFOS\BillingLedger\Repo\MoneyQueries;
use BHFOS\BillingLedger\Util\RequestHasher;

final class ApplyCreditService
{
    public function __construct(
        private MoneyDb $db,
        private IdempotencyRepo $idempotency,
        private CreditMemoRepo $creditMemos,
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
     * 2) credit memo FOR UPDATE
     * 3) invoice(s) FOR UPDATE ordered by id
     *
     * @return array{applied_cents:int, remaining_invoice_balance_cents:int, remaining_credit_available_cents:int}
     */
    public function apply(
        string $idempotencyKey,
        string $creditMemoRecordId,
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
            'credit_memo_record_id' => $creditMemoRecordId,
            'invoice_record_id' => $invoiceRecordId,
            'requested_cents' => $requestedCents,
            'mode' => $mode,
        ]);

        $didReplay = false;
        $response = $this->db->transactional(function () use (
            $idempotencyKey,
            $requestHash,
            $creditMemoRecordId,
            $invoiceRecordId,
            $requestedCents,
            $createdByUserId,
            $mode,
            &$didReplay
        ) {
            $begin = $this->idempotency->begin($idempotencyKey, 'apply_credit', $requestHash);
            if ($begin['is_replay']) {
                $didReplay = true;
                return $begin['response'];
            }

            $creditMemo = $this->creditMemos->lockCreditMemo($creditMemoRecordId);
            $invoice = $this->invoices->lockInvoices([$invoiceRecordId])[$invoiceRecordId];

            if ((string)$creditMemo['status'] !== 'issued') {
                throw new NotAllocatable('Only issued credit memos can be applied.');
            }

            $invoiceStatus = (string)$invoice['status'];
            if ($invoiceStatus === 'draft' || $invoiceStatus === 'void') {
                throw new NotAllocatable('Invoice is not allocatable.');
            }

            if ((string)$creditMemo['payer_id'] !== (string)$invoice['payer_id']) {
                throw new ScopeMismatch('Credit memo payer does not match invoice payer.');
            }

            if ((string)$creditMemo['currency_code'] !== (string)$invoice['currency_code']) {
                throw new ScopeMismatch('Credit memo currency does not match invoice currency.');
            }

            if ((string)$creditMemo['billing_case_id'] !== (string)$invoice['billing_case_id']) {
                throw new ScopeMismatch('Credit memo billing case does not match invoice billing case.');
            }

            $invoiceBalance = $this->queries->getInvoiceLiveBalance($invoiceRecordId);
            $creditAvailable = $this->queries->getIssuedCreditAvailableAmount($creditMemoRecordId);

            $applyCents = min($requestedCents, $invoiceBalance, $creditAvailable);

            if ($mode === ApplyMode::STRICT && $applyCents !== $requestedCents) {
                throw new InsufficientAvailableAmount('Requested credit cannot be fully applied.', [
                    'requested_cents' => $requestedCents,
                    'invoice_balance_cents' => $invoiceBalance,
                    'credit_available_cents' => $creditAvailable,
                ]);
            }

            if ($applyCents <= 0) {
                throw new InsufficientAvailableAmount('No applicable credit remains.', [
                    'invoice_balance_cents' => $invoiceBalance,
                    'credit_available_cents' => $creditAvailable,
                ]);
            }

            $stmt = $this->db->pdo()->prepare(
                "insert into credit_applications (
                    credit_application_id,
                    credit_memo_record_id,
                    invoice_record_id,
                    payer_id,
                    currency_code,
                    billing_case_id,
                    applied_cents,
                    effective_at,
                    idempotency_key,
                    created_by_user_id,
                    created_at,
                    reversal_of_credit_application_id
                 ) values (
                    :id,
                    :credit_memo_id,
                    :invoice_id,
                    :payer_id,
                    :currency_code,
                    :billing_case_id,
                    :applied_cents,
                    now(),
                    :idempotency_key,
                    :created_by_user_id,
                    now(),
                    null
                 )"
            );

            $stmt->execute([
                ':id' => $this->uuid->uuidV4(),
                ':credit_memo_id' => $creditMemoRecordId,
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
                'remaining_credit_available_cents' => $creditAvailable - $applyCents,
            ];

            $this->idempotency->complete($idempotencyKey, $response);
            return $response;
        });

        if (!$didReplay) {
            $this->events->emit('money.apply_credit', [
                'idempotency_key' => $idempotencyKey,
                'credit_memo_record_id' => $creditMemoRecordId,
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
