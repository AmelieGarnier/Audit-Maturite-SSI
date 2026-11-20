<?php
/**
 * SSI Audit — Amorçage commun : configuration, session, CSRF, base SQLite, journal.
 */
declare(strict_types=1);

const APP_VERSION = '1.0';
const MAX_BODY = 8 * 1024 * 1024;

$config = require __DIR__ . '/../config.php';
define('APP_PASSWORD_HASH', (string)($config['password_hash'] ?? ''));
define('APP_DATA_DIR', rtrim((string)($config['data_dir'] ?? (__DIR__ . '/../data')), '/\\'));

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('SSIAUDIT');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $https,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

function auth_required(): bool
{
    return APP_PASSWORD_HASH !== '';
}

function is_logged_in(): bool
{
    if (empty($_SESSION['auth']) || ($_SESSION['auth_until'] ?? 0) < time()) {
        return false;
    }
    return true;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function check_csrf(): void
{
    $sent = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf'] ?? ''));
    if ($sent === '' || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Jeton de sécurité invalide. Rechargez la page.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!is_dir(APP_DATA_DIR) && !mkdir(APP_DATA_DIR, 0770, true) && !is_dir(APP_DATA_DIR)) {
        throw new RuntimeException('Dossier de données inaccessible.');
    }
    $deny = APP_DATA_DIR . '/.htaccess';
    if (!is_file($deny)) {
        @file_put_contents($deny, "Require all denied\n");
    }
    $pdo = new PDO('sqlite:' . APP_DATA_DIR . '/ssi-audit.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('CREATE TABLE IF NOT EXISTS audits (
        id TEXT PRIMARY KEY, organisation TEXT NOT NULL, date_audit TEXT, demo INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, audit_id TEXT, action TEXT NOT NULL, client TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS q_campaigns (
        id TEXT PRIMARY KEY, audit_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, titre TEXT NOT NULL,
        organisation TEXT NOT NULL, questions TEXT NOT NULL, statut TEXT NOT NULL DEFAULT \'ouvert\',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS q_responses (
        id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, data TEXT NOT NULL, client TEXT, created_at TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS q_responses_campaign ON q_responses (campaign_id, created_at)');
    return $pdo;
}

/** Client pseudonymisé : empreinte de l'adresse IP et du navigateur, salée par l'installation. */
function client_hash(): string
{
    $salt = APP_PASSWORD_HASH !== '' ? APP_PASSWORD_HASH : APP_DATA_DIR;
    return substr(hash('sha256', $salt . '|' . ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 16);
}

function journal(PDO $db, string $auditId, string $action): void
{
    $st = $db->prepare('INSERT INTO journal (at, audit_id, action, client) VALUES (:at, :id, :action, :client)');
    $st->execute([':at' => gmdate('Y-m-d H:i:s'), ':id' => $auditId, ':action' => $action, ':client' => client_hash()]);
}
