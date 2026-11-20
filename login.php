<?php
/**
 * Page de connexion (active uniquement si un mot de passe est défini dans config.php).
 */
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");

if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_regenerate_id(true);
    header('Location: login.php');
    exit;
}
if (!auth_required()) {
    header('Location: index.html');
    exit;
}

$error = '';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    check_csrf();
    $_SESSION['attempts'] = ($_SESSION['attempts'] ?? 0) + 1;
    if ($_SESSION['attempts'] > 5) {
        usleep(min(5, $_SESSION['attempts'] - 5) * 1000000); // ralentit la force brute
    }
    if (password_verify((string)($_POST['password'] ?? ''), APP_PASSWORD_HASH)) {
        session_regenerate_id(true);
        $_SESSION['auth'] = true;
        $_SESSION['auth_until'] = time() + 8 * 3600;
        $_SESSION['attempts'] = 0;
        unset($_SESSION['csrf']);
        header('Location: index.html');
        exit;
    }
    $error = 'Mot de passe incorrect.';
}
$csrf = csrf_token();
?><!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connexion · SSI Audit</title>
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="login-page">
  <main class="login card">
    <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true"><path d="M16 2 4 7v8c0 7.5 5.1 13.4 12 15 6.9-1.6 12-7.5 12-15V7z" fill="#1E5631"/><path d="m11 16 3.5 3.5L21.5 12" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <h1>SSI Audit</h1>
    <p class="muted">Accès réservé aux auditeurs.</p>
    <form method="post" class="form" autocomplete="off">
      <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES) ?>">
      <label>Mot de passe<input type="password" name="password" required autofocus></label>
      <?php if ($error): ?><p class="err" role="alert"><?= htmlspecialchars($error, ENT_QUOTES) ?></p><?php endif; ?>
      <button class="btn primary block">Se connecter</button>
    </form>
  </main>
</body>
</html>
