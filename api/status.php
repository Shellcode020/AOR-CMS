<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$configPath = __DIR__ . '/config.php';

if (!is_file($configPath)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server configuration unavailable',
        'server_online' => false,
        'uptime_seconds' => null,
        'connection' => 'Unavailable',
        'latency_ms' => null,
        'accounts' => null,
        'characters' => null,
        'players_online' => null,
        'checked_at' => gmdate('c')
    ]);
    exit;
}

$config = require $configPath;

/**
 * Returns the Unix timestamp when AORebirth.AccountBroker.Service.exe started.
 * Returns null if PHP cannot retrieve the process start time.
 */
function getZoneEngineStartTime(): ?int
{
    if (!function_exists('shell_exec') || !function_exists('iconv')) {
        error_log('AO Rebirth: shell_exec or iconv is unavailable.');
        return null;
    }

    $powershellScript = <<<'PS'
$p = Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -eq 'AORebirth.AccountBroker.Service.exe'
    } |
    Select-Object -First 1

if ($p -and $p.CreationDate) {
    [DateTimeOffset]::new(
        $p.CreationDate.ToUniversalTime()
    ).ToUnixTimeSeconds()
}
PS;

    $encodedCommand = base64_encode(
        iconv('UTF-8', 'UTF-16LE', $powershellScript)
    );

    $command = 'powershell.exe -NoProfile -NonInteractive -EncodedCommand '
        . $encodedCommand
        . ' 2>NUL';

    $output = @shell_exec($command);

    if (!is_string($output) || trim($output) === '') {
        return null;
    }

    $timestamp = filter_var(
        trim($output),
        FILTER_VALIDATE_INT
    );

    return ($timestamp !== false && $timestamp > 0)
        ? (int) $timestamp
        : null;
}
/**
 * Initial API response.
 */
$result = [
    'server_online' => false,
    'uptime_seconds' => null,
    'connection' => 'Offline',
    'latency_ms' => null,
    'accounts' => null,
    'characters' => null,
    'players_online' => null,
    'checked_at' => gmdate('c')
];

/**
 * Check the game server TCP connection.
 */
try {
    if (!isset($config['game_server'])) {
        throw new RuntimeException(
            'Game server configuration is missing.'
        );
    }

    $game = $config['game_server'];

    $host = (string) $game['host'];
    $port = (int) $game['port'];
    $timeout = (float) ($game['timeout_seconds'] ?? 3);

    $start = microtime(true);
    $errno = 0;
    $errstr = '';

    $socket = @fsockopen(
        $host,
        $port,
        $errno,
        $errstr,
        $timeout
    );

    if (is_resource($socket)) {
        $result['server_online'] = true;
        $result['connection'] = 'Online';

        $result['latency_ms'] = round(
            (microtime(true) - $start) * 1000,
            2
        );

        fclose($socket);

        $processStartTime = getZoneEngineStartTime();

        if ($processStartTime !== null) {
            $result['uptime_seconds'] = max(
                0,
                time() - $processStartTime
            );
        }
    }
} catch (Throwable $e) {
    error_log(
        'AO Rebirth game connection error: ' . $e->getMessage()
    );
}

/**
 * Retrieve database statistics independently.
 * Database errors will not mark the game server as offline.
 */
try {
    if (!isset($config['database'])) {
        throw new RuntimeException(
            'Database configuration is missing.'
        );
    }

    $db = $config['database'];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $db['host'],
        (int) $db['port'],
        $db['name']
    );

    $pdo = new PDO(
        $dsn,
        $db['username'],
        $db['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 3
        ]
    );

    $result['accounts'] = (int) $pdo
        ->query('SELECT COUNT(*) FROM `login`')
        ->fetchColumn();

    $result['characters'] = (int) $pdo
        ->query('SELECT COUNT(*) FROM `characters`')
        ->fetchColumn();

    $result['players_online'] = (int) $pdo
        ->query(
            'SELECT COUNT(*) FROM `characters` WHERE `Online` = 1'
        )
        ->fetchColumn();

} catch (Throwable $e) {
    error_log(
        'AO Rebirth database error: ' . $e->getMessage()
    );

    $result['database_error'] = true;
}

/**
 * Send the JSON response.
 */
echo json_encode(
    $result,
    JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
);
