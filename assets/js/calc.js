/* SSI Audit — Moteur de calcul (sans dépendance, testable sous Node).
 * Reproduit les règles de la matrice Excel d'origine (onglet « Méthode ») :
 *
 * Écart        = cible − niveau actuel (0 si la cible est atteinte)
 * Criticité    = écart × poids du risque (Critique 4, Élevé 3, Moyen 2, Faible 1)
 * Priorité     = P1 ≥ 12 · P2 8 à 11 · P3 1 à 7 · OK ; « Non retenue » pour une mesure écartée
 * Vraisemblance= niveau 0 → 4 · 1 → 3 · 2 → 2 · ≥ 3 → 1
 * Risque       = gravité × vraisemblance (1 à 16) : ≥ 12 Critique · 8–11 Élevé · 4–7 Moyen · 1–3 Faible
 * Risque résiduel actuel = calculé avec le « niveau atteint après action » quand l'action est réalisée,
 *                          sinon égal au risque initial.
 * Risque résiduel prévisionnel = calculé avec la cible ; il ne descend jamais à zéro.
 */
(function (root) {
  'use strict';

  var POIDS = { 'Critique': 4, 'Élevé': 3, 'Moyen': 2, 'Faible': 1 };
  var GRAVITES = ['Critique', 'Élevé', 'Moyen', 'Faible'];
  var DELAIS = { P1: 3, P2: 6, P3: 12 };
  var COBIT = ['Incomplet', 'Initial', 'Géré', 'Défini', 'Mesuré', 'Optimisé'];
  var SOURCES = ['ANSSI', 'CIS', 'SPEC'];
  var PREUVE_OK = ['Collectée', 'Reçue', 'Validée'];

  function isLevel(v) { return typeof v === 'number' && v >= 0 && v <= 5 && Math.floor(v) === v; }
  function poids(g) { return POIDS[g] || 0; }
  function vraisemblance(n) { if (!isLevel(n)) return null; return n === 0 ? 4 : n === 1 ? 3 : n === 2 ? 2 : 1; }
  function ecart(n, c) { if (!isLevel(n) || !isLevel(c)) return null; return Math.max(0, c - n); }
  function priorite(crit) {
    if (crit === null || crit === undefined) return null;
    if (crit >= 12) return 'P1';
    if (crit >= 8) return 'P2';
    if (crit >= 1) return 'P3';
    return 'OK';
  }
  function niveauRisque(score) {
    if (score === null || score === undefined) return null;
    if (score >= 12) return 'Critique';
    if (score >= 8) return 'Élevé';
    if (score >= 4) return 'Moyen';
    return 'Faible';
  }
  function risque(g, n) { var v = vraisemblance(n), p = poids(g); return v === null || !p ? null : p * v; }
  function estRealisee(it) { return it.actionRealisee === true || it.statutAction === 'Réalisé'; }

  /** Calcule les champs dérivés d'un point de contrôle. */
  function compute(it) {
    var retenu = it.retenue !== false;
    var e = retenu ? ecart(it.niveau, it.cible) : null;
    var crit = e === null ? null : e * poids(it.gravite);
    var prio = retenu ? priorite(crit) : 'Non retenue';
    // Une mesure non retenue reste cotée en risque ; sans niveau, la vraisemblance vaut 1 (comme dans la matrice).
    var nRisk = !retenu && !isLevel(it.niveau) ? 3 : it.niveau;
    var cRisk = !retenu && !isLevel(it.cible) ? 3 : it.cible;
    var initial = risque(it.gravite, nRisk);
    var realise = estRealisee(it) && isLevel(it.niveauApres);
    var actuel = realise ? risque(it.gravite, it.niveauApres) : initial;
    var apres = risque(it.gravite, cRisk);
    if (apres !== null && initial !== null && apres > initial) apres = initial;
    return {
      retenu: retenu,
      evalue: isLevel(it.niveau),
      ecart: e,
      criticite: crit,
      priorite: prio,
      delaiMois: DELAIS[prio] || null,
      vraisemblance: vraisemblance(nRisk),
      risqueInitial: initial,
      risqueActuel: actuel,
      risqueApres: apres,
      niveauRisqueInitial: niveauRisque(initial),
      niveauRisqueActuel: niveauRisque(actuel),
      niveauRisqueApres: niveauRisque(apres),
      atteint: e === 0,
      realise: realise,
      niveauCourant: realise ? it.niveauApres : it.niveau
    };
  }

  function retenus(audit) {
    var refs = (audit.meta && audit.meta.referentiels) || {};
    return (audit.items || []).filter(function (it) { return it.retenue !== false && refs[it.src] !== false; });
  }
  function actifs(audit) {
    var refs = (audit.meta && audit.meta.referentiels) || {};
    return (audit.items || []).filter(function (it) { return refs[it.src] !== false; });
  }

  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function round(x, d) { if (x === null || x === undefined) return null; var f = Math.pow(10, d === undefined ? 1 : d); return Math.round(x * f) / f; }
  function count(a, f) { return a.filter(f).length; }

  /** Statistiques d'un groupe de points retenus (moyennes simples, comme la matrice). */
  function stats(rows) {
    var ev = rows.filter(function (r) { return r.c.evalue; });
    var niv = ev.map(function (r) { return r.it.niveau; });
    var cib = rows.filter(function (r) { return isLevel(r.it.cible); }).map(function (r) { return r.it.cible; });
    var mN = mean(niv), mC = mean(cib);
    return {
      retenus: rows.length, evalues: ev.length,
      niveau: mN, cible: mC, ecartMoyen: mN === null || mC === null ? null : mC - mN,
      tauxAtteinte: mN === null || !mC ? null : mN / mC,
      courant: mean(ev.map(function (r) { return r.c.niveauCourant; })),
      niveau0: count(ev, function (r) { return r.it.niveau === 0; }),
      regleOui: count(rows, function (r) { return r.it.regleEcrite === 'Oui'; }),
      P1: count(ev, function (r) { return r.c.priorite === 'P1'; }),
      P2: count(ev, function (r) { return r.c.priorite === 'P2'; }),
      P3: count(ev, function (r) { return r.c.priorite === 'P3'; }),
      OK: count(ev, function (r) { return r.c.priorite === 'OK'; })
    };
  }

  /** Synthèse d'un audit : indicateurs globaux, par référentiel, par domaine, risques, DICT, méthodes. */
  function summary(audit) {
    var all = actifs(audit).map(function (it) { return { it: it, c: compute(it) }; });
    var rows = all.filter(function (r) { return r.c.retenu; });
    var ev = rows.filter(function (r) { return r.c.evalue; });
    var g = stats(rows);

    var parSource = {};
    SOURCES.forEach(function (src) {
      var srcAll = all.filter(function (r) { return r.it.src === src; });
      if (!srcAll.length) return;
      var srcRows = srcAll.filter(function (r) { return r.c.retenu; });
      var st = stats(srcRows);
      st.total = srcAll.length;
      st.nonRetenus = srcAll.length - srcRows.length;
      st.actions = {
        retenues: srcRows.length,
        realisees: count(srcRows, function (r) { return estRealisee(r.it); }),
        avancementMoyen: mean(srcRows.map(function (r) { return +r.it.avancement || 0; }))
      };
      st.actions.taux = srcRows.length ? st.actions.realisees / srcRows.length : null;
      st.methodes = {};
      srcAll.forEach(function (r) { (r.it.methodes || []).forEach(function (m) { st.methodes[m] = (st.methodes[m] || 0) + 1; }); });
      parSource[src] = st;
    });

    var dom = {}, ordre = [];
    rows.forEach(function (r) {
      var key = r.it.src + ' · ' + r.it.domaine;
      if (!dom[key]) { dom[key] = []; ordre.push(key); }
      dom[key].push(r);
    });
    var parDomaine = ordre.map(function (k) {
      var st = stats(dom[k]);
      st.cle = k; st.src = dom[k][0].it.src; st.domaine = dom[k][0].it.domaine;
      return st;
    });

    var classes = { initial: {}, actuel: {}, apres: {} }, risk = { initial: 0, actuel: 0, apres: 0, points: 0 };
    all.forEach(function (r) {
      if (r.c.risqueInitial === null) return;
      risk.points++;
      risk.initial += r.c.risqueInitial; risk.actuel += r.c.risqueActuel; risk.apres += r.c.risqueApres;
      classes.initial[r.c.niveauRisqueInitial] = (classes.initial[r.c.niveauRisqueInitial] || 0) + 1;
      classes.actuel[r.c.niveauRisqueActuel] = (classes.actuel[r.c.niveauRisqueActuel] || 0) + 1;
      classes.apres[r.c.niveauRisqueApres] = (classes.apres[r.c.niveauRisqueApres] || 0) + 1;
    });

    var heat = {};
    ev.forEach(function (r) { var hk = poids(r.it.gravite) + 'x' + r.c.vraisemblance; heat[hk] = (heat[hk] || 0) + 1; });

    var dict = {};
    ['D', 'I', 'C', 'T'].forEach(function (k) {
      // Comme la matrice : toutes les mesures ANSSI et CIS cochées pour le critère, retenues ou non.
      var dr = all.filter(function (r) { return r.it.src !== 'SPEC' && r.it.dict && r.it.dict[k]; });
      var st = stats(dr);
      st.anssi = count(dr, function (r) { return r.it.src === 'ANSSI'; });
      st.cis = count(dr, function (r) { return r.it.src === 'CIS'; });
      dict[k] = st;
    });

    var methodes = {};
    all.forEach(function (r) { (r.it.methodes || []).forEach(function (m) { methodes[m] = (methodes[m] || 0) + 1; }); });

    var actions = rows.filter(function (r) { return r.c.evalue && r.c.ecart > 0; });
    var realisees = actions.filter(function (r) { return estRealisee(r.it); });
    var preuves = audit.preuves || [];
    var collectees = preuves.filter(function (p) { return PREUVE_OK.indexOf(p.statut) >= 0; });
    var top = ev.filter(function (r) { return r.c.criticite > 0; })
      .sort(function (a, b) { return b.c.criticite - a.c.criticite || b.c.ecart - a.c.ecart || a.it.id.localeCompare(b.it.id); })
      .slice(0, 10).map(function (r) { return { id: r.it.id, titre: r.it.titre, ecart: r.c.ecart, criticite: r.c.criticite, priorite: r.c.priorite }; });

    return {
      total: (audit.items || []).length,
      retenus: rows.length,
      evalues: ev.length,
      maturite: round(g.niveau, 2),
      maturiteCourante: round(g.courant, 2),
      cibleMoyenne: round(g.cible, 2),
      conformite: ev.length ? round(100 * count(ev, function (r) { return r.c.atteint; }) / ev.length, 1) : null,
      priorites: { P1: g.P1, P2: g.P2, P3: g.P3, OK: g.OK },
      parSource: parSource,
      parDomaine: parDomaine,
      risque: risk,
      classesRisque: classes,
      heatmap: heat,
      dict: dict,
      methodes: methodes,
      top10: top,
      actions: { total: actions.length, realisees: realisees.length, taux: actions.length ? round(100 * realisees.length / actions.length, 1) : null },
      preuves: { total: preuves.length, collectees: collectees.length, taux: preuves.length ? round(100 * collectees.length / preuves.length, 1) : null }
    };
  }

  /** Valeur d'un KPI calculé automatiquement. */
  function kpiAuto(formule, s) {
    switch (formule) {
      case 'maturite': return s.maturiteCourante;
      case 'conformite': return s.conformite;
      case 'p1': return s.priorites.P1;
      case 'actions': return s.actions.taux;
      case 'preuves': return s.preuves.taux;
      default: return null;
    }
  }

  /** Taux d'atteinte d'une cible de KPI (0 à 100). */
  function kpiAtteinte(val, cible, sens) {
    if (val === null || val === undefined || cible === null || cible === undefined) return null;
    if (sens === 'bas') {
      if (val <= cible) return 100;
      return Math.max(0, round(100 * (cible === 0 ? 1 / (1 + val) : cible / val), 1));
    }
    if (cible === 0) return 100;
    return Math.min(100, Math.max(0, round(100 * val / cible, 1)));
  }

  function addMonths(dateStr, m) {
    var d = dateStr ? new Date(dateStr + 'T00:00:00Z') : new Date();
    if (isNaN(d.getTime())) d = new Date();
    d.setUTCMonth(d.getUTCMonth() + m);
    return d.toISOString().slice(0, 10);
  }

  var Calc = {
    POIDS: POIDS, GRAVITES: GRAVITES, DELAIS: DELAIS, COBIT: COBIT, SOURCES: SOURCES, PREUVE_OK: PREUVE_OK,
    isLevel: isLevel, poids: poids, vraisemblance: vraisemblance, ecart: ecart, priorite: priorite,
    niveauRisque: niveauRisque, risque: risque, estRealisee: estRealisee, compute: compute, retenus: retenus,
    summary: summary, kpiAuto: kpiAuto, kpiAtteinte: kpiAtteinte, addMonths: addMonths, round: round, mean: mean
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
  else root.SSICalc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
