/* SSI Audit — Catalogue des points de contrôle (ANSSI, CIS), listes de valeurs et KPI par défaut.
 * Les mesures elles-mêmes sont dans catalog-data.js (guide d'hygiène ANSSI : 42 mesures,
 * numérotation officielle ; guide CIS Telework and Small Office Network Security v8.1 : 20 recommandations).
 * Intitulés résumés et reformulés en français : se reporter aux guides officiels pour le texte de référence. */
(function (root) {
  'use strict';
  var DATA = root.SSI_CATALOG_DATA || { ANSSI: [], CIS: [] };

  var KPIS = [
    { id: 'KPI-01', nom: 'Postes à jour des correctifs de sécurité', unite: '%', cible: 95, sens: 'haut', mode: 'manuel' },
    { id: 'KPI-02', nom: 'Comptes critiques protégés par authentification multifacteur', unite: '%', cible: 100, sens: 'haut', mode: 'manuel' },
    { id: 'KPI-03', nom: 'Chartes informatiques signées', unite: '%', cible: 100, sens: 'haut', mode: 'manuel' },
    { id: 'KPI-04', nom: 'Tests de restauration réussis (trimestre)', unite: 'nb', cible: 1, sens: 'haut', mode: 'manuel' },
    { id: 'KPI-05', nom: 'Taux de clic aux exercices d\'hameçonnage', unite: '%', cible: 10, sens: 'bas', mode: 'manuel' },
    { id: 'KPI-A1', nom: 'Maturité moyenne (COBIT)', unite: '/5', cible: 3, sens: 'haut', mode: 'auto', formule: 'maturite' },
    { id: 'KPI-A2', nom: 'Points de contrôle atteignant la cible', unite: '%', cible: 80, sens: 'haut', mode: 'auto', formule: 'conformite' },
    { id: 'KPI-A3', nom: 'Écarts de priorité P1', unite: 'nb', cible: 0, sens: 'bas', mode: 'auto', formule: 'p1' },
    { id: 'KPI-A4', nom: 'Actions correctives réalisées', unite: '%', cible: 100, sens: 'haut', mode: 'auto', formule: 'actions' },
    { id: 'KPI-A5', nom: 'Preuves collectées', unite: '%', cible: 100, sens: 'haut', mode: 'auto', formule: 'preuves' }
  ];

  var LISTES = {
    retenue: ['Oui', 'Allégée', 'Non'],
    fiabilite: ['Établie', 'Partielle', 'Présomption'],
    regleEcrite: ['Oui', 'Partiel', 'Non'],
    statut: ['À faire', 'En cours', 'Fait'],
    statutPreuve: ['À collecter', 'Collectée'],
    methodes: ['Examen documentaire', 'Entretien', 'Questionnaire', 'Observation', 'Test de contrôle', 'Échantillonnage', 'Analyse', 'Recalcul']
  };

  /** Crée un point de contrôle d'audit à partir d'une entrée du catalogue. */
  function newItem(m) {
    var dict = m.dict || {};
    return {
      id: m.id, src: m.src, num: m.num, ref: m.ref || String(m.num), domaine: m.domaine || '', domaineSecurite: m.domaineSecurite || '',
      titre: m.titre || '', question: m.question || '', attendus: m.attendus || '', methodeVerif: m.methodeVerif || '',
      indicateur: m.indicateur || '', correspondance: m.correspondance || '',
      dict: { D: !!dict.D, I: !!dict.I, C: !!dict.C, T: !!dict.T },
      retenue: true, allegee: false, justification: '',
      constat: '', causes: '', consequences: '', pointsForts: '', couverture: '',
      preuves: [], preuvesComplementaires: '', fiabilite: '', regleEcrite: '', methodes: [], analyseCobit: '',
      niveau: null, cible: m.cible, gravite: m.gravite,
      action: '', responsable: '', echeance: '', actionRealisee: false, dateRealisation: '', avancement: 0,
      statutAction: 'À faire', justificatifRealisation: '', niveauApres: null, chantier: '', suivi: '', decision: ''
    };
  }

  root.SSI_CATALOG = { ANSSI: DATA.ANSSI, CIS: DATA.CIS, KPIS: KPIS, LISTES: LISTES, newItem: newItem };
})(typeof window !== 'undefined' ? window : globalThis);
