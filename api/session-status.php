<?php
declare(strict_types=1);

ini_set('session.use_strict_mode', '1');

session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/',
]);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

echo json_encode([
    'ok' => true,
    'logged_in' => !empty($_SESSION['account_id'])
        && !empty($_SESSION['account_username']),
    'username' => !empty($_SESSION['account_username'])
        ? (string) $_SESSION['account_username']
        : null,
], JSON_UNESCAPED_SLASHES);