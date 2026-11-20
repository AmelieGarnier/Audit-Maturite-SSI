/* SSI Audit — Questions en langage courant (une par point de contrôle) et échelle de réponse.
 * public : « tous » = posée à tout le monde ; « tech » = direction et informatique seulement. */
(function (root) {
  'use strict';
  var Q = {
    'ANSSI-01': ['tech', 'Les personnes qui gèrent l\'informatique ont-elles suivi une formation à la sécurité ?'],
    'ANSSI-02': ['tous', 'Avez-vous été sensibilisé(e) aux bons réflexes de sécurité informatique (charte, réunion, formation) ?'],
    'ANSSI-03': ['tech', 'Les contrats avec les prestataires informatiques contiennent-ils des exigences de sécurité ?'],
    'ANSSI-04': ['tech', 'Existe-t-il une liste des données et serveurs importants et un plan du réseau à jour ?'],
    'ANSSI-05': ['tech', 'La liste des comptes administrateurs est-elle tenue à jour et vérifiée ?'],
    'ANSSI-06': ['tous', 'Lors d\'une arrivée ou d\'un départ, les accès informatiques sont-ils créés ou supprimés rapidement ?'],
    'ANSSI-07': ['tous', 'Est-il impossible de brancher un appareil personnel sur le réseau de l\'entreprise ?'],
    'ANSSI-08': ['tous', 'Chacun a-t-il son propre identifiant (pas de compte partagé entre collègues) ?'],
    'ANSSI-09': ['tous', 'N\'avez-vous accès qu\'aux dossiers et applications nécessaires à votre travail ?'],
    'ANSSI-10': ['tous', 'Une règle impose-t-elle des mots de passe longs et complexes ?'],
    'ANSSI-11': ['tous', 'Rangez-vous vos mots de passe dans un coffre-fort numérique (et jamais sur un post-it ou un fichier) ?'],
    'ANSSI-12': ['tech', 'Les mots de passe d\'origine des équipements (box, imprimantes, caméras) ont-ils été changés ?'],
    'ANSSI-13': ['tous', 'Utilisez-vous une double authentification (code SMS, application) pour la messagerie ou les accès à distance ?'],
    'ANSSI-14': ['tous', 'Votre ordinateur dispose-t-il d\'un antivirus et se verrouille-t-il automatiquement ?'],
    'ANSSI-15': ['tous', 'L\'usage des clés USB est-il encadré (interdites ou analysées automatiquement) ?'],
    'ANSSI-16': ['tech', 'Les réglages de sécurité des ordinateurs sont-ils appliqués depuis un outil central ?'],
    'ANSSI-17': ['tech', 'Le pare-feu de chaque ordinateur est-il activé ?'],
    'ANSSI-18': ['tous', 'Les fichiers sensibles envoyés par Internet sont-ils protégés (lien sécurisé, chiffrement) ?'],
    'ANSSI-19': ['tech', 'Le réseau est-il découpé en zones séparées (bureautique, serveurs, invités) ?'],
    'ANSSI-20': ['tous', 'Le Wi-Fi de l\'entreprise est-il protégé et les visiteurs utilisent-ils un Wi-Fi séparé ?'],
    'ANSSI-21': ['tech', 'Les connexions aux équipements utilisent-elles des protocoles chiffrés (SSH, HTTPS) ?'],
    'ANSSI-22': ['tech', 'L\'accès à Internet passe-t-il par un pare-feu qui filtre les sites dangereux ?'],
    'ANSSI-23': ['tech', 'Les services accessibles depuis Internet (site web, accès distant) sont-ils isolés du reste du réseau ?'],
    'ANSSI-24': ['tous', 'La messagerie bloque-t-elle efficacement les courriels indésirables et dangereux ?'],
    'ANSSI-25': ['tech', 'Les liaisons informatiques avec les partenaires sont-elles sécurisées ?'],
    'ANSSI-26': ['tous', 'Le local ou l\'armoire informatique est-il fermé à clé et réservé aux personnes autorisées ?'],
    'ANSSI-27': ['tech', 'L\'administration du système se fait-elle depuis un poste qui ne sert pas à naviguer sur Internet ?'],
    'ANSSI-28': ['tech', 'Les interfaces d\'administration ne sont-elles accessibles que depuis un réseau réservé ?'],
    'ANSSI-29': ['tous', 'Devez-vous demander au service informatique pour installer un logiciel (pas de droits administrateur) ?'],
    'ANSSI-30': ['tous', 'Protégez-vous votre ordinateur portable et votre téléphone contre le vol lors de vos déplacements ?'],
    'ANSSI-31': ['tech', 'Les disques des ordinateurs portables sont-ils chiffrés ?'],
    'ANSSI-32': ['tous', 'Utilisez-vous le VPN de l\'entreprise lorsque vous travaillez hors des locaux ?'],
    'ANSSI-33': ['tous', 'Votre téléphone professionnel est-il protégé par un code et géré par l\'entreprise ?'],
    'ANSSI-34': ['tous', 'Les mises à jour de sécurité de votre ordinateur sont-elles installées rapidement ?'],
    'ANSSI-35': ['tech', 'Les logiciels et systèmes qui ne sont plus maintenus par l\'éditeur sont-ils identifiés et remplacés ?'],
    'ANSSI-36': ['tech', 'Les journaux (traces) des serveurs et du pare-feu sont-ils activés et conservés ?'],
    'ANSSI-37': ['tous', 'Les données sont-elles sauvegardées régulièrement, avec une copie hors ligne et des tests de restauration ?'],
    'ANSSI-38': ['tech', 'Des contrôles ou audits de sécurité ont-ils lieu régulièrement, suivis d\'actions ?'],
    'ANSSI-39': ['tous', 'Savez-vous qui est la personne référente pour la sécurité informatique ?'],
    'ANSSI-40': ['tous', 'Savez-vous quoi faire et qui prévenir en cas de problème de sécurité (virus, piratage, vol) ?'],
    'ANSSI-41': ['tech', 'Une analyse des risques informatiques a-t-elle été réalisée ?'],
    'ANSSI-42': ['tech', 'Les solutions de sécurité sont-elles choisies en tenant compte des labels de l\'ANSSI ?'],
    'CIS-C01': ['tech', 'Les box et routeurs utilisés pour le travail ont-ils été achetés neufs, auprès d\'une source fiable, avec des fonctions de sécurité ?'],
    'CIS-C02': ['tous', 'Le mot de passe d\'administration de votre box (au bureau ou à domicile) a-t-il été changé ?'],
    'CIS-C03': ['tech', 'Le compte en ligne du fournisseur d\'accès à Internet est-il protégé par un mot de passe unique ?'],
    'CIS-C04': ['tech', 'La double authentification est-elle activée sur le compte du fournisseur d\'accès et l\'application de la box ?'],
    'CIS-C05': ['tous', 'La clé Wi-Fi a-t-elle été remplacée par une clé longue et unique ?'],
    'CIS-C06': ['tous', 'La clé du Wi-Fi est-elle connue uniquement des personnes autorisées ?'],
    'CIS-C07': ['tech', 'Le nom du réseau Wi-Fi évite-t-il de révéler l\'entreprise, l\'adresse ou le modèle de la box ?'],
    'CIS-C08': ['tech', 'Les bandes Wi-Fi inutilisées sont-elles désactivées ?'],
    'CIS-C09': ['tous', 'La box est-elle installée hors de portée des visiteurs ?'],
    'CIS-C10': ['tech', 'Les mises à jour automatiques de la box sont-elles activées ?'],
    'CIS-C11': ['tous', 'Le Wi-Fi est-il protégé par un chiffrement récent (WPA2 ou WPA3) ?'],
    'CIS-C12': ['tech', 'La fonction WPS de la box est-elle désactivée ?'],
    'CIS-C13': ['tech', 'Le pare-feu de la box est-il activé au niveau le plus strict possible ?'],
    'CIS-C14': ['tech', 'La traduction d\'adresses (NAT) est-elle active, sans ouverture de port inutile ?'],
    'CIS-C15': ['tech', 'Un filtrage DNS bloque-t-il les sites malveillants (sur la box ou sur les postes) ?'],
    'CIS-C16': ['tech', 'La fonction UPnP de la box est-elle désactivée ?'],
    'CIS-C17': ['tech', 'Les services inutiles et l\'administration à distance de la box sont-ils désactivés ?'],
    'CIS-C18': ['tous', 'Les invités et appareils non maîtrisés utilisent-ils un réseau Wi-Fi séparé ?'],
    'CIS-C19': ['tech', 'Les équipements qui ne reçoivent plus de mises à jour sont-ils remplacés, et effacés avant mise au rebut ?'],
    'CIS-C20': ['tech', 'Seuls les appareils enregistrés (adresse MAC) peuvent-ils se connecter au Wi-Fi ?']
  };

  var SCALE = [
    { v: 0, label: 'Non, ce n\'est pas fait' },
    { v: 1, label: 'Parfois, au cas par cas' },
    { v: 2, label: 'Oui, régulièrement, mais sans règle écrite' },
    { v: 3, label: 'Oui, et une règle ou procédure écrite existe' },
    { v: 4, label: 'Oui, avec une règle écrite et des contrôles réguliers' },
    { v: 5, label: 'Oui, contrôlé et amélioré en continu' },
    { v: 'nsp', label: 'Je ne sais pas' },
    { v: 'nc', label: 'Non concerné' }
  ];

  var ROLES = [
    { v: 'direction', label: 'Direction' },
    { v: 'informatique', label: 'Personne qui gère l\'informatique' },
    { v: 'salarie', label: 'Salarié(e)' }
  ];

  var out = {};
  Object.keys(Q).forEach(function (k) { out[k] = { public: Q[k][0], texte: Q[k][1] }; });
  root.SSI_QUESTIONS = { items: out, scale: SCALE, roles: ROLES };
})(typeof window !== 'undefined' ? window : globalThis);
