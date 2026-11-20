/* SSI Audit — Questionnaire : questions, encodage des liens, agrégation des réponses.
 * Partagé entre l'application (index.html) et la page du répondant (questionnaire.html). */
(function (root) {
  'use strict';
  var QS = root.SSI_QUESTIONS || { items: {}, scale: [], roles: [] };
  var ID_RE = /^[A-Za-z0-9_-]{2,64}$/;

  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /** Lien local : la liste des questions est contenue dans le fragment (#q=…), jamais envoyée au serveur. */
  function encodeCampaign(c) {
    return b64urlEncode(JSON.stringify({ v: 1, c: c.id, a: c.auditId, t: c.titre, o: c.organisation, q: c.questions, x: c.extra || {} }));
  }
  function decodeCampaign(s) {
    var o = JSON.parse(b64urlDecode(s));
    if (!o || o.v !== 1 || !ID_RE.test(o.c) || !Array.isArray(o.q)) throw new Error('Lien invalide');
    var q = o.q.filter(function (x) { return typeof x === 'string' && ID_RE.test(x); }).slice(0, 2000);
    var extra = {};
    if (o.x && typeof o.x === 'object') Object.keys(o.x).forEach(function (k) { if (q.indexOf(k) >= 0 && typeof o.x[k] === 'string') extra[k] = o.x[k].slice(0, 500); });
    return { id: o.c, auditId: String(o.a || ''), titre: String(o.t || 'Questionnaire').slice(0, 200), organisation: String(o.o || '').slice(0, 200), questions: q, extra: extra };
  }

  /** Texte de la question pour un point de contrôle (question courante, sinon question d'audit). */
  function questionText(id, item) {
    var q = QS.items[id];
    if (q) return q.texte;
    return item && item.question ? item.question : (item && item.titre ? item.titre : id);
  }
  function isPublic(id) { var q = QS.items[id]; return !q || q.public === 'tous'; }

  /** Questions visibles pour une fonction : les salariés ne voient que les questions d'usage. */
  function questionsFor(ids, role) {
    return ids.filter(function (id) { return role !== 'salarie' || isPublic(id); });
  }

  function validValue(v) { return v === 'nsp' || v === 'nc' || (typeof v === 'number' && v >= 0 && v <= 5 && Math.floor(v) === v); }

  /** Nettoie une réponse (fichier importé, stockage local). Renvoie null si invalide. */
  function sanitizeResponse(r, allowedIds) {
    if (!r || typeof r !== 'object' || typeof r.answers !== 'object' || r.answers === null) return null;
    var roles = QS.roles.map(function (x) { return x.v; });
    var out = {
      id: ID_RE.test(String(r.id || '')) ? String(r.id) : 'R' + Math.random().toString(36).slice(2, 10),
      campaign: String(r.campaign || ''),
      role: roles.indexOf(r.role) >= 0 ? r.role : 'salarie',
      nom: String(r.nom || '').slice(0, 100),
      date: String(r.date || '').slice(0, 30),
      answers: {}, comments: {}
    };
    Object.keys(r.answers).forEach(function (k) {
      if ((!allowedIds || allowedIds.indexOf(k) >= 0) && validValue(r.answers[k])) out.answers[k] = r.answers[k];
    });
    if (r.comments && typeof r.comments === 'object') {
      Object.keys(r.comments).forEach(function (k) {
        if ((!allowedIds || allowedIds.indexOf(k) >= 0) && typeof r.comments[k] === 'string' && r.comments[k].trim()) {
          out.comments[k] = r.comments[k].slice(0, 1000);
        }
      });
    }
    return out;
  }

  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** Agrège les réponses : médiane (défaut), minimum ou moyenne, arrondie à l'inférieur. */
  function aggregate(ids, responses, method) {
    var res = {};
    ids.forEach(function (id) {
      var vals = [], nsp = 0, nc = 0, n = 0, detail = [], comments = [];
      responses.forEach(function (r) {
        if (!(id in r.answers)) return;
        n++;
        var v = r.answers[id];
        if (v === 'nsp') nsp++; else if (v === 'nc') nc++; else vals.push(v);
        detail.push(r.role);
        if (r.comments && r.comments[id]) comments.push(r.comments[id]);
      });
      var niveau = null;
      if (vals.length) {
        var x = method === 'min' ? Math.min.apply(null, vals) : method === 'moyenne' ? vals.reduce(function (s, y) { return s + y; }, 0) / vals.length : median(vals);
        niveau = Math.floor(x);
      }
      var counts = [0, 0, 0, 0, 0, 0];
      vals.forEach(function (v) { counts[v]++; });
      res[id] = {
        n: n, valeurs: vals, counts: counts, nsp: nsp, nc: nc, niveau: niveau, comments: comments,
        divergent: vals.length >= 2 && Math.max.apply(null, vals) - Math.min.apply(null, vals) >= 2,
        meconnue: n > 0 && nsp > n / 2,
        nonConcerne: n > 0 && nc > n / 2
      };
    });
    return res;
  }

  function nextProofId(audit) {
    var max = 0;
    (audit.preuves || []).forEach(function (p) { var m = /^PR-(\d+)$/.exec(p.id); if (m) max = Math.max(max, +m[1]); });
    return 'PR-' + (max + 1 < 10 ? '0' : '') + (max + 1);
  }

  /** Génère l'audit à partir des résultats agrégés d'une campagne. Renvoie le nombre de points mis à jour. */
  function applyToAudit(audit, campaign, agg, C) {
    var labels = {}; QS.scale.forEach(function (s) { labels[s.v] = s.label; });
    var proof = null;
    (audit.preuves = audit.preuves || []).forEach(function (p) { if (p.campagne === campaign.id) proof = p; });
    if (!proof) {
      proof = { id: nextProofId(audit), titre: 'Réponses au questionnaire « ' + campaign.titre + ' »', type: 'Questionnaire', statut: 'Reçue', date: new Date().toISOString().slice(0, 10), commentaire: '', campagne: campaign.id };
      audit.preuves.push(proof);
    }
    proof.commentaire = (campaign.reponses || []).length + ' réponse(s)';
    var count = 0;
    (audit.items || []).forEach(function (it) {
      var a = agg[it.id];
      if (!a || !a.n) return;
      count++;
      var lines = ['[Questionnaire ' + campaign.titre + '] ' + a.n + ' réponse(s)'];
      for (var lv = 0; lv <= 5; lv++) if (a.counts[lv]) lines.push('· ' + labels[lv] + ' : ' + a.counts[lv]);
      if (a.nsp) lines.push('· Je ne sais pas : ' + a.nsp);
      if (a.nc) lines.push('· Non concerné : ' + a.nc);
      if (a.divergent) lines.push('⚠ Réponses divergentes : à vérifier en entretien.');
      if (a.meconnue) lines.push('⚠ Question méconnue (majorité de « Je ne sais pas ») : à vérifier en entretien.');
      a.comments.forEach(function (c) { lines.push('« ' + c + ' »'); });
      var block = lines.join('\n');
      var prev = String(it.constat || '').replace(/\[Questionnaire [^\]]*\][\s\S]*?(?=\n\n|$)/g, '').trim();
      it.constat = (prev ? prev + '\n\n' : '') + block;
      if (a.niveau !== null) it.niveau = a.niveau;
      it.methodes = it.methodes || [];
      if (it.methodes.indexOf('Questionnaire') < 0) it.methodes.push('Questionnaire');
      it.fiabilite = 'Présomption';
      it.aVerifier = a.divergent || a.meconnue;
      if (a.nonConcerne) { it.retenue = false; it.decision = 'Non retenue'; }
      it.preuves = it.preuves || [];
      if (it.preuves.indexOf(proof.id) < 0) it.preuves.push(proof.id);
      if (C && it.niveau !== null) {
        var r = C.compute(it);
        if (it.retenue !== false) it.decision = r.atteint ? 'Conforme' : it.niveau >= 2 ? 'Partiel' : 'Non conforme';
        if (r.ecart > 0 && !it.action) {
          it.action = 'Mettre en œuvre : ' + it.titre;
          if (!it.echeance && r.delaiMois) it.echeance = C.addMonths(null, r.delaiMois);
        }
      }
    });
    return count;
  }

  root.SSIQ = {
    ID_RE: ID_RE, scale: QS.scale, roles: QS.roles,
    b64urlEncode: b64urlEncode, b64urlDecode: b64urlDecode,
    encodeCampaign: encodeCampaign, decodeCampaign: decodeCampaign,
    questionText: questionText, isPublic: isPublic, questionsFor: questionsFor,
    validValue: validValue, sanitizeResponse: sanitizeResponse, aggregate: aggregate, applyToAudit: applyToAudit,
    localKey: function (cid) { return 'ssi-audit.q.' + cid; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
