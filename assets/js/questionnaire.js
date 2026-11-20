/* SSI Audit — Page du répondant.
 * questionnaire.html?t=<jeton>  → mode serveur (api.php)
 * questionnaire.html#q=<lien>   → mode local (questions contenues dans le lien) */
(function () {
  'use strict';
  var Q = window.SSIQ;
  var main = document.getElementById('q-main');
  var st = { camp: null, questions: [], role: '', nom: '', answers: {}, comments: {}, server: false, token: '', step: 'intro', idx: 0, submitted: false };

  function esc(s) { return s === null || s === undefined ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function $(s, c) { return (c || document).querySelector(s); }
  function toast(msg, kind) {
    var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function draftKey() { return 'ssi-audit.draft.' + st.camp.id; }
  function saveDraft() {
    var s = ls(); if (!s || st.submitted) return;
    try { s.setItem(draftKey(), JSON.stringify({ role: st.role, nom: st.nom, answers: st.answers, comments: st.comments, idx: st.idx })); } catch (e) { /* ignoré */ }
  }
  function loadDraft() {
    var s = ls(); if (!s) return;
    try { var d = JSON.parse(s.getItem(draftKey()) || 'null'); if (d) { st.role = d.role || ''; st.nom = d.nom || ''; st.answers = d.answers || {}; st.comments = d.comments || {}; st.idx = d.idx || 0; } } catch (e) { /* ignoré */ }
  }
  function message(title, text) {
    main.innerHTML = '<div class="q-card"><h1>' + esc(title) + '</h1><p>' + text + '</p></div>';
    $('#q-bar').style.width = '0';
  }

  function visible() { return Q.questionsFor(st.questions.map(function (q) { return q.id; }), st.role); }
  function qById(id) { return st.questions.filter(function (q) { return q.id === id; })[0]; }
  function progress() {
    var ids = visible(), done = ids.filter(function (id) { return id in st.answers; }).length;
    $('#q-bar').style.width = (ids.length ? Math.round(100 * done / ids.length) : 0) + '%';
    return { done: done, total: ids.length };
  }

  function render() {
    if (st.step === 'intro') return renderIntro();
    if (st.step === 'questions') return renderQuestion();
    if (st.step === 'review') return renderReview();
    if (st.step === 'done') return renderDone();
  }

  function renderIntro() {
    main.innerHTML = '<div class="q-card"><h1>' + esc(st.camp.titre) + '</h1>' +
      '<p>Ce questionnaire aide à évaluer la sécurité informatique de <b>' + esc(st.camp.organisation || 'votre organisation') + '</b>. Il n\'y a pas de bonne ou de mauvaise réponse : répondez simplement selon ce que vous constatez au quotidien. « Je ne sais pas » est une réponse utile.</p>' +
      '<p class="muted small">Vos réponses sont enregistrées en brouillon sur cet appareil au fil de l\'eau. Durée : 5 à 15 minutes.</p>' +
      '<form id="q-intro" class="form"><fieldset><legend>Votre fonction *</legend>' + Q.roles.map(function (r) {
        return '<label class="check big"><input type="radio" name="role" value="' + esc(r.v) + '"' + (st.role === r.v ? ' checked' : '') + ' required> ' + esc(r.label) + '</label>';
      }).join('') + '</fieldset>' +
      '<label>Votre nom (facultatif)<input name="nom" maxlength="100" value="' + esc(st.nom) + '" autocomplete="off"></label>' +
      '<button class="btn primary block">Commencer</button></form></div>';
    $('#q-bar').style.width = '0';
    $('#q-intro').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, r = f.querySelector('input[name=role]:checked');
      if (!r) { toast('Indiquez votre fonction.', 'err'); return; }
      st.role = r.value; st.nom = f.nom.value.trim();
      st.idx = Math.min(st.idx, Math.max(0, visible().length - 1));
      st.step = 'questions'; saveDraft(); render();
    });
  }

  function renderQuestion() {
    var ids = visible(), id = ids[st.idx], q = qById(id), p = progress();
    var cur = st.answers[id];
    main.innerHTML = '<div class="q-card"><p class="muted small">Question ' + (st.idx + 1) + ' sur ' + ids.length + ' · ' + p.done + ' répondue(s)</p>' +
      '<h1 class="q-question">' + esc(q.texte) + '</h1><form id="q-form"><div class="q-scale" role="radiogroup">' +
      Q.scale.map(function (s) {
        var sel = cur !== undefined && String(cur) === String(s.v);
        return '<label class="q-opt' + (typeof s.v === 'string' ? ' alt' : '') + (sel ? ' sel' : '') + '"><input type="radio" name="v" value="' + esc(s.v) + '"' + (sel ? ' checked' : '') + '><span>' + esc(s.label) + '</span></label>';
      }).join('') + '</div>' +
      '<details' + (st.comments[id] ? ' open' : '') + '><summary>Ajouter un commentaire</summary><textarea name="c" rows="3" maxlength="1000">' + esc(st.comments[id] || '') + '</textarea></details>' +
      '<div class="q-nav"><button type="button" class="btn ghost" id="q-prev">' + (st.idx ? '← Précédente' : '← Fonction') + '</button>' +
      '<button type="button" class="btn ghost" id="q-review">Récapitulatif</button>' +
      '<button class="btn primary">' + (st.idx < ids.length - 1 ? 'Suivante →' : 'Terminer') + '</button></div></form></div>';
    var form = $('#q-form');
    form.addEventListener('change', function (e) {
      if (e.target.name === 'v') {
        var v = e.target.value; st.answers[id] = /^\d$/.test(v) ? Number(v) : v;
        Array.prototype.forEach.call(form.querySelectorAll('.q-opt'), function (l) { l.classList.toggle('sel', l.querySelector('input').checked); });
        progress(); saveDraft();
      }
    });
    form.c.addEventListener('input', function () { var t = form.c.value.trim(); if (t) st.comments[id] = form.c.value.slice(0, 1000); else delete st.comments[id]; saveDraft(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); if (st.idx < ids.length - 1) { st.idx++; } else { st.step = 'review'; } saveDraft(); render(); window.scrollTo(0, 0); });
    $('#q-prev').addEventListener('click', function () { if (st.idx) st.idx--; else st.step = 'intro'; saveDraft(); render(); });
    $('#q-review').addEventListener('click', function () { st.step = 'review'; render(); });
    var first = form.querySelector('input:checked') || form.querySelector('input'); if (first) first.focus();
  }

  function renderReview() {
    var ids = visible(), p = progress(), labels = {};
    Q.scale.forEach(function (s) { labels[s.v] = s.label; });
    var missing = ids.filter(function (id) { return !(id in st.answers); });
    main.innerHTML = '<div class="q-card"><h1>Récapitulatif</h1><p>' + p.done + ' question(s) répondue(s) sur ' + p.total + '.' + (missing.length ? ' Les questions sans réponse ne seront pas prises en compte.' : '') + '</p>' +
      '<ol class="q-review">' + ids.map(function (id, i) {
        var a = st.answers[id];
        return '<li><button class="link" data-i="' + i + '">' + esc(qById(id).texte) + '</button><span class="' + (a === undefined ? 'muted' : '') + '">' + esc(a === undefined ? 'Sans réponse' : labels[a]) + '</span></li>';
      }).join('') + '</ol>' +
      '<div class="q-nav"><button class="btn ghost" id="q-back">← Revenir aux questions</button><button class="btn primary" id="q-send"' + (p.done ? '' : ' disabled') + '>Envoyer mes réponses</button></div></div>';
    main.querySelector('.q-review').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) { st.idx = +b.dataset.i; st.step = 'questions'; render(); } });
    $('#q-back').addEventListener('click', function () { st.step = 'questions'; render(); });
    $('#q-send').addEventListener('click', submit);
  }

  function response() {
    var ids = visible(), answers = {}, comments = {};
    ids.forEach(function (id) { if (id in st.answers) answers[id] = st.answers[id]; if (st.comments[id]) comments[id] = st.comments[id]; });
    return { id: 'R' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), campaign: st.camp.id, role: st.role, nom: st.nom, date: new Date().toISOString(), answers: answers, comments: comments };
  }

  function submit() {
    var r = response(), btn = $('#q-send'); btn.disabled = true;
    if (st.server) {
      fetch('api.php?action=q_submit&t=' + encodeURIComponent(st.token), { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'SSIAudit', 'Content-Type': 'application/json' }, body: JSON.stringify(r) })
        .then(function (res) { return res.json().then(function (j) { if (!res.ok || j.ok === false) throw new Error(j.error || 'Envoi impossible'); }); })
        .then(function () { finish(r); })
        .catch(function (e) { btn.disabled = false; toast(e.message, 'err'); });
      return;
    }
    // Mode local : dépôt sur ce navigateur (intégration directe si l'auditeur utilise le même appareil).
    var s = ls();
    if (s) {
      try {
        var k = Q.localKey(st.camp.id), list = JSON.parse(s.getItem(k) || '[]');
        list.push(r); s.setItem(k, JSON.stringify(list));
      } catch (e) { /* le téléchargement reste possible */ }
    }
    finish(r);
  }

  function finish(r) {
    st.submitted = true; st.lastResponse = r;
    var s = ls(); if (s) try { s.removeItem(draftKey()); } catch (e) { /* ignoré */ }
    st.step = 'done'; render();
  }

  function renderDone() {
    $('#q-bar').style.width = '100%';
    main.innerHTML = '<div class="q-card"><h1>Merci pour vos réponses !</h1>' +
      (st.server ? '<p>Vos réponses ont bien été transmises à la personne qui réalise l\'audit. Vous pouvez fermer cette page.</p>' :
        '<p>Vos réponses sont enregistrées sur cet appareil. <b>Si vous ne répondez pas sur l\'ordinateur de la personne qui réalise l\'audit</b>, téléchargez le fichier ci-dessous et transmettez-le-lui (courriel, messagerie interne).</p>' +
        '<p><button class="btn primary" id="q-dl">Télécharger mes réponses (.json)</button></p>') + '</div>';
    var dl = $('#q-dl');
    if (dl) dl.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(st.lastResponse, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reponses-' + st.role + '-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
  }

  function start(camp) {
    st.camp = camp;
    document.title = camp.titre + ' · Questionnaire';
    $('#q-org').textContent = camp.organisation || 'Questionnaire';
    $('#q-title').textContent = camp.titre;
    if (!st.questions.length) { message('Questionnaire vide', 'Ce questionnaire ne contient aucune question.'); return; }
    loadDraft(); render();
  }

  // ---------- Démarrage ----------
  var params = new URLSearchParams(location.search);
  var token = params.get('t');
  var frag = /[#&]q=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (token) {
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) { message('Lien invalide', 'Le lien du questionnaire est incomplet ou erroné. Vérifiez qu\'il a été copié en entier.'); return; }
    st.server = true; st.token = token;
    fetch('api.php?action=q_get&t=' + encodeURIComponent(token), { credentials: 'same-origin', headers: { 'X-Requested-With': 'SSIAudit' } })
      .then(function (r) {
        var ct = r.headers.get('Content-Type') || '';
        if (ct.indexOf('application/json') < 0) throw new Error('Le serveur ne permet pas de répondre en ligne à ce questionnaire.');
        return r.json().then(function (j) { if (!r.ok || j.ok === false) throw new Error(j.error || 'Questionnaire indisponible.'); return j.questionnaire; });
      })
      .then(function (qn) {
        st.questions = (qn.questions || []).filter(function (q) { return q && Q.ID_RE.test(q.id); })
          .map(function (q) { return { id: q.id, texte: String(q.texte || q.id), public: q.public === 'tech' ? 'tech' : 'tous' }; });
        // Le filtrage par fonction repose sur la nature de chaque question.
        var pub = {}; st.questions.forEach(function (q) { pub[q.id] = q.public; });
        Q.questionsFor = function (ids, role) { return ids.filter(function (id) { return role !== 'salarie' || pub[id] === 'tous'; }); };
        start({ id: token.slice(0, 32), titre: qn.titre, organisation: qn.organisation });
      })
      .catch(function (e) { message('Questionnaire indisponible', esc(e.message)); });
  } else if (frag) {
    try {
      var camp = Q.decodeCampaign(frag[1]);
      st.questions = camp.questions.map(function (id) { return { id: id, texte: camp.extra[id] || Q.questionText(id, null) }; });
      start(camp);
    } catch (e) {
      message('Lien invalide', 'Le lien du questionnaire est incomplet ou erroné. Vérifiez qu\'il a été copié en entier.');
    }
  } else {
    message('Aucun questionnaire n\'est indiqué', 'Utilisez le lien complet transmis par la personne qui réalise l\'audit de sécurité.');
  }
})();
