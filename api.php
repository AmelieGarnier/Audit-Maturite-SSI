<?php
/**
 * SSI Audit — API REST minimale (PHP 8 + SQLite)
 *
 * GET  api.php?action=ping            → état du serveur, jeton CSRF, besoin d'authentification
 * GET  api.php?action=list            → liste des audits
 * GET  api.php?action=get&id=…        → audit complet
 * POST api.php?action=save&id=…       → crée ou met à jour un audit (corps JSON)
 * POST api.php?action=delete&id=…     → supprime un audit
 *
 * Sécurité : requêtes préparées, en-tête X-Requested-With obligatoire, jeton CSRF
 * sur les écritures, cookie de session HttpOnly / SameSite=Strict, taille de
 * corps limitée, validation du schéma, journal des opérations.
 */
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data + ['ok' => $code < 400], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $code = 400): never
{
    reply(['ok' => false, 'error' => $msg], $code);
}

// Protection CSRF de base : les formulaires et liens d'un site tiers ne peuvent
// pas ajouter cet en-tête personnalisé sans pré-vérification CORS.
if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'SSIAudit') {
    fail('Requête refusée.', 403);
}

$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'ping') {
    reply([
        'app'  => 'ssi-audit',
        'version' => APP_VERSION,
        'auth' => auth_required() && !is_logged_in() ? 'required' : 'ok',
        'authEnabled' => auth_required(),
        'loginUrl' => 'login.php',
        'csrf' => csrf_token(),
    ]);
}

// --- Questionnaire : points d'accès publics, protégés par le jeton de campagne ---
if ($action === 'q_get' || $action === 'q_submit') {
    require __DIR__ . '/lib/questionnaire.php';
    $campaign = q_campaign_by_token(db(), (string)($_GET['t'] ?? ''));
    if ($campaign === null) fail('Questionnaire introuvable ou lien invalide.', 404);
    if ($campaign['statut'] !== 'ouvert') fail('Ce questionnaire est clos.', 410);
    if ($action === 'q_get') {
        reply(['questionnaire' => [
            'titre' => $campaign['titre'],
            'organisation' => $campaign['organisation'],
            'questions' => json_decode($campaign['questions'], true),
        ]]);
    }
    if ($method !== 'POST') fail('Méthode non autorisée.', 405);
    $res = q_submit(db(), $campaign);
    if (is_string($res)) fail($res, 422);
    reply(['received' => true]);
}

if (auth_required() && !is_logged_in()) {
    fail('Authentification requise.', 401);
}

$id = (string)($_GET['id'] ?? '');
if ($id !== '' && !preg_match('/^[A-Za-z0-9_-]{3,64}$/', $id)) {
    fail('Identifiant invalide.');
}

$db = db();

