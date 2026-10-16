<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

ini_set('session.use_strict_mode', '1');

session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/',
]);

session_start();

function respond(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Supply a CSRF token when the registration popup opens.
if ($_SERVER['REQUEST_METHOD'] === 'GET'
    && ($_GET['action'] ?? '') === 'csrf') {

    if (empty($_SESSION['registration_csrf'])) {
        $_SESSION['registration_csrf'] = bin2hex(random_bytes(32));
    }

    respond(200, [
        'ok' => true,
        'csrf' => $_SESSION['registration_csrf']
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    respond(405, [
        'ok' => false,
        'message' => 'Please use the registration form.'
    ]);
}

$csrf = (string)($_POST['csrf'] ?? '');
$expected = (string)($_SESSION['registration_csrf'] ?? '');

if ($csrf === '' || $expected === ''
    || !hash_equals($expected, $csrf)) {
    respond(403, [
        'ok' => false,
        'message' => 'Your session expired. Close and reopen the form.'
    ]);
}

// Each submission requires a fresh token.
unset($_SESSION['registration_csrf']);

$username = trim((string)($_POST['username'] ?? ''));
$password = (string)($_POST['password'] ?? '');
$confirmation = (string)($_POST['password_confirm'] ?? '');
$email = trim((string)($_POST['email'] ?? ''));
$firstName = trim((string)($_POST['first_name'] ?? ''));
$lastName = trim((string)($_POST['last_name'] ?? ''));

// Validate the submitted fields.

/* Validate the submitted fields. */

if ($username === '') {
    respond(422, [
        'ok' => false,
        'message' => 'Please choose a username.'
    ]);
}

if (strlen($username) < 6) {
    respond(422, [
        'ok' => false,
        'message' => 'Username is too short. It must contain at least 6 characters.'
    ]);
}

if (strlen($username) > 20) {
    respond(422, [
        'ok' => false,
        'message' => 'Username is too long. It can contain a maximum of 20 characters.'
    ]);
}

if (!preg_match('/^[A-Za-z0-9_]+$/', $username)) {
    respond(422, [
        'ok' => false,
        'message' => 'Username contains invalid characters. Use only letters, numbers and underscores (_).'
    ]);
}

if ($password === '') {
    respond(422, [
        'ok' => false,
        'message' => 'Please choose a password.'
    ]);
}

if (strlen($password) < 6) {
    respond(422, [
        'ok' => false,
        'message' => 'Password is too short. It must contain at least 6 characters.'
    ]);
}

if (strlen($password) > 128) {
    respond(422, [
        'ok' => false,
        'message' => 'Password is too long. It can contain a maximum of 128 characters.'
    ]);
}

if ($confirmation === '') {
    respond(422, [
        'ok' => false,
        'message' => 'Please enter your password again to confirm it.'
    ]);
}

if (!hash_equals($password, $confirmation)) {
    respond(422, [
        'ok' => false,
        'message' => 'Your passwords do not match. Check both password fields and try again.'
    ]);
}

if ($email === '') {
    respond(422, [
        'ok' => false,
        'message' => 'Please enter your email address.'
    ]);
}

if (strlen($email) > 254) {
    respond(422, [
        'ok' => false,
        'message' => 'Your email address is too long. It must not exceed 254 characters.'
    ]);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, [
        'ok' => false,
        'message' => 'That email address does not look valid. Please check it and try again.'
    ]);
}

if ($firstName === '') {
    respond(422, [
        'ok' => false,
        'message' => 'Please enter your first name.'
    ]);
}

if (strlen($firstName) > 240) {
    respond(422, [
        'ok' => false,
        'message' => 'Your first name is too long. It must not exceed 240 characters.'
    ]);
}

if ($lastName === '') {
    respond(422, [
        'ok' => false,
        'message' => 'Please enter your last name.'
    ]);
}

if (strlen($lastName) > 240) {
    respond(422, [
        'ok' => false,
        'message' => 'Your last name is too long. It must not exceed 240 characters.'
    ]);
}


try {
    // Use the existing private configuration.
    $config = require __DIR__ . '/config.php';
    $db = $config['database'];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $db['host'],
        (int)$db['port'],
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
        ]
    );

    // Check whether the username already exists.
    $check = $pdo->prepare(
        'SELECT Id FROM login WHERE Username = :username LIMIT 1'
    );

    $check->execute(['username' => $username]);

    if ($check->fetch()) {
        respond(409, [
            'ok' => false,
            'message' => 'That username is already taken.'
        ]);
    }

    /*
     * AO Rebirth-compatible password hash.
     * Format: iterations:Base64(salt):Base64(hash)
     * Uses PBKDF2-HMAC-SHA1, 30-byte salt and 30-byte hash.
     */
    $salt = random_bytes(30);
    $random = random_bytes(4);

    $iterationOffset =
        ord($random[0]) ^
        ord($random[1]) ^
        ord($random[2]) ^
        ord($random[3]);

    $iterations = 1111 + $iterationOffset;

    $derivedKey = hash_pbkdf2(
        'sha1',
        $password,
        $salt,
        $iterations,
        30,
        true
    );

    $passwordHash =
        $iterations . ':' .
        base64_encode($salt) . ':' .
        base64_encode($derivedKey);

    /*
     * Account defaults.
     * Website registrations can NEVER set their own GM level.
     */
    $defaultAllowedCharacters = 12;
    $defaultFlags = 0;
    $defaultAccountFlags = 0;
    $defaultExpansions = 2047;

    $insert = $pdo->prepare(
        'INSERT INTO login
        (
            CreationDate,
            Email,
            FirstName,
            LastName,
            Username,
            Password,
            AllowedCharacters,
            Flags,
            AccountFlags,
            Expansions,
            GM
        )
        VALUES
        (
            NOW(),
            :email,
            :first_name,
            :last_name,
            :username,
            :password_hash,
            :allowed_characters,
            :flags,
            :account_flags,
            :expansions,
            0
        )'
    );

    $insert->execute([
        'email' => $email,
        'first_name' => $firstName,
        'last_name' => $lastName,
        'username' => $username,
        'password_hash' => $passwordHash,
        'allowed_characters' => $defaultAllowedCharacters,
        'flags' => $defaultFlags,
        'account_flags' => $defaultAccountFlags,
        'expansions' => $defaultExpansions,
    ]);

    respond(201, [
        'ok' => true,
        'message' => 'Your Anarchy Online account has been created.'
    ]);

} catch (Throwable $e) {
    // Detailed errors go to the server log, never to the visitor.
    error_log('[AO Rebirth registration] ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'message' => 'Registration failed because of a server error. Please try again later.'
    ]);
}
