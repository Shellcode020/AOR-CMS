<?php
declare(strict_types=1);

return [
    'database' => [
        'host'     => getenv('AO_DB_HOST') ?: '127.0.0.1',
        'port'     => (int) (getenv('AO_DB_PORT') ?: 3308),
        'name'     => getenv('AO_DB_NAME') ?: 'cellao_codex_clean',
        'username' => getenv('AO_DB_USER') ?: 'root',
        'password' => getenv('AO_DB_PASSWORD') ?: 'aorebirth',
    ],
    'game_server' => [
        'host' => getenv('AO_GAME_SERVER_HOST') ?: '127.0.0.1',
        'port' => (int) (getenv('AO_GAME_SERVER_PORT') ?: 7501),
        'timeout_seconds' => 2,
    ],
];
