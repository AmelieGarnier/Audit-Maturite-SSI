/* SSI Audit — Jeu de démonstration : cas d'étude « Global Green » (données fictives). */
(function (root) {
  'use strict';
  var cat = root.SSI_CATALOG;
  if (!cat) return;

  // Niveaux COBIT constatés (ordre du catalogue). null = non évalué.
  var ANSSI_N = [1, 1, 2, 2, 1, 2, 1, 1, 2, 2, 1, 0, 1, 2, 1, 1, 3, 2, 1, 2, 2, 3, 1, 2, 2, 2, 0, 0, 1, 2, 1, 2, 1, 2, 1, 1, 2, 0, 1, 1, 0, 1];
  var CIS_N = [1, 2, 3, 1, 1, 2, 1, 2, 2, 2, 3, 2, 1, 1, 2, 2, 2, 1, 0, 1];

  var ACTIONS = {
    'ANSSI-05': ['Établir et revoir chaque trimestre la liste nominative des comptes administrateurs', 'Responsable informatique', 'CH-02', 'Réalisé', 3],
    'ANSSI-08': ['Supprimer les comptes partagés et créer des comptes d\'administration distincts', 'Responsable informatique', 'CH-02', 'En cours', null],
    'ANSSI-12': ['Changer les mots de passe par défaut de la box, des imprimantes et du NAS', 'Prestataire', 'CH-02', 'Réalisé', 4],
    'ANSSI-13': ['Activer la double authentification sur la messagerie et le VPN', 'Responsable informatique', 'CH-02', 'En cours', null],
    'ANSSI-29': ['Retirer les droits d\'administrateur local et mettre en place une procédure d\'élévation', 'Prestataire', 'CH-03', 'À faire', null],
    'ANSSI-31': ['Chiffrer les disques des ordinateurs portables (BitLocker)', 'Prestataire', 'CH-03', 'À faire', null],
    'ANSSI-34': ['Déployer une politique de mises à jour automatiques avec suivi mensuel', 'Prestataire', 'CH-03', 'En cours', null],
    'ANSSI-37': ['Ajouter une sauvegarde hors ligne et tester une restauration chaque trimestre', 'Responsable informatique', 'CH-04', 'Réalisé', 3],
    'ANSSI-02': ['Organiser une session de sensibilisation annuelle et faire signer la charte', 'Direction', 'CH-01', 'En cours', null],
    'ANSSI-40': ['Rédiger une fiche réflexe incident et l\'afficher', 'Référent SSI', 'CH-01', 'À faire', null],
    'CIS-01': ['Vérifier et changer le mot de passe des box des télétravailleurs', 'Responsable informatique', 'CH-05', 'À faire', null],
    'CIS-07': ['Imposer la double authentification pour les accès distants', 'Responsable informatique', 'CH-05', 'En cours', null],
    'CIS-13': ['Chiffrer les postes de télétravail', 'Prestataire', 'CH-03', 'À faire', null]
  };

  var items = cat.ANSSI.map(function (m, i) { var it = cat.newItem(m); it.niveau = ANSSI_N[i]; return it; })
    .concat(cat.CIS.map(function (m, i) { var it = cat.newItem(m); it.niveau = CIS_N[i]; return it; }));

  items.forEach(function (it) {
    it.methodes = ['Entretien'];
    it.fiabilite = 'Déclaratif';
    if (it.niveau >= it.cible) { it.decision = 'Conforme'; }
    else if (it.niveau >= 2) { it.decision = 'Partiel'; }
    else { it.decision = 'Non conforme'; }
    var a = ACTIONS[it.id];
    if (a) {
      it.action = a[0]; it.responsable = a[1]; it.chantier = a[2]; it.statutAction = a[3]; it.niveauApres = a[4];
      it.methodes = ['Entretien', 'Technique'];
      it.fiabilite = 'Vérifié';
    }
  });
  function set(id, f) { items.forEach(function (it) { if (it.id === id) f(it); }); }
  set('ANSSI-42', function (it) { it.retenue = false; it.decision = 'Non retenue'; it.constat = 'Hors périmètre pour une structure de cette taille.'; });
  set('ANSSI-37', function (it) { it.constat = 'Sauvegarde quotidienne sur NAS, sans copie hors ligne ni test de restauration.'; it.preuves = ['PR-03']; it.methodes = ['Entretien', 'Technique', 'Documentaire']; });
  set('ANSSI-12', function (it) { it.constat = 'Mot de passe d\'origine encore actif sur la box et deux imprimantes.'; it.preuves = ['PR-04']; });
  set('ANSSI-13', function (it) { it.constat = 'Aucune double authentification sur la messagerie en ligne.'; it.preuves = ['PR-05']; });
  set('ANSSI-02', function (it) { it.constat = 'Charte informatique existante mais non signée par les nouveaux arrivants.'; it.preuves = ['PR-01']; it.methodes = ['Documentaire', 'Questionnaire']; });
  set('ANSSI-04', function (it) { it.preuves = ['PR-02']; it.methodes = ['Documentaire']; });
  set('ANSSI-34', function (it) { it.constat = 'Mises à jour laissées à l\'initiative des utilisateurs.'; it.preuves = ['PR-06']; });

  root.SSI_DEMO = {
    id: 'demo-globalgreen',
    version: 1,
    meta: {
      organisation: 'Global Green', secteur: 'Conseil en environnement', effectif: '35 salariés, 2 sites',
      dateAudit: '2025-03-15', auditeur: 'Groupe ERIS 2', classification: 'C2 · Diffusion restreinte',
      contexte: 'PME de conseil en transition écologique, forte part de télétravail, informatique confiée à un prestataire.',
      perimetre: 'Siège et agence, postes de travail, messagerie en ligne, NAS, accès distants.',
      referentiels: { ANSSI: true, CIS: true, SPEC: true }, demo: true, agregation: 'mediane'
    },
    items: items,
    preuves: [
      { id: 'PR-01', titre: 'Charte informatique', type: 'Document', statut: 'Reçue', date: '2025-03-10', commentaire: '' },
      { id: 'PR-02', titre: 'Schéma du réseau', type: 'Document', statut: 'Validée', date: '2025-03-11', commentaire: 'Version 2023, à actualiser' },
      { id: 'PR-03', titre: 'Rapport de sauvegarde du NAS', type: 'Capture', statut: 'Reçue', date: '2025-03-12', commentaire: '' },
      { id: 'PR-04', titre: 'Inventaire des équipements réseau', type: 'Export', statut: 'À collecter', date: '', commentaire: '' },
      { id: 'PR-05', titre: 'Paramètres de sécurité de la messagerie', type: 'Capture', statut: 'À collecter', date: '', commentaire: '' },
      { id: 'PR-06', titre: 'État des mises à jour des postes', type: 'Export', statut: 'Reçue', date: '2025-03-14', commentaire: '' }
    ],
    chantiers: [
      { id: 'CH-01', titre: 'Sensibilisation et gouvernance', debut: '2025-04-01', fin: '2025-09-30', avancement: 30, type: 'chantier' },
      { id: 'CH-02', titre: 'Comptes et authentification', debut: '2025-04-01', fin: '2025-06-30', avancement: 55, type: 'chantier' },
      { id: 'CH-03', titre: 'Sécurisation des postes', debut: '2025-05-01', fin: '2025-10-31', avancement: 20, type: 'chantier' },
      { id: 'CH-04', titre: 'Sauvegardes et continuité', debut: '2025-04-15', fin: '2025-07-15', avancement: 70, type: 'chantier' },
      { id: 'CH-05', titre: 'Télétravail sécurisé', debut: '2025-06-01', fin: '2025-12-15', avancement: 10, type: 'chantier' },
      { id: 'CH-06', titre: 'Revue trimestrielle des accès', debut: '2025-04-01', fin: '2026-03-31', avancement: 25, type: 'recurrent' }
    ],
    jalons: [
      { id: 'J-01', titre: 'Validation du plan par la direction', date: '2025-04-01' },
      { id: 'J-02', titre: 'Audit de suivi', date: '2025-10-15' }
    ],
    kpis: cat.KPIS.map(function (k) { return JSON.parse(JSON.stringify(k)); }),
    releves: [
      { kpi: 'KPI-01', date: '2025-03-15', valeur: 62 }, { kpi: 'KPI-01', date: '2025-05-15', valeur: 78 }, { kpi: 'KPI-01', date: '2025-07-15', valeur: 88 },
      { kpi: 'KPI-02', date: '2025-03-15', valeur: 0 }, { kpi: 'KPI-02', date: '2025-05-15', valeur: 40 }, { kpi: 'KPI-02', date: '2025-07-15', valeur: 75 },
      { kpi: 'KPI-03', date: '2025-03-15', valeur: 20 }, { kpi: 'KPI-03', date: '2025-06-15', valeur: 65 },
      { kpi: 'KPI-04', date: '2025-06-30', valeur: 1 },
      { kpi: 'KPI-05', date: '2025-04-10', valeur: 24 }, { kpi: 'KPI-05', date: '2025-07-10', valeur: 11 }
    ],
    historique: [
      { date: '2025-03-15', version: '1.0', auteur: 'Groupe ERIS 2', commentaire: 'Audit initial' }
    ],
    questionnaires: []
  };
})(typeof window !== 'undefined' ? window : globalThis);
