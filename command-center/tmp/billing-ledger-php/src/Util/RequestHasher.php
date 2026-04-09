<?php

declare(strict_types=1);

namespace BHFOS\BillingLedger\Util;

final class RequestHasher
{
    public static function hash(array $payload): string
    {
        $normalized = self::normalize($payload);
        $json = json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new \RuntimeException('Failed to encode request payload for hashing.');
        }
        return hash('sha256', $json);
    }

    private static function normalize(mixed $value): mixed
    {
        if (!is_array($value)) return $value;

        $isList = array_keys($value) === range(0, count($value) - 1);
        if ($isList) {
            return array_map([self::class, 'normalize'], $value);
        }

        ksort($value);
        $out = [];
        foreach ($value as $k => $v) {
            $out[(string)$k] = self::normalize($v);
        }
        return $out;
    }
}

