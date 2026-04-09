<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Domain\Errors;

final class RefundExceedsRefundable extends MoneyDomainException
{
    public function __construct(int $requested, int $remaining, array $context = [])
    {
        parent::__construct(
            'ERR_REFUND_EXCEEDS_REFUNDABLE',
            'Refund exceeds remaining refundable amount.',
            array_merge($context, ['requested_cents' => $requested, 'remaining_refundable_cents' => $remaining])
        );
    }
}

