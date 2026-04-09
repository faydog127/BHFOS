<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Infra;

use BHFOS\BillingLedger\Contracts\EventSink;

final class NullEventSink implements EventSink
{
    public function emit(string $type, array $payload): void
    {
        // no-op
    }
}

