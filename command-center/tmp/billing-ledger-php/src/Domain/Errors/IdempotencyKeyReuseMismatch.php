<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Domain\Errors;

final class IdempotencyKeyReuseMismatch extends MoneyDomainException
{
    public function __construct(string $key, array $context = [])
    {
        parent::__construct('ERR_IDEMPOTENCY_REUSE_MISMATCH', "Idempotency key reused with different request: {$key}", $context);
    }
}

