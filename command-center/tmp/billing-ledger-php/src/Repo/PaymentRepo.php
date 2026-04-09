<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Repo;

use BHFOS\BillingLedger\Domain\Errors\NotFound;
use PDO;

final class PaymentRepo
{
    public function __construct(private PDO $pdo) {}

    /**
     * @return array<string, mixed>
     */
    public function lockPayment(string $paymentRecordId): array
    {
        $stmt = $this->pdo->prepare(
            "select *
             from payments
             where payment_record_id = :id
             for update"
        );
        $stmt->execute([':id' => $paymentRecordId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new NotFound('payment', $paymentRecordId);
        }

        return $row;
    }
}

