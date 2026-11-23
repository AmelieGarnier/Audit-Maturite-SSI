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
    <svg class="mark" viewBox="0 0 28 24" width="42" height="36" aria-hidden="true"><rect x="0" y="16" width="4" height="8" rx="1"/><rect x="6" y="12" width="4" height="12" rx="1"/><rect x="12" y="8" width="4" height="16" rx="1"/><rect x="18" y="4" width="4" height="20" rx="1" class="mark-off"/><rect x="24" y="0" width="4" height="24" rx="1" class="mark-off"/></svg>
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
