<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Repo;

use BHFOS\BillingLedger\Domain\Errors\DuplicateIdempotencyKey;
use BHFOS\BillingLedger\Domain\Errors\IdempotencyKeyReuseMismatch;
use PDO;
use PDOException;

final class IdempotencyRepo
{
    public function __construct(private PDO $pdo) {}

    /**
     * Begin an idempotent operation.
     *
     * Returns a previously stored response if the operation already completed.
     *
     * @return array{is_replay: bool, response: array|null}
     */
    public function begin(string $key, string $operation, string $requestHash): array
    {
        $insert = $this->pdo->prepare(
            "insert into idempotency_keys (idempotency_key, operation, request_hash, status)
             values (:key, :op, :hash, 'in_progress')"
        );

        try {
            $insert->execute([':key' => $key, ':op' => $operation, ':hash' => $requestHash]);
            return ['is_replay' => false, 'response' => null];
        } catch (PDOException $e) {
            if ($e->getCode() !== '23505') {
                throw $e;
            }
        }

        $select = $this->pdo->prepare(
            "select idempotency_key, operation, request_hash, status, response_json
             from idempotency_keys
             where idempotency_key = :key
             for update"
        );
        $select->execute([':key' => $key]);
        $row = $select->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new DuplicateIdempotencyKey($key);
        }

        if ((string)$row['operation'] !== $operation || (string)$row['request_hash'] !== $requestHash) {
            throw new IdempotencyKeyReuseMismatch($key, [
                'expected_operation' => $row['operation'],
                'got_operation' => $operation,
                'expected_request_hash' => $row['request_hash'],
                'got_request_hash' => $requestHash,
            ]);
        }

        $status = (string)$row['status'];
        if ($status === 'completed') {
            $decoded = is_string($row['response_json']) ? json_decode($row['response_json'], true) : $row['response_json'];
            if (!is_array($decoded)) {
                throw new \RuntimeException('Idempotency response_json is invalid.');
            }
            return ['is_replay' => true, 'response' => $decoded];
        }

        throw new DuplicateIdempotencyKey($key, ['status' => $status]);
    }

    public function complete(string $key, array $response): void
    {
        $json = json_encode($response, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new \RuntimeException('Failed to encode idempotency response.');
        }

        $stmt = $this->pdo->prepare(
            "update idempotency_keys
             set status = 'completed', response_json = :response
             where idempotency_key = :key"
        );
        $stmt->execute([':key' => $key, ':response' => $json]);
    }
}

