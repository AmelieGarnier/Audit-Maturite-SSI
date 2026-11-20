/* SSI Audit — Catalogue des points de contrôle (ANSSI, CIS) et KPI par défaut.
 * Intitulés résumés et reformulés en français : se reporter aux guides officiels
 * pour le texte de référence. */
(function (root) {
  'use strict';

  // [n°, domaine, intitulé, question d'audit, attendus, méthode de vérification, indicateur, gravité, cible, DICT]
  var ANSSI = [
    [1, 'Sensibiliser et former', 'Former les équipes opérationnelles à la sécurité des SI', 'Les équipes informatiques (internes ou prestataires) sont-elles formées à la SSI ?', 'Plan de formation SSI, attestations de formation des administrateurs', 'Entretien ; revue du plan de formation', '% d\'administrateurs formés dans l\'année', 'Élevé', 3, 'DICT'],
    [2, 'Sensibiliser et former', 'Sensibiliser les utilisateurs aux bonnes pratiques élémentaires', 'Les utilisateurs sont-ils sensibilisés régulièrement (charte, sessions, campagnes) ?', 'Charte informatique signée, supports et feuilles de présence', 'Documentaire ; questionnaire', '% d\'utilisateurs sensibilisés dans l\'année', 'Élevé', 3, 'DICT'],
    [3, 'Sensibiliser et former', 'Maîtriser les risques de l\'infogérance', 'Les contrats d\'infogérance comportent-ils des clauses de sécurité ?', 'Clauses SSI, PAS, droit d\'audit, réversibilité', 'Documentaire (contrats)', '% de contrats avec clauses SSI', 'Moyen', 3, 'DICT'],
    [4, 'Connaître le système d\'information', 'Identifier les informations et serveurs sensibles et maintenir un schéma du réseau', 'Existe-t-il un inventaire des actifs sensibles et un schéma réseau à jour ?', 'Inventaire des actifs, cartographie, schéma daté', 'Documentaire ; technique', 'Date de dernière mise à jour du schéma', 'Élevé', 3, 'DICT'],
    [5, 'Connaître le système d\'information', 'Disposer d\'un inventaire des comptes privilégiés', 'Les comptes à privilèges sont-ils inventoriés et revus ?', 'Liste nominative des comptes administrateurs, revue périodique', 'Technique (extraction annuaire)', 'Nombre de comptes administrateurs non justifiés', 'Critique', 3, 'ICT'],
    [6, 'Connaître le système d\'information', 'Organiser les procédures d\'arrivée, de départ et de changement de fonction', 'Les droits sont-ils créés, modifiés et retirés selon une procédure ?', 'Procédure formalisée, check-list arrivée/départ', 'Documentaire ; échantillon de départs', 'Délai moyen de désactivation après départ', 'Élevé', 3, 'ICT'],
    [7, 'Connaître le système d\'information', 'Autoriser la connexion au réseau aux seuls équipements maîtrisés', 'Les équipements personnels ou inconnus sont-ils empêchés de se connecter au réseau ?', 'Contrôle d\'accès réseau, réseau invité séparé', 'Technique ; observation', 'Nombre d\'équipements inconnus détectés', 'Moyen', 3, 'DIC'],
    [8, 'Authentifier et contrôler les accès', 'Identifier nommément chaque personne et distinguer les rôles utilisateur et administrateur', 'Chaque utilisateur dispose-t-il d\'un compte nominatif, distinct de son compte d\'administration ?', 'Comptes nominatifs, comptes d\'administration séparés, absence de comptes génériques', 'Technique (annuaire)', 'Nombre de comptes génériques actifs', 'Critique', 3, 'ICT'],
    [9, 'Authentifier et contrôler les accès', 'Attribuer les bons droits sur les ressources sensibles', 'Les droits d\'accès aux ressources sensibles suivent-ils le besoin d\'en connaître ?', 'Matrice des droits, revue annuelle des accès', 'Documentaire ; technique', '% de partages revus dans l\'année', 'Élevé', 3, 'IC'],
    [10, 'Authentifier et contrôler les accès', 'Définir et vérifier des règles de choix des mots de passe', 'Une politique de mots de passe est-elle définie et appliquée techniquement ?', 'Politique écrite, GPO ou paramétrage équivalent', 'Technique (stratégie de mots de passe)', 'Longueur minimale imposée', 'Élevé', 3, 'CT'],
    [11, 'Authentifier et contrôler les accès', 'Protéger les mots de passe stockés', 'Les mots de passe sont-ils stockés dans un coffre-fort et non en clair ?', 'Gestionnaire de mots de passe, absence de fichiers en clair', 'Observation ; entretien', '% d\'utilisateurs équipés d\'un coffre-fort', 'Élevé', 3, 'CT'],
    [12, 'Authentifier et contrôler les accès', 'Changer les éléments d\'authentification par défaut', 'Les mots de passe par défaut des équipements et services ont-ils été changés ?', 'Procédure de mise en service, contrôle des équipements', 'Technique (test des comptes par défaut)', 'Nombre d\'équipements avec identifiants par défaut', 'Critique', 4, 'DICT'],
    [13, 'Authentifier et contrôler les accès', 'Privilégier une authentification forte', 'L\'authentification multifacteur est-elle activée sur les accès sensibles et distants ?', 'MFA sur messagerie, accès distants et comptes d\'administration', 'Technique ; observation', '% de comptes protégés par MFA', 'Critique', 4, 'ICT'],
    [14, 'Sécuriser les postes', 'Mettre en place un niveau de sécurité minimal sur l\'ensemble du parc', 'Les postes disposent-ils d\'une configuration de sécurité de référence (antivirus, verrouillage, mises à jour) ?', 'Socle de sécurité documenté, antivirus actif, verrouillage automatique', 'Technique (échantillon de postes)', '% de postes conformes au socle', 'Élevé', 3, 'DIC'],
    [15, 'Sécuriser les postes', 'Se protéger des menaces liées aux supports amovibles', 'L\'usage des clés USB et supports amovibles est-il encadré ?', 'Règle d\'usage, blocage ou analyse antivirale automatique', 'Technique ; entretien', 'Nombre de supports non maîtrisés détectés', 'Moyen', 3, 'IC'],
    [16, 'Sécuriser les postes', 'Utiliser un outil de gestion centralisée', 'Les politiques de sécurité sont-elles déployées de manière centralisée ?', 'Annuaire, GPO, MDM ou outil de gestion de parc', 'Technique', '% du parc géré centralement', 'Moyen', 3, 'DI'],
    [17, 'Sécuriser les postes', 'Activer et configurer le pare-feu local des postes', 'Le pare-feu local est-il activé et configuré sur tous les postes ?', 'Pare-feu actif, règles maîtrisées', 'Technique (échantillon)', '% de postes avec pare-feu actif', 'Moyen', 3, 'IC'],
    [18, 'Sécuriser les postes', 'Chiffrer les données sensibles transmises par Internet', 'Les données sensibles échangées par Internet sont-elles chiffrées ?', 'Outils d\'échange chiffrés, HTTPS, archives chiffrées', 'Entretien ; technique', 'Nombre d\'échanges sensibles non chiffrés', 'Élevé', 3, 'C'],
    [19, 'Sécuriser le réseau', 'Segmenter le réseau et cloisonner les zones', 'Le réseau est-il découpé en zones (utilisateurs, serveurs, invités, administration) ?', 'VLAN, filtrage entre zones', 'Technique (configuration réseau)', 'Nombre de zones cloisonnées', 'Élevé', 3, 'DIC'],
    [20, 'Sécuriser le réseau', 'Sécuriser les réseaux Wi-Fi et séparer les usages', 'Le Wi-Fi est-il chiffré (WPA2/WPA3) et le réseau invité séparé ?', 'WPA2-Entreprise ou WPA3, réseau invité isolé', 'Technique ; observation', 'Protocole de chiffrement Wi-Fi', 'Élevé', 3, 'IC'],
    [21, 'Sécuriser le réseau', 'Utiliser des protocoles réseau sécurisés', 'Les protocoles non chiffrés (Telnet, FTP, HTTP) sont-ils remplacés ?', 'SSH, SFTP, HTTPS ; absence de protocoles en clair', 'Technique (scan)', 'Nombre de services en clair exposés', 'Moyen', 3, 'IC'],
    [22, 'Sécuriser le réseau', 'Mettre en place une passerelle d\'accès sécurisé à Internet', 'L\'accès à Internet passe-t-il par un pare-feu et un filtrage ?', 'Pare-feu périmétrique, filtrage web, journalisation', 'Technique', 'Disponibilité du filtrage web', 'Élevé', 3, 'DIC'],
    [23, 'Sécuriser le réseau', 'Cloisonner les services visibles depuis Internet', 'Les services exposés sur Internet sont-ils isolés (DMZ) du reste du SI ?', 'DMZ, règles de filtrage, absence de ports d\'administration exposés', 'Technique (scan externe)', 'Nombre de services exposés non justifiés', 'Critique', 3, 'DIC'],
    [24, 'Sécuriser le réseau', 'Protéger sa messagerie professionnelle', 'La messagerie est-elle protégée (antispam, antivirus, SPF/DKIM/DMARC) ?', 'Filtrage, enregistrements SPF, DKIM et DMARC', 'Technique (DNS, en-têtes)', 'Politique DMARC publiée', 'Élevé', 3, 'ICT'],
    [25, 'Sécuriser le réseau', 'Sécuriser les interconnexions avec les partenaires', 'Les liaisons avec les partenaires sont-elles chiffrées et filtrées ?', 'VPN site à site, filtrage, convention d\'interconnexion', 'Documentaire ; technique', 'Nombre d\'interconnexions non documentées', 'Moyen', 3, 'IC'],
    [26, 'Sécuriser le réseau', 'Contrôler l\'accès aux salles serveurs et locaux techniques', 'L\'accès physique aux équipements est-il restreint et tracé ?', 'Local fermé à clé ou badge, liste des personnes autorisées', 'Observation', 'Nombre de personnes ayant accès', 'Élevé', 3, 'DIC'],
    [27, 'Sécuriser l\'administration', 'Interdire l\'accès à Internet depuis les postes d\'administration', 'Les opérations d\'administration se font-elles depuis un poste sans navigation Internet ?', 'Poste ou session d\'administration dédiés', 'Entretien ; observation', 'Existence d\'un poste d\'administration dédié', 'Élevé', 3, 'ICT'],
    [28, 'Sécuriser l\'administration', 'Utiliser un réseau dédié et cloisonné pour l\'administration', 'Les interfaces d\'administration sont-elles accessibles uniquement depuis un réseau dédié ?', 'VLAN ou bastion d\'administration', 'Technique', 'Nombre d\'interfaces d\'administration accessibles depuis le réseau utilisateur', 'Moyen', 3, 'IC'],
    [29, 'Sécuriser l\'administration', 'Limiter les droits d\'administration sur les postes de travail', 'Les utilisateurs travaillent-ils sans droits d\'administrateur local ?', 'Retrait des droits d\'administration locale, procédure d\'élévation', 'Technique (échantillon)', '% d\'utilisateurs administrateurs de leur poste', 'Critique', 4, 'IC'],
    [30, 'Gérer le nomadisme', 'Sécuriser physiquement les terminaux nomades', 'Les portables et téléphones sont-ils protégés contre le vol et la consultation ?', 'Câbles antivol, filtres de confidentialité, règles de transport', 'Entretien ; questionnaire', 'Nombre de pertes ou vols déclarés', 'Moyen', 3, 'DC'],
    [31, 'Gérer le nomadisme', 'Chiffrer les données sensibles sur le matériel nomade', 'Les disques des portables et supports nomades sont-ils chiffrés ?', 'BitLocker, FileVault ou équivalent, gestion des clés de recouvrement', 'Technique (échantillon)', '% de portables chiffrés', 'Critique', 4, 'C'],
    [32, 'Gérer le nomadisme', 'Sécuriser la connexion réseau en situation de nomadisme', 'Les accès distants au SI passent-ils par un VPN ?', 'VPN obligatoire, authentification forte', 'Technique', '% d\'accès distants via VPN', 'Élevé', 3, 'IC'],
    [33, 'Gérer le nomadisme', 'Adopter des politiques de sécurité dédiées aux terminaux mobiles', 'Les smartphones professionnels sont-ils gérés (MDM, code, chiffrement) ?', 'MDM, code de verrouillage, effacement à distance', 'Technique ; entretien', '% de mobiles gérés', 'Moyen', 3, 'DC'],
    [34, 'Maintenir le SI à jour', 'Définir une politique de mise à jour des composants', 'Les mises à jour de sécurité sont-elles appliquées selon une politique définie ?', 'Politique de correctifs, délais cibles, suivi', 'Technique (état des correctifs)', '% de postes à jour', 'Critique', 4, 'DIC'],
    [35, 'Maintenir le SI à jour', 'Anticiper la fin de maintenance des logiciels et systèmes', 'Les systèmes en fin de support sont-ils identifiés et remplacés ?', 'Inventaire des versions, plan de migration', 'Technique (inventaire)', 'Nombre de systèmes obsolètes', 'Élevé', 3, 'DIC'],
    [36, 'Superviser, auditer, réagir', 'Activer et configurer les journaux des composants importants', 'Les journaux des serveurs, pare-feu et accès sont-ils activés et conservés ?', 'Journalisation, durée de conservation, centralisation', 'Technique', 'Durée de conservation des journaux', 'Élevé', 3, 'IT'],
    [37, 'Superviser, auditer, réagir', 'Définir et appliquer une politique de sauvegarde', 'Les sauvegardes sont-elles régulières, déconnectées et testées ?', 'Politique de sauvegarde, copie hors ligne, tests de restauration', 'Technique ; documentaire', 'Date du dernier test de restauration réussi', 'Critique', 4, 'DI'],
    [38, 'Superviser, auditer, réagir', 'Procéder à des contrôles et audits de sécurité réguliers', 'Des audits ou contrôles de sécurité sont-ils menés et suivis d\'actions ?', 'Rapports d\'audit, plan d\'action suivi', 'Documentaire', 'Nombre d\'audits dans l\'année', 'Moyen', 3, 'DICT'],
    [39, 'Superviser, auditer, réagir', 'Désigner un référent en sécurité des SI', 'Un référent SSI est-il désigné et connu du personnel ?', 'Lettre de mission, communication interne', 'Entretien ; questionnaire', 'Référent désigné (oui/non)', 'Moyen', 3, 'DICT'],
    [40, 'Superviser, auditer, réagir', 'Définir une procédure de gestion des incidents de sécurité', 'Une procédure de signalement et de traitement des incidents existe-t-elle ?', 'Procédure, contacts d\'urgence, registre des incidents', 'Documentaire ; questionnaire', 'Délai moyen de traitement d\'un incident', 'Élevé', 3, 'DICT'],
    [41, 'Pour aller plus loin', 'Mener une analyse de risques formelle', 'Une analyse de risques (EBIOS RM ou équivalent) a-t-elle été réalisée ?', 'Rapport d\'analyse de risques, plan de traitement', 'Documentaire', 'Date de la dernière analyse de risques', 'Moyen', 2, 'DICT'],
    [42, 'Pour aller plus loin', 'Privilégier les produits et services qualifiés', 'Le choix des produits et prestataires tient-il compte des qualifications ANSSI ?', 'Critères de sélection, produits ou prestataires qualifiés', 'Documentaire', '% de solutions de sécurité qualifiées', 'Faible', 2, 'DICT']
  ];

  var CIS = [
    [1, 'Routeur et box', 'Changer le mot de passe d\'administration du routeur', 'Le mot de passe d\'administration de la box ou du routeur a-t-il été changé ?', 'Mot de passe unique et robuste', 'Observation ; test', 'Nombre de box avec mot de passe par défaut', 'Critique', 4, 'DIC'],
    [2, 'Routeur et box', 'Mettre à jour le micrologiciel du routeur', 'Le micrologiciel de la box ou du routeur est-il à jour ?', 'Mise à jour automatique ou vérification régulière', 'Observation', 'Version du micrologiciel', 'Élevé', 3, 'DIC'],
    [3, 'Routeur et box', 'Chiffrer le Wi-Fi en WPA2 ou WPA3', 'Le Wi-Fi du domicile ou du petit bureau est-il protégé en WPA2 ou WPA3 ?', 'WPA2-AES ou WPA3, clé robuste', 'Observation', 'Protocole utilisé', 'Élevé', 3, 'IC'],
    [4, 'Routeur et box', 'Désactiver WPS, UPnP et l\'administration à distance', 'Les fonctions WPS, UPnP et l\'administration distante de la box sont-elles désactivées ?', 'Fonctions inutiles désactivées', 'Observation', 'Nombre de fonctions à risque actives', 'Moyen', 3, 'IC'],
    [5, 'Routeur et box', 'Séparer les invités et objets connectés', 'Les invités et objets connectés utilisent-ils un réseau séparé ?', 'Réseau invité ou VLAN dédié', 'Observation', 'Existence d\'un réseau invité', 'Moyen', 3, 'IC'],
    [6, 'Accès distant', 'Utiliser le VPN de l\'entreprise', 'Le télétravailleur se connecte-t-il au SI via le VPN de l\'entreprise ?', 'VPN obligatoire pour les ressources internes', 'Technique', '% de connexions via VPN', 'Élevé', 3, 'IC'],
    [7, 'Accès distant', 'Activer l\'authentification multifacteur', 'Les accès distants et les services en ligne utilisent-ils la double authentification ?', 'MFA sur VPN, messagerie et outils collaboratifs', 'Technique', '% de comptes avec MFA', 'Critique', 4, 'ICT'],
    [8, 'Accès distant', 'Sécuriser les visioconférences', 'Les réunions en ligne sont-elles protégées (mot de passe, salle d\'attente) ?', 'Paramètres de sécurité par défaut', 'Observation ; questionnaire', '% de réunions protégées', 'Faible', 2, 'C'],
    [9, 'Poste de télétravail', 'Utiliser un équipement fourni et géré par l\'entreprise', 'Le télétravail se fait-il sur un équipement professionnel géré ?', 'Matériel professionnel, interdiction ou encadrement du BYOD', 'Entretien ; questionnaire', '% de télétravailleurs équipés', 'Élevé', 3, 'DIC'],
    [10, 'Poste de télétravail', 'Maintenir le système et les applications à jour', 'Le poste de télétravail reçoit-il les mises à jour automatiquement ?', 'Mises à jour automatiques, redémarrages réguliers', 'Technique', '% de postes à jour', 'Critique', 4, 'DIC'],
    [11, 'Poste de télétravail', 'Disposer d\'un antivirus actif', 'Un antivirus ou EDR est-il actif et à jour sur le poste ?', 'Protection active, signatures à jour', 'Technique', '% de postes protégés', 'Élevé', 3, 'DIC'],
    [12, 'Poste de télétravail', 'Verrouiller l\'écran en cas d\'absence', 'L\'écran se verrouille-t-il automatiquement et manuellement en cas d\'absence ?', 'Verrouillage automatique ≤ 10 min, réflexe Windows + L', 'Observation ; questionnaire', 'Délai de verrouillage configuré', 'Moyen', 3, 'C'],
    [13, 'Poste de télétravail', 'Chiffrer le disque du poste nomade', 'Le disque du poste utilisé en télétravail est-il chiffré ?', 'Chiffrement complet du disque', 'Technique', '% de postes chiffrés', 'Critique', 4, 'C'],
    [14, 'Poste de télétravail', 'Séparer les usages personnels et professionnels', 'Le poste professionnel est-il réservé à l\'usage professionnel ?', 'Règle écrite, absence de comptes personnels', 'Questionnaire', '% d\'usage mixte déclaré', 'Moyen', 3, 'IC'],
    [15, 'Données', 'Sauvegarder les données de travail', 'Les fichiers de travail sont-ils enregistrés sur un espace sauvegardé de l\'entreprise ?', 'Stockage sur serveur ou cloud de l\'entreprise', 'Questionnaire ; technique', '% de données hors espace sauvegardé', 'Élevé', 3, 'DI'],
    [16, 'Données', 'Protéger les documents imprimés et l\'environnement de travail', 'Les documents et écrans sont-ils protégés des regards (famille, lieux publics) ?', 'Rangement, destruction des impressions, filtre de confidentialité', 'Questionnaire', 'Nombre d\'incidents de confidentialité', 'Faible', 2, 'C'],
    [17, 'Données', 'Utiliser les outils de partage approuvés', 'Les échanges de fichiers passent-ils uniquement par les outils approuvés ?', 'Liste d\'outils autorisés, interdiction des services personnels', 'Questionnaire ; entretien', 'Nombre d\'outils non approuvés utilisés', 'Moyen', 3, 'C'],
    [18, 'Vigilance', 'Reconnaître l\'hameçonnage', 'Les télétravailleurs savent-ils reconnaître et signaler un courriel suspect ?', 'Sensibilisation, exercices d\'hameçonnage', 'Questionnaire ; exercice', 'Taux de clic lors des exercices', 'Élevé', 3, 'ICT'],
    [19, 'Vigilance', 'Filtrer les noms de domaine malveillants', 'Un filtrage DNS protège-t-il le poste, y compris hors du réseau de l\'entreprise ?', 'DNS filtrant ou protection web nomade', 'Technique', 'Nombre de requêtes bloquées', 'Moyen', 3, 'IC'],
    [20, 'Vigilance', 'Signaler rapidement les incidents', 'Le télétravailleur sait-il qui prévenir et comment en cas d\'incident ?', 'Contact connu, procédure simple', 'Questionnaire', 'Délai moyen de signalement', 'Élevé', 3, 'DICT']
  ];

  function build(src, rows) {
    return rows.map(function (r) {
      return {
        id: src + '-' + (r[0] < 10 ? '0' : '') + r[0], src: src, num: r[0], domaine: r[1], titre: r[2],
        question: r[3], attendus: r[4], methodeVerif: r[5], indicateur: r[6], gravite: r[7], cible: r[8],
        dict: { D: r[9].indexOf('D') >= 0, I: r[9].indexOf('I') >= 0, C: r[9].indexOf('C') >= 0, T: r[9].indexOf('T') >= 0 }
      };
    });
  }

  var KPIS = [
    { id: 'KPI-01', nom: 'Postes à jour des correctifs de sécurité', unite: '%', cible: 95, sens: 'haut', mode: 'manuel' },
    { id: 'KPI-02', nom: 'Comptes protégés par authentification multifacteur', unite: '%', cible: 100, sens: 'haut', mode: 'manuel' },
    { id: 'KPI-03', nom: 'Utilisateurs sensibilisés dans l\'année', unite: '%', cible: 90, sens: 'haut', mode: 'manuel' },
    { id: 'KPI-04', nom: 'Tests de restauration réussis (trimestre)', unite: 'nb', cible: 1, sens: 'haut', mode: 'manuel' },
    { id: 'KPI-05', nom: 'Taux de clic aux exercices d\'hameçonnage', unite: '%', cible: 5, sens: 'bas', mode: 'manuel' },
    { id: 'KPI-A1', nom: 'Maturité moyenne (COBIT)', unite: '/5', cible: 3, sens: 'haut', mode: 'auto', formule: 'maturite' },
    { id: 'KPI-A2', nom: 'Points de contrôle atteignant la cible', unite: '%', cible: 80, sens: 'haut', mode: 'auto', formule: 'conformite' },
    { id: 'KPI-A3', nom: 'Écarts de priorité P1', unite: 'nb', cible: 0, sens: 'bas', mode: 'auto', formule: 'p1' },
    { id: 'KPI-A4', nom: 'Actions correctives réalisées', unite: '%', cible: 100, sens: 'haut', mode: 'auto', formule: 'actions' },
    { id: 'KPI-A5', nom: 'Preuves collectées', unite: '%', cible: 100, sens: 'haut', mode: 'auto', formule: 'preuves' }
  ];

  /** Crée un point de contrôle d'audit à partir d'une entrée du catalogue. */
  function newItem(m) {
    return {
      id: m.id, src: m.src, num: m.num, domaine: m.domaine, titre: m.titre, question: m.question,
      attendus: m.attendus, methodeVerif: m.methodeVerif, indicateur: m.indicateur,
      dict: { D: !!m.dict.D, I: !!m.dict.I, C: !!m.dict.C, T: !!m.dict.T },
      retenue: true, decision: 'Non évalué', constat: '', preuves: [], methodes: [], fiabilite: '',
      niveau: null, cible: m.cible, gravite: m.gravite,
      action: '', responsable: '', echeance: '', statutAction: 'À faire', niveauApres: null, chantier: '', suivi: ''
    };
  }

  root.SSI_CATALOG = { ANSSI: build('ANSSI', ANSSI), CIS: build('CIS', CIS), KPIS: KPIS, newItem: newItem };
})(typeof window !== 'undefined' ? window : globalThis);
