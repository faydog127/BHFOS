<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Domain\Errors;

use RuntimeException;

class MoneyDomainException extends RuntimeException
{
    public function __construct(
        public readonly string $codeName,
        string $message,
        public readonly array $context = [],
        int $code = 0,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $code, $previous);
    }
}

