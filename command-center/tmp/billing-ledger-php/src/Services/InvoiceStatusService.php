<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Services;

use BHFOS\BillingLedger\Contracts\Clock;
use DateTimeImmutable;
use DateTimeZone;

final class InvoiceStatusService
{
    public function __construct(private Clock $clock, private DateTimeZone $tz) {}

    public function derive(string $currentStatus, ?string $dueDateYmd, int $grandTotalCents, int $balanceDueCents): string
    {
        if ($currentStatus === 'draft') return 'draft';
        if ($currentStatus === 'void') return 'void';

        if ($balanceDueCents <= 0) return 'paid';
        if ($balanceDueCents < $grandTotalCents) return 'partially_paid';

        if ($dueDateYmd) {
            $due = DateTimeImmutable::createFromFormat('Y-m-d', $dueDateYmd, $this->tz);
            if ($due instanceof DateTimeImmutable) {
                $today = $this->clock->now()->setTimezone($this->tz)->format('Y-m-d');
                if ($dueDateYmd < $today) return 'overdue';
            }
        }

        return 'issued';
    }
}

