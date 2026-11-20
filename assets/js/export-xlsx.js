/* SSI Audit — Export Excel au format de la matrice d'audit de maturité.
 * Onglets : Présentation, Méthode, Audit ANSSI, Audit CIS Télétravail, Audit logiciels, Registre des preuves,
 * Éléments non retenus, Synthèse, Plan d'action, Plan de déploiement, Indicateurs.
 * Dans les onglets d'audit, écart, criticité, priorité et risques sont des formules Excel : le classeur se
 * recalcule si on le modifie. */
(function (root) {
  'use strict';
  var GREEN = '1E5631', SOFT = 'E8F3EA', INPUT = 'FFF9E5', GREY = 'E7E6E6', BLUE = '2E75B6', RED = 'C00000';
  var ST = {
    title: { b: true, sz: 16, color: GREEN, h: 'center', v: 'center', wrap: true },
    subtitle: { sz: 10, color: '595959', h: 'center', v: 'center', wrap: true },
    section: { b: true, sz: 13, color: GREEN, v: 'center' },
    head: { b: true, color: 'FFFFFF', fill: GREEN, h: 'center', v: 'center', wrap: true, border: true },
    label: { b: true, color: GREEN, fill: SOFT, v: 'center', wrap: true, border: true },
    cell: { wrap: true, border: true },
    center: { wrap: true, border: true, h: 'center', v: 'center' },
    ref: { b: true, wrap: true, border: true, h: 'center', v: 'center' },
    input: { wrap: true, border: true, fill: INPUT },
    inputC: { wrap: true, border: true, fill: INPUT, h: 'center', v: 'center' },
    calc: { wrap: true, border: true, h: 'center', v: 'center', b: true },
    dec: { border: true, h: 'center', v: 'center', dec: true },
    pct: { border: true, h: 'center', v: 'center', pct: true },
    note: { i: true, sz: 9, color: '595959', wrap: true },
    gantt: { fill: BLUE, border: true },
    rec: { b: true, color: BLUE, h: 'center', v: 'center', border: true },
    jalon: { b: true, color: RED, h: 'center', v: 'center', border: true },
    empty: { border: true }
  };
  var LEVEL_FILLS = { 'Critique': ['C00000', 'FFFFFF'], 'Élevé': ['ED7D31', 'FFFFFF'], 'Moyen': ['FFC000', '000000'], 'Faible': ['70AD47', 'FFFFFF'] };
  var PRIO_FILLS = { P1: ['C00000', 'FFFFFF'], P2: ['ED7D31', 'FFFFFF'], P3: ['FFC000', '000000'], OK: ['70AD47', 'FFFFFF'], 'Non retenue': ['BFBFBF', '404040'] };
  function rules(map) { return Object.keys(map).map(function (k) { return { eq: k, fill: map[k][0], color: map[k][1], b: true }; }); }
  function c(v, s) { return { v: v === undefined ? null : v, s: s || ST.cell }; }
  function f(formula, cached, s) { return { f: formula, v: cached === undefined ? null : cached, s: s || ST.calc }; }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function fmtDate(s) { if (!s || !/^\d{4}-\d\d-\d\d/.test(s)) return s || ''; var p = s.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function X(b) { return b ? 'X' : ''; }
  function colNum(L) { var n = 0; for (var i = 0; i < L.length; i++) n = n * 26 + L.charCodeAt(i) - 64; return n - 1; }

  // Formules Excel (syntaxe anglaise, séparateur virgule, comme dans le format OOXML).
  function poidsF(w) { return 'IF(' + w + '="Critique",4,IF(' + w + '="Élevé",3,IF(' + w + '="Moyen",2,IF(' + w + '="Faible",1,0))))'; }
  function vraisF(n) { return 'IF(' + n + '="",1,IF(' + n + '=0,4,IF(' + n + '=1,3,IF(' + n + '=2,2,1))))'; }
  function niveauF(s) { return 'IF(' + s + '="","",IF(' + s + '>=12,"Critique",IF(' + s + '>=8,"Élevé",IF(' + s + '>=4,"Moyen","Faible"))))'; }

  function build(audit, C, CAT) {
    var meta = audit.meta || {}, L = CAT.LISTES, s = C.summary(audit);
    var items = audit.items || [], refs = meta.referentiels || {};
    var sheets = [];
    var byChantier = {};
    items.forEach(function (it) { if (it.chantier) (byChantier[it.chantier] = byChantier[it.chantier] || []).push(it); });
    var srcLabel = { ANSSI: 'Audit ANSSI', CIS: 'Audit CIS Télétravail', SPEC: 'Audit logiciels' };

    // ---------- Présentation ----------
    var P = [];
    P.push({ h: 30, cells: [c(meta.organisation + ' : Matrice d\'audit de maturité SSI', ST.title)] });
    P.push([c('Audit de maturité de la sécurité du système d\'information', ST.subtitle)]);
    P.push([c('Référentiels : guide d\'hygiène informatique de l\'ANSSI · guide CIS Telework and Small Office Network Security (v8.1) · échelle de capacité COBIT 2019', ST.subtitle)]);
    P.push([]);
    P.push([c('Identification du document', ST.section)]);
    [['Référence', meta.reference || (meta.organisation + '_Audit_Maturité_SSI')], ['Version', meta.versionDoc || ''], ['Date de l\'audit', fmtDate(meta.dateAudit)],
      ['Destinataires', meta.destinataires || ''], ['Classification', meta.classification || ''], ['Auditeur', meta.auditeur || '']]
      .forEach(function (r) { P.push([c(r[0], ST.label), c(r[1])]); });
    P.push([]);
    P.push([c('Historique des versions', ST.section)]);
    P.push([c('Version et date', ST.head), c('Auteur et modification', ST.head)]);
    (audit.historique || []).forEach(function (h) { P.push([c((h.version || '') + ' - ' + fmtDate(h.date), ST.label), c((h.auteur ? h.auteur + ' : ' : '') + (h.commentaire || ''))]); });
    P.push([]);
    P.push([c('Sommaire du classeur', ST.section)]);
    [['Présentation', 'Identification, classification, historique, contexte de l\'audit.'],
      ['Méthode', 'Échelle COBIT 2019, règles de calcul (écart, criticité, priorité, risque), méthodes de vérification, critères DICT.'],
      ['Audit ANSSI', s.parSource.ANSSI ? s.parSource.ANSSI.total + ' mesures du guide d\'hygiène, dont ' + s.parSource.ANSSI.retenus + ' retenues.' : ''],
      ['Audit CIS Télétravail', s.parSource.CIS ? s.parSource.CIS.total + ' recommandations du guide CIS, dont ' + s.parSource.CIS.retenus + ' retenues.' : ''],
      ['Audit logiciels', s.parSource.SPEC ? s.parSource.SPEC.total + ' contrôles spécifiques (logiciels métier et outils).' : 'Contrôles spécifiques (logiciels métier).'],
      ['Registre des preuves', (audit.preuves || []).length + ' preuves, référencées dans chaque ligne d\'audit.'],
      ['Éléments non retenus', 'Mesures non retenues ou allégées : justification, mesure compensatoire, risque résiduel accepté.'],
      ['Synthèse', 'Indicateurs clés, niveaux par domaine, suivi des actions, évolution du risque, DICT, méthodes.'],
      ['Plan d\'action', 'Chantiers : mesures couvertes, actions clés, responsable, échéance, coût, indicateur, suivi.'],
      ['Plan de déploiement', 'Diagramme de Gantt, activités récurrentes, jalons et critères de passage.'],
      ['Indicateurs', 'Indicateurs de suivi (KPI) et historique des mesures.']]
      .forEach(function (r) { P.push([c(r[0], ST.label), c(r[1])]); });
    P.push([]);
    P.push([c('Contexte de l\'audit', ST.section)]);
    [['Organisation', meta.contexte || ''], ['Secteur d\'activité', meta.secteur || ''], ['Effectif', meta.effectif || ''], ['Implantation', meta.implantation || ''],
      ['Périmètre audité', meta.perimetre || ''], ['Acteurs', meta.acteurs || ''], ['Enjeux', meta.enjeux || ''], ['Documents de référence internes', meta.documents || ''],
      ['Méthode', 'Chaque recommandation est évaluée sur l\'échelle des niveaux de capacité COBIT 2019 (0 à 5) : niveau actuel constaté et cible à 12 mois. L\'écart, la criticité, la priorité et les risques sont calculés automatiquement (onglet « Méthode »).'],
      ['Auditeur', meta.auditeur || '']]
      .forEach(function (r) { if (r[1]) P.push([c(r[0], ST.label), c(r[1])]); });
    sheets.push({ name: 'Présentation', cols: [38, 110], merges: ['A1:B1', 'A2:B2', 'A3:B3'], rows: P });

    // ---------- Méthode ----------
    var M = [];
    M.push({ h: 28, cells: [c('Échelle de maturité et règles de calcul', ST.title)] });
    M.push([c('Échelle : niveaux de capacité des processus COBIT 2019, appliqués à chaque recommandation.', ST.subtitle)]);
    M.push([]);
    M.push([c('Niveau COBIT', ST.head), c('Libellé', ST.head), c('Définition (COBIT 2019)', ST.head)]);
    [[0, 'Incomplet', 'Absence de capacité de base ; approche incomplète ; l\'objectif de la pratique n\'est pas atteint.'],
      [1, 'Initial', 'L\'objectif est plus ou moins atteint par un ensemble d\'activités incomplet, intuitif et peu organisé.'],
      [2, 'Géré', 'L\'objectif est atteint par un ensemble d\'activités basique mais complet, effectivement réalisé.'],
      [3, 'Défini', 'L\'objectif est atteint de façon organisée, en s\'appuyant sur les actifs de l\'organisation (politiques, procédures).'],
      [4, 'Mesuré', 'Processus bien défini dont la performance est mesurée quantitativement.'],
      [5, 'Optimisé', 'Processus bien défini, performance mesurée et amélioration continue recherchée.']]
      .forEach(function (r) { M.push([c(r[0], ST.ref), c(r[1], ST.label), c(r[2])]); });
    M.push([]);
    M.push([c('Règles de calcul', ST.section)]);
    [['Écart', 'Cible − niveau actuel (0 si la cible est atteinte).'],
      ['Criticité', 'Écart × poids du risque (Critique = 4, Élevé = 3, Moyen = 2, Faible = 1).'],
      ['P1 : Critique', 'Criticité ≥ 12 : à traiter dans les 3 mois.'], ['P2 : Important', 'Criticité de 8 à 11 : à traiter dans les 6 mois.'],
      ['P3 : À planifier', 'Criticité de 1 à 7 : à traiter dans les 12 mois.'], ['OK', 'Cible atteinte.'],
      ['Non retenue', 'Mesure écartée et justifiée (onglet « Éléments non retenus ») : ni écart ni priorité, exclue des moyennes ; son risque reste coté.'],
      ['Gravité', 'Colonne « Risque » : impact sur l\'activité si la mesure fait défaut (Critique 4, Élevé 3, Moyen 2, Faible 1).'],
      ['Vraisemblance', 'Déduite du niveau COBIT : niveau 0 = 4, 1 = 3, 2 = 2, 3 et plus = 1.'],
      ['Score de risque', 'Gravité × vraisemblance, de 1 à 16 : ≥ 12 Critique · 8 à 11 Élevé · 4 à 7 Moyen · 1 à 3 Faible.'],
      ['Risque initial', 'Calculé avec le niveau actuel constaté.'],
      ['Risque résiduel actuel', 'Calculé avec le « Niveau atteint après action » lorsque « Action réalisée » vaut Oui ; sinon égal au risque initial.'],
      ['Risque résiduel prévisionnel', 'Calculé avec la cible : risque qui subsistera une fois le plan achevé. Il ne descend jamais à zéro.'],
      ['Règle écrite', 'Oui : la mesure est encadrée par une politique écrite ; Partiel : en partie ; Non : aucune règle.'],
      ['Fiabilité de la preuve', 'Établie : fait corroboré par une preuve collectée ; Partielle : fait décrit, à corroborer ; Présomption : déduit, à vérifier.']]
      .forEach(function (r) { M.push([c(r[0], ST.label), c(r[1]), c('')]); });
    M.push([]);
    M.push([c('Méthodes de vérification', ST.section)]);
    [['Examen documentaire', 'Vérification des politiques, procédures, contrats, registres et rapports fournis par l\'audité.'],
      ['Entretien', 'Échange avec les personnes concernées ; ne suffit jamais seul.'],
      ['Questionnaire', 'Questions fermées adressées à plusieurs personnes pour mesurer la connaissance d\'une règle.'],
      ['Observation', 'Constat visuel sur place (locaux, postes, équipements) ; valable au moment de l\'observation.'],
      ['Test de contrôle', 'Mise à l\'épreuve réelle du contrôle : connexion avec un mot de passe d\'usine, restauration, faux hameçonnage.'],
      ['Échantillonnage', 'Contrôle d\'un échantillon représentatif lorsque l\'exhaustivité n\'est pas possible.'],
      ['Analyse', 'Exploitation d\'extractions techniques ou d\'outils (console, scan de ports, liste des appareils connectés).'],
      ['Recalcul', 'Vérification arithmétique : rapprochement inventaire / réalité, calcul d\'un taux ou d\'une durée.']]
      .forEach(function (r) { M.push([c(r[0], ST.label), c(r[1]), c('')]); });
    M.push([]);
    M.push([c('Critères DICT', ST.section)]);
    [['D : Disponibilité', 'L\'information et les outils sont utilisables au moment où l\'on en a besoin.'],
      ['I : Intégrité', 'L\'information est exacte, complète et n\'a pas été modifiée sans autorisation.'],
      ['C : Confidentialité', 'Seules les personnes autorisées accèdent à l\'information.'],
      ['T : Traçabilité', 'On peut savoir qui a fait quoi et quand, et le prouver.']]
      .forEach(function (r) { M.push([c(r[0], ST.label), c(r[1]), c('')]); });
    sheets.push({ name: 'Méthode', cols: [26, 22, 100], merges: ['A1:C1', 'A2:C2'], rows: M });

    // ---------- Onglets d'audit ANSSI / CIS ----------
    var HEAD_AUDIT = ['Réf. (n° officiel)', 'Domaine', 'Recommandation', 'Question d\'audit', 'Attendus (preuves à fournir)', 'Méthode de vérification',
      'Indicateur de vérification (cible)', 'Correspondance', 'Retenue (Oui / Allégée / Non)', 'Justification du choix', 'Constat (situation observée)',
      'Causes identifiées', 'Conséquences possibles pour ' + meta.organisation, 'Points forts constatés', 'Couverture documentaire ' + meta.organisation,
      'Preuves collectées (registre des preuves)', 'Preuves complémentaires à collecter', 'Fiabilité de la preuve', 'Règle écrite', 'Niveau actuel', 'Cible',
      'Écart', 'Risque (gravité)', 'Criticité', 'Priorité', 'Action corrective proposée', 'Responsable', 'Échéance', 'Action réalisée (Oui / Non)',
      'Date de réalisation', 'État d\'avancement (%)', 'Statut', 'Justificatif / preuve de réalisation', 'Niveau atteint après action',
      'Niveau retenu pour le résiduel', 'Risque initial (score /16)', 'Niveau de risque initial', 'Risque résiduel actuel (score)',
      'Niveau de risque résiduel actuel', 'Risque résiduel prévisionnel (score)', 'Niveau de risque résiduel prévisionnel',
      'Évolution du risque (initial → actuel → prévisionnel)', 'D', 'I', 'C', 'T', 'Analyse du niveau attribué (COBIT)'].concat(L.methodes);
    var W_AUDIT = [9, 22, 36, 42, 34, 28, 28, 18, 12, 34, 48, 34, 34, 30, 30, 34, 30, 12, 10, 9, 8, 8, 10, 9, 11, 44, 18, 14, 11, 12, 11, 11, 26, 11, 11, 10, 12, 10, 12, 10, 12, 26, 4, 4, 4, 4, 40, 10, 10, 10, 10, 10, 10, 10, 10];

    function preuvesTexte(it) {
      if (it.preuvesCollecteesTexte) return it.preuvesCollecteesTexte;
      var idx = {}; (audit.preuves || []).forEach(function (p) { idx[p.id] = p.titre; });
      return (it.preuves || []).map(function (id) { return id + (idx[id] ? ' ' + idx[id] : ''); }).join(' ; ');
    }
    function evolution(r) { return r.niveauRisqueInitial ? r.niveauRisqueInitial + ' → ' + r.niveauRisqueActuel + ' → ' + r.niveauRisqueApres : ''; }

    function auditSheet(src, name, title, subtitle) {
      var list = items.filter(function (it) { return it.src === src; });
      var R = [];
      R.push({ h: 26, cells: [c(title, ST.title)] });
      R.push({ h: 28, cells: [c(subtitle, ST.subtitle)] });
      var r3 = []; r3[colNum('AQ')] = c('DICT protégé', ST.head); r3[colNum('AV')] = c('Méthodes de vérification (une colonne par méthode)', ST.head);
      R.push(r3);
      R.push({ h: 48, cells: HEAD_AUDIT.map(function (h) { return c(h, ST.head); }) });
      list.forEach(function (it, i) {
        var n = i + 5, k = C.compute(it), ex = it.retenue === false;
        var base = ex ? { wrap: true, border: true, fill: GREY, color: '7F7F7F' } : ST.cell;
        var inp = ex ? base : ST.input, inpC = ex ? Object.assign({ h: 'center', v: 'center' }, base) : ST.inputC;
        var cen = ex ? Object.assign({ h: 'center', v: 'center' }, base) : ST.center;
        var I = 'I' + n, T = 'T' + n, U = 'U' + n, V = 'V' + n, Wc = 'W' + n, Xc = 'X' + n, AC = 'AC' + n, AH = 'AH' + n, AI = 'AI' + n;
        var row = [
          c(it.ref || it.num, ex ? base : ST.ref), c(it.domaine, base), c(it.titre, base), c(it.question, base), c(it.attendus, base), c(it.methodeVerif, base),
          c(it.indicateur, base), c(it.correspondance, base), c(ex ? 'Non' : it.allegee ? 'Allégée' : 'Oui', inpC), c(it.justification, inp),
          c(it.constat, inp), c(it.causes, inp), c(it.consequences, inp), c(it.pointsForts, inp), c(it.couverture, inp), c(preuvesTexte(it), inp),
          c(it.preuvesComplementaires, inp), c(it.fiabilite, inpC), c(it.regleEcrite, inpC), c(it.niveau, inpC), c(it.cible, inpC),
          f('IF(OR(' + I + '="Non",' + T + '="",' + U + '=""),"",MAX(0,' + U + '-' + T + '))', k.ecart === null ? '' : k.ecart),
          c(it.gravite, inpC),
          f('IF(' + V + '="","",' + V + '*' + poidsF(Wc) + ')', k.criticite === null ? '' : k.criticite),
          f('IF(' + I + '="Non","Non retenue",IF(' + Xc + '="","",IF(' + Xc + '>=12,"P1",IF(' + Xc + '>=8,"P2",IF(' + Xc + '>=1,"P3","OK")))))', k.priorite || ''),
          c(it.action, inp), c(it.responsable, inpC), c(it.echeance, inpC), c(C.estRealisee(it) ? 'Oui' : 'Non', inpC), c(fmtDate(it.dateRealisation), inpC),
          c(+it.avancement || 0, inpC), c(it.statutAction, inpC), c(it.justificatifRealisation, inp), c(it.niveauApres, inpC),
          f('IF(AND(' + AC + '="Oui",' + AH + '<>""),' + AH + ',' + T + ')', k.niveauCourant === null ? '' : k.niveauCourant, cen),
          f('IF(AND(' + I + '<>"Non",' + T + '=""),"",' + poidsF(Wc) + '*' + vraisF(T) + ')', k.risqueInitial === null ? '' : k.risqueInitial), f(niveauF('AJ' + n), k.niveauRisqueInitial || ''),
          f('IF(AJ' + n + '="","",' + poidsF(Wc) + '*' + vraisF(AI) + ')', k.risqueActuel === null ? '' : k.risqueActuel), f(niveauF('AL' + n), k.niveauRisqueActuel || ''),
          f('IF(AJ' + n + '="","",MIN(AJ' + n + ',' + poidsF(Wc) + '*' + vraisF('IF(' + U + '="",3,' + U + ')') + '))', k.risqueApres === null ? '' : k.risqueApres), f(niveauF('AN' + n), k.niveauRisqueApres || ''),
          f('IF(AK' + n + '="","",AK' + n + '&" → "&AM' + n + '&" → "&AO' + n + ')', evolution(k), cen),
          c(X(it.dict && it.dict.D), cen), c(X(it.dict && it.dict.I), cen), c(X(it.dict && it.dict.C), cen), c(X(it.dict && it.dict.T), cen), c(it.analyseCobit, base)
        ].concat(L.methodes.map(function (m) { return c(X((it.methodes || []).indexOf(m) >= 0), cen); }));
        R.push({ h: 110, cells: row });
      });
      var last = list.length + 4;
      R.push([]);
      R.push([c('Fond jaune pâle = saisie de l\'auditeur · Écart, criticité, priorité et risques sont calculés par formule (onglet « Méthode ») · lignes grisées = mesure non retenue, justifiée dans l\'onglet « Éléments non retenus » et exclue des moyennes · Risque résiduel actuel = risque initial tant que « Action réalisée » vaut Non.', ST.note)]);
      var lvl = ['0', '1', '2', '3', '4', '5'];
      return {
        name: name, cols: W_AUDIT, freeze: 'D5', autoFilter: 'A4:BC' + last,
        merges: ['A1:M1', 'A2:M2', 'AQ3:AT3', 'AV3:BC3', 'A' + (last + 2) + ':M' + (last + 2)],
        validations: [{ ref: 'I5:I' + last, list: L.retenue }, { ref: 'R5:R' + last, list: L.fiabilite }, { ref: 'S5:S' + last, list: L.regleEcrite },
          { ref: 'T5:U' + last + ' AH5:AH' + last, list: lvl }, { ref: 'W5:W' + last, list: C.GRAVITES }, { ref: 'AC5:AC' + last, list: ['Oui', 'Non'] },
          { ref: 'AF5:AF' + last, list: L.statut }],
        conditional: [{ ref: 'Y5:Y' + last, rules: rules(PRIO_FILLS) }, { ref: 'W5:W' + last + ' AK5:AK' + last + ' AM5:AM' + last + ' AO5:AO' + last, rules: rules(LEVEL_FILLS) }],
        rows: R
      };
    }
    if (refs.ANSSI !== false) sheets.push(auditSheet('ANSSI', 'Audit ANSSI', 'Audit de maturité : Guide d\'hygiène informatique de l\'ANSSI (42 mesures)',
      'Numérotation officielle du guide ANSSI · niveaux COBIT 2019 (0 à 5) · fond jaune pâle = saisie de l\'auditeur'));
    if (refs.CIS !== false) sheets.push(auditSheet('CIS', 'Audit CIS Télétravail', 'Audit de maturité : CIS Telework and Small Office Network Security Guide (v8.1)',
      'Recommandations appliquées aux réseaux domestiques des télétravailleurs et au réseau du bureau · niveaux COBIT 2019 (0 à 5)'));

    // ---------- Audit logiciels ----------
    var spec = items.filter(function (it) { return it.src === 'SPEC'; });
    if (refs.SPEC !== false && spec.length) {
      var HL = ['Réf.', 'Logiciel', 'Domaine de sécurité', 'Mesure de sécurité standard (fonction disponible)', 'Source du standard', 'Exigence ' + meta.organisation + ' (règle écrite)',
        'Point de contrôle (question d\'audit)', 'Preuve attendue', 'Méthode de vérification', 'Constat (situation observée)', 'Causes identifiées',
        'Conséquences possibles pour ' + meta.organisation, 'Preuves collectées (registre des preuves)', 'Preuves complémentaires à collecter', 'Fiabilité de la preuve',
        'Mesures ANSSI liées', 'Chantier du plan d\'action', 'Niveau actuel', 'Cible', 'Écart', 'Risque (gravité)', 'Criticité', 'Priorité', 'Action corrective proposée',
        'Responsable', 'Échéance', 'Action réalisée (Oui / Non)', 'Date de réalisation', 'État d\'avancement (%)', 'Statut', 'Justificatif / preuve de réalisation',
        'Niveau atteint après action', 'Niveau retenu pour le résiduel', 'Risque initial (score /16)', 'Niveau de risque initial', 'Risque résiduel actuel (score)',
        'Niveau de risque résiduel actuel', 'Risque résiduel prévisionnel (score)', 'Niveau de risque résiduel prévisionnel', 'Évolution du risque (initial → actuel → prévisionnel)'].concat(L.methodes);
      var R = [];
      R.push({ h: 26, cells: [c('Audit des mesures de sécurité des logiciels et outils', ST.title)] });
      R.push({ h: 28, cells: [c('Fonctions de sécurité standard de chaque logiciel, comparées à leur usage constaté · niveaux COBIT 2019 (0 à 5)', ST.subtitle)] });
      var r3 = []; r3[colNum('AO')] = c('Méthodes de vérification (une colonne par méthode)', ST.head); R.push(r3);
      R.push({ h: 48, cells: HL.map(function (h) { return c(h, ST.head); }) });
      spec.forEach(function (it, i) {
        var n = i + 5, k = C.compute(it);
        var Rr = 'R' + n, S = 'S' + n, T = 'T' + n, U = 'U' + n, V = 'V' + n, AA = 'AA' + n, AF = 'AF' + n, AG = 'AG' + n;
        var ch = it.chantier ? String(it.chantier).replace(/^CH-0?/, '') : '';
        R.push({ h: 100, cells: [
          c(it.ref || it.id, ST.ref), c(it.domaine), c(it.domaineSecurite || ''), c(it.titre), c(it.sourceStandard || ''), c(it.exigence || ''), c(it.question),
          c(it.attendus), c(it.methodeVerif), c(it.constat, ST.input), c(it.causes, ST.input), c(it.consequences, ST.input), c(preuvesTexte(it), ST.input),
          c(it.preuvesComplementaires, ST.input), c(it.fiabilite, ST.inputC), c(it.mesuresAnssi || it.correspondance || '', ST.center), c(ch === '' ? '' : (isNaN(+ch) ? ch : +ch), ST.center),
          c(it.niveau, ST.inputC), c(it.cible, ST.inputC),
          f('IF(OR(' + Rr + '="",' + S + '=""),"",MAX(0,' + S + '-' + Rr + '))', k.ecart === null ? '' : k.ecart), c(it.gravite, ST.inputC),
          f('IF(' + T + '="","",' + T + '*' + poidsF(U) + ')', k.criticite === null ? '' : k.criticite),
          f('IF(' + V + '="","",IF(' + V + '>=12,"P1",IF(' + V + '>=8,"P2",IF(' + V + '>=1,"P3","OK"))))', k.priorite || ''),
          c(it.action, ST.input), c(it.responsable, ST.inputC), c(it.echeance, ST.inputC), c(C.estRealisee(it) ? 'Oui' : 'Non', ST.inputC), c(fmtDate(it.dateRealisation), ST.inputC),
          c(+it.avancement || 0, ST.inputC), c(it.statutAction, ST.inputC), c(it.justificatifRealisation, ST.input), c(it.niveauApres, ST.inputC),
          f('IF(AND(' + AA + '="Oui",' + AF + '<>""),' + AF + ',' + Rr + ')', k.niveauCourant === null ? '' : k.niveauCourant, ST.center),
          f('IF(' + Rr + '="","",' + poidsF(U) + '*' + vraisF(Rr) + ')', k.risqueInitial === null ? '' : k.risqueInitial), f(niveauF('AH' + n), k.niveauRisqueInitial || ''),
          f('IF(AH' + n + '="","",' + poidsF(U) + '*' + vraisF(AG) + ')', k.risqueActuel === null ? '' : k.risqueActuel), f(niveauF('AJ' + n), k.niveauRisqueActuel || ''),
          f('IF(AH' + n + '="","",MIN(AH' + n + ',' + poidsF(U) + '*' + vraisF('IF(' + S + '="",3,' + S + ')') + '))', k.risqueApres === null ? '' : k.risqueApres), f(niveauF('AL' + n), k.niveauRisqueApres || ''),
          f('IF(AI' + n + '="","",AI' + n + '&" → "&AK' + n + '&" → "&AM' + n + ')', evolution(k), ST.center)
        ].concat(L.methodes.map(function (m) { return c(X((it.methodes || []).indexOf(m) >= 0), ST.center); })) });
      });
      var lastL = spec.length + 4;
      sheets.push({
        name: 'Audit logiciels', cols: [11, 24, 20, 40, 30, 30, 40, 30, 28, 46, 32, 32, 32, 30, 12, 12, 10, 9, 8, 8, 10, 9, 10, 44, 20, 13, 11, 12, 11, 11, 26, 11, 11, 10, 12, 10, 12, 10, 12, 26, 10, 10, 10, 10, 10, 10, 10, 10],
        freeze: 'E5', autoFilter: 'A4:AV' + lastL, merges: ['A1:M1', 'A2:M2', 'AO3:AV3'],
        validations: [{ ref: 'O5:O' + lastL, list: L.fiabilite }, { ref: 'R5:S' + lastL + ' AF5:AF' + lastL, list: ['0', '1', '2', '3', '4', '5'] },
          { ref: 'U5:U' + lastL, list: C.GRAVITES }, { ref: 'AA5:AA' + lastL, list: ['Oui', 'Non'] }, { ref: 'AD5:AD' + lastL, list: L.statut }],
        conditional: [{ ref: 'W5:W' + lastL, rules: rules(PRIO_FILLS) }, { ref: 'U5:U' + lastL + ' AI5:AI' + lastL + ' AK5:AK' + lastL + ' AM5:AM' + lastL, rules: rules(LEVEL_FILLS) }],
        rows: R
      });
    }

    // ---------- Registre des preuves ----------
    var cites = {};
    items.forEach(function (it) { (it.preuves || []).forEach(function (p) { (cites[p] = cites[p] || []).push(it.ref && it.src !== 'SPEC' ? it.src + ' ' + it.ref : it.id); }); });
    var RP = [];
    RP.push({ h: 26, cells: [c('Registre des preuves de l\'audit', ST.title)] });
    RP.push([c('Preuves collectées pour l\'audit (' + fmtDate(meta.dateAudit) + ') et preuves complémentaires à collecter ; chaque preuve est référencée dans les lignes d\'audit.', ST.subtitle)]);
    RP.push([]);
    RP.push({ h: 32, cells: ['ID', 'Type', 'Intitulé de la preuve', 'Source / auteur', 'Date de collecte', 'Statut', 'Ce que la preuve établit', 'Mesures concernées', 'Emplacement (dossier de preuves)'].map(function (h) { return c(h, ST.head); }) });
    (audit.preuves || []).forEach(function (p) {
      RP.push([c(p.id, ST.ref), c(p.type, ST.center), c(p.titre), c(p.source || ''), c(fmtDate(p.date), ST.center), c(p.statut, ST.inputC),
        c(p.etablit || p.commentaire || ''), c(p.mesures || (cites[p.id] || []).join(', ')), c(p.emplacement || '')]);
    });
    var lastP = (audit.preuves || []).length + 4;
    RP.push([]);
    RP.push([c('Fiabilité de la preuve (colonne des onglets d\'audit) : Établie = fait corroboré sur site ; Partielle = fait décrit, à corroborer ; Présomption = déduit, à vérifier. Les preuves « À collecter » passent au statut « Collectée » dès qu\'elles sont obtenues.', ST.note)]);
    sheets.push({ name: 'Registre des preuves', cols: [9, 14, 44, 30, 14, 13, 50, 36, 30], freeze: 'A5', autoFilter: 'A4:I' + lastP,
      merges: ['A1:I1', 'A2:I2', 'A' + (lastP + 2) + ':I' + (lastP + 2)], validations: [{ ref: 'F5:F' + lastP, list: L.statutPreuve }],
      conditional: [{ ref: 'F5:F' + lastP, rules: [{ eq: 'Collectée', fill: 'C6EFCE', color: '006100' }, { eq: 'À collecter', fill: 'FFEB9C', color: '9C5700' }] }], rows: RP });

    // ---------- Éléments non retenus ----------
    var nr = items.filter(function (it) { return it.retenue === false || it.allegee; });
    var RN = [];
    RN.push({ h: 26, cells: [c('Éléments non retenus ou retenus sous forme allégée', ST.title)] });
    RN.push([c('Décisions conservées et justifiées : risque associé, mesure compensatoire, risque résiduel accepté et conditions de réévaluation.', ST.subtitle)]);
    RN.push([]);
    RN.push({ h: 40, cells: ['Réf.', 'Onglet', 'Intitulé', 'Décision', 'Partie non retenue', 'Justification détaillée', 'Risque associé', 'Niveau de risque initial',
      'Mesure compensatoire', 'Risque résiduel accepté', 'Accepté par', 'Réévaluation possible', 'Conditions de réévaluation ou d\'évolution', 'Prochaine réévaluation'].map(function (h) { return c(h, ST.head); }) });
    nr.forEach(function (it) {
      var d = it.nonRetenu || {}, k = C.compute(it);
      RN.push({ h: 90, cells: [c((it.src === 'SPEC' ? '' : it.src + ' ') + (it.ref || it.num), ST.ref), c(srcLabel[it.src], ST.center), c(it.titre),
        c(d.decision || (it.retenue === false ? 'Non retenue' : 'Retenue allégée'), ST.center), c(d.partieNonRetenue || (it.retenue === false ? 'Mesure entière' : ''), ST.input),
        c(d.justificationDetaillee || it.justification || '', ST.input), c(d.risqueAssocie || '', ST.input), c(d.niveauRisqueInitialNR || k.niveauRisqueInitial || '', ST.inputC),
        c(d.mesureCompensatoire || '', ST.input), c(d.risqueResiduelAccepte || '', ST.inputC), c(d.acceptePar || '', ST.input), c(d.reevaluationPossible || '', ST.inputC),
        c(d.conditionsReevaluation || '', ST.input), c(d.prochaineReevaluation || '', ST.inputC)] });
    });
    if (!nr.length) RN.push([c('Aucun élément non retenu.', ST.note)]);
    RN.push([]);
    RN.push([c('Un élément « Retenue allégée » reste évalué dans l\'onglet d\'audit (seule la partie indiquée n\'est pas mise en œuvre). Un élément « Non retenue » est exclu des moyennes ; son risque reste suivi.', ST.note)]);
    sheets.push({ name: 'Éléments non retenus', cols: [11, 18, 34, 14, 26, 48, 34, 12, 40, 12, 26, 12, 40, 18], freeze: 'A5',
      merges: ['A1:N1', 'A2:N2', 'A' + (nr.length + 6) + ':N' + (nr.length + 6)],
      conditional: [{ ref: 'H5:H' + (nr.length + 4) + ' J5:J' + (nr.length + 4), rules: rules(LEVEL_FILLS) }], rows: RN });

    // ---------- Synthèse ----------
    var A = s.parSource.ANSSI, K = s.parSource.CIS, Lg = s.parSource.SPEC, SY = [];
    function both(a, b, fn, avg) {
      var va = a ? fn(a) : null, vb = b ? fn(b) : null, g;
      if (va === null && vb === null) g = null; else if (va === null) g = vb; else if (vb === null) g = va; else g = avg ? (va + vb) / 2 : va + vb;
      return [va, vb, g];
    }
    SY.push({ h: 26, cells: [c('Synthèse de la maturité SSI : ' + meta.organisation, ST.title)] });
    SY.push([c('Calculs automatiques à partir des onglets d\'audit (mesures non retenues exclues des moyennes). Valeurs calculées par SSI Audit le ' + fmtDate(new Date().toISOString()) + '.', ST.subtitle)]);
    SY.push([]);
    SY.push([c('Indicateurs clés', ST.section)]);
    SY.push([c('Indicateur', ST.head), c('ANSSI', ST.head), c('CIS Télétravail', ST.head), c('Global', ST.head)]);
    [['Mesures encadrées par une règle écrite (Oui)', function (x) { return x.regleOui; }, false, null],
      ['Niveau de capacité actuel moyen (COBIT /5)', function (x) { return x.niveau; }, true, ST.dec],
      ['Niveau cible moyen (COBIT /5)', function (x) { return x.cible; }, true, ST.dec],
      ['Taux d\'atteinte de la cible (actuel / cible)', function (x) { return x.tauxAtteinte; }, true, ST.pct],
      ['Mesures au niveau 0 (Incomplet)', function (x) { return x.niveau0; }, false, null],
      ['Priorités P1 (critiques)', function (x) { return x.P1; }, false, null], ['Priorités P2 (importantes)', function (x) { return x.P2; }, false, null],
      ['Priorités P3 (à planifier)', function (x) { return x.P3; }, false, null], ['Mesures au niveau cible (OK)', function (x) { return x.OK; }, false, null]]
      .forEach(function (r) { var v = both(A, K, r[1], r[2]); SY.push([c(r[0], ST.label), c(v[0], r[3] || ST.center), c(v[1], r[3] || ST.center), c(v[2], r[3] || ST.calc)]); });
    function domTable(src, title, headDom) {
      var ds = s.parDomaine.filter(function (d) { return d.src === src; });
      if (!ds.length) return;
      SY.push([]);
      SY.push([c(title, ST.section)]);
      SY.push([headDom, 'Mesures retenues', 'Niveau actuel', 'Cible', 'Écart moyen', 'Règle écrite (Oui)', 'Nb P1', 'Nb P2'].map(function (h) { return c(h, ST.head); }));
      ds.forEach(function (d) { SY.push([c(d.domaine, ST.label), c(d.retenus, ST.center), c(d.niveau, ST.dec), c(d.cible, ST.dec), c(d.ecartMoyen, ST.dec), c(d.regleOui, ST.center), c(d.P1, ST.center), c(d.P2, ST.center)]); });
    }
    domTable('ANSSI', 'Niveau de capacité par domaine : Guide d\'hygiène ANSSI', 'Domaine ANSSI');
    domTable('CIS', 'Niveau de capacité par thème : Guide CIS Télétravail', 'Thème CIS');
    SY.push([]);
    SY.push([c('Suivi des actions correctives', ST.section)]);
    SY.push(['Périmètre', 'Actions retenues', 'Actions réalisées', 'Taux de réalisation', 'Avancement moyen (%)', 'Éléments non retenus'].map(function (h) { return c(h, ST.head); }));
    var tot = { r: 0, d: 0, nr: 0, av: [] };
    ['ANSSI', 'CIS', 'SPEC'].forEach(function (src) {
      var x = s.parSource[src]; if (!x) return;
      tot.r += x.actions.retenues; tot.d += x.actions.realisees; tot.nr += x.nonRetenus; if (x.actions.avancementMoyen !== null) tot.av.push(x.actions.avancementMoyen);
      SY.push([c(srcLabel[src], ST.label), c(x.actions.retenues, ST.center), c(x.actions.realisees, ST.center), c(x.actions.taux, ST.pct), c(x.actions.avancementMoyen, ST.dec), c(x.nonRetenus, ST.center)]);
    });
    SY.push([c('Total', ST.label), c(tot.r, ST.calc), c(tot.d, ST.calc), c(tot.r ? tot.d / tot.r : null, ST.pct), c(mean(tot.av), ST.dec), c(tot.nr, ST.calc)]);
    SY.push([]);
    SY.push([c('Évolution du risque avant / après correctifs (tous les points de contrôle)', ST.section)]);
    SY.push(['Niveau de risque', 'Initial (avant correctifs)', 'Résiduel actuel (correctifs réalisés)', 'Résiduel prévisionnel (plan achevé)'].map(function (h) { return c(h, ST.head); }));
    var lvRow = SY.length + 1;
    C.GRAVITES.forEach(function (g) { SY.push([c(g, ST.label), c(s.classesRisque.initial[g] || 0, ST.center), c(s.classesRisque.actuel[g] || 0, ST.center), c(s.classesRisque.apres[g] || 0, ST.center)]); });
    SY.push([c('Total des points évalués', ST.label), c(s.risque.points, ST.calc), c(s.risque.points, ST.calc), c(s.risque.points, ST.calc)]);
    var rp = s.risque.points || 1;
    SY.push([c('Score de risque moyen (gravité × vraisemblance, /16)', ST.label), c(s.risque.initial / rp, ST.dec), c(s.risque.actuel / rp, ST.dec), c(s.risque.apres / rp, ST.dec)]);
    if (Lg) {
      SY.push([]);
      SY.push([c('Maturité des logiciels métier (onglet « Audit logiciels »)', ST.section)]);
      SY.push(['Logiciel', 'Contrôles', 'Niveau actuel', 'Cible', 'Écart moyen', 'Nb P1', 'Nb P2'].map(function (h) { return c(h, ST.head); }));
      s.parDomaine.filter(function (d) { return d.src === 'SPEC'; }).forEach(function (d) {
        SY.push([c(d.domaine, ST.label), c(d.retenus, ST.center), c(d.niveau, ST.dec), c(d.cible, ST.dec), c(d.ecartMoyen, ST.dec), c(d.P1, ST.center), c(d.P2, ST.center)]);
      });
    }
    SY.push([]);
    SY.push([c('Couverture des critères DICT (mesures ANSSI et CIS)', ST.section)]);
    SY.push(['Critère', 'Mesures ANSSI', 'Mesures CIS', 'Niveau actuel', 'Cible', 'Écart moyen', 'Nb P1', 'Nb P2'].map(function (h) { return c(h, ST.head); }));
    [['D', 'D : Disponibilité'], ['I', 'I : Intégrité'], ['C', 'C : Confidentialité'], ['T', 'T : Traçabilité (preuve)']].forEach(function (k) {
      var d = s.dict[k[0]];
      SY.push([c(k[1], ST.label), c(d.anssi, ST.center), c(d.cis, ST.center), c(d.niveau, ST.dec), c(d.cible, ST.dec), c(d.ecartMoyen, ST.dec), c(d.P1, ST.center), c(d.P2, ST.center)]);
    });
    if (meta.pointsForts) {
      SY.push([]);
      SY.push([c('Points forts de l\'audit', ST.section)]);
      SY.push([c('Point fort', ST.head), c('Constat', ST.head)]);
      String(meta.pointsForts).split('\n').filter(Boolean).forEach(function (line) {
        var i = line.indexOf(' : ');
        SY.push({ h: 45, cells: [c(i > 0 ? line.slice(0, i) : '', ST.label), c(i > 0 ? line.slice(i + 3) : line)] });
      });
    }
    SY.push([]);
    SY.push([c('Répartition des méthodes de vérification (nombre de points de contrôle)', ST.section)]);
    SY.push(['Méthode', 'Audit ANSSI', 'Audit CIS', 'Audit logiciels', 'Total'].map(function (h) { return c(h, ST.head); }));
    L.methodes.forEach(function (m) {
      var v = ['ANSSI', 'CIS', 'SPEC'].map(function (src) { return s.parSource[src] ? s.parSource[src].methodes[m] || 0 : 0; });
      SY.push([c(m, ST.label), c(v[0], ST.center), c(v[1], ST.center), c(v[2], ST.center), c(v[0] + v[1] + v[2], ST.calc)]);
    });
    SY.push([]);
    SY.push([c('Les graphiques (radar par domaine, priorités, évolution du risque, cartographie, DICT, trajectoire) sont dans le tableau de bord de l\'application SSI Audit.', ST.note)]);
    var mergesSy = ['A1:H1', 'A2:H2'];
    SY.forEach(function (row, i) { if (row && !Array.isArray(row) && row.h === 45) mergesSy.push('B' + (i + 1) + ':H' + (i + 1)); });
    sheets.push({ name: 'Synthèse', cols: [50, 16, 16, 17, 14, 16, 10, 10], merges: mergesSy,
      conditional: [{ ref: 'A' + lvRow + ':A' + (lvRow + 3), rules: rules(LEVEL_FILLS) }], rows: SY });

    // ---------- Plan d'action ----------
    var chantiers = (audit.chantiers || []).filter(function (x) { return x.type !== 'recurrent'; });
    function mesuresCouvertes(ch) {
      if (ch.mesures) return ch.mesures;
      return (byChantier[ch.id] || []).map(function (it) { return it.src === 'SPEC' ? it.id : it.src + ' ' + (it.ref || it.num); }).join(', ');
    }
    var PA = [];
    PA.push({ h: 26, cells: [c('Plan d\'action : feuille de route', ST.title)] });
    PA.push([c('Regroupement des actions correctives en chantiers, classés par ordre de lancement ; les actions détaillées sont dans les onglets d\'audit.', ST.subtitle)]);
    PA.push([]);
    PA.push({ h: 34, cells: ['N°', 'Chantier', 'Mesures couvertes', 'Actions clés', 'Responsable', 'Échéance', 'Coût estimé', 'Indicateur de réussite', 'Statut',
      'Action réalisée (Oui / Non)', 'Date de réalisation', 'État d\'avancement (%)', 'Justificatif / preuve de réalisation'].map(function (h) { return c(h, ST.head); }) });
    chantiers.forEach(function (ch) {
      var num = String(ch.id).replace(/^CH-0?/, '');
      PA.push({ h: 75, cells: [c(isNaN(+num) ? ch.id : +num, ST.ref), c(ch.titre, ST.label), c(mesuresCouvertes(ch)), c(ch.actions || ''), c(ch.responsable || '', ST.center),
        c(ch.echeance || fmtDate(ch.fin), ST.center), c(ch.cout || '', ST.center), c(ch.indicateur || ''), c(ch.statut || 'À faire', ST.inputC),
        c(ch.statut === 'Fait' || +ch.avancement === 100 ? 'Oui' : 'Non', ST.inputC), c(fmtDate(ch.dateRealisation), ST.inputC), c(+ch.avancement || 0, ST.inputC), c(ch.justificatif || '', ST.input)] });
    });
    var lastPA = chantiers.length + 4;
    PA.push([]);
    PA.push([c('Coût estimé : Faible = paramétrage / licences < 1 k€ · Moyen = matériel ou prestation · Élevé = projet. Suivi : renseigner « Action réalisée », la date, l\'avancement et le justificatif.', ST.note)]);
    PA.push([]);
    PA.push([c('Actions correctives par point de contrôle (triées par criticité)', ST.section)]);
    PA.push(['Point', 'Mesure', 'Action corrective proposée', 'Priorité', 'Criticité', 'Responsable', 'Échéance', 'Chantier', 'Statut'].map(function (h) { return c(h, ST.head); }));
    var detailStart = PA.length + 1;
    items.map(function (it) { return { it: it, k: C.compute(it) }; })
      .filter(function (r) { return r.k.retenu && (r.k.ecart > 0 || r.it.action) && refs[r.it.src] !== false; })
      .sort(function (a, b) { return (b.k.criticite || 0) - (a.k.criticite || 0) || a.it.id.localeCompare(b.it.id); })
      .forEach(function (r) {
        var it = r.it;
        PA.push([c(it.src === 'SPEC' ? it.id : it.src + ' ' + (it.ref || it.num), ST.ref), c(it.titre), c(it.action), c(r.k.priorite, ST.center), c(r.k.criticite, ST.center),
          c(it.responsable, ST.center), c(it.echeance, ST.center), c(it.chantier, ST.center), c(it.statutAction, ST.center)]);
      });
    sheets.push({ name: 'Plan d\'action', cols: [11, 34, 34, 50, 22, 16, 12, 34, 11, 11, 12, 11, 26], freeze: 'C5',
      merges: ['A1:M1', 'A2:M2', 'A' + (lastPA + 2) + ':M' + (lastPA + 2)],
      validations: [{ ref: 'I5:I' + lastPA, list: L.statut }, { ref: 'J5:J' + lastPA, list: ['Oui', 'Non'] }],
      conditional: [{ ref: 'D' + detailStart + ':D' + (PA.length), rules: rules(PRIO_FILLS) }], rows: PA });

    // ---------- Plan de déploiement (Gantt) ----------
    var all = audit.chantiers || [], dates = [];
    all.forEach(function (x) { if (x.debut) dates.push(x.debut); if (x.fin) dates.push(x.fin); (x.mois || []).forEach(function (m) { dates.push(m); }); });
    (audit.jalons || []).forEach(function (j) { if (j.date) dates.push(j.date); });
    dates.sort();
    var months = [];
    if (dates.length) {
      var y = +dates[0].slice(0, 4), mo = +dates[0].slice(5, 7), endKey = dates[dates.length - 1].slice(0, 7);
      for (var guard = 0; guard < 36; guard++) {
        var key = y + '-' + (mo < 10 ? '0' : '') + mo;
        months.push(key);
        if (key >= endKey) break;
        mo++; if (mo > 12) { mo = 1; y++; }
      }
    }
    var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    function mLabel(k) { return MOIS[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4); }
    function duree(a, b) { if (!a || !b) return ''; var d = (new Date(b) - new Date(a)) / (1000 * 3600 * 24 * 30.44); return Math.round(d * 10) / 10; }
    var G = [];
    var nm = months.length;
    G.push({ h: 26, cells: [c('Plan de déploiement : diagramme de Gantt', ST.title)] });
    G.push([c(months.length ? 'Lancement : ' + mLabel(months[0]) + ' · ' + nm + ' mois' : 'Renseignez les dates des chantiers dans l\'application.', ST.subtitle)]);
    G.push([]);
    var mh = [c('', ST.empty), c('', ST.empty), c('', ST.empty), c('', ST.empty), c('', ST.empty), c('', ST.empty), c('', ST.empty), c('Mois →', ST.head)];
    G.push(mh.concat(months.map(function (k) { return c(mLabel(k), ST.head); })));
    G.push({ h: 30, cells: ['N°', 'Chantier', 'Mesures couvertes', 'Responsable', 'Début', 'Fin', 'Durée (mois)', 'Statut'].map(function (h) { return c(h, ST.head); }).concat(months.map(function () { return c('', ST.head); })) });
    var bandRows = [];
    var bandSt = { b: true, color: GREEN, fill: SOFT, v: 'center', border: true };
    function band(label) { G.push([c(label, bandSt)].concat(new Array(7 + nm).fill(0).map(function () { return c('', bandSt); }))); bandRows.push(G.length); }
    band('Chantiers');
    chantiers.forEach(function (ch) {
      var num = String(ch.id).replace(/^CH-0?/, '');
      var a = (ch.debut || '').slice(0, 7), b = (ch.fin || '').slice(0, 7);
      G.push({ h: 30, cells: [c(isNaN(+num) ? ch.id : +num, ST.ref), c(ch.titre), c(mesuresCouvertes(ch)), c(ch.responsable || '', ST.center), c(fmtDate(ch.debut), ST.center),
        c(fmtDate(ch.fin), ST.center), c(duree(ch.debut, ch.fin), ST.center), c(ch.statut || 'À faire', ST.center)]
        .concat(months.map(function (k) { return a && b && k >= a && k <= b ? c('', ST.gantt) : c('', ST.empty); })) });
    });
    var recs = all.filter(function (x) { return x.type === 'recurrent'; });
    if (recs.length) {
      band('Pilotage récurrent');
      recs.forEach(function (ch) {
        var ms = (ch.mois || []).map(function (m) { return m.slice(0, 7); });
        G.push([c('', ST.cell), c(ch.titre), c(ch.mesures || ''), c(ch.responsable || '', ST.center), c('', ST.cell), c('', ST.cell), c('', ST.cell), c(ch.statut || '', ST.center)]
          .concat(months.map(function (k) {
            if (ms.length) return ms.indexOf(k) >= 0 ? c('●', ST.rec) : c('', ST.empty);
            return k >= (ch.debut || '').slice(0, 7) && k <= (ch.fin || '').slice(0, 7) ? c('●', ST.rec) : c('', ST.empty);
          })));
      });
    }
    if ((audit.jalons || []).length) {
      band('Jalons');
      audit.jalons.forEach(function (j) {
        var k = (j.date || '').slice(0, 7);
        G.push([c(j.id, ST.ref), c(j.titre), c(j.chantiers || ''), c(j.responsable || 'Comité de pilotage', ST.center), c(fmtDate(j.date), ST.center), c(fmtDate(j.date), ST.center), c('', ST.cell), c(j.statut || 'À venir', ST.center)]
          .concat(months.map(function (m) { return m === k ? c('◆', ST.jalon) : c('', ST.empty); })));
      });
    }
    G.push([]);
    G.push([c('Légende', ST.section)]);
    G.push([c('', ST.gantt), c('Période de réalisation du chantier')]);
    G.push([c('●', ST.rec), c('Activité récurrente du mois')]);
    G.push([c('◆', ST.jalon), c('Jalon (validé en comité de pilotage)')]);
    if ((audit.jalons || []).some(function (j) { return j.criteres; })) {
      G.push([]);
      G.push([c('Critères de passage des jalons', ST.section)]);
      G.push(['Jalon', 'Intitulé', 'Date', 'Chantiers', 'Critères de passage (preuves attendues)'].map(function (h) { return c(h, ST.head); }));
      var critStart = G.length;
      audit.jalons.forEach(function (j) { G.push({ h: 45, cells: [c(j.id, ST.ref), c(j.titre, ST.label), c(fmtDate(j.date), ST.center), c(j.chantiers || '', ST.center), c(j.criteres || '')] }); });
    }
    var mergesG = ['A1:H1', 'A2:H2'];
    bandRows.forEach(function (r) { mergesG.push('A' + r + ':H' + r); });
    if (critStart) audit.jalons.forEach(function (j, i) { mergesG.push('E' + (critStart + i + 1) + ':' + XLSXLite.col(7 + Math.max(1, nm)) + (critStart + i + 1)); });
    sheets.push({ name: 'Plan de déploiement', cols: [8, 44, 34, 24, 12, 12, 9, 10].concat(months.map(function () { return 7; })), freeze: 'C6', merges: mergesG, rows: G });

    // ---------- Indicateurs ----------
    var kp = audit.kpis || [];
    if (kp.length) {
      var KI = [];
      KI.push({ h: 26, cells: [c('Indicateurs de suivi (KPI)', ST.title)] });
      KI.push([]);
      KI.push(['N°', 'Indicateur', 'Type', 'Unité', 'Sens', 'Cible', 'Dernière valeur', 'Date', 'Atteinte de la cible'].map(function (h) { return c(h, ST.head); }));
      kp.forEach(function (k) {
        var rel = (audit.releves || []).filter(function (r) { return r.kpi === k.id; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
        var v = k.mode === 'auto' ? C.kpiAuto(k.formule, s) : rel.length ? rel[rel.length - 1].valeur : null;
        var at = C.kpiAtteinte(v, k.cible, k.sens);
        KI.push([c(k.id, ST.ref), c(k.nom), c(k.mode === 'auto' ? 'Calculé' : 'Manuel', ST.center), c(k.unite, ST.center), c(k.sens === 'bas' ? 'Plus bas = mieux' : 'Plus haut = mieux', ST.center),
          c(k.cible, ST.center), c(v, ST.center), c(k.mode === 'auto' ? 'Calculé' : rel.length ? fmtDate(rel[rel.length - 1].date) : '', ST.center), c(at === null ? null : at / 100, ST.pct)]);
      });
      KI.push([]);
      KI.push([c('Historique des mesures', ST.section)]);
      KI.push(['Indicateur', 'Date', 'Valeur'].map(function (h) { return c(h, ST.head); }));
      (audit.releves || []).forEach(function (r) { KI.push([c(r.kpi, ST.ref), c(fmtDate(r.date), ST.center), c(r.valeur, ST.center)]); });
      if (!(audit.releves || []).length) KI.push([c('Aucune mesure enregistrée.', ST.note)]);
      sheets.push({ name: 'Indicateurs', cols: [10, 50, 11, 8, 18, 9, 13, 12, 14], merges: ['A1:I1'], rows: KI });
    }
    return sheets;
  }

  root.SSIExport = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
