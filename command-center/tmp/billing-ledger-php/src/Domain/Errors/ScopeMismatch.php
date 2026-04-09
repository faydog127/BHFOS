<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Domain\Errors;

final class ScopeMismatch extends MoneyDomainException
{
    public function __construct(string $message, array $context = [])
    {
        parent::__construct('ERR_SCOPE_MISMATCH', $message, $context);
    }
}

