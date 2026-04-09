<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Services;

use BHFOS\BillingLedger\Contracts\EventSink;
use BHFOS\BillingLedger\Contracts\UuidGenerator;
use BHFOS\BillingLedger\Db\MoneyDb;
use BHFOS\BillingLedger\Domain\ApplyMode;
use BHFOS\BillingLedger\Domain\Errors\InsufficientAvailableAmount;
use BHFOS\BillingLedger\Domain\Errors\NotAllocatable;
use BHFOS\BillingLedger\Infra\NullEventSink;
use BHFOS\BillingLedger\Repo\IdempotencyRepo;
use BHFOS\BillingLedger\Repo\InvoiceRepo;
use BHFOS\BillingLedger\Repo\MoneyQueries;
use BHFOS\BillingLedger\Util\RequestHasher;

final class WriteOffService
{
    public function __construct(
        private MoneyDb $db,
        private IdempotencyRepo $idempotency,
        private InvoiceRepo $invoices,
        private MoneyQueries $queries,
        private UuidGenerator $uuid,
        ?EventSink $events = null
    ) {
        $this->events = $events ?? new NullEventSink();
    }

    private EventSink $events;

    /**
     * @return array{writeoff_cents:int, remaining_invoice_balance_cents:int}
     */
    public function apply(
        string $idempotencyKey,
        string $invoiceRecordId,
        int $requestedCents,
        string $reasonCode,
        string $createdByUserId,
        string $mode = ApplyMode::CLAMP
    ): array {
        ApplyMode::assertValid($mode);
        if ($requestedCents <= 0) {
            throw new \InvalidArgumentException('Writeoff amount must be positive.');
        }

        $requestHash = RequestHasher::hash([
            'invoice_record_id' => $invoiceRecordId,
            'requested_cents' => $requestedCents,
            'reason_code' => $reasonCode,
            'mode' => $mode,
        ]);

        $didReplay = false;
        $response = $this->db->transactional(function () use (
            $idempotencyKey,
            $requestHash,
            $invoiceRecordId,
            $requestedCents,
            $reasonCode,
            $createdByUserId,
            $mode,
            &$didReplay
        ) {
            $begin = $this->idempotency->begin($idempotencyKey, 'writeoff_invoice', $requestHash);
            if ($begin['is_replay']) {
                $didReplay = true;
                return $begin['response'];
            }

            $invoice = $this->invoices->lockInvoices([$invoiceRecordId])[$invoiceRecordId];
            $invoiceStatus = (string)$invoice['status'];
            if ($invoiceStatus === 'draft' || $invoiceStatus === 'void') {
                throw new NotAllocatable('Invoice is not writeoff-eligible.');
            }

            $balance = $this->queries->getInvoiceLiveBalance($invoiceRecordId);
            $applyCents = min($requestedCents, $balance);

            if ($mode === ApplyMode::STRICT && $applyCents !== $requestedCents) {
                throw new InsufficientAvailableAmount('Requested writeoff cannot be fully applied.', [
                    'requested_cents' => $requestedCents,
                    'invoice_balance_cents' => $balance,
                ]);
            }

            if ($applyCents <= 0) {
                throw new InsufficientAvailableAmount('No writeoff amount can be applied.', [
                    'invoice_balance_cents' => $balance,
                ]);
            }

            $stmt = $this->db->pdo()->prepare(
                "insert into invoice_writeoffs (
                    writeoff_id,
                    invoice_record_id,
                    applied_cents,
                    reason_code,
                    effective_at,
                    created_by_user_id,
                    created_at,
                    idempotency_key,
                    reversal_of_writeoff_id
                 ) values (
                    :id,
                    :invoice_id,
                    :applied_cents,
                    :reason_code,
                    now(),
                    :created_by_user_id,
                    now(),
                    :idempotency_key,
                    null
                 )"
            );

            $stmt->execute([
                ':id' => $this->uuid->uuidV4(),
                ':invoice_id' => $invoiceRecordId,
                ':applied_cents' => $applyCents,
                ':reason_code' => $reasonCode,
                ':created_by_user_id' => $createdByUserId,
                ':idempotency_key' => $idempotencyKey,
            ]);

            $response = [
                'writeoff_cents' => $applyCents,
                'remaining_invoice_balance_cents' => $balance - $applyCents,
            ];

            $this->idempotency->complete($idempotencyKey, $response);
            return $response;
        });

        if (!$didReplay) {
            $this->events->emit('money.writeoff_invoice', [
                'idempotency_key' => $idempotencyKey,
                'invoice_record_id' => $invoiceRecordId,
                'requested_cents' => $requestedCents,
                'writeoff_cents' => $response['writeoff_cents'] ?? null,
                'reason_code' => $reasonCode,
                'mode' => $mode,
                'created_by_user_id' => $createdByUserId,
            ]);
        }

        return $response;
    }
}
