<?php

declare(strict_types=1);

spl_autoload_register(function (string $class): void {
    $prefix = 'BHFOS\\BillingLedger\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $relativePath = str_replace('\\', DIRECTORY_SEPARATOR, $relative) . '.php';
    $file = __DIR__ . '/../../src/' . $relativePath;

    if (is_file($file)) {
        require_once $file;
    }
});

function envOrThrow(string $key): string
{
    $v = getenv($key);
    if ($v === false || trim($v) === '') {
        throw new RuntimeException("Missing env var: {$key}");
    }
    return $v;
}

function makePdo(): PDO
{
    $host = envOrThrow('DB_HOST');
    $port = envOrThrow('DB_PORT');
    $name = envOrThrow('DB_NAME');
    $user = envOrThrow('DB_USER');
    $pass = envOrThrow('DB_PASS');

    $dsn = "pgsql:host={$host};port={$port};dbname={$name}";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function jsonOut(array $payload): never
{
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit(0);
}

