<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Infra;

use BHFOS\BillingLedger\Contracts\Clock;
use DateTimeImmutable;

final class SystemClock implements Clock
{
    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now');
    }
}

