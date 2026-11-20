/* SSI Audit — Interface : vues, graphiques, exports.
 * Aucune gestion d'événement en ligne (CSP script-src 'self') : délégation via data-act. */
(function () {
  'use strict';
  var C = window.SSICalc, CAT = window.SSI_CATALOG, Q = window.SSIQ, S = window.SSIStore;
  var main = document.getElementById('main');
  var state = { audit: null, view: 'audits', filters: {}, charts: [], drawerId: null, saveTimer: null, campaign: null };

  var VIEWS = [
    ['audits', 'Audits', '▤'], ['tableau', 'Tableau de bord', '◔'], ['organisation', 'Organisation', '⌂'],
    ['questionnaire', 'Questionnaire', '✎'], ['matrice', 'Matrice d\'audit', '▦'], ['plan', 'Plan d\'action', '☰'],
    ['preuves', 'Preuves', '❐'], ['kpi', 'KPI', '↗']
  ];
  var LISTES = CAT.LISTES;
  var METHODES = LISTES.methodes;
  var FIABILITES = [''].concat(LISTES.fiabilite);
  var REGLES = [''].concat(LISTES.regleEcrite);
  var STATUTS = LISTES.statut;
  var STATUTS_PREUVE = LISTES.statutPreuve;
  var SRC_LABEL = { ANSSI: 'ANSSI', CIS: 'CIS', SPEC: 'Logiciels' };
  // Champs d'analyse d'un point de contrôle (identiques aux colonnes de la matrice).
  var ANALYSE = [['constat', 'Constat (situation observée)', 4], ['causes', 'Causes identifiées', 2], ['consequences', 'Conséquences possibles', 2],
    ['pointsForts', 'Points forts constatés', 2], ['couverture', 'Couverture documentaire', 2], ['preuvesComplementaires', 'Preuves complémentaires à collecter', 2],
    ['analyseCobit', 'Analyse du niveau attribué (COBIT)', 2]];
  var NON_RETENU = [['partieNonRetenue', 'Partie non retenue'], ['justificationDetaillee', 'Justification détaillée'], ['risqueAssocie', 'Risque associé'],
    ['mesureCompensatoire', 'Mesure compensatoire'], ['risqueResiduelAccepte', 'Risque résiduel accepté'], ['acceptePar', 'Accepté par'],
    ['conditionsReevaluation', 'Conditions de réévaluation ou d\'évolution'], ['prochaineReevaluation', 'Prochaine réévaluation']];
  var COLORS = { green: '#1E5631', green2: '#4C9A2A', light: '#A4DE02', blue: '#2F6690', orange: '#E07A1F', red: '#B3261E', yellow: '#D4A017', grey: '#8A8F98' };
  var RISK_COLORS = { 'Critique': COLORS.red, 'Élevé': COLORS.orange, 'Moyen': COLORS.yellow, 'Faible': COLORS.green2 };
  var PRIO_COLORS = { P1: COLORS.red, P2: COLORS.orange, P3: COLORS.yellow, OK: COLORS.green2 };

  // ---------- Utilitaires ----------
  function esc(s) {
    return s === null || s === undefined ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmt(v, d) { return v === null || v === undefined || v === '' ? '—' : (typeof v === 'number' ? String(C.round(v, d === undefined ? 1 : d)).replace('.', ',') : v); }
  function fmtDate(s) { if (!s) return '—'; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function opts(list, cur) {
    return list.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : (o === '' ? '—' : o); return '<option value="' + esc(v) + '"' + (String(v) === String(cur === null || cur === undefined ? '' : cur) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
  }
  function levelOpts(cur, allowEmpty) {
    var l = allowEmpty ? [['', '— non évalué']] : [];
    for (var i = 0; i <= 5; i++) l.push([String(i), i + ' · ' + C.COBIT[i]]);
    return opts(l, cur === null || cur === undefined ? '' : String(cur));
  }
  function badge(text, cls) { return text ? '<span class="badge ' + esc(cls || '') + '">' + esc(text) + '</span>' : '<span class="muted">—</span>'; }
  function prioBadge(p) { return p ? badge(p, 'b-' + slug(p)) : badge(''); }
  function riskBadge(score) { var n = C.niveauRisque(score); return score === null || score === undefined ? badge('') : '<span class="badge b-r-' + esc(slug(n)) + '">' + score + ' · ' + esc(n) + '</span>'; }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  function download(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function fileName(ext) { return 'ssi-audit-' + slug(state.audit ? state.audit.meta.organisation : 'export') + '-' + today() + '.' + ext; }
  function toast(msg, kind) {
    var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 3500);
  }
  function getPath(obj, path) { return path.split('.').reduce(function (o, k) { return o === null || o === undefined ? undefined : o[k]; }, obj); }
  function setPath(obj, path, v) { var ks = path.split('.'), last = ks.pop(); var o = ks.reduce(function (o, k) { if (o[k] === undefined || o[k] === null) o[k] = {}; return o[k]; }, obj); o[last] = v; }
  function pickFile(accept) {
    return new Promise(function (resolve) {
      var i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = true;
      i.addEventListener('change', function () { resolve(Array.prototype.slice.call(i.files || [])); });
      i.click();
    });
  }
  function readJsonFile(f) {
    return new Promise(function (resolve, reject) {
      if (f.size > 8 * 1024 * 1024) return reject(new Error('Fichier trop volumineux'));
      var r = new FileReader();
      r.onload = function () { try { resolve(JSON.parse(r.result)); } catch (e) { reject(new Error('JSON invalide : ' + f.name)); } };
      r.onerror = function () { reject(new Error('Lecture impossible')); };
      r.readAsText(f);
    });
  }

  // ---------- Modale ----------
  var modalEl = $('#modal');
  function modal(title, body, buttons) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    var foot = $('#modal-foot'); foot.innerHTML = '';
    (buttons || [{ label: 'Fermer' }]).forEach(function (b) {
      var btn = document.createElement('button'); btn.className = 'btn ' + (b.cls || ''); btn.textContent = b.label; btn.type = 'button';
      btn.addEventListener('click', function () { if (b.onClick && b.onClick() === false) return; modalEl.close(); });
      foot.appendChild(btn);
    });
    if (typeof modalEl.showModal === 'function') modalEl.showModal(); else modalEl.setAttribute('open', '');
    var f = $('input,select,textarea', $('#modal-body')); if (f) f.focus();
  }

  // ---------- Modèle ----------
  function createAudit(meta) {
    var items = CAT.ANSSI.concat(CAT.CIS).map(CAT.newItem);
    return {
      id: uid('a'), version: 1,
      meta: Object.assign({ organisation: '', secteur: '', effectif: '', dateAudit: today(), auditeur: '', classification: 'Diffusion restreinte', contexte: '', perimetre: '', referentiels: { ANSSI: true, CIS: true, SPEC: true }, demo: false, agregation: 'mediane' }, meta),
      items: items, preuves: [], chantiers: [], jalons: [], kpis: clone(CAT.KPIS), releves: [],
      historique: [{ date: today(), version: '1.0', auteur: meta.auditeur || '', commentaire: 'Création de l\'audit' }],
      questionnaires: []
    };
  }
  function normalize(a) {
    ['items', 'preuves', 'chantiers', 'jalons', 'kpis', 'releves', 'historique', 'questionnaires'].forEach(function (k) { if (!Array.isArray(a[k])) a[k] = []; });
    a.meta = a.meta || {};
    a.meta.referentiels = a.meta.referentiels || { ANSSI: true, CIS: true, SPEC: true };
    if (!a.kpis.length) a.kpis = clone(CAT.KPIS);
    a.items.forEach(function (it) {
      it.methodes = it.methodes || []; it.preuves = it.preuves || []; it.dict = it.dict || {};
      if (it.statutAction === 'Réalisé') { it.statutAction = 'Fait'; it.actionRealisee = true; }
      if (it.actionRealisee === undefined) it.actionRealisee = false;
      if (it.avancement === undefined) it.avancement = 0;
    });
    return a;
  }
  function refLabel(it) { return it.src === 'SPEC' ? it.id : it.src + ' ' + (it.ref || it.num); }
  function validateAudit(a) {
    if (!a || typeof a !== 'object' || !a.meta || !Array.isArray(a.items)) return 'Ce fichier n\'est pas un audit SSI Audit.';
    if (!String(a.meta.organisation || '').trim()) return 'Le nom de l\'organisation est absent.';
    for (var i = 0; i < a.items.length; i++) {
      var it = a.items[i];
      if (!it || !it.id || ['ANSSI', 'CIS', 'SPEC'].indexOf(it.src) < 0) return 'Point de contrôle invalide.';
      var bad = ['niveau', 'cible', 'niveauApres'].filter(function (k) { return it[k] !== null && it[k] !== undefined && !C.isLevel(it[k]); });
      if (bad.length) return 'Valeur hors échelle COBIT (' + it.id + ').';
    }
    return null;
  }
  function item(id) { return state.audit.items.filter(function (i) { return i.id === id; })[0]; }

  function markDirty() {
    var s = $('#save-state'); s.dataset.state = 'pending'; s.textContent = 'Modifications…';
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(save, 600);
  }
  function save() {
    if (!state.audit) return Promise.resolve();
    var s = $('#save-state');
    return S.save(state.audit).then(function () { s.dataset.state = 'ok'; s.textContent = 'Enregistré'; })
      .catch(function (e) { s.dataset.state = 'err'; s.textContent = 'Échec de l\'enregistrement'; toast(e.message, 'err'); });
  }

  function freshDemo() { return normalize(clone(window.SSI_DEMO)); }
  function openAudit(id) {
    return S.get(id).then(function (a) {
      // Démonstration enregistrée par une version antérieure de l'application : remplacée par la version actuelle.
      if (a && a.id === 'demo-globalgreen' && a.meta && a.meta.demo && window.SSI_DEMO && a.meta.demoVersion !== window.SSI_DEMO.meta.demoVersion) { a = freshDemo(); S.save(a); toast('Démonstration Global Green mise à jour.'); }
      state.audit = normalize(a); state.filters = {};
      S.prefs.set('current', a.id);
      updateChrome();
    });
  }

  // ---------- Habillage ----------
  function updateChrome() {
    var a = state.audit;
    $('#audit-name').textContent = a ? a.meta.organisation : 'Aucun audit ouvert';
    $('#audit-sub').textContent = a ? ('Audit du ' + fmtDate(a.meta.dateAudit) + (a.meta.demo ? ' · démo' : '')) : '';
    $$('[data-need-audit]').forEach(function (b) { b.disabled = !a; });
    $('#nav').innerHTML = VIEWS.map(function (v) {
      var dis = !a && v[0] !== 'audits';
      return '<a href="#/' + v[0] + '" class="' + (state.view === v[0] ? 'active' : '') + (dis ? ' disabled' : '') + '"' + (dis ? ' aria-disabled="true" tabindex="-1"' : '') + '><span aria-hidden="true">' + v[2] + '</span>' + esc(v[1]) + '</a>';
    }).join('');
  }

  function destroyCharts() { state.charts.forEach(function (c) { c.destroy(); }); state.charts = []; }
  function chart(id, cfg) {
    var el = document.getElementById(id);
    if (!el || !window.Chart) return null;
    var c = new window.Chart(el, cfg); state.charts.push(c); return c;
  }

  function route() {
    var v = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'audits';
    if (!VIEWS.some(function (x) { return x[0] === v; })) v = 'audits';
    if (!state.audit && v !== 'audits') v = 'audits';
    state.view = v;
    render();
  }
  function go(view, filters) {
    if (filters) state.filters = filters;
    if (location.hash === '#/' + view) route(); else location.hash = '#/' + view;
  }

  function render() {
    destroyCharts();
    updateChrome();
    document.body.classList.remove('nav-open');
    var fn = { audits: viewAudits, tableau: viewTableau, organisation: viewOrganisation, questionnaire: viewQuestionnaire, matrice: viewMatrice, plan: viewPlan, preuves: viewPreuves, kpi: viewKpi }[state.view];
    try { fn(); } catch (e) { main.innerHTML = '<div class="card err">Erreur d\'affichage : ' + esc(e.message) + '</div>'; if (window.console) console.error(e); }
    main.scrollTop = 0;
  }

  function head(title, sub, actions) {
    return '<header class="view-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p class="muted">' + sub + '</p>' : '') + '</div><div class="actions">' + (actions || '') + '</div></header>';
  }

  // ---------- Vue : audits ----------
  function viewAudits() {
    main.innerHTML = head('Audits', 'Créez un audit à partir du catalogue ANSSI / CIS, ouvrez un audit existant ou chargez la démonstration.',
      '<button class="btn primary" data-act="new-audit">Nouvel audit</button><button class="btn" data-act="load-demo">Charger la démo</button><button class="btn ghost" data-act="import-audit">Importer (.json)</button>') +
      '<div id="audit-list" class="cards"><p class="loading">Chargement…</p></div>';
    S.list().then(function (list) {
      var el = $('#audit-list'); if (!el) return;
      if (!list.length) { el.innerHTML = '<div class="empty card"><h2>Aucun audit pour l\'instant</h2><p>Commencez par <b>Nouvel audit</b> ou explorez le cas <b>Global Green</b> avec <b>Charger la démo</b>.</p></div>'; return; }
      el.innerHTML = list.map(function (a) {
        var cur = state.audit && state.audit.id === a.id;
        return '<article class="card audit-card' + (cur ? ' current' : '') + '"><h2>' + esc(a.organisation) + (a.demo ? ' <span class="badge b-demo">démo</span>' : '') + '</h2>' +
          '<p class="muted">Audit du ' + esc(fmtDate(a.dateAudit)) + (a.modifieLe ? ' · modifié le ' + esc(fmtDate(a.modifieLe)) : '') + '</p>' +
          '<div class="row-actions"><button class="btn primary sm" data-act="open-audit" data-id="' + esc(a.id) + '">' + (cur ? 'Ouvert' : 'Ouvrir') + '</button>' +
          '<button class="btn sm" data-act="dup-audit" data-id="' + esc(a.id) + '">Dupliquer</button>' +
          '<button class="btn sm ghost danger" data-act="del-audit" data-id="' + esc(a.id) + '">Supprimer</button></div></article>';
      }).join('');
    }).catch(function (e) { $('#audit-list').innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }

  function newAuditDialog() {
    modal('Nouvel audit', '<form class="form" id="f-new"><label>Organisation auditée *<input name="organisation" required maxlength="200"></label>' +
      '<label>Date de l\'audit<input type="date" name="dateAudit" value="' + today() + '"></label>' +
      '<label>Auditeur<input name="auditeur" maxlength="200"></label>' +
      '<fieldset><legend>Référentiels</legend><label class="check"><input type="checkbox" name="ANSSI" checked> Guide d\'hygiène ANSSI (42 mesures)</label><label class="check"><input type="checkbox" name="CIS" checked> CIS Télétravail et petit bureau (20 recommandations)</label></fieldset></form>',
      [{ label: 'Annuler', cls: 'ghost' }, { label: 'Créer', cls: 'primary', onClick: function () {
        var f = $('#f-new'), org = f.organisation.value.trim();
        if (!org) { f.organisation.focus(); toast('Indiquez le nom de l\'organisation.', 'err'); return false; }
        var a = createAudit({ organisation: org, dateAudit: f.dateAudit.value || today(), auditeur: f.auditeur.value.trim(), referentiels: { ANSSI: f.ANSSI.checked, CIS: f.CIS.checked, SPEC: true } });
        state.audit = a; S.prefs.set('current', a.id);
        save().then(function () { toast('Audit créé.'); go('organisation'); });
      } }]);
  }

  // ---------- Vue : tableau de bord ----------
  function viewTableau() {
    var a = state.audit, s = C.summary(a);
    var tiles = [
      ['Maturité moyenne', fmt(s.maturite, 2) + ' <small>/ 5</small>', ['ANSSI', 'CIS', 'SPEC'].filter(function (k) { return s.parSource[k] && s.parSource[k].niveau !== null; }).map(function (k) { return SRC_LABEL[k] + ' ' + fmt(s.parSource[k].niveau, 2); }).join(' · ') + ' · cible ' + fmt(s.cibleMoyenne, 2)],
      ['Points à la cible', fmt(s.conformite) + ' <small>%</small>', s.evalues + ' évalués sur ' + s.retenus + ' retenus'],
      ['Écarts P1', String(s.priorites.P1), 'P2 : ' + s.priorites.P2 + ' · P3 : ' + s.priorites.P3],
      ['Score de risque moyen', fmt(s.risque.points ? s.risque.initial / s.risque.points : null, 2) + ' <small>/ 16</small>', 'Actuel ' + fmt(s.risque.points ? s.risque.actuel / s.risque.points : null, 2) + ' · après plan ' + fmt(s.risque.points ? s.risque.apres / s.risque.points : null, 2)],
      ['Actions réalisées', fmt(s.actions.taux) + ' <small>%</small>', s.actions.realisees + ' sur ' + s.actions.total]
    ];
    var heat = '<table class="heat"><caption>Gravité × vraisemblance (nombre de points)</caption><thead><tr><th></th>' + [1, 2, 3, 4].map(function (v) { return '<th>V' + v + '</th>'; }).join('') + '</tr></thead><tbody>';
    [4, 3, 2, 1].forEach(function (g) {
      heat += '<tr><th>' + esc(C.GRAVITES[4 - g]) + '</th>';
      [1, 2, 3, 4].forEach(function (v) {
        var n = s.heatmap[g + 'x' + v] || 0, cl = slug(C.niveauRisque(g * v));
        heat += '<td class="h-' + cl + (n ? ' clickable' : '') + '"' + (n ? ' data-act="filter-heat" data-g="' + g + '" data-v="' + v + '" tabindex="0"' : '') + '>' + (n || '') + '</td>';
      });
      heat += '</tr>';
    });
    heat += '</tbody></table>';
    main.innerHTML = head('Tableau de bord', esc(a.meta.organisation) + ' · audit du ' + esc(fmtDate(a.meta.dateAudit)) + ' · cliquez sur un graphique pour ouvrir la matrice filtrée') +
      (s.evalues ? '' : '<div class="card note">Aucun point n\'est encore évalué : renseignez la <a href="#/matrice">matrice</a> ou utilisez le <a href="#/questionnaire">questionnaire</a>.</div>') +
      '<section class="tiles">' + tiles.map(function (t) { return '<div class="tile"><span>' + esc(t[0]) + '</span><b>' + t[1] + '</b><small>' + esc(t[2]) + '</small></div>'; }).join('') + '</section>' +
      '<section class="grid2">' +
      '<div class="card chart-card wide"><h2>Maturité par domaine</h2><div class="chart tall"><canvas id="ch-radar" aria-label="Radar de maturité par domaine"></canvas></div></div>' +
      '<div class="card chart-card"><h2>Priorités</h2><div class="chart"><canvas id="ch-prio"></canvas></div></div>' +
      '<div class="card chart-card"><h2>Évolution du risque</h2><div class="chart"><canvas id="ch-risk"></canvas></div></div>' +
      '<div class="card chart-card"><h2>Cartographie des risques</h2>' + heat + '</div>' +
      '<div class="card chart-card"><h2>Écarts par domaine</h2><div class="chart"><canvas id="ch-gap"></canvas></div></div>' +
      '<div class="card chart-card"><h2>Maturité par critère DICT</h2><div class="chart"><canvas id="ch-dict"></canvas></div></div>' +
      '<div class="card chart-card"><h2>Méthodes d\'évaluation</h2><div class="chart"><canvas id="ch-meth"></canvas></div></div>' +
      '<div class="card chart-card"><h2>Trajectoire de maturité</h2><div class="chart"><canvas id="ch-traj"></canvas></div></div>' +
      '<div class="card wide"><h2>Top 10 des écarts</h2>' + (s.top10.length ? '<table class="table"><thead><tr><th>Point</th><th>Intitulé</th><th>Écart</th><th>Criticité</th><th>Priorité</th></tr></thead><tbody>' +
        s.top10.map(function (t) { return '<tr class="clickable" data-act="open-item" data-id="' + esc(t.id) + '"><td class="mono">' + esc(t.id) + '</td><td>' + esc(t.titre) + '</td><td>' + t.ecart + '</td><td>' + t.criticite + '</td><td>' + prioBadge(t.priorite) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">Aucun écart.</p>') + '</div>' +
      '</section>';

    var dom = s.parDomaine;
    var labels = dom.map(function (d) { return (d.src === 'ANSSI' ? '' : SRC_LABEL[d.src] + ' · ') + d.domaine; });
    chart('ch-radar', {
      type: 'radar',
      data: { labels: labels, datasets: [
        { label: 'Niveau constaté', data: dom.map(function (d) { return d.niveau; }), borderColor: COLORS.orange, backgroundColor: 'rgba(224,122,31,.18)', pointRadius: 3 },
        { label: 'Niveau actuel', data: dom.map(function (d) { return d.courant; }), borderColor: COLORS.blue, backgroundColor: 'rgba(47,102,144,.10)', pointRadius: 3 },
        { label: 'Cible', data: dom.map(function (d) { return d.cible; }), borderColor: COLORS.green2, backgroundColor: 'rgba(30,86,49,.06)', borderDash: [5, 4], pointRadius: 2 }
      ] },
      options: { maintainAspectRatio: false, scales: { r: { min: 0, max: 5, ticks: { stepSize: 1, backdropColor: 'transparent' }, pointLabels: { font: { size: 10 } } } },
        onClick: function (e, els) { if (els.length) go('matrice', { domaine: dom[els[0].index].domaine, src: dom[els[0].index].src }); } }
    });
    var pk = ['P1', 'P2', 'P3', 'OK'];
    chart('ch-prio', {
      type: 'doughnut',
      data: { labels: pk, datasets: [{ data: pk.map(function (k) { return s.priorites[k]; }), backgroundColor: pk.map(function (k) { return PRIO_COLORS[k]; }) }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, onClick: function (e, els) { if (els.length) go('matrice', { priorite: pk[els[0].index] }); } }
    });
    var rk = ['Critique', 'Élevé', 'Moyen', 'Faible'];
    chart('ch-risk', {
      type: 'bar',
      data: { labels: ['Initial', 'Actuel', 'Après plan'], datasets: rk.map(function (k) {
        return { label: k, backgroundColor: RISK_COLORS[k], data: ['initial', 'actuel', 'apres'].map(function (p) { return s.classesRisque[p][k] || 0; }) };
      }) },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Points de contrôle' } } },
        onClick: function (e, els) { if (els.length) go('matrice', { risque: rk[els[0].datasetIndex] }); } }
    });
    chart('ch-gap', {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Écart moyen à la cible', backgroundColor: COLORS.orange, data: dom.map(function (d) { return d.niveau === null || d.cible === null ? null : C.round(Math.max(0, d.cible - d.niveau), 2); }) }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, max: 5 }, y: { ticks: { font: { size: 10 } } } },
        onClick: function (e, els) { if (els.length) go('matrice', { domaine: dom[els[0].index].domaine, src: dom[els[0].index].src }); } }
    });
    var dk = ['D', 'I', 'C', 'T'], dl = ['Disponibilité', 'Intégrité', 'Confidentialité', 'Traçabilité'];
    chart('ch-dict', {
      type: 'bar',
      data: { labels: dl, datasets: [{ label: 'Maturité moyenne', data: dk.map(function (k) { return s.dict[k].niveau === null ? null : C.round(s.dict[k].niveau, 2); }), backgroundColor: [COLORS.blue, COLORS.green2, COLORS.green, COLORS.orange] }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 5 } }, onClick: function (e, els) { if (els.length) go('matrice', { dict: dk[els[0].index] }); } }
    });
    var mk = Object.keys(s.methodes);
    chart('ch-meth', {
      type: 'bar',
      data: { labels: mk, datasets: [{ label: 'Points', data: mk.map(function (k) { return s.methodes[k]; }), backgroundColor: COLORS.green2 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, onClick: function (e, els) { if (els.length) go('matrice', { methode: mk[els[0].index] }); } }
    });
    chart('ch-traj', {
      type: 'line',
      data: { labels: ['Audit initial', 'Aujourd\'hui', 'Après plan'], datasets: [{ label: 'Maturité moyenne', data: [s.maturite, s.maturiteCourante, s.cibleMoyenne], borderColor: COLORS.green2, backgroundColor: 'rgba(76,154,42,.15)', fill: true, tension: 0.25 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 5 } } }
    });
  }

  // ---------- Vue : organisation ----------
  function field(label, path, type, extra) {
    var v = getPath(state.audit, path);
    if (type === 'textarea') return '<label>' + esc(label) + '<textarea data-bind="' + path + '" rows="3">' + esc(v) + '</textarea></label>';
    return '<label>' + esc(label) + '<input type="' + (type || 'text') + '" data-bind="' + path + '" value="' + esc(v) + '"' + (extra || '') + '></label>';
  }
  // Classification : un niveau choisi dans une liste, plus une précision libre (« Confidentiel : diffusion limitée… »).
  var CLASSIF = ['Public', 'Interne', 'Diffusion restreinte', 'Confidentiel', 'Secret'];
  function splitClassif(v) {
    v = String(v || ''); var i = v.indexOf(' : '), lvl = i >= 0 ? v.slice(0, i) : v, note = i >= 0 ? v.slice(i + 3) : '';
    var key = slug(lvl), found = CLASSIF.filter(function (c) { return key.indexOf(slug(c)) >= 0; })[0];
    if (!found && lvl) { found = ''; note = v; }
    return { niveau: found || '', note: note };
  }
  function classifFields(v) {
    var c = splitClassif(v);
    return '<div class="cols2"><label>Classification<select data-classif="niveau">' + opts([['', '— à choisir']].concat(CLASSIF), c.niveau) + '</select></label>' +
      '<label>Précision (diffusion, stockage…)<input data-classif="note" value="' + esc(c.note) + '" placeholder="ex. diffusion limitée aux destinataires"></label></div>';
  }
  function viewOrganisation() {
    var a = state.audit, m = a.meta, refs = m.referentiels;
    main.innerHTML = head('Organisation', 'Identification du document, contexte, périmètre et référentiels de l\'audit.') +
      '<section class="grid2"><div class="card form">' +
      '<h2>Identification</h2>' + field('Organisation *', 'meta.organisation', 'text', ' required maxlength="200"') + field('Secteur d\'activité', 'meta.secteur') +
      field('Effectif', 'meta.effectif') + field('Date de l\'audit', 'meta.dateAudit', 'date') + field('Auditeur', 'meta.auditeur') +
      '<div class="cols2">' + field('Référence du document', 'meta.reference') + field('Version', 'meta.versionDoc') + '</div>' +
      field('Destinataires', 'meta.destinataires') +
      classifFields(m.classification) +
      '</div><div class="card form"><h2>Contexte et périmètre</h2>' + field('Organisation (présentation)', 'meta.contexte', 'textarea') +
      field('Implantation', 'meta.implantation', 'textarea') + field('Périmètre audité', 'meta.perimetre', 'textarea') + field('Acteurs', 'meta.acteurs', 'textarea') +
      field('Enjeux', 'meta.enjeux', 'textarea') + field('Documents de référence internes', 'meta.documents', 'textarea') +
      '<fieldset><legend>Référentiels activés</legend>' +
      ['ANSSI', 'CIS', 'SPEC'].map(function (k) { return '<label class="check"><input type="checkbox" data-bind-check="meta.referentiels.' + k + '"' + (refs[k] !== false ? ' checked' : '') + '> ' + ({ ANSSI: 'Guide d\'hygiène informatique ANSSI', CIS: 'CIS Télétravail et petit bureau (box et réseau)', SPEC: 'Contrôles spécifiques (logiciels métier)' })[k] + '</label>'; }).join('') +
      '</fieldset></div>' +
      '<div class="card form wide"><h2>Points forts de l\'audit</h2><label>Un point fort par ligne, sous la forme « Intitulé : constat »<textarea data-bind="meta.pointsForts" rows="5">' + esc(m.pointsForts) + '</textarea></label></div>' +
      '<div class="card wide"><div class="card-head"><h2>Historique des versions</h2><button class="btn sm" data-act="add-version">Nouvelle version</button></div>' +
      '<table class="table"><thead><tr><th>Date</th><th>Version</th><th>Auteur</th><th>Modification</th><th></th></tr></thead><tbody>' +
      a.historique.map(function (h, i) {
        return '<tr><td><input type="date" data-bind="historique.' + i + '.date" value="' + esc(h.date) + '"></td><td><input data-bind="historique.' + i + '.version" value="' + esc(h.version) + '" size="5"></td><td><input data-bind="historique.' + i + '.auteur" value="' + esc(h.auteur) + '"></td><td><input data-bind="historique.' + i + '.commentaire" value="' + esc(h.commentaire) + '" class="full"></td><td><button class="icon-btn" data-act="del-row" data-list="historique" data-i="' + i + '" aria-label="Supprimer">✕</button></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  // ---------- Vue : matrice ----------
  function retenueLabel(it) { return it.retenue === false ? 'Non' : it.allegee ? 'Allégée' : 'Oui'; }
  function matchFilters(it, c, f) {
    if (f.src && it.src !== f.src) return false;
    if (f.domaine && it.domaine !== f.domaine) return false;
    if (f.priorite && c.priorite !== f.priorite) return false;
    if (f.retenue && retenueLabel(it) !== f.retenue) return false;
    if (f.risque && c.niveauRisqueActuel !== f.risque) return false;
    if (f.dict && !(it.dict && it.dict[f.dict])) return false;
    if (f.methode && (it.methodes || []).indexOf(f.methode) < 0) return false;
    if (f.heat) { var p = f.heat.split('x'); if (!c.retenu || !c.evalue || C.poids(it.gravite) !== +p[0] || c.vraisemblance !== +p[1]) return false; }
    if (f.verifier && !it.aVerifier) return false;
    if (f.q) { var q = f.q.toLowerCase(); if ((it.id + ' ' + refLabel(it) + ' ' + it.titre + ' ' + it.domaine + ' ' + (it.constat || '')).toLowerCase().indexOf(q) < 0) return false; }
    return true;
  }
  function viewMatrice() {
    var a = state.audit, f = state.filters, refs = a.meta.referentiels;
    var domaines = []; a.items.forEach(function (it) { if ((!f.src || it.src === f.src) && domaines.indexOf(it.domaine) < 0) domaines.push(it.domaine); });
    var rows = a.items.filter(function (it) { return refs[it.src] !== false; }).map(function (it) { return { it: it, c: C.compute(it) }; })
      .filter(function (r) { return matchFilters(r.it, r.c, f); });
    var extra = ['risque', 'dict', 'methode', 'heat', 'verifier'].filter(function (k) { return f[k]; });
    main.innerHTML = head('Matrice d\'audit', rows.length + ' point(s) de contrôle affiché(s) · cliquez sur une ligne pour ouvrir sa fiche',
      '<button class="btn" data-act="add-spec">Ajouter un contrôle spécifique</button>') +
      '<div class="filters card">' +
      '<input type="search" id="flt-q" placeholder="Rechercher…" value="' + esc(f.q || '') + '" aria-label="Rechercher">' +
      '<select data-filter="src" aria-label="Référentiel">' + opts([['', 'Tous les référentiels'], ['ANSSI', 'ANSSI'], ['CIS', 'CIS'], ['SPEC', 'Logiciels / spécifiques']], f.src || '') + '</select>' +
      '<select data-filter="domaine" aria-label="Domaine">' + opts([['', 'Tous les domaines']].concat(domaines), f.domaine || '') + '</select>' +
      '<select data-filter="priorite" aria-label="Priorité">' + opts([['', 'Toutes priorités'], 'P1', 'P2', 'P3', 'OK', 'Non retenue'], f.priorite || '') + '</select>' +
      '<select data-filter="retenue" aria-label="Retenue">' + opts([['', 'Retenue : toutes'], ['Oui', 'Retenue'], ['Allégée', 'Allégée'], ['Non', 'Non retenue']], f.retenue || '') + '</select>' +
      (extra.length ? '<span class="chip">Filtre : ' + esc(extra.map(function (k) { return k === 'verifier' ? 'à vérifier' : k + ' = ' + f[k]; }).join(', ')) + '</span>' : '') +
      '<button class="btn ghost sm" data-act="clear-filters">Effacer les filtres</button></div>' +
      '<div class="table-wrap card"><table class="table matrix"><thead><tr><th>Réf.</th><th>Recommandation</th><th title="Niveau COBIT actuel">Niv.</th><th>Cible</th><th>Écart</th><th>Risque</th><th>Crit.</th><th>Priorité</th><th>Risque actuel</th><th>Fiabilité</th><th>Action</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) {
        var it = r.it, c = r.c;
        return '<tr class="clickable' + (it.retenue === false ? ' excluded' : '') + '" data-act="open-item" data-id="' + esc(it.id) + '" tabindex="0">' +
          '<td class="mono">' + esc(refLabel(it)) + (it.aVerifier ? ' <span title="À vérifier en entretien">⚠</span>' : '') + (it.allegee ? ' <span class="badge b-muted" title="Retenue sous forme allégée">allégée</span>' : '') + '</td>' +
          '<td><b>' + esc(it.titre) + '</b><small class="muted block">' + esc(it.domaine) + (it.domaineSecurite ? ' · ' + esc(it.domaineSecurite) : '') + '</small></td>' +
          '<td>' + (c.evalue ? '<span class="lvl l' + it.niveau + '">' + it.niveau + '</span>' : '<span class="muted">—</span>') + '</td>' +
          '<td>' + fmt(it.cible) + '</td><td>' + fmt(c.ecart) + '</td><td>' + badge(it.gravite, 'b-r-' + slug(it.gravite)) + '</td><td>' + fmt(c.criticite) + '</td><td>' + prioBadge(c.priorite) + '</td>' +
          '<td>' + riskBadge(c.risqueActuel) + '</td><td>' + esc(it.fiabilite || '—') + '</td><td>' + (it.action ? esc(C.estRealisee(it) ? 'Réalisée' : it.statutAction) : '<span class="muted">—</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="11" class="muted center">Aucun point ne correspond aux filtres.</td></tr>') +
      '</tbody></table></div>';
  }

  // ---------- Fiche (tiroir) ----------
  function tarea(path, label, rows, val, attr) { return '<label>' + esc(label) + '<textarea ' + (attr || 'data-ibind') + '="' + path + '" rows="' + (rows || 2) + '">' + esc(val) + '</textarea></label>'; }
  function tinput(path, label, val, type) { return '<label>' + esc(label) + '<input' + (type ? ' type="' + type + '"' : '') + ' data-ibind="' + path + '" value="' + esc(val) + '"></label>'; }
  function openDrawer(id) {
    var it = item(id); if (!it) return;
    state.drawerId = id;
    var d = $('#drawer'), scroll = d.classList.contains('open') ? ($('.drawer-body', d) || {}).scrollTop : 0;
    var chantiers = [['', '—']].concat(state.audit.chantiers.filter(function (c) { return c.type !== 'recurrent'; }).map(function (c) { return [c.id, c.id + ' · ' + c.titre]; }));
    var spec = it.src === 'SPEC', nr = it.nonRetenu || {};
    d.innerHTML = '<div class="drawer-head"><div><span class="mono muted">' + esc(refLabel(it)) + ' · ' + esc(SRC_LABEL[it.src]) + '</span><h2>' + esc(it.titre) + '</h2></div><button class="icon-btn" data-act="close-drawer" aria-label="Fermer">✕</button></div>' +
      '<div class="drawer-body form" data-item="' + esc(it.id) + '">' +
      '<div id="calc-box" class="calc-box"></div>' +
      '<div class="cols2"><label>Retenue<select data-retenue>' + opts(LISTES.retenue, retenueLabel(it)) + '</select></label>' +
      '<label>Règle écrite<select data-ibind="regleEcrite">' + opts(REGLES, it.regleEcrite) + '</select></label></div>' +
      (it.retenue === false || it.allegee ? tarea('justification', 'Justification du choix', 2, it.justification) +
        '<details open><summary>Élément ' + (it.retenue === false ? 'non retenu' : 'allégé') + ' : risque accepté et mesure compensatoire</summary>' +
        NON_RETENU.map(function (k) { return tarea('nonRetenu.' + k[0], k[1], 2, nr[k[0]]); }).join('') + '</details>' : '') +
      (spec ? tinput('titre', 'Mesure de sécurité standard', it.titre) + '<div class="cols2">' + tinput('domaine', 'Logiciel', it.domaine) + tinput('domaineSecurite', 'Domaine de sécurité', it.domaineSecurite) + '</div>' +
        tarea('question', 'Point de contrôle (question d\'audit)', 2, it.question)
        : '<div class="info"><b>Question d\'audit</b><p>' + esc(it.question) + '</p><b>Domaine</b><p>' + esc(it.domaine) + '</p>' + (it.correspondance ? '<b>Correspondance</b><p>' + esc(it.correspondance) + '</p>' : '') + '</div>') +
      '<details' + (spec ? ' open' : '') + '><summary>Attendus, vérification et indicateur</summary>' +
      tarea('attendus', spec ? 'Preuve attendue' : 'Attendus (preuves à fournir)', 2, it.attendus) + tinput('methodeVerif', 'Méthode de vérification', it.methodeVerif) +
      (spec ? tinput('sourceStandard', 'Source du standard', it.sourceStandard) + tinput('exigence', 'Exigence (règle écrite)', it.exigence) + tinput('mesuresAnssi', 'Mesures ANSSI liées', it.mesuresAnssi)
        : tinput('indicateur', 'Indicateur de vérification (cible)', it.indicateur) + tinput('correspondance', 'Correspondance', it.correspondance)) +
      (spec ? '' : '<fieldset class="inline"><legend>DICT protégé</legend>' + ['D', 'I', 'C', 'T'].map(function (k) { return '<label class="check"><input type="checkbox" data-ibind-check="dict.' + k + '"' + (it.dict && it.dict[k] ? ' checked' : '') + '> ' + k + '</label>'; }).join('') + '</fieldset>') + '</details>' +
      '<h3>Évaluation</h3><div class="cols3">' +
      '<label>Niveau actuel<select data-ibind="niveau" data-num>' + levelOpts(it.niveau, true) + '</select></label>' +
      '<label>Cible<select data-ibind="cible" data-num>' + levelOpts(it.cible, true) + '</select></label>' +
      '<label>Risque (gravité)<select data-ibind="gravite">' + opts(C.GRAVITES, it.gravite) + '</select></label></div>' +
      '<label>Fiabilité de la preuve<select data-ibind="fiabilite">' + opts(FIABILITES, it.fiabilite) + '</select></label>' +
      '<fieldset class="inline"><legend>Méthodes de vérification</legend>' + METHODES.map(function (m) { return '<label class="check"><input type="checkbox" data-ibind-list="methodes" value="' + esc(m) + '"' + (it.methodes.indexOf(m) >= 0 ? ' checked' : '') + '> ' + esc(m) + '</label>'; }).join('') + '</fieldset>' +
      ANALYSE.filter(function (k) { return !spec || (k[0] !== 'pointsForts' && k[0] !== 'couverture' && k[0] !== 'analyseCobit'); }).map(function (k) { return tarea(k[0], k[1], k[2], it[k[0]]); }).join('') +
      '<fieldset class="inline"><legend>Preuves collectées (registre)</legend>' + (state.audit.preuves.length ? state.audit.preuves.map(function (p) { return '<label class="check"><input type="checkbox" data-ibind-list="preuves" value="' + esc(p.id) + '"' + (it.preuves.indexOf(p.id) >= 0 ? ' checked' : '') + '> ' + esc(p.id) + ' · ' + esc(p.titre) + '</label>'; }).join('') : '<span class="muted">Aucune preuve au registre. <a href="#/preuves">Ajouter une preuve</a></span>') + '</fieldset>' +
      '<h3>Action corrective et suivi</h3>' +
      tarea('action', 'Action corrective proposée', 3, it.action) +
      '<div class="cols2">' + tinput('responsable', 'Responsable', it.responsable) + tinput('echeance', 'Échéance (date ou « Mars 2027 », « Immédiat »…)', it.echeance) +
      '<label>Statut<select data-ibind="statutAction">' + opts(STATUTS, it.statutAction) + '</select></label>' +
      '<label>État d\'avancement (%)<input type="number" min="0" max="100" step="5" data-ibind="avancement" data-num value="' + esc(it.avancement) + '"></label></div>' +
      '<label class="check"><input type="checkbox" data-ibind-check="actionRealisee"' + (it.actionRealisee ? ' checked' : '') + '> Action réalisée (le risque résiduel actuel est recalculé)</label>' +
      '<div class="cols2"><label>Date de réalisation<input type="date" data-ibind="dateRealisation" value="' + esc(it.dateRealisation) + '"></label>' +
      '<label>Niveau atteint après action<select data-ibind="niveauApres" data-num>' + levelOpts(it.niveauApres, true) + '</select></label></div>' +
      tinput('justificatifRealisation', 'Justificatif / preuve de réalisation', it.justificatifRealisation) +
      '<label>Chantier du plan d\'action<select data-ibind="chantier">' + opts(chantiers, it.chantier) + '</select></label>' +
      tarea('suivi', 'Suivi', 2, it.suivi) +
      (spec ? '<button class="btn ghost danger sm" data-act="del-spec" data-id="' + esc(it.id) + '">Supprimer ce contrôle spécifique</button>' : '') +
      '</div>';
    renderCalcBox(it);
    d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('show');
    if (scroll) $('.drawer-body', d).scrollTop = scroll; else { var first = $('select,input,textarea', d); if (first) first.focus(); }
  }
  function renderCalcBox(it) {
    var c = C.compute(it), el = $('#calc-box'); if (!el) return;
    if (!c.retenu) { el.innerHTML = '<div><span>Priorité</span><b>' + prioBadge(c.priorite) + '</b></div><div><span>Risque initial</span><b>' + riskBadge(c.risqueInitial) + '</b></div><div><span>Risque actuel</span><b>' + riskBadge(c.risqueActuel) + '</b></div><div><span>Prévisionnel</span><b>' + riskBadge(c.risqueApres) + '</b></div>'; return; }
    el.innerHTML = '<div><span>Écart</span><b>' + fmt(c.ecart) + '</b></div><div><span>Criticité</span><b>' + fmt(c.criticite) + '</b></div>' +
      '<div><span>Priorité</span><b>' + prioBadge(c.priorite) + '</b></div><div><span>Délai</span><b>' + (c.delaiMois ? c.delaiMois + ' mois' : '—') + '</b></div>' +
      '<div><span>Risque initial</span><b>' + riskBadge(c.risqueInitial) + '</b></div><div><span>Risque actuel</span><b>' + riskBadge(c.risqueActuel) + '</b></div><div><span>Après plan</span><b>' + riskBadge(c.risqueApres) + '</b></div>';
  }
  function closeDrawer() {
    var d = $('#drawer'); if (!d.classList.contains('open')) return;
    d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('show');
    state.drawerId = null; render();
  }

  // ---------- Vue : plan d'action ----------
  function isoDate(s) { return /^\d{4}-\d\d-\d\d$/.test(String(s || '')); }
  function viewPlan() {
    var a = state.audit;
    var actions = C.retenus(a).map(function (it) { return { it: it, c: C.compute(it) }; })
      .filter(function (r) { return r.c.evalue && (r.c.ecart > 0 || r.it.action); })
      .sort(function (x, y) { return (y.c.criticite || 0) - (x.c.criticite || 0) || x.it.id.localeCompare(y.it.id); });
    var dates = [];
    a.chantiers.forEach(function (c) { if (isoDate(c.debut)) dates.push(c.debut); if (isoDate(c.fin)) dates.push(c.fin); (c.mois || []).forEach(function (m) { dates.push(m); }); });
    a.jalons.forEach(function (j) { if (isoDate(j.date)) dates.push(j.date); });
    dates.sort();
    var count = {}; a.items.forEach(function (it) { if (it.chantier) count[it.chantier] = (count[it.chantier] || 0) + 1; });
    var gantt = '<p class="muted">Ajoutez des chantiers avec des dates de début et de fin pour afficher le diagramme de Gantt.</p>';
    if (dates.length >= 2) {
      var t0 = new Date(dates[0].slice(0, 8) + '01T00:00:00Z').getTime();
      var endD = new Date(dates[dates.length - 1] + 'T00:00:00Z'); endD.setUTCMonth(endD.getUTCMonth() + 1, 1);
      var t1 = endD.getTime(), span = t1 - t0;
      var pos = function (d) { return Math.max(0, Math.min(100, 100 * (new Date(d + 'T00:00:00Z').getTime() - t0) / span)); };
      var months = [], m = new Date(t0);
      while (m.getTime() < t1) { months.push({ l: m.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }), x: pos(m.toISOString().slice(0, 10)) }); m.setUTCMonth(m.getUTCMonth() + 1); }
      var nowX = pos(today()), now = nowX > 0 && nowX < 100 ? '<i class="g-now" style="left:' + nowX + '%"></i>' : '';
      var monthW = 100 / months.length;
      gantt = '<div class="gantt"><div class="g-row g-scale"><div class="g-label"></div><div class="g-track">' + months.map(function (mm) { return '<span style="left:' + mm.x + '%">' + esc(mm.l) + '</span>'; }).join('') + '</div></div>' +
        a.chantiers.filter(function (c) { return c.type !== 'recurrent' && isoDate(c.debut) && isoDate(c.fin); }).map(function (c) {
          var x = pos(c.debut), w = Math.max(1, pos(c.fin) - x);
          return '<div class="g-row"><div class="g-label"><b>' + esc(c.titre) + '</b><small>' + esc(c.id) + ' · ' + (count[c.id] || 0) + ' point(s) · ' + esc(c.responsable || '') + '</small></div><div class="g-track">' + now +
            '<div class="g-bar" style="left:' + x + '%;width:' + w + '%" title="' + esc(fmtDate(c.debut) + ' → ' + fmtDate(c.fin) + ' · ' + (c.avancement || 0) + ' %') + '"><i style="width:' + Math.max(0, Math.min(100, +c.avancement || 0)) + '%"></i><span>' + (c.avancement || 0) + ' %</span></div></div></div>';
        }).join('') +
        a.chantiers.filter(function (c) { return c.type === 'recurrent'; }).map(function (c) {
          var marks = (c.mois && c.mois.length) ? c.mois.map(function (d) { return '<span class="g-dot" style="left:' + (pos(d) + monthW / 2) + '%" title="' + esc(fmtDate(d)) + '">●</span>'; }).join('')
            : (isoDate(c.debut) && isoDate(c.fin) ? '<div class="g-bar rec" style="left:' + pos(c.debut) + '%;width:' + Math.max(1, pos(c.fin) - pos(c.debut)) + '%"></div>' : '');
          return '<div class="g-row"><div class="g-label"><b>' + esc(c.titre) + '</b><small>Activité récurrente · ' + esc(c.responsable || '') + '</small></div><div class="g-track">' + now + marks + '</div></div>';
        }).join('') +
        a.jalons.filter(function (j) { return isoDate(j.date); }).map(function (j) {
          return '<div class="g-row"><div class="g-label"><b>◆ ' + esc(j.id + ' · ' + j.titre) + '</b><small>Jalon · ' + esc(fmtDate(j.date)) + (j.chantiers ? ' · ' + esc(j.chantiers) : '') + '</small></div><div class="g-track">' + now + '<span class="g-milestone" style="left:' + pos(j.date) + '%" title="' + esc(j.criteres || j.titre) + '">◆</span></div></div>';
        }).join('') + '</div><p class="legend"><span class="lg-bar"></span> Chantier <span class="lg-dot">●</span> Activité récurrente <span class="lg-ms">◆</span> Jalon <span class="lg-now"></span> Aujourd\'hui</p>';
    }
    main.innerHTML = head('Plan d\'action', 'Chantiers, plan de déploiement, jalons et actions correctives triées par criticité.') +
      '<div class="card"><h2>Plan de déploiement</h2>' + gantt + '</div>' +
      '<div class="card"><div class="card-head"><h2>Chantiers et activités récurrentes</h2><div class="row-actions"><button class="btn sm" data-act="add-chantier">Ajouter un chantier</button><button class="btn sm ghost" data-act="add-recurrent">Ajouter une activité récurrente</button></div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Chantier</th><th>Responsable</th><th>Début</th><th>Fin</th><th>Avancement (%)</th><th>Statut</th><th></th></tr></thead><tbody>' +
      (a.chantiers.length ? a.chantiers.map(function (c, i) {
        return '<tr><td class="mono">' + esc(c.id) + '</td><td><input class="full" data-bind="chantiers.' + i + '.titre" value="' + esc(c.titre) + '"><small class="muted block">' + (c.type === 'recurrent' ? 'Activité récurrente' : (count[c.id] || 0) + ' point(s) de contrôle' + (c.cout ? ' · coût ' + esc(c.cout) : '')) + '</small></td>' +
          '<td><input data-bind="chantiers.' + i + '.responsable" value="' + esc(c.responsable) + '"></td>' +
          '<td><input type="date" data-bind="chantiers.' + i + '.debut" value="' + esc(c.debut) + '"></td><td><input type="date" data-bind="chantiers.' + i + '.fin" value="' + esc(c.fin) + '"></td>' +
          '<td><input type="number" min="0" max="100" step="5" data-bind="chantiers.' + i + '.avancement" data-num value="' + esc(c.avancement) + '" class="num"></td>' +
          '<td><select data-bind="chantiers.' + i + '.statut">' + opts(STATUTS, c.statut || 'À faire') + '</select></td>' +
          '<td class="nowrap"><button class="btn sm ghost" data-act="edit-chantier" data-i="' + i + '">Détails</button><button class="icon-btn" data-act="del-row" data-list="chantiers" data-i="' + i + '" aria-label="Supprimer">✕</button></td></tr>';
      }).join('') : '<tr><td colspan="8" class="muted center">Aucun chantier.</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><h2>Jalons et critères de passage</h2><button class="btn sm" data-act="add-jalon">Ajouter un jalon</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Jalon</th><th>Intitulé</th><th>Date</th><th>Chantiers</th><th>Critères de passage (preuves attendues)</th><th></th></tr></thead><tbody>' +
      (a.jalons.length ? a.jalons.map(function (j, i) {
        return '<tr><td class="mono">' + esc(j.id) + '</td><td><input class="full" data-bind="jalons.' + i + '.titre" value="' + esc(j.titre) + '"></td><td><input type="date" data-bind="jalons.' + i + '.date" value="' + esc(j.date) + '"></td>' +
          '<td><input data-bind="jalons.' + i + '.chantiers" value="' + esc(j.chantiers) + '"></td><td><textarea class="full" rows="2" data-bind="jalons.' + i + '.criteres">' + esc(j.criteres) + '</textarea></td>' +
          '<td><button class="icon-btn" data-act="del-row" data-list="jalons" data-i="' + i + '" aria-label="Supprimer">✕</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted center">Aucun jalon.</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><h2>Actions correctives (' + actions.length + ')</h2><div class="table-wrap"><table class="table"><thead><tr><th>Réf.</th><th>Action corrective proposée</th><th>Priorité</th><th>Crit.</th><th>Responsable</th><th>Échéance</th><th>Chantier</th><th>Statut</th></tr></thead><tbody>' +
      (actions.length ? actions.map(function (r) {
        var it = r.it, late = isoDate(it.echeance) && it.echeance < today() && !C.estRealisee(it);
        return '<tr class="clickable" data-act="open-item" data-id="' + esc(it.id) + '" tabindex="0"><td class="mono">' + esc(refLabel(it)) + '</td><td>' + (it.action ? esc(it.action) : '<span class="muted">À définir · ' + esc(it.titre) + '</span>') + '</td><td>' + prioBadge(r.c.priorite) + '</td><td>' + fmt(r.c.criticite) + '</td><td>' + esc(it.responsable || '—') + '</td><td' + (late ? ' class="late"' : '') + '>' + esc(isoDate(it.echeance) ? fmtDate(it.echeance) : (it.echeance || '—')) + '</td><td>' + esc(it.chantier || '—') + '</td><td>' + badge(C.estRealisee(it) ? 'Réalisée' : it.statutAction, 'b-s-' + slug(C.estRealisee(it) ? 'realise' : it.statutAction)) + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="muted center">Aucune action : tous les points évalués atteignent leur cible.</td></tr>') + '</tbody></table></div></div>';
  }

  // ---------- Vue : preuves ----------
  function viewPreuves() {
    var a = state.audit;
    var cites = {};
    a.items.forEach(function (it) { (it.preuves || []).forEach(function (p) { (cites[p] = cites[p] || []).push(it); }); });
    main.innerHTML = head('Registre des preuves', a.preuves.length + ' preuve(s) · ' + a.preuves.filter(function (p) { return C.PREUVE_OK.indexOf(p.statut) >= 0; }).length + ' collectée(s) · points de contrôle qui les citent', '<button class="btn primary" data-act="add-preuve">Ajouter une preuve</button>') +
      '<div class="card table-wrap"><table class="table"><thead><tr><th>ID</th><th>Type</th><th>Intitulé de la preuve</th><th>Source / auteur</th><th>Date de collecte</th><th>Statut</th><th>Ce que la preuve établit</th><th>Mesures concernées</th><th>Citée par</th><th></th></tr></thead><tbody>' +
      (a.preuves.length ? a.preuves.map(function (p, i) {
        return '<tr><td class="mono">' + esc(p.id) + '</td>' +
          '<td><select data-bind="preuves.' + i + '.type">' + opts(['Document', 'Entretien', 'Questionnaire', 'Observation', 'Capture', 'Capture / test', 'Test', 'Extraction', 'Échantillonnage', 'Analyse', 'Autre'], p.type) + '</select></td>' +
          '<td><textarea class="full" rows="2" data-bind="preuves.' + i + '.titre">' + esc(p.titre) + '</textarea></td>' +
          '<td><input data-bind="preuves.' + i + '.source" value="' + esc(p.source) + '"></td>' +
          '<td><input type="date" data-bind="preuves.' + i + '.date" value="' + esc(p.date) + '"></td>' +
          '<td><select data-bind="preuves.' + i + '.statut">' + opts(STATUTS_PREUVE.indexOf(p.statut) < 0 && p.statut ? STATUTS_PREUVE.concat([p.statut]) : STATUTS_PREUVE, p.statut) + '</select></td>' +
          '<td><textarea class="full" rows="2" data-bind="preuves.' + i + '.etablit">' + esc(p.etablit || p.commentaire) + '</textarea></td>' +
          '<td><input data-bind="preuves.' + i + '.mesures" value="' + esc(p.mesures) + '"></td>' +
          '<td>' + ((cites[p.id] || []).map(function (it) { return '<button class="link mono" data-act="open-item" data-id="' + esc(it.id) + '">' + esc(refLabel(it)) + '</button>'; }).join(' ') || '<span class="muted">—</span>') + '</td>' +
          '<td><button class="icon-btn" data-act="del-preuve" data-i="' + i + '" aria-label="Supprimer">✕</button></td></tr>';
      }).join('') : '<tr><td colspan="10" class="muted center">Aucune preuve enregistrée.</td></tr>') + '</tbody></table></div>';
  }

  // ---------- Vue : KPI ----------
  function kpiValue(k, s) {
    if (k.mode === 'auto') return C.kpiAuto(k.formule, s);
    var rel = state.audit.releves.filter(function (r) { return r.kpi === k.id; }).sort(function (x, y) { return String(x.date).localeCompare(String(y.date)); });
    return rel.length ? rel[rel.length - 1].valeur : null;
  }
  function viewKpi() {
    var a = state.audit, s = C.summary(a);
    main.innerHTML = head('Indicateurs (KPI)', 'Indicateurs manuels avec historique des mesures et indicateurs calculés à partir de la matrice.', '<button class="btn primary" data-act="add-kpi">Ajouter un indicateur</button>') +
      '<section class="grid2"><div class="card chart-card"><h2>Atteinte des cibles</h2><div class="chart tall"><canvas id="ch-kpi"></canvas></div></div>' +
      '<div class="card chart-card"><h2>Évolution des indicateurs manuels</h2><div class="chart tall"><canvas id="ch-kpi-evo"></canvas></div></div></section>' +
      '<div class="card table-wrap"><table class="table"><thead><tr><th>N°</th><th>Indicateur</th><th>Type</th><th>Valeur</th><th>Cible</th><th>Atteinte</th><th>Nouvelle mesure</th><th></th></tr></thead><tbody>' +
      a.kpis.map(function (k, i) {
        var v = kpiValue(k, s), at = C.kpiAtteinte(v, k.cible, k.sens);
        return '<tr><td class="mono">' + esc(k.id) + '</td><td>' + (k.mode === 'auto' ? esc(k.nom) : '<input class="full" data-bind="kpis.' + i + '.nom" value="' + esc(k.nom) + '">') + '<small class="muted block">' + (k.sens === 'bas' ? 'Plus bas = mieux' : 'Plus haut = mieux') + '</small></td>' +
          '<td>' + (k.mode === 'auto' ? badge('Calculé', 'b-auto') : badge('Manuel', '')) + '</td>' +
          '<td><b>' + fmt(v) + '</b> ' + esc(k.unite) + '</td>' +
          '<td>' + (k.mode === 'auto' ? fmt(k.cible) : '<input type="number" step="any" data-bind="kpis.' + i + '.cible" data-num value="' + esc(k.cible) + '" class="num">') + ' ' + esc(k.unite) + '</td>' +
          '<td><div class="meter" title="' + fmt(at) + ' %"><i style="width:' + (at || 0) + '%" class="' + (at >= 100 ? 'ok' : at >= 60 ? 'mid' : 'low') + '"></i></div>' + fmt(at) + ' %</td>' +
          '<td>' + (k.mode === 'auto' ? '<span class="muted">automatique</span>' : '<form class="inline-form" data-kpi="' + esc(k.id) + '"><input type="date" name="date" value="' + today() + '" aria-label="Date"><input type="number" step="any" name="valeur" required class="num" aria-label="Valeur"><button class="btn sm">Ajouter</button></form>' +
            '<small class="muted">' + a.releves.filter(function (r) { return r.kpi === k.id; }).length + ' mesure(s) · <button class="link" data-act="kpi-history" data-id="' + esc(k.id) + '">historique</button></small>') + '</td>' +
          '<td>' + (k.mode === 'auto' ? '' : '<button class="icon-btn" data-act="del-kpi" data-i="' + i + '" aria-label="Supprimer">✕</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    chart('ch-kpi', {
      type: 'bar',
      data: { labels: a.kpis.map(function (k) { return k.id; }), datasets: [{ label: 'Atteinte de la cible (%)', data: a.kpis.map(function (k) { return C.kpiAtteinte(kpiValue(k, s), k.cible, k.sens); }),
        backgroundColor: a.kpis.map(function (k) { var at = C.kpiAtteinte(kpiValue(k, s), k.cible, k.sens); return at >= 100 ? COLORS.green2 : at >= 60 ? COLORS.yellow : COLORS.red; }) }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: function (it) { return a.kpis[it[0].dataIndex].nom; } } } }, scales: { y: { min: 0, max: 100 } } }
    });
    var manual = a.kpis.filter(function (k) { return k.mode !== 'auto'; });
    var allDates = []; a.releves.forEach(function (r) { if (allDates.indexOf(r.date) < 0) allDates.push(r.date); }); allDates.sort();
    var palette = [COLORS.green, COLORS.blue, COLORS.orange, COLORS.red, COLORS.yellow, COLORS.green2, COLORS.grey];
    chart('ch-kpi-evo', {
      type: 'line',
      data: { labels: allDates.map(fmtDate), datasets: manual.map(function (k, i) {
        return { label: k.id + ' · ' + k.nom, data: allDates.map(function (d) { var r = a.releves.filter(function (x) { return x.kpi === k.id && x.date === d; }); return r.length ? r[r.length - 1].valeur : null; }),
          borderColor: palette[i % palette.length], backgroundColor: palette[i % palette.length], spanGaps: true, tension: 0.2 };
      }) },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
  }

  // ---------- Vue : questionnaire ----------
  function campaignLink(c) {
    var base = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '') + 'questionnaire.html';
    if (S.mode === 'server' && c.token) return base + '?t=' + encodeURIComponent(c.token);
    if (c.id === 'standard') return base + '#standard';
    return base + '#q=' + Q.encodeCampaign(c);
  }
  function campaignQuestionIds(a) {
    return C.retenus(a).map(function (it) { return it.id; });
  }
  function localResponses(c) {
    try { var raw = localStorage.getItem(Q.localKey(c.id)); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  }
  function mergeResponses(c, list) {
    c.reponses = c.reponses || [];
    var known = {}; c.reponses.forEach(function (r) { known[r.id] = true; });
    var added = 0;
    list.forEach(function (r) {
      var s = Q.sanitizeResponse(r, c.questions);
      if (s && !known[s.id] && Object.keys(s.answers).length) { c.reponses.push(s); known[s.id] = true; added++; }
    });
    return added;
  }
  function viewQuestionnaire() {
    var a = state.audit;
    var cur = a.questionnaires.filter(function (c) { return c.id === state.campaign; })[0] || a.questionnaires[a.questionnaires.length - 1];
    var html = head('Questionnaire', 'Auto-évaluation par lien : chaque personne répond en langage courant, les réponses génèrent automatiquement l\'audit.', '<button class="btn primary" data-act="std-campaign">Questionnaire standard</button><button class="btn" data-act="new-campaign">Questionnaire personnalisé</button>');
    if (!a.questionnaires.length) {
      main.innerHTML = html + '<div class="card empty"><h2>Aucun questionnaire</h2><ol class="steps"><li><b>Utilisez</b> le <b>questionnaire standard</b> (lien fixe, 62 questions ANSSI + CIS) ou <b>créez</b> un questionnaire personnalisé : une question par mesure retenue (' + campaignQuestionIds(a).length + ' questions).</li><li><b>Partagez</b> le lien : les salariés ne voient que les questions d\'usage, la direction et l\'informatique voient aussi les questions techniques.</li><li><b>Générez l\'audit</b> : les réponses sont converties en niveaux COBIT et la matrice est recalculée.</li></ol>' +
        (S.mode !== 'server' ? '<p class="note">Mode local : sur ce même navigateur, les réponses sont intégrées directement (bouton <b>Actualiser</b>). Ailleurs, le répondant télécharge un fichier <code>.json</code> à importer ici.</p>' : '') + '</div>';
      return;
    }
    state.campaign = cur.id;
    var agg = Q.aggregate(cur.questions, cur.reponses || [], a.meta.agregation || 'mediane');
    var roles = {}; (cur.reponses || []).forEach(function (r) { roles[r.role] = (roles[r.role] || 0) + 1; });
    var link = campaignLink(cur);
    html += '<div class="tabs">' + a.questionnaires.map(function (c) { return '<button class="tab' + (c.id === cur.id ? ' active' : '') + '" data-act="sel-campaign" data-id="' + esc(c.id) + '">' + esc(c.titre) + '</button>'; }).join('') + '</div>' +
      '<section class="grid2"><div class="card"><h2>' + esc(cur.titre) + '</h2><p class="muted">Créé le ' + esc(fmtDate(cur.createdAt)) + ' · ' + cur.questions.length + ' questions · ' + (cur.statut === 'clos' ? 'clos' : 'ouvert') + '</p>' +
      (S.mode === 'server' && !cur.token ? '<p><button class="btn primary" data-act="publish-campaign">Publier sur le serveur</button></p>' :
        '<label>Lien à partager<div class="copy"><input readonly id="q-link" value="' + esc(link) + '"><button class="btn sm" data-act="copy-link">Copier</button><a class="btn sm ghost" href="' + esc(link) + '" target="_blank" rel="noopener">Ouvrir</a></div></label>') +
      '<div class="row-actions"><button class="btn" data-act="refresh-responses">Actualiser</button><button class="btn" data-act="import-responses">Importer des réponses (.json)</button><button class="btn ghost danger" data-act="del-campaign">Supprimer</button></div></div>' +
      '<div class="card form"><h2>Réponses : ' + (cur.reponses || []).length + '</h2><ul class="plain">' + Q.roles.map(function (r) { return '<li>' + esc(r.label) + ' : <b>' + (roles[r.v] || 0) + '</b></li>'; }).join('') + '</ul>' +
      '<label>Agrégation<select data-bind="meta.agregation" data-rerender>' + opts([['mediane', 'Médiane (par défaut)'], ['min', 'Minimum (prudent)'], ['moyenne', 'Moyenne']], a.meta.agregation || 'mediane') + '</select></label>' +
      '<button class="btn primary block" data-act="apply-campaign"' + ((cur.reponses || []).length ? '' : ' disabled') + '>Générer l\'audit à partir des réponses</button>' +
      '<p class="muted small">Un audit issu d\'un questionnaire est déclaratif : à confirmer par l\'examen des preuves.</p></div></section>' +
      '<div class="card table-wrap"><h2>Résultats par question</h2><table class="table"><thead><tr><th>Point</th><th>Question</th><th>Réponses</th><th>Niveau proposé</th><th>Signalements</th></tr></thead><tbody>' +
      cur.questions.map(function (id) {
        var g = agg[id] || { n: 0 }, it = item(id);
        var flags = [];
        if (g.divergent) flags.push(badge('Divergent', 'b-warn'));
        if (g.meconnue) flags.push(badge('Méconnue', 'b-warn'));
        if (g.nonConcerne) flags.push(badge('Non concerné', 'b-muted'));
        return '<tr><td class="mono">' + esc(id) + '</td><td>' + esc(Q.questionText(id, it)) + '</td><td>' + g.n + (g.nsp ? ' <small class="muted">(' + g.nsp + ' NSP)</small>' : '') + '</td><td>' + (g.niveau === null || g.niveau === undefined ? '—' : '<span class="lvl l' + g.niveau + '">' + g.niveau + '</span>') + '</td><td>' + flags.join(' ') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    main.innerHTML = html;
  }

  // ---------- Exports ----------
  function exportXlsx() {
    var a = clone(state.audit);
    download(fileName('xlsx'), window.XLSXLite.build(window.SSIExport.build(a, C, CAT)));
    toast('Matrice Excel exportée.');
  }
  function exportJson() {
    download(fileName('json'), new Blob([JSON.stringify(state.audit, null, 2)], { type: 'application/json' }));
    toast('Sauvegarde JSON téléchargée.');
  }

  // ---------- Actions ----------
  function nextId(list, prefix) {
    var max = 0; list.forEach(function (x) { var m = new RegExp('^' + prefix + '-(\\d+)$').exec(x.id); if (m) max = Math.max(max, +m[1]); });
    return prefix + '-' + (max + 1 < 10 ? '0' : '') + (max + 1);
  }

  var ACTIONS = {
    'new-audit': newAuditDialog,
    'load-demo': function () {
      if (!window.SSI_DEMO) return toast('Jeu de démonstration indisponible.', 'err');
      var d = freshDemo();
      S.save(d).then(function () { state.audit = d; S.prefs.set('current', d.id); toast('Démonstration Global Green chargée.'); go('tableau'); }).catch(function (e) { toast(e.message, 'err'); });
    },
    'import-audit': function () {
      pickFile('.json,application/json').then(function (files) {
        if (!files.length) return;
        readJsonFile(files[0]).then(function (a) {
          var err = validateAudit(a); if (err) throw new Error(err);
          a = normalize(a);
          return S.list().then(function (list) {
            if (!a.id || !Q.ID_RE.test(a.id) || list.some(function (x) { return x.id === a.id; }) && !confirm('Un audit avec cet identifiant existe déjà. Le remplacer ? (Annuler = importer comme copie)')) a.id = uid('a');
            return S.save(a).then(function () { state.audit = a; S.prefs.set('current', a.id); toast('Audit importé.'); go('tableau'); });
          });
        }).catch(function (e) { toast(e.message, 'err'); });
      });
    },
    'open-audit': function (el) { openAudit(el.dataset.id).then(function () { go('tableau'); }).catch(function (e) { toast(e.message, 'err'); }); },
    'dup-audit': function (el) {
      S.get(el.dataset.id).then(function (a) {
        a = normalize(clone(a)); a.id = uid('a'); a.meta.organisation += ' (copie)'; a.meta.demo = false;
        a.historique.push({ date: today(), version: '', auteur: '', commentaire: 'Copie de l\'audit' });
        return S.save(a);
      }).then(function () { toast('Audit dupliqué.'); render(); }).catch(function (e) { toast(e.message, 'err'); });
    },
    'del-audit': function (el) {
      if (!confirm('Supprimer définitivement cet audit ?')) return;
      S.remove(el.dataset.id).then(function () {
        if (state.audit && state.audit.id === el.dataset.id) { state.audit = null; S.prefs.set('current', null); }
        toast('Audit supprimé.'); render();
      }).catch(function (e) { toast(e.message, 'err'); });
    },
    'open-item': function (el) { openDrawer(el.dataset.id); },
    'close-drawer': closeDrawer,
    'clear-filters': function () { state.filters = {}; render(); },
    'filter-heat': function (el) { go('matrice', { heat: el.dataset.g + 'x' + el.dataset.v }); },
    'add-spec': function () {
      var a = state.audit, n = a.items.filter(function (i) { return i.src === 'SPEC'; }).length + 1, id;
      do { id = 'SPEC-' + (n < 10 ? '0' : '') + n; n++; } while (item(id));
      var it = CAT.newItem({ id: id, src: 'SPEC', num: n - 1, domaine: 'Contrôles spécifiques', titre: 'Nouveau contrôle spécifique', question: '', attendus: '', methodeVerif: '', indicateur: '', gravite: 'Moyen', cible: 3, dict: {} });
      a.items.push(it); a.meta.referentiels.SPEC = true; markDirty(); render(); openDrawer(id);
    },
    'del-spec': function (el) {
      if (!confirm('Supprimer ce contrôle spécifique ?')) return;
      state.audit.items = state.audit.items.filter(function (i) { return i.id !== el.dataset.id; }); markDirty(); closeDrawer();
    },
    'del-row': function (el) {
      if (!confirm('Supprimer cette ligne ?')) return;
      state.audit[el.dataset.list].splice(+el.dataset.i, 1); markDirty(); render();
    },
    'add-version': function () { state.audit.historique.push({ date: today(), version: '', auteur: state.audit.meta.auditeur || '', commentaire: '' }); markDirty(); render(); },
    'add-chantier': function () { var a = state.audit; a.chantiers.push({ id: nextId(a.chantiers, 'CH'), titre: 'Nouveau chantier', mesures: '', actions: '', responsable: '', echeance: '', cout: '', indicateur: '', statut: 'À faire', debut: today(), fin: C.addMonths(today(), 3), avancement: 0, type: 'chantier' }); markDirty(); render(); },
    'add-recurrent': function () { var a = state.audit; a.chantiers.push({ id: nextId(a.chantiers, 'REC'), titre: 'Nouvelle activité récurrente', responsable: '', statut: 'À faire', debut: today(), fin: C.addMonths(today(), 12), avancement: 0, type: 'recurrent', mois: [0, 3, 6, 9].map(function (k) { return C.addMonths(today().slice(0, 8) + '01', k); }) }); markDirty(); render(); },
    'edit-chantier': function (el) {
      var i = +el.dataset.i, c = state.audit.chantiers[i]; if (!c) return;
      var b = function (k, label, rows) { return '<label>' + esc(label) + '<textarea data-bind="chantiers.' + i + '.' + k + '" rows="' + (rows || 2) + '">' + esc(c[k]) + '</textarea></label>'; };
      modal(c.id + ' · ' + c.titre, '<div class="form">' + (c.type === 'recurrent'
        ? '<label>Mois concernés (AAAA-MM, séparés par des virgules)<input data-mois="' + i + '" value="' + esc((c.mois || []).map(function (m) { return m.slice(0, 7); }).join(', ')) + '"></label>'
        : b('mesures', 'Mesures couvertes') + b('actions', 'Actions clés', 3) + '<div class="cols2"><label>Échéance<input data-bind="chantiers.' + i + '.echeance" value="' + esc(c.echeance) + '"></label><label>Coût estimé<select data-bind="chantiers.' + i + '.cout">' + opts([['', '—'], 'Faible', 'Moyen', 'Élevé'].concat(c.cout && ['Faible', 'Moyen', 'Élevé'].indexOf(c.cout) < 0 ? [c.cout] : []), c.cout || '') + '</select></label></div>' +
          b('indicateur', 'Indicateur de réussite') + b('justificatif', 'Justificatif / preuve de réalisation')) + '</div>',
        [{ label: 'Fermer', cls: 'primary', onClick: function () { render(); } }]);
    },
    'add-jalon': function () { var a = state.audit, n = a.jalons.length + 1; while (a.jalons.some(function (j) { return j.id === 'J' + n; })) n++; a.jalons.push({ id: 'J' + n, titre: 'Nouveau jalon', date: C.addMonths(today(), 1), chantiers: '', criteres: '' }); markDirty(); render(); },
    'add-preuve': function () { var a = state.audit; a.preuves.push({ id: nextId(a.preuves, 'PR'), titre: '', type: 'Document', source: '', statut: 'À collecter', date: '', etablit: '', mesures: '', emplacement: '', commentaire: '' }); markDirty(); render(); var ins = $$('[data-bind$=".titre"]'); if (ins.length) ins[ins.length - 1].focus(); },
    'del-preuve': function (el) {
      var a = state.audit, p = a.preuves[+el.dataset.i];
      if (!p || !confirm('Supprimer la preuve ' + p.id + ' ? Elle sera retirée des points de contrôle qui la citent.')) return;
      a.preuves.splice(+el.dataset.i, 1);
      a.items.forEach(function (it) { it.preuves = (it.preuves || []).filter(function (x) { return x !== p.id; }); });
      markDirty(); render();
    },
    'add-kpi': function () {
      modal('Nouvel indicateur', '<form class="form" id="f-kpi"><label>Intitulé *<input name="nom" required maxlength="200"></label><div class="cols3"><label>Unité<input name="unite" value="%" maxlength="10"></label><label>Cible<input type="number" step="any" name="cible" value="100"></label><label>Sens<select name="sens"><option value="haut">Plus haut = mieux</option><option value="bas">Plus bas = mieux</option></select></label></div></form>',
        [{ label: 'Annuler', cls: 'ghost' }, { label: 'Ajouter', cls: 'primary', onClick: function () {
          var f = $('#f-kpi'); if (!f.nom.value.trim()) { f.nom.focus(); return false; }
          var a = state.audit;
          a.kpis.push({ id: nextId(a.kpis, 'KPI'), nom: f.nom.value.trim(), unite: f.unite.value.trim(), cible: f.cible.value === '' ? null : +f.cible.value, sens: f.sens.value, mode: 'manuel' });
          markDirty(); render();
        } }]);
    },
    'del-kpi': function (el) {
      var a = state.audit, k = a.kpis[+el.dataset.i];
      if (!k || !confirm('Supprimer l\'indicateur ' + k.id + ' et ses mesures ?')) return;
      a.kpis.splice(+el.dataset.i, 1); a.releves = a.releves.filter(function (r) { return r.kpi !== k.id; }); markDirty(); render();
    },
    'kpi-history': function (el) {
      var a = state.audit, id = el.dataset.id;
      var rel = a.releves.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return x.r.kpi === id; }).sort(function (x, y) { return String(x.r.date).localeCompare(String(y.r.date)); });
      modal('Historique · ' + id, rel.length ? '<table class="table"><thead><tr><th>Date</th><th>Valeur</th><th></th></tr></thead><tbody>' + rel.map(function (x) { return '<tr><td>' + esc(fmtDate(x.r.date)) + '</td><td>' + fmt(x.r.valeur) + '</td><td><button class="icon-btn" data-act="del-releve" data-i="' + x.i + '" aria-label="Supprimer">✕</button></td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">Aucune mesure.</p>');
    },
    'del-releve': function (el) { state.audit.releves.splice(+el.dataset.i, 1); markDirty(); modalEl.close(); render(); },
    'new-campaign': function () {
      var a = state.audit, ids = campaignQuestionIds(a);
      modal('Nouveau questionnaire', '<form class="form" id="f-camp"><label>Titre<input name="titre" value="Auto-évaluation ' + esc(a.meta.organisation) + '" maxlength="200"></label><p class="muted">' + ids.length + ' questions (une par mesure retenue). Les salariés verront environ ' + ids.filter(Q.isPublic).length + ' questions d\'usage.</p></form>',
        [{ label: 'Annuler', cls: 'ghost' }, { label: 'Créer', cls: 'primary', onClick: function () {
          var extra = {};
          ids.forEach(function (id) { var it = item(id); if (it.src === 'SPEC') extra[id] = it.question || it.titre; });
          var c = { id: uid('q'), auditId: a.id, titre: $('#f-camp').titre.value.trim() || 'Questionnaire', organisation: a.meta.organisation, questions: ids, extra: extra, createdAt: today(), statut: 'ouvert', reponses: [] };
          a.questionnaires.push(c); state.campaign = c.id; markDirty(); render();
        } }]);
    },
    'std-campaign': function () {
      var a = state.audit, c = a.questionnaires.filter(function (x) { return x.id === 'standard'; })[0];
      if (!c) {
        c = { id: 'standard', auditId: a.id, titre: 'Questionnaire standard', organisation: a.meta.organisation, questions: campaignQuestionIds(a).filter(function (id) { return id.indexOf('SPEC') !== 0; }), extra: {}, createdAt: today(), statut: 'ouvert', reponses: [] };
        a.questionnaires.push(c); markDirty();
      }
      state.campaign = c.id; render();
    },
    'sel-campaign': function (el) { state.campaign = el.dataset.id; render(); },
    'copy-link': function () {
      var i = $('#q-link'); i.select();
      (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(function () { toast('Lien copié.'); }, function () { document.execCommand('copy'); toast('Lien copié.'); });
    },
    'publish-campaign': function () {
      var c = curCampaign();
      S.api('q_publish', {}, { auditId: state.audit.id, campaignId: c.id, titre: c.titre, organisation: c.organisation,
        questions: c.questions.map(function (id) { return { id: id, texte: Q.questionText(id, item(id)), public: Q.isPublic(id) ? 'tous' : 'tech' }; }) })
        .then(function (r) { c.token = r.token; markDirty(); render(); toast('Questionnaire publié.'); }).catch(function (e) { toast(e.message, 'err'); });
    },
    'refresh-responses': function () {
      var c = curCampaign();
      var p = S.mode === 'server' && c.token ? S.api('q_responses', { campaign: c.id }).then(function (j) { return j.responses; }) : Promise.resolve(localResponses(c));
      p.then(function (list) { var n = mergeResponses(c, list); if (n) markDirty(); render(); toast(n ? n + ' nouvelle(s) réponse(s).' : 'Aucune nouvelle réponse.'); }).catch(function (e) { toast(e.message, 'err'); });
    },
    'import-responses': function () {
      var c = curCampaign();
      pickFile('.json,application/json').then(function (files) {
        return Promise.all(files.map(readJsonFile)).then(function (arr) {
          var list = [];
          arr.forEach(function (x) { (Array.isArray(x) ? x : [x]).forEach(function (r) { if (r && (!r.campaign || r.campaign === c.id || r.campaign === 'standard')) list.push(r); }); });
          var n = mergeResponses(c, list); if (n) markDirty(); render(); toast(n + ' réponse(s) importée(s).');
        });
      }).catch(function (e) { toast(e.message, 'err'); });
    },
    'del-campaign': function () {
      var a = state.audit, c = curCampaign();
      if (!confirm('Supprimer ce questionnaire et ses réponses ?')) return;
      a.questionnaires = a.questionnaires.filter(function (x) { return x.id !== c.id; });
      if (S.mode === 'server' && c.token) S.api('q_delete', { campaign: c.id }, {}).catch(function () {});
      state.campaign = null; markDirty(); render();
    },
    'apply-campaign': function () {
      var a = state.audit, c = curCampaign();
      if (!confirm('Générer l\'audit : les niveaux des points concernés seront remplacés par ceux issus des réponses. Continuer ?')) return;
      var agg = Q.aggregate(c.questions, c.reponses || [], a.meta.agregation || 'mediane');
      var n = Q.applyToAudit(a, c, agg, C);
      a.historique.push({ date: today(), version: '', auteur: a.meta.auditeur || '', commentaire: 'Audit généré depuis le questionnaire « ' + c.titre + ' » (' + (c.reponses || []).length + ' réponses)' });
      markDirty(); toast(n + ' point(s) de contrôle mis à jour.'); go('tableau');
    }
  };
  function curCampaign() { return state.audit.questionnaires.filter(function (c) { return c.id === state.campaign; })[0]; }

  // ---------- Événements ----------
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = ACTIONS[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('#drawer').classList.contains('open')) { closeDrawer(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-act], td[data-act]')) { e.preventDefault(); e.target.click(); }
  });
  $('#scrim').addEventListener('click', closeDrawer);

  function bindValue(el) {
    if (el.dataset.num !== undefined) return el.value === '' ? null : Number(el.value);
    return el.value;
  }
  function onInput(e) {
    var el = e.target;
    if (!state.audit) return;
    if (el.dataset.bind) {
      setPath(state.audit, el.dataset.bind, bindValue(el)); markDirty();
      if (el.dataset.bind === 'meta.organisation' || el.dataset.bind === 'meta.dateAudit') updateChrome();
      if (e.type === 'change' && el.dataset.rerender !== undefined) render();
      return;
    }
    if (el.dataset.bindCheck) { setPath(state.audit, el.dataset.bindCheck, el.checked); markDirty(); return; }
    var box = el.closest('[data-item]'); if (!box) return;
    if (el.dataset.ibind && el.dataset.ibind.indexOf('nonRetenu.') === 0) { var itn = item(box.dataset.item); if (itn) { itn.nonRetenu = itn.nonRetenu || {}; } }
    var it = item(box.dataset.item); if (!it) return;
    if (el.dataset.ibind) {
      setPath(it, el.dataset.ibind, bindValue(el));
      if (el.dataset.ibind === 'niveau' && e.type === 'change') {
        var c = C.compute(it);
        if (c.ecart > 0 && !it.echeance && c.delaiMois) { it.echeance = C.addMonths(state.audit.meta.dateAudit, c.delaiMois); var ec = $('[data-ibind="echeance"]', box); if (ec) ec.value = it.echeance; }
      }
    } else if (el.dataset.ibindCheck) {
      setPath(it, el.dataset.ibindCheck, el.checked);
      if (el.dataset.ibindCheck === 'actionRealisee' && el.checked) { if (it.statutAction !== 'Fait') { it.statutAction = 'Fait'; var sa = $('[data-ibind="statutAction"]', box); if (sa) sa.value = 'Fait'; } if (!it.dateRealisation) { it.dateRealisation = today(); var dr = $('[data-ibind="dateRealisation"]', box); if (dr) dr.value = it.dateRealisation; } }
    } else if (el.dataset.retenue !== undefined) {
      if (e.type !== 'change') return;
      it.retenue = el.value !== 'Non'; it.allegee = el.value === 'Allégée';
      markDirty(); openDrawer(it.id); return;
    } else if (el.dataset.ibindList) {
      var list = it[el.dataset.ibindList] = it[el.dataset.ibindList] || [];
      var i = list.indexOf(el.value);
      if (el.checked && i < 0) list.push(el.value); if (!el.checked && i >= 0) list.splice(i, 1);
    } else return;
    renderCalcBox(it); markDirty();
  }
  document.addEventListener('input', function (e) { if (e.target.matches('input:not([type=checkbox]),textarea')) onInput(e); });
  document.addEventListener('change', function (e) {
    if (e.target.matches('select,input[type=checkbox],input[type=date],input[type=number]')) onInput(e);
    if (e.target.matches('[data-filter]')) { state.filters[e.target.dataset.filter] = e.target.value || undefined; render(); }
    if (e.target.matches('[data-bind^="chantiers"],[data-bind^="jalons"]')) render();
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'flt-q') {
      state.filters.q = e.target.value; clearTimeout(state.qTimer);
      state.qTimer = setTimeout(function () { render(); var i = $('#flt-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250);
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.dataset && e.target.dataset.mois !== undefined && state.audit) {
      var c = state.audit.chantiers[+e.target.dataset.mois];
      c.mois = e.target.value.split(/[,;\s]+/).filter(function (x) { return /^\d{4}-\d\d$/.test(x); }).map(function (x) { return x + '-01'; });
      markDirty();
    }
  });
  function onClassif() {
    if (!state.audit) return;
    var n = $('[data-classif="niveau"]'), t = $('[data-classif="note"]'); if (!n || !t) return;
    var note = t.value.trim();
    state.audit.meta.classification = n.value && note ? n.value + ' : ' + note : (n.value || note);
    markDirty();
  }
  document.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.classif) onClassif(); });
  document.addEventListener('input', function (e) { if (e.target.dataset && e.target.dataset.classif === 'note') onClassif(); });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    e.preventDefault();
    if (f.dataset.kpi) {
      var v = f.valeur.value; if (v === '') return;
      state.audit.releves.push({ kpi: f.dataset.kpi, date: f.date.value || today(), valeur: Number(v) });
      markDirty(); render(); toast('Mesure ajoutée.');
    }
  });

  $('#btn-xlsx').addEventListener('click', function () { if (state.audit) exportXlsx(); });
  $('#btn-json').addEventListener('click', function () { if (state.audit) exportJson(); });
  $('#btn-print').addEventListener('click', function () { if (state.audit) window.print(); });
  $('#btn-audits').addEventListener('click', function () { go('audits'); });
  $('#menu-toggle').addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
  $('#lb-close').addEventListener('click', function () { $('#local-banner').hidden = true; S.prefs.set('bannerClosed', true); });
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', function (e) { if ($('#save-state').dataset.state === 'pending') { save(); e.preventDefault(); e.returnValue = ''; } });

  if (window.Chart) {
    window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    var cs = getComputedStyle(document.documentElement);
    window.Chart.defaults.color = cs.getPropertyValue('--ink-2').trim() || '#4A5560';
    window.Chart.defaults.borderColor = cs.getPropertyValue('--grid').trim() || 'rgba(0,0,0,.08)';
    if (window.Chart.defaults.scales && window.Chart.defaults.scales.radialLinear) window.Chart.defaults.scales.radialLinear.ticks.color = window.Chart.defaults.color;
  }

  // ---------- Démarrage ----------
  S.init().then(function () {
    var badgeEl = $('#mode-badge');
    badgeEl.textContent = S.mode === 'server' ? 'Mode serveur' : 'Mode local';
    badgeEl.dataset.mode = S.mode;
    if (S.mode === 'local' && !S.prefs.get('bannerClosed', false)) $('#local-banner').hidden = false;
    if (S.mode === 'server' && S.authEnabled) $('#btn-logout').hidden = false;
    var cur = S.prefs.get('current', null);
    return cur ? openAudit(cur).catch(function () { S.prefs.set('current', null); }) : null;
  }).then(route).catch(function (e) { main.innerHTML = '<div class="card err">Impossible de démarrer : ' + esc(e.message) + '</div>'; });
})();
