<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','samesite'=>'Lax','path'=>'/']);
session_start();

function respond(int $code, array $data): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function db(): PDO {
    $config = require __DIR__ . '/config.php';
    $d = $config['database'];
    return new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',$d['host'],(int)$d['port'],$d['name']),$d['username'],$d['password'],[
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES=>false
    ]);
}
function requireCsrf(): void {
    $given = (string)($_POST['csrf'] ?? '');
    $expected = (string)($_SESSION['account_csrf'] ?? '');
    if ($given === '' || $expected === '' || !hash_equals($expected,$given)) respond(403,['ok'=>false,'message'=>'Your session expired. Please try again.']);
}
function passwordMatches(string $password, string $stored): bool {
    $parts = explode(':',$stored);
    if (count($parts)!==3 || !ctype_digit($parts[0])) return false;
    $iterations=(int)$parts[0]; $salt=base64_decode($parts[1],true); $expected=base64_decode($parts[2],true);
    if ($iterations<1 || $iterations>10000000 || $salt===false || $expected===false || $expected==='') return false;
    return hash_equals($expected,hash_pbkdf2('sha1',$password,$salt,$iterations,strlen($expected),true));
}
function makePasswordHash(string $password): string {
    // Matches the format used by the supplied registration script.
    $salt=random_bytes(30); $r=random_bytes(4);
    $iterations=1111 ^ 0; $iterations += ord($r[0]) ^ ord($r[1]) ^ ord($r[2]) ^ ord($r[3]);
    $derived=hash_pbkdf2('sha1',$password,$salt,$iterations,30,true);
    return $iterations.':'.base64_encode($salt).':'.base64_encode($derived);
}
$method=$_SERVER['REQUEST_METHOD']??'GET';
$action=(string)($_GET['action']??$_POST['action']??'');
if ($method==='GET' && $action==='csrf') {
    if (empty($_SESSION['account_csrf'])) $_SESSION['account_csrf']=bin2hex(random_bytes(32));
    respond(200,['ok'=>true,'csrf'=>$_SESSION['account_csrf']]);
}
if ($method!=='POST') { header('Allow: GET, POST'); respond(405,['ok'=>false,'message'=>'Method not allowed.']); }
requireCsrf();
try {
    $pdo=db();
    if ($action==='login') {
        $username=trim((string)($_POST['username']??'')); $password=(string)($_POST['password']??'');
        if ($username==='' || $password==='') respond(422,['ok'=>false,'message'=>'Enter your username and password.']);
        $q=$pdo->prepare('SELECT Id, Username, Password FROM login WHERE Username = :username LIMIT 1');
        $q->execute(['username'=>$username]); $account=$q->fetch();
        if (!$account || !passwordMatches($password,(string)$account['Password'])) respond(401,['ok'=>false,'message'=>'The username or password is incorrect.']);
        session_regenerate_id(true);
        $_SESSION['account_id']=(int)$account['Id']; $_SESSION['account_username']=(string)$account['Username'];
        $_SESSION['account_csrf']=bin2hex(random_bytes(32));
        respond(200,['ok'=>true,'redirect'=>'account.php']);
    }
    if (empty($_SESSION['account_id']) || empty($_SESSION['account_username'])) respond(401,['ok'=>false,'message'=>'Please log in again.']);
    $accountId=(int)$_SESSION['account_id']; $username=(string)$_SESSION['account_username'];
    if ($action==='logout') {
        $_SESSION=[];
        if (ini_get('session.use_cookies')) { $p=session_get_cookie_params(); setcookie(session_name(),'',time()-42000,$p['path'],$p['domain']??'',(bool)$p['secure'],(bool)$p['httponly']); }
        session_destroy(); respond(200,['ok'=>true,'redirect'=>'index.html']);
    }
    if ($action==='profile') {
        $first=trim((string)($_POST['first_name']??'')); $last=trim((string)($_POST['last_name']??'')); $email=trim((string)($_POST['email']??''));
        if ($first==='' || strlen($first)>32) respond(422,['ok'=>false,'message'=>'First name is required and must be at most 32 characters.']);
        if ($last==='' || strlen($last)>32) respond(422,['ok'=>false,'message'=>'Last name is required and must be at most 32 characters.']);
        if (strlen($email)>64 || !filter_var($email,FILTER_VALIDATE_EMAIL)) respond(422,['ok'=>false,'message'=>'Enter a valid email address of no more than 64 characters.']);
        $q=$pdo->prepare('UPDATE login SET FirstName=:first, LastName=:last, Email=:email WHERE Id=:id AND Username=:username');
        $q->execute(['first'=>$first,'last'=>$last,'email'=>$email,'id'=>$accountId,'username'=>$username]);
        respond(200,['ok'=>true,'message'=>'Account details updated.']);
    }
    if ($action==='password') {
        $current=(string)($_POST['current_password']??''); $new=(string)($_POST['new_password']??''); $confirm=(string)($_POST['confirm_password']??'');
        if (strlen($new)<6 || strlen($new)>128) respond(422,['ok'=>false,'message'=>'The new password must be between 6 and 128 characters.']);
        if (!hash_equals($new,$confirm)) respond(422,['ok'=>false,'message'=>'The new passwords do not match.']);
        $q=$pdo->prepare('SELECT Password FROM login WHERE Id=:id AND Username=:username LIMIT 1'); $q->execute(['id'=>$accountId,'username'=>$username]); $row=$q->fetch();
        if (!$row || !passwordMatches($current,(string)$row['Password'])) respond(403,['ok'=>false,'message'=>'Your current password is incorrect.']);
        $q=$pdo->prepare('UPDATE login SET Password=:password WHERE Id=:id AND Username=:username'); $q->execute(['password'=>makePasswordHash($new),'id'=>$accountId,'username'=>$username]);
        session_regenerate_id(true); $_SESSION['account_csrf']=bin2hex(random_bytes(32));
        respond(200,['ok'=>true,'message'=>'Password changed successfully.']);
    }
    if ($action==='unstuck') {
        $characterId=filter_var($_POST['character_id']??null,FILTER_VALIDATE_INT);
        if (!$characterId || $characterId<1) respond(422,['ok'=>false,'message'=>'Select a valid character.']);
        $q=$pdo->prepare('SELECT Id, Name, Online FROM characters WHERE Id=:id AND Username=:username LIMIT 1');
        $q->execute(['id'=>$characterId,'username'=>$username]); $character=$q->fetch();
        if (!$character) respond(404,['ok'=>false,'message'=>'That character was not found on your account.']);
        if ((int)($character['Online']??0)!==0) respond(409,['ok'=>false,'message'=>'Please log this character out of the game before using unstuck.']);
        $q=$pdo->prepare('UPDATE characters SET playfield=655, X=3226.16, Y=35.11, Z=866.004 WHERE Id=:id AND Username=:username AND COALESCE(Online,0)=0');
        $q->execute(['id'=>$characterId,'username'=>$username]);
        if ($q->rowCount()<1) respond(409,['ok'=>false,'message'=>'The character was not changed. Check that it is offline and try again.']);
        respond(200,['ok'=>true,'message'=>'Character unstuck successfully.']);
    }
    respond(400,['ok'=>false,'message'=>'Unknown account action.']);
} catch (Throwable $e) {
    error_log('[Anarchy Online Account API] '.$e->getMessage());
    respond(500,['ok'=>false,'message'=>'A server error occurred. Please try again later.']);
}
