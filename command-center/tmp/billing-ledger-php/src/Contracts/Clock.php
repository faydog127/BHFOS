<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Contracts;

use DateTimeImmutable;

interface Clock
{
    public function now(): DateTimeImmutable;
}

