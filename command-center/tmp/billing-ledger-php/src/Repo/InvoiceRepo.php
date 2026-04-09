<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Repo;

use BHFOS\BillingLedger\Domain\Errors\NotFound;
use PDO;

final class InvoiceRepo
{
    public function __construct(private PDO $pdo) {}

    /**
     * Locks invoices in deterministic order.
     *
     * @return array<string, array<string, mixed>>
     */
    public function lockInvoices(array $invoiceRecordIds): array
    {
        $ids = array_values(array_unique(array_map('strval', $invoiceRecordIds)));
        sort($ids, SORT_STRING);

        if ($ids === []) {
            throw new \InvalidArgumentException('At least one invoice must be locked.');
        }

        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $sql = <<<SQL
        select *
        from invoices
        where invoice_record_id in ($placeholders)
        order by invoice_record_id
        for update
        SQL;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($ids);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $map = [];
        foreach ($rows as $row) {
            $map[(string)$row['invoice_record_id']] = $row;
        }

        if (count($map) !== count($ids)) {
            throw new NotFound('invoice', 'one_or_more');
        }

        return $map;
    }
}

