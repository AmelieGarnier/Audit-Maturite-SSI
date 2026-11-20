/* Tests du moteur de calcul : node tests/calc.test.js
 * Le jeu Global Green est comparé aux valeurs calculées par la matrice Excel d'origine
 * (tests/fixtures/globalgreen-attendu.json) : chaque point de contrôle et la synthèse. */
'use strict';
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '..');
const C = require(path.join(root, 'assets', 'js', 'calc.js'));
['catalog-data.js', 'catalog.js', 'questions.js', 'demo-globalgreen.js'].forEach((f) => require(path.join(root, 'assets', 'data', f)));
const attendu = require(path.join(__dirname, 'fixtures', 'globalgreen-attendu.json'));
const demo = globalThis.SSI_DEMO;

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok', n, '-', name); }
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg} : attendu ${b}, obtenu ${a}`);

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
  assert.deepStrictEqual([16, 12, 11, 8, 7, 1, 0].map(C.priorite), ['P1', 'P1', 'P2', 'P2', 'P3', 'P3', 'OK']);
});
t('niveaux de risque', () => {
  assert.deepStrictEqual([16, 12, 11, 8, 7, 4, 3, 1].map(C.niveauRisque),
    ['Critique', 'Critique', 'Élevé', 'Élevé', 'Moyen', 'Moyen', 'Faible', 'Faible']);
});
t('point de contrôle complet', () => {
  const r = C.compute({ niveau: 0, cible: 4, gravite: 'Critique' });
  assert.deepStrictEqual([r.ecart, r.criticite, r.priorite, r.delaiMois, r.risqueInitial, r.risqueActuel, r.risqueApres],
    [4, 16, 'P1', 3, 16, 16, 4]);
});
t('risque actuel recalculé seulement quand l\'action est réalisée', () => {
  assert.strictEqual(C.compute({ niveau: 1, cible: 3, gravite: 'Élevé', actionRealisee: true, niveauApres: 3 }).risqueActuel, 3);
  assert.strictEqual(C.compute({ niveau: 1, cible: 3, gravite: 'Élevé', actionRealisee: false, niveauApres: 3 }).risqueActuel, 9);
});
t('mesure non retenue : ni écart ni priorité, risque toujours coté', () => {
  const r = C.compute({ niveau: 0, cible: 3, gravite: 'Moyen', retenue: false });
  assert.deepStrictEqual([r.ecart, r.criticite, r.priorite, r.risqueInitial, r.risqueApres], [null, null, 'Non retenue', 8, 2]);
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

t('Global Green : 88 points de contrôle sur 88 identiques à la matrice Excel', () => {
  assert.strictEqual(demo.items.length, 88);
  demo.items.forEach((it) => {
    const r = C.compute(it), e = attendu.points[it.id];
    ['ecart', 'criticite', 'risqueInitial', 'risqueActuel', 'risqueApres'].forEach((k) => assert.strictEqual(r[k], e[k], `${it.id} ${k}`));
    assert.strictEqual(r.priorite, e.priorite, `${it.id} priorité`);
  });
});

t('Global Green : indicateurs clés de la synthèse', () => {
  const s = C.summary(demo), A = s.parSource.ANSSI, K = s.parSource.CIS, y = attendu.synthese;
  const pair = (label, a, b) => { near(a, y[label][0], label + ' ANSSI'); near(b, y[label][1], label + ' CIS'); };
  pair('Mesures encadrées par une règle écrite (Oui)', A.regleOui, K.regleOui);
  pair('Niveau de capacité actuel moyen (COBIT /5)', A.niveau, K.niveau);
  pair('Niveau cible moyen (COBIT /5)', A.cible, K.cible);
  pair('Taux d\'atteinte de la cible (actuel / cible)', A.tauxAtteinte, K.tauxAtteinte);
  pair('Mesures au niveau 0 (Incomplet)', A.niveau0, K.niveau0);
  pair('Priorités P1 (critiques)', A.P1, K.P1);
  pair('Priorités P2 (importantes)', A.P2, K.P2);
  pair('Priorités P3 (à planifier)', A.P3, K.P3);
  near((A.niveau + K.niveau) / 2, y['Niveau de capacité actuel moyen (COBIT /5)'][2], 'niveau global');
  assert.deepStrictEqual([A.nonRetenus, K.nonRetenus, s.parSource.SPEC.actions.retenues], [5, 1, 26]);
});

t('Global Green : niveaux par domaine, par thème et par logiciel', () => {
  const s = C.summary(demo), y = attendu.synthese;
  let vus = 0;
  s.parDomaine.forEach((d) => {
    const e = y[d.domaine];
    if (!e) return;
    vus++;
    assert.strictEqual(d.retenus, e[0], d.domaine);
    near(d.niveau, e[1], d.domaine + ' niveau');
    near(d.cible, e[2], d.domaine + ' cible');
  });
  assert.strictEqual(vus, 10 + 6 + 7);
});

t('Global Green : évolution du risque, DICT et méthodes', () => {
  const s = C.summary(demo), y = attendu.synthese;
  ['Critique', 'Élevé', 'Moyen', 'Faible'].forEach((k) => {
    assert.deepStrictEqual([s.classesRisque.initial[k] || 0, s.classesRisque.actuel[k] || 0, s.classesRisque.apres[k] || 0], y[k], k);
  });
  assert.strictEqual(s.risque.points, 88);
  near(s.risque.initial / s.risque.points, 9.943181818181818, 'score moyen initial');
  near(s.risque.apres / s.risque.points, 2.727272727272727, 'score moyen prévisionnel');
  const dict = { D: [17, 5, 3, 6], I: [31, 9, 6, 15], C: [35, 18, 5, 20], T: [11, 1, 2, 4] };
  Object.keys(dict).forEach((k) => assert.deepStrictEqual([s.dict[k].anssi, s.dict[k].cis, s.dict[k].P1, s.dict[k].P2], dict[k], 'DICT ' + k));
  ['Examen documentaire', 'Entretien', 'Questionnaire', 'Observation', 'Test de contrôle', 'Échantillonnage', 'Analyse', 'Recalcul'].forEach((m) => {
    assert.deepStrictEqual(['ANSSI', 'CIS', 'SPEC'].map((src) => s.parSource[src].methodes[m] || 0), y[m], m);
  });
});

t('atteinte des KPI', () => {
  assert.strictEqual(C.kpiAtteinte(50, 100, 'haut'), 50);
  assert.strictEqual(C.kpiAtteinte(120, 100, 'haut'), 100);
  assert.strictEqual(C.kpiAtteinte(3, 5, 'bas'), 100);
  assert.strictEqual(C.kpiAtteinte(10, 5, 'bas'), 50);
});

console.log(`\n${n} tests réussis.`);
