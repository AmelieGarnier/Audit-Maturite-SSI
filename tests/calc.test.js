/* Tests du moteur de calcul : node tests/calc.test.js */
'use strict';
const assert = require('assert');
const path = require('path');
const C = require(path.join(__dirname, '..', 'assets', 'js', 'calc.js'));
require(path.join(__dirname, '..', 'assets', 'data', 'catalog.js'));
require(path.join(__dirname, '..', 'assets', 'data', 'questions.js'));
require(path.join(__dirname, '..', 'assets', 'data', 'demo-globalgreen.js'));

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok', n, '-', name); }

t('vraisemblance', () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map(C.vraisemblance), [4, 3, 2, 1, 1, 1]);
  assert.strictEqual(C.vraisemblance(null), null);
});
t('écart borné à 0', () => {
  assert.strictEqual(C.ecart(1, 3), 2);
  assert.strictEqual(C.ecart(4, 3), 0);
  assert.strictEqual(C.ecart(null, 3), null);
});
t('seuils de priorité', () => {
  assert.strictEqual(C.priorite(12), 'P1');
  assert.strictEqual(C.priorite(16), 'P1');
  assert.strictEqual(C.priorite(11), 'P2');
  assert.strictEqual(C.priorite(8), 'P2');
  assert.strictEqual(C.priorite(7), 'P3');
  assert.strictEqual(C.priorite(1), 'P3');
  assert.strictEqual(C.priorite(0), 'OK');
});
t('niveaux de risque', () => {
  assert.deepStrictEqual([16, 12, 11, 8, 7, 4, 3, 1].map(C.niveauRisque),
    ['Critique', 'Critique', 'Élevé', 'Élevé', 'Moyen', 'Moyen', 'Faible', 'Faible']);
});
t('point de contrôle complet', () => {
  const r = C.compute({ niveau: 0, cible: 4, gravite: 'Critique' });
  assert.strictEqual(r.ecart, 4);
  assert.strictEqual(r.criticite, 16);
  assert.strictEqual(r.priorite, 'P1');
  assert.strictEqual(r.delaiMois, 3);
  assert.strictEqual(r.risqueInitial, 16);
  assert.strictEqual(r.risqueActuel, 16);
  assert.strictEqual(r.risqueApres, 4);
  assert.strictEqual(r.niveauRisqueApres, 'Moyen');
});
t('risque actuel recalculé quand l\'action est réalisée', () => {
  const r = C.compute({ niveau: 1, cible: 3, gravite: 'Élevé', statutAction: 'Réalisé', niveauApres: 3 });
  assert.strictEqual(r.risqueInitial, 9);
  assert.strictEqual(r.risqueActuel, 3);
  const r2 = C.compute({ niveau: 1, cible: 3, gravite: 'Élevé', statutAction: 'En cours', niveauApres: 3 });
  assert.strictEqual(r2.risqueActuel, 9);
});
t('le risque après plan ne descend jamais à zéro', () => {
  const r = C.compute({ niveau: 5, cible: 5, gravite: 'Faible' });
  assert.strictEqual(r.risqueApres, 1);
  assert.strictEqual(r.priorite, 'OK');
});
t('point non évalué', () => {
  const r = C.compute({ niveau: null, cible: 3, gravite: 'Moyen' });
  assert.strictEqual(r.evalue, false);
  assert.strictEqual(r.priorite, null);
});
t('catalogue : 42 mesures ANSSI et 20 recommandations CIS, avec une question chacune', () => {
  const cat = globalThis.SSI_CATALOG;
  assert.strictEqual(cat.ANSSI.length, 42);
  assert.strictEqual(cat.CIS.length, 20);
  cat.ANSSI.concat(cat.CIS).forEach((m) => {
    assert.ok(C.POIDS[m.gravite], m.id + ' gravité');
    assert.ok(C.isLevel(m.cible), m.id + ' cible');
    assert.ok(globalThis.SSI_QUESTIONS.items[m.id], m.id + ' question');
  });
});
t('synthèse et exclusion des mesures non retenues', () => {
  const audit = {
    meta: { referentiels: { ANSSI: true, CIS: false } },
    items: [
      { id: 'A', src: 'ANSSI', domaine: 'X', niveau: 1, cible: 3, gravite: 'Critique', methodes: ['Entretien'] },
      { id: 'B', src: 'ANSSI', domaine: 'X', niveau: 3, cible: 3, gravite: 'Moyen' },
      { id: 'C', src: 'ANSSI', domaine: 'Y', niveau: 0, cible: 3, gravite: 'Faible', retenue: false },
      { id: 'D', src: 'CIS', domaine: 'Z', niveau: 0, cible: 4, gravite: 'Critique' }
    ],
    preuves: [{ statut: 'Reçue' }, { statut: 'À collecter' }]
  };
  const s = C.summary(audit);
  assert.strictEqual(s.retenus, 2);
  assert.strictEqual(s.maturite, 2);
  assert.strictEqual(s.conformite, 50);
  assert.deepStrictEqual(s.priorites, { P1: 0, P2: 1, P3: 0, OK: 1 });
  assert.strictEqual(s.preuves.taux, 50);
  assert.strictEqual(s.top10[0].id, 'A');
  assert.strictEqual(C.kpiAuto('p1', s), 0);
});
t('atteinte des KPI', () => {
  assert.strictEqual(C.kpiAtteinte(50, 100, 'haut'), 50);
  assert.strictEqual(C.kpiAtteinte(120, 100, 'haut'), 100);
  assert.strictEqual(C.kpiAtteinte(3, 5, 'bas'), 100);
  assert.strictEqual(C.kpiAtteinte(10, 5, 'bas'), 50);
});
t('jeu de démonstration cohérent', () => {
  const demo = globalThis.SSI_DEMO;
  assert.ok(demo && demo.items.length >= 62);
  demo.items.forEach((it) => {
    if (it.niveau !== null) assert.ok(C.isLevel(it.niveau), it.id);
  });
  const s = C.summary(demo);
  assert.ok(s.evalues > 50);
});

console.log(`\n${n} tests réussis.`);
