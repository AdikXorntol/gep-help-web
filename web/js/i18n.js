/* GEP Help: two-language support (Bahasa Malaysia + English). Exposes window.GEPI. */
(function () {
  'use strict';
  var U = window.GEPU;
  var LANGS = ['ms', 'en'];
  var dict = { ms: {}, en: {} };
  var I = { lang: 'ms', ready: false };

  I.detect = function () {
    var saved = U.local.get('gep_lang', '');
    if (LANGS.indexOf(saved) >= 0) return saved;
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return /^ms/i.test(nav) ? 'ms' : 'en';
  };

  I.load = function () {
    return Promise.all(LANGS.map(function (l) {
      return fetch('i18n/' + l + '.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('i18n ' + l + ' ' + r.status);
        return r.json();
      }).then(function (j) { dict[l] = j; });
    })).then(function () { I.ready = true; });
  };

  I.set = function (lang, remember) {
    if (LANGS.indexOf(lang) < 0) return;
    I.lang = lang;
    document.documentElement.lang = lang;
    if (remember !== false) U.local.set('gep_lang', lang);
  };

  // t('key', {n: 3}) -> text with {n} filled in. Falls back to the other language, then the key.
  I.t = function (key, vars) {
    var s = dict[I.lang][key];
    if (s == null) s = dict[I.lang === 'ms' ? 'en' : 'ms'][key];
    if (s == null) {
      if (window.console) console.warn('i18n: missing key', key);
      s = key;
    }
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    }
    return s;
  };

  // Count-aware text: uses "<key>.one" when n is 1 (English needs it; BM has the same text).
  I.tn = function (key, n, vars) {
    var v = vars || {};
    v.n = v.n != null ? v.n : n;
    var one = key + '.one';
    return I.t(Number(n) === 1 && dict[I.lang][one] != null ? one : key, v);
  };

  // Content fields come in pairs, e.g. tajuk_ms / tajuk_en. Returns {text, missing}
  // where missing = true when the current language is empty and the other one is shown.
  I.pick = function (row, base) {
    if (!row) return { text: '', missing: false };
    var mine = String(row[base + '_' + I.lang] || '').trim();
    if (mine) return { text: mine, missing: false };
    var other = String(row[base + '_' + (I.lang === 'ms' ? 'en' : 'ms')] || '').trim();
    return { text: other, missing: !!other };
  };
  I.text = function (row, base) { return I.pick(row, base).text; };

  I.keys = function (lang) { return Object.keys(dict[lang] || {}); };

  window.GEPI = I;
})();
