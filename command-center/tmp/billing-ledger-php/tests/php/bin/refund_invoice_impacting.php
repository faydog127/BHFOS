<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

use BHFOS\BillingLedger\Db\MoneyDb;
use BHFOS\BillingLedger\Domain\Errors\MoneyDomainException;
use BHFOS\BillingLedger\Infra\RandomUuidGenerator;
use BHFOS\BillingLedger\Repo\IdempotencyRepo;
use BHFOS\BillingLedger\Repo\InvoiceRepo;
use BHFOS\BillingLedger\Repo\MoneyQueries;
use BHFOS\BillingLedger\Repo\PaymentRepo;
use BHFOS\BillingLedger\Services\RefundService;

try {
    if ($argc < 8) {
        throw new InvalidArgumentException('usage: refund_invoice_impacting.php <idem_key> <payment_id> <invoice_id> <original_allocation_id> <refund_cents> <processor_refund_id> <created_by_user_id>');
    }

    [$script, $idemKey, $paymentId, $invoiceId, $originalAllocId, $refundCents, $processorRefundId, $createdByUserId] = $argv;

    $pdo = makePdo();
    $db = new MoneyDb($pdo);

    $svc = new RefundService(
        $db,
        new IdempotencyRepo($pdo),
        new PaymentRepo($pdo),
        new InvoiceRepo($pdo),
        new MoneyQueries($pdo),
        new RandomUuidGenerator()
    );

    $result = $svc->refundInvoiceImpacting(
        $idemKey,
        $paymentId,
        $invoiceId,
        $originalAllocId,
        (int)$refundCents,
        $processorRefundId,
        $createdByUserId
    );

    jsonOut(['ok' => true, 'result' => $result]);
} catch (MoneyDomainException $e) {
    jsonOut(['ok' => false, 'error' => ['code' => $e->codeName, 'message' => $e->getMessage(), 'context' => $e->context]]);
} catch (Throwable $e) {
    jsonOut(['ok' => false, 'error' => ['code' => 'ERR_UNHANDLED', 'message' => $e->getMessage()]]);
}

