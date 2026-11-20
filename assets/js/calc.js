/* SSI Audit — Moteur de calcul (sans dépendance, testable sous Node).
 *
 * Écart        = cible − niveau (0 si la cible est atteinte)
 * Criticité    = écart × poids (Critique 4, Élevé 3, Moyen 2, Faible 1)
 * Priorité     = P1 ≥ 12 · P2 8 à 11 · P3 1 à 7 · OK
 * Vraisemblance= niveau 0 → 4 · 1 → 3 · 2 → 2 · ≥ 3 → 1
 * Risque       = gravité × vraisemblance (1 à 16) : ≥ 12 Critique · 8–11 Élevé · 4–7 Moyen · 1–3 Faible
 */
(function (root) {
  'use strict';

  var POIDS = { 'Critique': 4, 'Élevé': 3, 'Moyen': 2, 'Faible': 1 };
  var GRAVITES = ['Critique', 'Élevé', 'Moyen', 'Faible'];
  var DELAIS = { P1: 3, P2: 6, P3: 12 };
  var COBIT = ['Incomplet', 'Initial', 'Géré', 'Défini', 'Mesuré', 'Optimisé'];

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

  /** Calcule les champs dérivés d'un point de contrôle. */
  function compute(it) {
    var e = ecart(it.niveau, it.cible);
    var crit = e === null ? null : e * poids(it.gravite);
    var initial = risque(it.gravite, it.niveau);
    var realise = it.statutAction === 'Réalisé' && isLevel(it.niveauApres);
    var actuel = realise ? risque(it.gravite, it.niveauApres) : initial;
    var apres = risque(it.gravite, it.cible);
    if (apres !== null && initial !== null && apres > initial) apres = initial;
    return {
      evalue: isLevel(it.niveau),
      ecart: e,
      criticite: crit,
      priorite: priorite(crit),
      delaiMois: DELAIS[priorite(crit)] || null,
      vraisemblance: vraisemblance(it.niveau),
      risqueInitial: initial,
      risqueActuel: actuel,
      risqueApres: apres,
      niveauRisqueInitial: niveauRisque(initial),
      niveauRisqueActuel: niveauRisque(actuel),
      niveauRisqueApres: niveauRisque(apres),
      atteint: e === 0,
      niveauCourant: realise ? it.niveauApres : it.niveau
    };
  }

  function retenus(audit) {
    var refs = (audit.meta && audit.meta.referentiels) || {};
    return (audit.items || []).filter(function (it) {
      return it.retenue !== false && refs[it.src] !== false;
    });
  }

  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function round(x, d) { if (x === null) return null; var f = Math.pow(10, d || 1); return Math.round(x * f) / f; }

  /** Synthèse d'un audit : indicateurs globaux, par domaine, par priorité, etc. */
  function summary(audit) {
    var items = retenus(audit);
    var rows = items.map(function (it) { return { it: it, c: compute(it) }; });
    var ev = rows.filter(function (r) { return r.c.evalue; });
    var prio = { P1: 0, P2: 0, P3: 0, OK: 0 };
    var risk = { initial: 0, actuel: 0, apres: 0 };
    var classes = { initial: {}, actuel: {}, apres: {} };
    var heat = {};
    var domaines = {};
    var dict = { D: [], I: [], C: [], T: [] };
    var methodes = {};
    ev.forEach(function (r) {
      prio[r.c.priorite]++;
      risk.initial += r.c.risqueInitial; risk.actuel += r.c.risqueActuel; risk.apres += r.c.risqueApres;
      ['initial', 'actuel', 'apres'].forEach(function (k) {
        var cl = niveauRisque(k === 'initial' ? r.c.risqueInitial : k === 'actuel' ? r.c.risqueActuel : r.c.risqueApres);
        classes[k][cl] = (classes[k][cl] || 0) + 1;
      });
      var hk = poids(r.it.gravite) + 'x' + r.c.vraisemblance;
      heat[hk] = (heat[hk] || 0) + 1;
      ['D', 'I', 'C', 'T'].forEach(function (k) { if (r.it.dict && r.it.dict[k]) dict[k].push(r.it.niveau); });
      (r.it.methodes || []).forEach(function (m) { methodes[m] = (methodes[m] || 0) + 1; });
    });
    rows.forEach(function (r) {
      var key = r.it.src + ' · ' + r.it.domaine;
      var d = domaines[key] || (domaines[key] = { src: r.it.src, domaine: r.it.domaine, niveaux: [], cibles: [], courants: [], total: 0 });
      d.total++;
      if (r.c.evalue) { d.niveaux.push(r.it.niveau); d.courants.push(r.c.niveauCourant); }
      if (isLevel(r.it.cible)) d.cibles.push(r.it.cible);
    });
    var parDomaine = Object.keys(domaines).map(function (k) {
      var d = domaines[k];
      return { cle: k, src: d.src, domaine: d.domaine, total: d.total, evalues: d.niveaux.length,
        niveau: round(mean(d.niveaux), 2), cible: round(mean(d.cibles), 2), courant: round(mean(d.courants), 2) };
    });
    var actions = rows.filter(function (r) { return r.c.evalue && r.c.ecart > 0; });
    var realisees = actions.filter(function (r) { return r.it.statutAction === 'Réalisé'; });
    var preuves = audit.preuves || [];
    var collectees = preuves.filter(function (p) { return p.statut === 'Reçue' || p.statut === 'Validée'; });
    var top = ev.filter(function (r) { return r.c.criticite > 0; })
      .sort(function (a, b) { return b.c.criticite - a.c.criticite || b.c.ecart - a.c.ecart || a.it.id.localeCompare(b.it.id); })
      .slice(0, 10).map(function (r) { return { id: r.it.id, titre: r.it.titre, ecart: r.c.ecart, criticite: r.c.criticite, priorite: r.c.priorite }; });
    return {
      total: (audit.items || []).length,
      retenus: rows.length,
      evalues: ev.length,
      maturite: round(mean(ev.map(function (r) { return r.it.niveau; })), 2),
      maturiteCourante: round(mean(ev.map(function (r) { return r.c.niveauCourant; })), 2),
      cibleMoyenne: round(mean(rows.filter(function (r) { return isLevel(r.it.cible); }).map(function (r) { return r.it.cible; })), 2),
      conformite: ev.length ? round(100 * ev.filter(function (r) { return r.c.atteint; }).length / ev.length, 1) : null,
      priorites: prio,
      risque: risk,
      classesRisque: classes,
      heatmap: heat,
      parDomaine: parDomaine,
      dict: { D: round(mean(dict.D), 2), I: round(mean(dict.I), 2), C: round(mean(dict.C), 2), T: round(mean(dict.T), 2) },
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
      return val === 0 ? 0 : Math.max(0, round(100 * (cible === 0 ? 1 / (1 + val) : cible / val), 1));
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
    POIDS: POIDS, GRAVITES: GRAVITES, DELAIS: DELAIS, COBIT: COBIT,
    isLevel: isLevel, poids: poids, vraisemblance: vraisemblance, ecart: ecart, priorite: priorite,
    niveauRisque: niveauRisque, risque: risque, compute: compute, retenus: retenus, summary: summary,
    kpiAuto: kpiAuto, kpiAtteinte: kpiAtteinte, addMonths: addMonths, round: round
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
  else root.SSICalc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
