<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Contracts;

interface UuidGenerator
{
    public function uuidV4(): string;
}

