<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Db;

use PDO;
use Throwable;

final class MoneyDb
{
    public function __construct(private PDO $pdo) {}

    public function pdo(): PDO
    {
        return $this->pdo;
    }

    public function transactional(callable $callback): mixed
    {
        $started = false;

        try {
            if (!$this->pdo->inTransaction()) {
                $this->pdo->beginTransaction();
                $started = true;
            }

            $result = $callback($this->pdo);

            if ($started) {
                $this->pdo->commit();
            }

            return $result;
        } catch (Throwable $e) {
            if ($started && $this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }
}

