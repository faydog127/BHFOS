<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Repo;

use BHFOS\BillingLedger\Domain\Errors\NotFound;
use PDO;

final class CreditMemoRepo
{
    public function __construct(private PDO $pdo) {}

    /**
     * @return array<string, mixed>
     */
    public function lockCreditMemo(string $creditMemoRecordId): array
    {
        $stmt = $this->pdo->prepare(
            "select *
             from credit_memos
             where credit_memo_record_id = :id
             for update"
        );
        $stmt->execute([':id' => $creditMemoRecordId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new NotFound('credit_memo', $creditMemoRecordId);
        }

        return $row;
    }
}

