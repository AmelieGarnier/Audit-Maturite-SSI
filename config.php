<?php
/**
 * Configuration du serveur.
 *
 * password_hash : laisser vide pour un usage local ; pour protéger l'accès, générer
 *   un hachage avec : php -r "echo password_hash('VotreMotDePasse', PASSWORD_DEFAULT), PHP_EOL;"
 *   puis le coller ci-dessous.
 * data_dir      : dossier de la base SQLite (idéalement hors de la racine web).
 */
return [
    'password_hash' => '',
    'data_dir'      => __DIR__ . '/data',
];
