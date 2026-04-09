<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Domain;

final class ApplyMode
{
    public const STRICT = 'strict';
    public const CLAMP = 'clamp';

    public static function assertValid(string $mode): void
    {
        if ($mode !== self::STRICT && $mode !== self::CLAMP) {
            throw new \InvalidArgumentException('Invalid apply mode.');
        }
    }
}

