<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

use BHFOS\BillingLedger\Db\MoneyDb;
use BHFOS\BillingLedger\Domain\Errors\MoneyDomainException;
use BHFOS\BillingLedger\Infra\RandomUuidGenerator;
use BHFOS\BillingLedger\Repo\CreditMemoRepo;
use BHFOS\BillingLedger\Repo\IdempotencyRepo;
use BHFOS\BillingLedger\Repo\InvoiceRepo;
use BHFOS\BillingLedger\Repo\MoneyQueries;
use BHFOS\BillingLedger\Services\ApplyCreditService;

try {
    if ($argc < 7) {
        throw new InvalidArgumentException('usage: apply_credit.php <idem_key> <credit_memo_id> <invoice_id> <requested_cents> <created_by_user_id> <mode>');
    }

    [$script, $idemKey, $creditMemoId, $invoiceId, $requestedCents, $createdByUserId, $mode] = $argv;

    $pdo = makePdo();
    $db = new MoneyDb($pdo);

    $svc = new ApplyCreditService(
        $db,
        new IdempotencyRepo($pdo),
        new CreditMemoRepo($pdo),
        new InvoiceRepo($pdo),
        new MoneyQueries($pdo),
        new RandomUuidGenerator()
    );

    $result = $svc->apply($idemKey, $creditMemoId, $invoiceId, (int)$requestedCents, $createdByUserId, $mode);
    jsonOut(['ok' => true, 'result' => $result]);
} catch (MoneyDomainException $e) {
    jsonOut(['ok' => false, 'error' => ['code' => $e->codeName, 'message' => $e->getMessage(), 'context' => $e->context]]);
} catch (Throwable $e) {
    jsonOut(['ok' => false, 'error' => ['code' => 'ERR_UNHANDLED', 'message' => $e->getMessage()]]);
}

