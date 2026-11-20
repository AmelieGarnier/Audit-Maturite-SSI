<?php
/**
 * SSI Audit — Questionnaires : campagnes, jetons, dépôt et lecture des réponses.
 * Le jeton (256 bits) n'est jamais stocké : seule son empreinte SHA-256 l'est.
 */
declare(strict_types=1);

const Q_MAX_RESPONSES = 500;
const Q_MIN_DELAY = 10;         // secondes minimales entre deux envois d'un même client
const Q_ID_RE = '/^[A-Za-z0-9_-]{2,64}$/';

function q_campaign_by_token(PDO $db, string $token): ?array
{
    if (!preg_match('/^[A-Za-z0-9_-]{20,128}$/', $token)) {
        return null;
    }
    $st = $db->prepare('SELECT * FROM q_campaigns WHERE token_hash = :h');
    $st->execute([':h' => hash('sha256', $token)]);
    $row = $st->fetch();
    return $row === false ? null : $row;
}

/** @return array|string tableau de résultat, ou message d'erreur */
function q_publish(PDO $db, mixed $body): array|string
{
    if (!is_array($body)) return 'Requête invalide.';
    $auditId = (string)($body['auditId'] ?? '');
    $cid = (string)($body['campaignId'] ?? '');
    if (!preg_match(Q_ID_RE, $auditId) || !preg_match(Q_ID_RE, $cid)) return 'Identifiant invalide.';
    $titre = trim(mb_substr((string)($body['titre'] ?? ''), 0, 200));
    $org = trim(mb_substr((string)($body['organisation'] ?? ''), 0, 200));
    if ($titre === '') $titre = 'Questionnaire';
    $questions = [];
    foreach ((array)($body['questions'] ?? []) as $q) {
        if (!is_array($q) || !preg_match(Q_ID_RE, (string)($q['id'] ?? ''))) return 'Question invalide.';
        $questions[] = [
            'id' => (string)$q['id'],
            'texte' => mb_substr((string)($q['texte'] ?? $q['id']), 0, 500),
            'public' => ($q['public'] ?? '') === 'tech' ? 'tech' : 'tous',
        ];
        if (count($questions) > 2000) return 'Trop de questions.';
    }
    if (!$questions) return 'Le questionnaire ne contient aucune question.';
    $now = gmdate('Y-m-d H:i:s');
    $json = json_encode($questions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $st = $db->prepare('SELECT id FROM q_campaigns WHERE id = :id');
    $st->execute([':id' => $cid]);
    if ($st->fetchColumn() !== false) {
        $db->prepare('UPDATE q_campaigns SET titre = :t, organisation = :o, questions = :q, updated_at = :now WHERE id = :id')
            ->execute([':t' => $titre, ':o' => $org, ':q' => $json, ':now' => $now, ':id' => $cid]);
        return ['campaignId' => $cid, 'updated' => true];
    }
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $db->prepare('INSERT INTO q_campaigns (id, audit_id, token_hash, titre, organisation, questions, statut, created_at, updated_at)
        VALUES (:id, :a, :h, :t, :o, :q, \'ouvert\', :now, :now)')
        ->execute([':id' => $cid, ':a' => $auditId, ':h' => hash('sha256', $token), ':t' => $titre, ':o' => $org, ':q' => $json, ':now' => $now]);
    return ['campaignId' => $cid, 'token' => $token];
}

/** @return true|string */
function q_submit(PDO $db, array $campaign): bool|string
{
    $raw = file_get_contents('php://input', false, null, 0, 256 * 1024 + 1);
    if ($raw === false || strlen($raw) > 256 * 1024) return 'Réponse trop volumineuse.';
    try {
        $r = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return 'Réponse illisible.';
    }
    if (!is_array($r) || !is_array($r['answers'] ?? null)) return 'Réponse invalide.';

    $allowed = [];
    foreach (json_decode($campaign['questions'], true) ?: [] as $q) {
        $allowed[$q['id']] = true;
    }
    $answers = [];
    foreach ($r['answers'] as $k => $v) {
        if (!isset($allowed[$k])) return 'Question inconnue.';
        if (!(is_int($v) && $v >= 0 && $v <= 5) && $v !== 'nsp' && $v !== 'nc') return 'Valeur de réponse invalide.';
        $answers[$k] = $v;
    }
    if (!$answers) return 'Aucune réponse.';
    $comments = [];
    foreach ((array)($r['comments'] ?? []) as $k => $v) {
        if (isset($allowed[$k]) && is_string($v) && trim($v) !== '') {
            $comments[$k] = mb_substr($v, 0, 1000);
        }
    }
    $role = in_array($r['role'] ?? '', ['direction', 'informatique', 'salarie'], true) ? $r['role'] : 'salarie';

    $cnt = $db->prepare('SELECT COUNT(*) FROM q_responses WHERE campaign_id = :c');
    $cnt->execute([':c' => $campaign['id']]);
    if ((int)$cnt->fetchColumn() >= Q_MAX_RESPONSES) return 'Nombre maximal de réponses atteint.';

    $client = client_hash();
    $last = $db->prepare('SELECT MAX(created_at) FROM q_responses WHERE campaign_id = :c AND client = :cl');
    $last->execute([':c' => $campaign['id'], ':cl' => $client]);
    $lastAt = $last->fetchColumn();
    if ($lastAt && time() - strtotime($lastAt . ' UTC') < Q_MIN_DELAY) return 'Veuillez patienter quelques secondes avant un nouvel envoi.';

    $id = 'R' . bin2hex(random_bytes(8));
    $now = gmdate('Y-m-d H:i:s');
    $data = [
        'id' => $id, 'campaign' => $campaign['id'], 'role' => $role,
        'nom' => mb_substr((string)($r['nom'] ?? ''), 0, 100), 'date' => gmdate('c'),
        'answers' => $answers, 'comments' => (object)$comments,
    ];
    $db->prepare('INSERT INTO q_responses (id, campaign_id, data, client, created_at) VALUES (:id, :c, :d, :cl, :now)')
        ->execute([':id' => $id, ':c' => $campaign['id'], ':d' => json_encode($data, JSON_UNESCAPED_UNICODE), ':cl' => $client, ':now' => $now]);
    return true;
}

function q_responses(PDO $db, string $campaignId): array
{
    $st = $db->prepare('SELECT data FROM q_responses WHERE campaign_id = :c ORDER BY created_at');
    $st->execute([':c' => $campaignId]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $d) {
        $out[] = json_decode((string)$d, true);
    }
    return $out;
}
