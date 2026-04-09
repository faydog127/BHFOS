<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Domain\Errors;

final class NotAllocatable extends MoneyDomainException
{
    public function __construct(string $message, array $context = [])
    {
        parent::__construct('ERR_NOT_ALLOCATABLE', $message, $context);
    }
}

