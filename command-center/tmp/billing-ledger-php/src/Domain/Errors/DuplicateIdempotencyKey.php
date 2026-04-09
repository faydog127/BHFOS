<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Domain\Errors;

final class DuplicateIdempotencyKey extends MoneyDomainException
{
    public function __construct(string $key, array $context = [])
    {
        parent::__construct('ERR_IDEMPOTENCY_DUPLICATE', "Duplicate idempotency key: {$key}", $context);
    }
}