switch ($action) {
    case 'list':
        $rows = $db->query('SELECT id, organisation, date_audit AS dateAudit, updated_at AS modifieLe, demo FROM audits ORDER BY updated_at DESC')->fetchAll();
        foreach ($rows as &$r) {
            $r['demo'] = (bool)$r['demo'];
        }
        reply(['audits' => $rows]);

    case 'get':
        if ($id === '') fail('Identifiant manquant.');
        $st = $db->prepare('SELECT data FROM audits WHERE id = :id');
        $st->execute([':id' => $id]);
        $data = $st->fetchColumn();
        if ($data === false) fail('Audit introuvable.', 404);
        reply(['audit' => json_decode((string)$data, true, 64, JSON_THROW_ON_ERROR)]);

    case 'save':
        if ($method !== 'POST') fail('Méthode non autorisée.', 405);
        check_csrf();
        if ($id === '') fail('Identifiant manquant.');
        $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
        if ($raw === false || strlen($raw) > MAX_BODY) fail('Audit trop volumineux.', 413);
        try {
            $audit = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            fail('JSON invalide.');
        }
        $err = validate_audit($audit, $id);
        if ($err !== null) fail($err, 422);
        $now = gmdate('Y-m-d H:i:s');
        $st = $db->prepare('INSERT INTO audits (id, organisation, date_audit, demo, data, created_at, updated_at)
            VALUES (:id, :org, :date, :demo, :data, :now, :now)
            ON CONFLICT(id) DO UPDATE SET organisation = excluded.organisation, date_audit = excluded.date_audit,
            demo = excluded.demo, data = excluded.data, updated_at = excluded.updated_at');
        $st->execute([
            ':id' => $id,
            ':org' => mb_substr((string)$audit['meta']['organisation'], 0, 200),
            ':date' => mb_substr((string)($audit['meta']['dateAudit'] ?? ''), 0, 20),
            ':demo' => !empty($audit['meta']['demo']) ? 1 : 0,
            ':data' => json_encode($audit, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':now' => $now,
        ]);
        journal($db, $id, 'save');
        reply(['id' => $id, 'savedAt' => $now]);

    case 'delete':
        if ($method !== 'POST') fail('Méthode non autorisée.', 405);
        check_csrf();
        if ($id === '') fail('Identifiant manquant.');
        $st = $db->prepare('DELETE FROM audits WHERE id = :id');
        $st->execute([':id' => $id]);
        journal($db, $id, 'delete');
        reply(['deleted' => $st->rowCount()]);

    case 'q_publish':
        // Publie ou met à jour une campagne ; renvoie le jeton à la première publication.
        if ($method !== 'POST') fail('Méthode non autorisée.', 405);
        check_csrf();
        require __DIR__ . '/lib/questionnaire.php';
        $raw = file_get_contents('php://input', false, null, 0, 1024 * 1024 + 1);
        if ($raw === false || strlen($raw) > 1024 * 1024) fail('Requête trop volumineuse.', 413);
        try {
            $body = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            fail('JSON invalide.');
        }
        $res = q_publish($db, $body);
        if (is_string($res)) fail($res, 422);
        journal($db, (string)$body['auditId'], 'q_publish');
        reply($res);

    case 'q_responses':
        require __DIR__ . '/lib/questionnaire.php';
        $cid = (string)($_GET['campaign'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_-]{3,64}$/', $cid)) fail('Campagne invalide.');
        reply(['responses' => q_responses($db, $cid)]);

    case 'q_delete':
        if ($method !== 'POST') fail('Méthode non autorisée.', 405);
        check_csrf();
        $cid = (string)($_GET['campaign'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_-]{3,64}$/', $cid)) fail('Campagne invalide.');
        $db->prepare('DELETE FROM q_responses WHERE campaign_id = :c')->execute([':c' => $cid]);
        $db->prepare('DELETE FROM q_campaigns WHERE id = :c')->execute([':c' => $cid]);
        reply(['deleted' => true]);

    default:
        fail('Action inconnue.', 404);
}

/** Validation structurelle d'un audit avant enregistrement. */
function validate_audit(mixed $a, string $id): ?string
{
    if (!is_array($a)) return 'Format d\'audit invalide.';
    if (($a['id'] ?? null) !== $id) return 'Identifiant incohérent.';
    if (!isset($a['meta']) || !is_array($a['meta'])) return 'Métadonnées manquantes.';
    $org = trim((string)($a['meta']['organisation'] ?? ''));
    if ($org === '') return 'Le nom de l\'organisation est obligatoire.';
    if (!isset($a['items']) || !is_array($a['items'])) return 'Liste des points de contrôle manquante.';
    if (count($a['items']) > 2000) return 'Trop de points de contrôle.';
    foreach ($a['items'] as $it) {
        if (!is_array($it) || !isset($it['id'], $it['src'])) return 'Point de contrôle invalide.';
        if (!in_array($it['src'], ['ANSSI', 'CIS', 'SPEC'], true)) return 'Référentiel inconnu.';
        foreach (['niveau', 'cible', 'niveauApres'] as $k) {
            if (isset($it[$k]) && $it[$k] !== null && (!is_int($it[$k]) || $it[$k] < 0 || $it[$k] > 5)) {
                return "Valeur hors échelle COBIT ($k).";
            }
        }
    }
    foreach (['preuves', 'chantiers', 'jalons', 'kpis', 'historique', 'releves'] as $k) {
        if (isset($a[$k]) && !is_array($a[$k])) return "Champ « $k » invalide.";
    }
    return null;
}
