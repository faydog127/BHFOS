<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Contracts;

interface EventSink
{
    /**
     * Emit an audit/observability event.
     *
     * Implementations may write to DB, logs, or an event bus.
     */
    public function emit(string $type, array $payload): void;
}

