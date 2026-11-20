/* SSI Audit — Persistance : serveur PHP (api.php) si disponible, sinon navigateur (localStorage).
 * Sur GitHub Pages, api.php n'est pas exécuté : l'application passe automatiquement en mode local. */
(function (root) {
  'use strict';
  var PREFIX = 'ssi-audit.audit.';
  var state = { mode: null, csrf: '', authEnabled: false };

  function api(action, params, body) {
    var url = 'api.php?action=' + encodeURIComponent(action);
    Object.keys(params || {}).forEach(function (k) { url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); });
    var opt = { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'SSIAudit' } };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.headers['X-CSRF-Token'] = state.csrf; opt.body = JSON.stringify(body); }
    return fetch(url, opt).then(function (r) {
      var ct = r.headers.get('Content-Type') || '';
      if (ct.indexOf('application/json') < 0) throw new Error('Réponse inattendue du serveur');
      return r.json().then(function (j) {
        if (r.status === 401) { root.location.href = 'login.php'; throw new Error('Authentification requise'); }
        if (!r.ok || j.ok === false) throw new Error(j.error || ('Erreur ' + r.status));
        return j;
      });
    });
  }

  function ls() { try { return root.localStorage; } catch (e) { return null; } }

  var local = {
    list: function () {
      var s = ls(), out = [];
      if (!s) return Promise.resolve(out);
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf(PREFIX) === 0) {
          try {
            var a = JSON.parse(s.getItem(k));
            out.push({ id: a.id, organisation: a.meta.organisation, dateAudit: a.meta.dateAudit, modifieLe: a.modifieLe || '', demo: !!a.meta.demo });
          } catch (e) { /* entrée illisible ignorée */ }
        }
      }
      out.sort(function (a, b) { return String(b.modifieLe).localeCompare(String(a.modifieLe)); });
      return Promise.resolve(out);
    },
    get: function (id) {
      var s = ls(), v = s && s.getItem(PREFIX + id);
      if (!v) return Promise.reject(new Error('Audit introuvable'));
      return Promise.resolve(JSON.parse(v));
    },
    save: function (audit) {
      var s = ls();
      if (!s) return Promise.reject(new Error('Stockage du navigateur indisponible'));
      audit.modifieLe = new Date().toISOString();
      try { s.setItem(PREFIX + audit.id, JSON.stringify(audit)); }
      catch (e) { return Promise.reject(new Error('Espace de stockage du navigateur plein')); }
      return Promise.resolve({ id: audit.id });
    },
    remove: function (id) { var s = ls(); if (s) s.removeItem(PREFIX + id); return Promise.resolve(); }
  };

  var server = {
    list: function () { return api('list').then(function (j) { return j.audits; }); },
    get: function (id) { return api('get', { id: id }).then(function (j) { return j.audit; }); },
    save: function (audit) { audit.modifieLe = new Date().toISOString(); return api('save', { id: audit.id }, audit); },
    remove: function (id) { return api('delete', { id: id }, {}); }
  };

  var Store = {
    init: function () {
      if (root.location.protocol === 'file:') { state.mode = 'local'; return Promise.resolve(state); }
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
      return fetch('api.php?action=ping', { credentials: 'same-origin', headers: { 'X-Requested-With': 'SSIAudit' }, signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) {
          var ct = r.headers.get('Content-Type') || '';
          if (ct.indexOf('application/json') < 0) throw new Error('pas de PHP');
          return r.json();
        })
        .then(function (j) {
          if (!j || j.app !== 'ssi-audit') throw new Error('pas de PHP');
          state.mode = 'server'; state.csrf = j.csrf || ''; state.authEnabled = !!j.authEnabled;
          if (j.auth === 'required') { root.location.href = j.loginUrl || 'login.php'; }
          return state;
        })
        .catch(function () { state.mode = 'local'; return state; })
        .then(function (s) { clearTimeout(timer); return s; });
    },
    get mode() { return state.mode; },
    get authEnabled() { return state.authEnabled; },
    list: function () { return (state.mode === 'server' ? server : local).list(); },
    get: function (id) { return (state.mode === 'server' ? server : local).get(id); },
    save: function (a) { return (state.mode === 'server' ? server : local).save(a); },
    remove: function (id) { return (state.mode === 'server' ? server : local).remove(id); },
    api: api,
    prefs: {
      get: function (k, d) { try { var v = ls().getItem('ssi-audit.pref.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
      set: function (k, v) { try { ls().setItem('ssi-audit.pref.' + k, JSON.stringify(v)); } catch (e) { /* ignoré */ } }
    }
  };
  root.SSIStore = Store;
})(window);
