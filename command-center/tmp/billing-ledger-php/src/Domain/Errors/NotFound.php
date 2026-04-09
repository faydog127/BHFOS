<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Domain\Errors;

final class NotFound extends MoneyDomainException
{
    public function __construct(string $entity, string $id)
    {
        parent::__construct('ERR_NOT_FOUND', "{$entity} not found: {$id}", ['entity' => $entity, 'id' => $id]);
    }
}

