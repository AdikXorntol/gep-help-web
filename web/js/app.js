/* GEP Help: main application (routing, pages for everyone, sign-in, overlays).
   Admin pages live in admin.js and plug in through window.GEPApp. */
(function () {
  'use strict';
  var U = window.GEPU, I = window.GEPI, t = I.t, esc = U.esc, svg = U.svg;
  var CFG = window.GEP_CONFIG || {};
  var S = null;

  var st = {
    cat: null, prod: {}, tut: {}, steps: {}, tutsOf: {},
    settings: { whatsapp: '', wajib_log_masuk: false },
    mine: { nota: {}, kegemaran: [], ditonton: [] },
    offline: false, loading: true, loadError: null, q: '', qa: {}, route: null, prevRoute: null
  };
  var app = { st: st, ACT: {}, FORM: {}, routes: {} };
  var $root, $layer, $toast;

  /* ======================= helpers ======================= */
  function me() { return S && S.me; }
  function role() { return me() ? me().peranan : 'tetamu'; }
  function isAdmin() { return role() === 'admin'; }
  function isEditor() { return role() === 'admin' || role() === 'editor'; }
  function pick(row, base) { return I.pick(row, base); }
  function txt(row, base) { return I.text(row, base); }
  function missingTag(p) { return p.missing ? ' <span class="untr" lang="' + I.lang + '">' + esc(t('i18n.notTranslated')) + '</span>' : ''; }
  function errText(err) {
    var e = S && S.classify ? S.classify(err) : err;
    var code = (e && e.code) || 'unknown';
    var key = 'err.' + code;
    var s = t(key);
    return s === key ? t('err.unknown') : s;
  }
  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  function greeting() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return t('greet.morning');
    if (h >= 12 && h < 15) return t('greet.noon');
    if (h >= 15 && h < 19) return t('greet.evening');
    return t('greet.night');
  }
  function patch(p, cls) {
    return '<span class="patch' + (cls ? ' ' + cls : '') + '" style="background:' + esc(p.warna) + ';color:' + U.onColor(p.warna) + '" aria-hidden="true">' + esc(p.kod) + '</span>';
  }
  function visibleTuts(pid) {
    return (st.tutsOf[pid] || []).filter(function (x) { return x.status === 'terbit' || isEditor(); });
  }
  function firstImage(tid) {
    var s = (st.steps[tid] || []).filter(function (l) { return l.gambar_path; })[0];
    return s ? S.imageUrl(s.gambar_path) : '';
  }
  function videoOf(tu) {
    var mine = tu['video_url_' + I.lang], other = tu['video_url_' + (I.lang === 'ms' ? 'en' : 'ms')];
    return U.ytId(mine) ? mine : (U.ytId(other) ? other : '');
  }
  function watched(tid) { return st.mine.ditonton.indexOf(tid) >= 0; }
  function faved(tid) { return st.mine.kegemaran.indexOf(tid) >= 0; }
  function isNew(tu) { return tu.status === 'terbit' && U.isRecent(tu.diterbit_pada, 14); }
  function waLink(text) {
    var n = String(st.settings.whatsapp || '').replace(/\D/g, '');
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) : '';
  }
  app.helpers = {
    me: me, role: role, isAdmin: isAdmin, isEditor: isEditor, pick: pick, txt: txt, missingTag: missingTag,
    errText: errText, busy: busy, patch: patch, firstImage: firstImage, visibleTuts: visibleTuts
  };

  function indexCatalog(cat) {
    st.cat = cat; st.prod = {}; st.tut = {}; st.steps = {}; st.tutsOf = {};
    cat.produk.forEach(function (p) { st.prod[p.id] = p; st.tutsOf[p.id] = []; });
    cat.tutorial.forEach(function (x) {
      st.tut[x.id] = x; st.steps[x.id] = [];
      if (st.tutsOf[x.produk_id]) st.tutsOf[x.produk_id].push(x);
    });
    cat.langkah.forEach(function (l) {
      if (typeof l.penanda === 'string') { try { l.penanda = JSON.parse(l.penanda); } catch (e) { l.penanda = []; } }
      l.penanda = U.cleanMarkers(l.penanda);
      if (st.steps[l.tutorial_id]) st.steps[l.tutorial_id].push(l);
    });
    st.offline = !!cat.offline;
  }

  function refresh() {
    if (app.beforeRefresh) app.beforeRefresh();
    st.refreshing = (st.refreshing || 0) + 1;
    var cat = S.loadCatalog();
    var settings = S.loadSettings().catch(function () { return st.settings; });
    var mine = S.loadMine().catch(function () { return { nota: {}, kegemaran: [], ditonton: [] }; });
    return Promise.all([cat, settings, mine]).then(function (r) {
      indexCatalog(r[0]);
      st.settings = r[1] || st.settings;
      st.mine = r[2];
      st.loading = false; st.loadError = null; st.qa = {};
      st.refreshing--;
      render();
    }, function (err) {
      st.loading = false; st.loadError = err;
      st.refreshing--;
      render();
    });
  }
  app.refresh = refresh;

  /* ======================= routing ======================= */
  function parseRoute() {
    var h = location.hash || '';
    if (/^#(access_token|error|type=)/.test(h) || /[#&](access_token|error_description)=/.test(h)) return { name: 'home', parts: [] };
    var path = h.replace(/^#\/?/, '');
    var q = '';
    var qi = path.indexOf('?');
    if (qi >= 0) { q = path.slice(qi + 1); path = path.slice(0, qi); }
    var parts = path.split('/').filter(Boolean).map(function (s) { try { return decodeURIComponent(s); } catch (e) { return s; } });
    var params = {};
    q.split('&').forEach(function (kv) { if (!kv) return; var i = kv.indexOf('='); params[decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1)); });
    var name = parts[0] || 'home';
    if (name === 't' && parts[2] === 's') name = 'step';
    return { name: name, parts: parts, params: params, hash: h };
  }

  var backPending = false, pendingHash = null, backTimer = null;
  function nav(href, replace) {
    if (layers.length) { closeAllLayers(href, replace); return; }
    if (backPending) { pendingHash = { href: href, replace: replace }; return; }
    if (replace) location.replace(href); else location.hash = href.replace(/^#/, '');
  }
  app.nav = nav;

  var VIEWS = {};
  function render() {
    var r = parseRoute();
    var changed = !st.route || st.route.hash !== r.hash;
    if (changed) { st.prevRoute = st.route; st.route = r; }
    var keep = changed ? null : captureFields($root);
    var view = VIEWS[r.name] || app.routes[r.name] || VIEWS.notfound;
    document.body.className = 'r-' + r.name + (S && S.mode === 'demo' ? ' demo' : '') + (layers.length ? ' lock' : '');
    $root.innerHTML = view(r);
    if (keep) restoreFields($root, keep);
    var title = $root.querySelector('h1');
    document.title = (title && r.name !== 'home' ? title.textContent.trim() + ' · ' : '') + 'GEP Help';
    if (changed) {
      window.scrollTo(0, 0);
      if (st.prevRoute && title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
    }
    afterRender(r);
  }
  app.render = render;

  function captureFields(root) {
    var out = {};
    root.querySelectorAll('input[id],textarea[id],select[id]').forEach(function (el) {
      if (el.type === 'file') return;
      out[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value };
    });
    var a = document.activeElement;
    if (a && a.id && root.contains(a)) out.__focus = a.id;
    return out;
  }
  function restoreFields(root, keep) {
    Object.keys(keep).forEach(function (id) {
      if (id === '__focus') return;
      var el = root.querySelector('#' + CSS.escape(id));
      if (!el) return;
      if ('c' in keep[id]) el.checked = keep[id].c; else el.value = keep[id].v;
    });
    if (keep.__focus) { var f = root.querySelector('#' + CSS.escape(keep.__focus)); if (f) f.focus({ preventScroll: true }); }
  }
  app.captureFields = captureFields;
  app.restoreFields = restoreFields;

  function afterRender(r) {
    if (r.name === 't' && r.parts[1]) loadQuestions(r.parts[1]);
    if (app.after && app.after[r.name]) app.after[r.name](r);
  }
  app.after = {};

  /* ======================= shared pieces ======================= */
  function langToggle() {
    return '<div class="lang" role="group" aria-label="' + esc(t('lang.label')) + '">' +
      ['ms', 'en'].map(function (l) {
        return '<button type="button" data-act="lang" data-lang="' + l + '" aria-pressed="' + (I.lang === l) + '" lang="' + l + '" title="' + (l === 'ms' ? 'Bahasa Malaysia' : 'English') + '">' + (l === 'ms' ? 'BM' : 'EN') + '</button>';
      }).join('') + '</div>';
  }
  app.langToggle = langToggle;

  function accountBtn() {
    if (me()) {
      var n = (me().nama || me().emel || '?').trim().charAt(0).toUpperCase();
      return '<a class="avatar" href="#/akaun" aria-label="' + esc(t('account.title')) + '">' + esc(n) + '</a>';
    }
    return '<button type="button" class="signin" data-act="login" aria-label="' + esc(t('auth.signIn')) + '">' + svg('user') + '<span aria-hidden="true">' + esc(t('auth.signIn')) + '</span></button>';
  }

  function topbar(back, crumb) {
    return '<div class="topbar"><div class="navrow">' +
      (back ? '<a class="back-btn" href="' + esc(back) + '" aria-label="' + esc(t('nav.back')) + '">' + svg('back') + '</a>' : '') +
      '<span class="crumb">' + (crumb || '') + '</span><span class="sp"></span>' + langToggle() + accountBtn() +
      '</div></div>';
  }
  app.topbar = topbar;

  function banners() {
    var h = '';
    if (st.offline) h += '<div class="banner off" role="status">' + svg('wifiOff') + '<span>' + esc(t('offline.banner')) + '</span></div>';
    if (S.mode === 'demo') h += '<div class="banner demo" role="note">' + svg('info') + '<span>' + esc(t('demo.banner')) + '</span></div>';
    return h;
  }
  app.banners = banners;

  function loadingBox() {
    return '<div class="skel" aria-busy="true" aria-live="polite"><span class="vh">' + esc(t('state.loading')) + '</span><i></i><i></i><i></i></div>';
  }
  function errorBox(err) {
    var net = err && (err.code === 'network' || U.isNetworkError(err));
    return '<div class="empty-box" role="alert">' + svg(net ? 'wifiOff' : 'info') + '<strong>' + esc(net ? t('offline.title') : t('state.errorTitle')) + '</strong><p>' + esc(errText(err)) + '</p>' +
      '<button type="button" class="btn" data-act="retry">' + esc(t('state.retry')) + '</button></div>';
  }
  function emptyBox(title, body, extra) {
    return '<div class="empty-box">' + '<strong>' + esc(title) + '</strong>' + (body ? '<p>' + esc(body) + '</p>' : '') + (extra || '') + '</div>';
  }
  app.loadingBox = loadingBox; app.errorBox = errorBox; app.emptyBox = emptyBox;

  function loginWall() {
    return '<div class="empty-box">' + svg('shield') + '<strong>' + esc(t('wall.title')) + '</strong><p>' + esc(t('wall.body')) + '</p>' +
      '<button type="button" class="btn primary" data-act="login">' + esc(t('auth.signIn')) + '</button></div>';
  }

  function thumb(url) {
    return url ? '<span class="thumb"><img src="' + esc(url) + '" alt="" loading="lazy" decoding="async"></span>'
      : '<span class="thumb empty">' + svg('steps') + '</span>';
  }

  function chips(tu) {
    var c = [];
    var n = (st.steps[tu.id] || []).length;
    c.push('<span>' + esc(I.tn('tutorial.stepCount', n, { n: U.fmtNum(n, I.lang) })) + '</span>');
    if (videoOf(tu)) c.push('<span class="c-video">' + svg('play') + esc(t('tutorial.hasVideo')) + '</span>');
    if (tu.status !== 'terbit') c.push('<span class="c-draft">' + esc(t('status.draf')) + '</span>');
    else if (isNew(tu)) c.push('<span class="c-new">' + esc(t('tutorial.new')) + '</span>');
    if (watched(tu.id)) c.push('<span class="c-done">' + svg('check') + esc(t('tutorial.watched')) + '</span>');
    return '<span class="chips">' + c.join('') + '</span>';
  }

  function tutRow(tu, num) {
    var p = pick(tu, 'tajuk');
    return '<li><a class="lesson" href="#/t/' + esc(tu.id) + '">' + thumb(firstImage(tu.id)) +
      '<span class="l-body">' + (num ? '<span class="l-num">' + esc(t('tutorial.number', { n: num })) + '</span>' : '') +
      '<span class="l-title">' + esc(p.text) + missingTag(p) + '</span>' + chips(tu) + '</span>' +
      svg('chev', 'chev') + '</a></li>';
  }
  app.tutRow = tutRow;

  /* ======================= home ======================= */
  VIEWS.home = function () {
    var h = '<header class="mast"><div class="mast-in"><div class="brand">' + U.BRAND + '<span class="brand-name">GEP Help</span><span class="sp"></span>' + langToggle() + accountBtn() + '</div>' +
      '<p class="greet">' + esc(greeting()) + (me() && me().nama ? ', ' + esc(me().nama.split(' ')[0]) : '') + '</p>' +
      '<h1>' + esc(t('home.title')) + '</h1>' +
      '<form class="search" role="search" data-form="search"><label class="vh" for="q">' + esc(t('search.label')) + '</label>' + svg('search') +
      '<input id="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="' + esc(t('search.placeholder')) + '" value="' + esc(st.q) + '"></form>' +
      '</div></header><main class="page">' + banners() + '<div id="results" aria-live="polite">' + (st.q.trim() ? searchResults() : homeBody()) + '</div></main>';
    return h;
  };

  function homeBody() {
    if (st.loading) return loadingBox();
    if (st.loadError) return errorBox(st.loadError);
    if (st.settings.wajib_log_masuk && !me()) return loginWall();
    var h = '';
    var last = U.local.get('gep_last', null);
    if (last && st.tut[last.tid] && (st.tut[last.tid].status === 'terbit' || isEditor())) {
      var lt = st.tut[last.tid], lp = st.prod[lt.produk_id];
      var total = (st.steps[lt.id] || []).length;
      var stepN = Math.min(Math.max(1, last.step || 1), Math.max(1, total));
      h += '<section class="block"><h2 class="sec-h">' + esc(t('home.continue')) + '</h2>' +
        '<a class="cont" href="#/t/' + esc(lt.id) + (total && last.step ? '/s/' + stepN : '') + '">' + (lp ? patch(lp, 'sm') : '') +
        '<span class="l-body"><span class="l-title">' + esc(txt(lt, 'tajuk')) + '</span>' +
        '<span class="l-num">' + esc(total ? t('step.of', { n: stepN, total: total }) : t('tutorial.open')) + '</span></span>' + svg('next', 'chev') + '</a></section>';
    }
    var prods = st.cat.produk;
    h += '<section class="block"><h2 class="sec-h">' + esc(t('home.products')) + '</h2>';
    if (!prods.length) h += emptyBox(t('home.noProducts'), isAdmin() ? t('home.noProductsAdmin') : '');
    else {
      h += '<ul class="list">' + prods.map(function (p) {
        var n = visibleTuts(p.id).length, d = pick(p, 'keterangan');
        return '<li><a class="product" href="#/p/' + esc(p.id) + '">' + patch(p) + '<span class="p-body"><span class="p-name">' + esc(txt(p, 'nama')) + '</span>' +
          (d.text ? '<span class="p-meta">' + esc(d.text) + missingTag(d) + '</span>' : '') +
          '<span class="p-count">' + esc(n ? I.tn('product.count', n, { n: U.fmtNum(n, I.lang) }) : t('product.empty')) + '</span></span>' + svg('chev', 'chev') + '</a></li>';
      }).join('') + '</ul>';
    }
    h += '</section>';
    var favs = st.mine.kegemaran.map(function (id) { return st.tut[id]; }).filter(function (x) { return x && (x.status === 'terbit' || isEditor()); });
    if (favs.length) {
      h += '<section class="block"><h2 class="sec-h">' + svg('starOn', 'h-ic') + esc(t('home.favourites')) + '</h2><ul class="log">' + favs.map(function (x) { return tutRow(x); }).join('') + '</ul></section>';
    }
    var fresh = st.cat.tutorial.filter(isNew).sort(function (a, b) { return String(b.diterbit_pada).localeCompare(String(a.diterbit_pada)); }).slice(0, 5);
    if (fresh.length) {
      h += '<section class="block"><h2 class="sec-h">' + esc(t('home.new')) + '</h2><ul class="log">' + fresh.map(function (x) { return tutRow(x); }).join('') + '</ul></section>';
    }
    h += footer();
    return h;
  }

  function footer() {
    var wa = waLink(t('help.waTextGeneral'));
    return '<section class="foot-card"><h2>' + esc(t('foot.title')) + '</h2><p>' + esc(t('foot.body')) + '</p><div class="foot-actions">' +
      '<button type="button" class="btn" data-act="suggest">' + svg('plus') + esc(t('suggest.button')) + '</button>' +
      (wa ? '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">' + svg('whatsapp') + esc(t('help.whatsapp')) + '</a>' : '') +
      '</div></section>' +
      '<p class="foot">' + (isEditor() ? '<a class="linkish" href="#/admin">' + esc(t('admin.panel')) + '</a> · ' : '') +
      '<button type="button" class="linkish" data-act="welcome">' + esc(t('welcome.again')) + '</button></p>';
  }

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function searchResults() {
    if (st.loading) return loadingBox();
    if (st.loadError) return errorBox(st.loadError);
    if (st.settings.wajib_log_masuk && !me()) return loginWall();
    var words = norm(st.q).split(/\s+/).filter(Boolean);
    var hits = st.cat.tutorial.filter(function (x) { return x.status === 'terbit' || isEditor(); }).map(function (x) {
      var p = st.prod[x.produk_id];
      var hay = norm([txt(x, 'tajuk'), txt(x, 'ringkasan'), p ? txt(p, 'nama') : ''].concat((st.steps[x.id] || []).map(function (l) { return txt(l, 'teks'); })).join(' '));
      var title = norm(txt(x, 'tajuk'));
      if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return null;
      var score = words.reduce(function (s, w) { return s + (title.indexOf(w) >= 0 ? 2 : 1); }, 0);
      return { x: x, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
    var h = '<section class="block"><h2 class="sec-h">' + esc(I.tn('search.results', hits.length, { n: U.fmtNum(hits.length, I.lang) })) + '</h2>';
    if (!hits.length) h += emptyBox(t('search.none'), t('search.noneHint'), '<button type="button" class="btn" data-act="suggest">' + esc(t('suggest.button')) + '</button>');
    else h += '<ul class="log">' + hits.map(function (o) { return tutRow(o.x); }).join('') + '</ul>';
    return h + '</section>';
  }

  /* ======================= product ======================= */
  VIEWS.p = function (r) {
    var p = st.prod[r.parts[1]];
    var h = topbar('#/', esc(t('home.products')));
    h += '<main class="page">' + banners();
    if (st.loading) return h + loadingBox() + '</main>';
    if (st.loadError) return h + errorBox(st.loadError) + '</main>';
    if (st.settings.wajib_log_masuk && !me()) return h + loginWall() + '</main>';
    if (!p) return h + emptyBox(t('notfound.title'), t('notfound.body'), '<a class="btn" href="#/">' + esc(t('nav.home')) + '</a>') + '</main>';
    var d = pick(p, 'keterangan');
    var tuts = visibleTuts(p.id);
    h += '<div class="p-head">' + patch(p, 'lg') + '<div><h1>' + esc(txt(p, 'nama')) + '</h1>' + (d.text ? '<p>' + esc(d.text) + missingTag(d) + '</p>' : '') +
      '<span class="p-count">' + esc(tuts.length ? I.tn('product.count', tuts.length, { n: U.fmtNum(tuts.length, I.lang) }) : t('product.empty')) + '</span></div></div>';
    if (!tuts.length) h += emptyBox(t('product.noneTitle'), t('product.noneBody'), '<button type="button" class="btn" data-act="suggest" data-produk="' + esc(p.id) + '">' + esc(t('suggest.button')) + '</button>');
    else h += '<ol class="log">' + tuts.map(function (x, i) { return tutRow(x, i + 1); }).join('') + '</ol>';
    if (isEditor()) h += '<p class="foot"><a class="linkish" href="#/admin/t/baru?p=' + esc(p.id) + '">' + esc(t('admin.addTutorial')) + '</a></p>';
    return h + '</main>';
  };

  /* ======================= tutorial ======================= */
  function shot(l, n, act) {
    if (!l.gambar_path) return '';
    var alt = t('step.imgAlt', { n: n }) + ': ' + txt(l, 'teks');
    return '<button type="button" class="shot" data-act="' + (act || 'zoom') + '" data-step="' + esc(l.id) + '" aria-label="' + esc(t('step.zoom', { n: n })) + '">' +
      '<span class="shot-in"><img src="' + esc(S.imageUrl(l.gambar_path)) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async">' + U.markersHtml(l.penanda) + '</span>' +
      '<span class="zoom-hint">' + svg('zoomIn') + '</span></button>';
  }
  app.shot = shot;

  VIEWS.t = function (r) {
    var tu = st.tut[r.parts[1]];
    var p = tu && st.prod[tu.produk_id];
    var h = topbar(p ? '#/p/' + p.id : '#/', p ? esc(txt(p, 'nama')) : '');
    h += '<main class="page">' + banners();
    if (st.loading) return h + loadingBox() + '</main>';
    if (st.loadError) return h + errorBox(st.loadError) + '</main>';
    if (!tu && st.settings.wajib_log_masuk && !me()) return h + loginWall() + '</main>';
    if (!tu) return h + emptyBox(t('notfound.title'), t('notfound.body'), '<a class="btn" href="#/">' + esc(t('nav.home')) + '</a>') + '</main>';
    var steps = st.steps[tu.id] || [];
    var title = pick(tu, 'tajuk'), sum = pick(tu, 'ringkasan');
    var vid = videoOf(tu);
    U.local.set('gep_last', { tid: tu.id, step: 0 });

    if (tu.status !== 'terbit') h += '<div class="banner draft" role="note">' + svg('eye') + '<span>' + esc(t('tutorial.draftBanner')) + '</span>' +
      (isEditor() ? '<a href="#/admin/t/' + esc(tu.id) + '">' + esc(t('admin.edit')) + '</a>' : '') + '</div>';
    h += '<p class="kicker">' + (p ? patch(p, 'xs') + esc(txt(p, 'nama')) + ' · ' : '') + esc(I.tn('tutorial.stepCount', steps.length, { n: U.fmtNum(steps.length, I.lang) })) + '</p>' +
      '<h1 class="t-title">' + esc(title.text) + missingTag(title) + '</h1>' +
      (sum.text ? '<p class="lede">' + esc(sum.text) + missingTag(sum) + '</p>' : '');

    h += '<div class="t-actions">' +
      (vid ? '<button type="button" class="cta" data-act="video" data-tid="' + esc(tu.id) + '">' + svg('play') + esc(t('tutorial.watchVideo')) + '</button>' : '') +
      (steps.length ? '<a class="cta ' + (vid ? 'alt' : '') + '" href="#/t/' + esc(tu.id) + '/s/1">' + svg('steps') + esc(t('tutorial.stepMode')) + '</a>' : '') +
      '<button type="button" class="fav" data-act="fav" data-tid="' + esc(tu.id) + '" aria-pressed="' + faved(tu.id) + '">' + svg(faved(tu.id) ? 'starOn' : 'star') + '<span>' + esc(t(faved(tu.id) ? 'fav.saved' : 'fav.save')) + '</span></button>' +
      '</div>';

    if (!steps.length) h += emptyBox(t('tutorial.noSteps'), vid ? t('tutorial.noStepsVideo') : '');
    else {
      h += '<ol class="steps">' + steps.map(function (l, i) {
        var tx = pick(l, 'teks');
        return '<li class="step" id="langkah-' + (i + 1) + '"><span class="step-num" aria-hidden="true">' + (i + 1) + '</span>' +
          '<div class="step-body"><p class="step-text"><span class="vh">' + esc(t('step.label', { n: i + 1 })) + ': </span>' + esc(tx.text) + missingTag(tx) + '</p>' + shot(l, i + 1) + '</div></li>';
      }).join('') + '</ol>';
    }

    h += '<section class="done-box">' + (watched(tu.id)
      ? '<p class="done-ok">' + svg('check') + esc(t('tutorial.understood')) + '</p>'
      : '<button type="button" class="cta" data-act="understood" data-tid="' + esc(tu.id) + '">' + svg('check') + esc(t('tutorial.gotIt')) + '</button>') + '</section>';

    h += noteBox(tu) + '<section class="box" id="qa-box"><h2>' + svg('chat', 'h-ic') + esc(t('qa.title')) + '</h2><div id="qa">' + qaBody(tu.id) + '</div></section>';

    var wa = waLink(t('help.waText', { title: title.text }));
    h += '<section class="box help"><h2>' + svg('help', 'h-ic') + esc(t('help.title')) + '</h2><p>' + esc(t('help.body')) + '</p><div class="foot-actions">' +
      (wa ? '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">' + svg('whatsapp') + esc(t('help.whatsapp')) + '</a>' : '') +
      '<button type="button" class="btn" data-act="report" data-tid="' + esc(tu.id) + '">' + svg('flag') + esc(t('report.button')) + '</button></div></section>';

    var sib = visibleTuts(tu.produk_id), idx = sib.indexOf(tu);
    var nx = idx >= 0 ? sib[idx + 1] : null;
    if (nx) h += '<a class="next-card" href="#/t/' + esc(nx.id) + '"><span class="l-num">' + esc(t('tutorial.next')) + '</span><span class="l-title">' + esc(txt(nx, 'tajuk')) + '</span>' + svg('next', 'chev') + '</a>';
    return h + '</main>';
  };

  function noteBox(tu) {
    var h = '<section class="box"><h2>' + svg('note', 'h-ic') + esc(t('note.title')) + '</h2>';
    if (!me()) return h + '<p class="muted">' + esc(t('note.signIn')) + '</p><button type="button" class="btn" data-act="login">' + esc(t('auth.signIn')) + '</button></section>';
    var cur = st.mine.nota[tu.id] || '';
    return h + '<form data-form="note" data-tid="' + esc(tu.id) + '"><label class="vh" for="note-' + esc(tu.id) + '">' + esc(t('note.title')) + '</label>' +
      '<textarea id="note-' + esc(tu.id) + '" name="teks" rows="3" maxlength="2000" placeholder="' + esc(t('note.placeholder')) + '">' + esc(cur) + '</textarea>' +
      '<div class="btn-row"><button type="submit" class="btn primary">' + esc(t('note.save')) + '</button>' +
      (cur ? '<button type="button" class="btn" data-act="note-del" data-tid="' + esc(tu.id) + '">' + esc(t('note.delete')) + '</button>' : '') + '</div></form></section>';
  }

  function qaBody(tid) {
    if (!me()) return '<p class="muted">' + esc(t('qa.signIn')) + '</p><button type="button" class="btn" data-act="login">' + esc(t('auth.signIn')) + '</button>';
    var list = st.qa[tid];
    var h = '';
    if (list === undefined) h += '<p class="muted" aria-busy="true">' + esc(t('state.loading')) + '</p>';
    else if (list === null) h += '<p class="muted">' + esc(t('qa.loadError')) + '</p>';
    else if (!list.length) h += '<p class="muted">' + esc(t('qa.none')) + '</p>';
    else {
      h += '<ul class="qa-list">' + list.map(function (q) {
        var mine = me() && q.user_id === me().id;
        return '<li class="qa"><p class="qa-q"><b>' + esc(q.nama || t('qa.someone')) + '</b> <span class="muted">' + esc(U.fmtDate(q.dicipta, I.lang)) + '</span></p>' +
          '<p class="qa-text">' + esc(q.teks) + '</p>' +
          (q.jawapan ? '<div class="qa-a"><b>' + svg('shield') + esc(t('qa.answer')) + '</b><p>' + esc(q.jawapan) + '</p></div>' : '<p class="qa-wait">' + esc(t('qa.waiting')) + '</p>') +
          ((mine || isAdmin()) ? '<div class="qa-tools">' +
            (mine && !q.jawapan ? '<button type="button" class="mini" data-act="qa-edit" data-id="' + esc(q.id) + '">' + svg('edit') + esc(t('admin.edit')) + '</button>' : '') +
            (isAdmin() ? '<button type="button" class="mini" data-act="qa-answer" data-id="' + esc(q.id) + '">' + svg('send') + esc(q.jawapan ? t('qa.editAnswer') : t('qa.reply')) + '</button>' : '') +
            '<button type="button" class="mini danger" data-act="qa-del" data-id="' + esc(q.id) + '">' + svg('trash') + esc(t('admin.delete')) + '</button></div>' : '') +
          '</li>';
      }).join('') + '</ul>';
    }
    h += '<form class="qa-form" data-form="ask" data-tid="' + esc(tid) + '"><label for="ask-' + esc(tid) + '">' + esc(t('qa.ask')) + '</label>' +
      '<textarea id="ask-' + esc(tid) + '" name="teks" rows="2" maxlength="1000" required placeholder="' + esc(t('qa.placeholder')) + '"></textarea>' +
      '<button type="submit" class="btn primary">' + svg('send') + esc(t('qa.send')) + '</button></form>';
    return h;
  }

  function loadQuestions(tid) {
    if (!me() || st.qa[tid] !== undefined || !st.tut[tid]) return;
    S.listSoalan(tid).then(function (rows) { st.qa[tid] = rows; }, function () { st.qa[tid] = null; }).then(function () {
      var box = document.getElementById('qa');
      if (box && st.route && st.route.parts[1] === tid) {
        var keep = captureFields(box);
        box.innerHTML = qaBody(tid);
        restoreFields(box, keep);
      }
    });
  }

  /* ======================= step-by-step mode ======================= */
  VIEWS.step = function (r) {
    var tu = st.tut[r.parts[1]];
    if (st.loading) return '<main class="page">' + loadingBox() + '</main>';
    if (!tu) return VIEWS.t(r);
    var steps = st.steps[tu.id] || [];
    if (!steps.length) return VIEWS.t(r);
    var n = Math.min(Math.max(1, parseInt(r.parts[3], 10) || 1), steps.length);
    var l = steps[n - 1], tx = pick(l, 'teks');
    U.local.set('gep_last', { tid: tu.id, step: n });
    var pct = Math.round(n / steps.length * 100);
    return '<main class="stepmode" data-tid="' + esc(tu.id) + '" data-n="' + n + '" data-total="' + steps.length + '">' +
      '<div class="sm-top"><button type="button" class="back-btn" data-act="step-close" data-tid="' + esc(tu.id) + '" aria-label="' + esc(t('step.close')) + '">' + svg('x') + '</button>' +
      '<div class="sm-head"><span class="sm-title">' + esc(txt(tu, 'tajuk')) + '</span>' +
      '<h1 class="sm-count">' + esc(t('step.of', { n: n, total: steps.length })) + '</h1></div>' + langToggle() + '</div>' +
      '<div class="sm-bar" role="progressbar" aria-valuemin="1" aria-valuemax="' + steps.length + '" aria-valuenow="' + n + '" aria-label="' + esc(t('step.progress')) + '"><span style="width:' + pct + '%"></span></div>' +
      '<div class="sm-body" id="sm-body"><p class="sm-text">' + esc(tx.text) + missingTag(tx) + '</p>' +
      (l.gambar_path ? shot(l, n) : '<div class="sm-noimg">' + svg('steps') + '</div>') + '</div>' +
      '<div class="sm-nav">' +
      '<button type="button" class="btn" data-act="step-go" data-n="' + (n - 1) + '"' + (n === 1 ? ' disabled' : '') + '>' + svg('prev') + esc(t('step.prev')) + '</button>' +
      (n < steps.length
        ? '<button type="button" class="btn primary" data-act="step-go" data-n="' + (n + 1) + '">' + esc(t('step.next')) + svg('next') + '</button>'
        : '<button type="button" class="btn primary" data-act="step-finish" data-tid="' + esc(tu.id) + '">' + svg('check') + esc(t('step.finish')) + '</button>') +
      '</div></main>';
  };
  app.after.step = function () {
    var body = document.getElementById('sm-body');
    if (!body) return;
    var x0 = null, y0 = 0;
    body.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; });
    body.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        var m = document.querySelector('.stepmode');
        var n = +m.dataset.n, total = +m.dataset.total;
        var to = dx < 0 ? n + 1 : n - 1;
        if (to >= 1 && to <= total) { body.dataset.swiped = '1'; goStep(m.dataset.tid, to); }
      }
    });
  };
  function goStep(tid, n) { nav('#/t/' + tid + '/s/' + n, true); }

  /* ======================= account ======================= */
  VIEWS.akaun = function () {
    var h = topbar('#/', esc(t('account.title')));
    h += '<main class="page">';
    if (!me()) {
      return h + '<h1 class="page-h">' + esc(t('account.title')) + '</h1>' + emptyBox(t('account.guest'), t('account.guestBody'), '<button type="button" class="btn primary" data-act="login">' + esc(t('auth.signIn')) + '</button>') + '</main>';
    }
    var m = me();
    h += '<h1 class="page-h">' + esc(t('account.title')) + '</h1>' +
      '<section class="box"><p class="acct-mail">' + esc(m.emel) + ' <span class="role-chip r-' + esc(m.peranan) + '">' + esc(t('role.' + m.peranan)) + '</span></p>' +
      '<form data-form="profile"><div class="field"><label for="acct-nama">' + esc(t('account.name')) + '</label>' +
      '<input id="acct-nama" name="nama" maxlength="80" autocomplete="name" value="' + esc(m.nama) + '"></div>' +
      '<div class="btn-row"><button type="submit" class="btn primary">' + esc(t('form.save')) + '</button></div></form></section>' +
      '<section class="box"><h2>' + esc(t('lang.label')) + '</h2><p class="muted">' + esc(t('account.langHint')) + '</p>' + langToggle() + '</section>' +
      '<section class="box"><h2>' + esc(t('suggest.mine')) + '</h2><div id="my-sugg"><p class="muted" aria-busy="true">' + esc(t('state.loading')) + '</p></div>' +
      '<button type="button" class="btn" data-act="suggest">' + svg('plus') + esc(t('suggest.button')) + '</button></section>' +
      '<section class="box"><div class="foot-actions">' +
      (isEditor() ? '<a class="btn" href="#/admin">' + svg('gear') + esc(t('admin.panel')) + '</a>' : '') +
      (S.mode !== 'demo' ? '<button type="button" class="btn" data-act="new-password">' + esc(t('auth.changePassword')) + '</button>' : '') +
      '<button type="button" class="btn danger-o" data-act="logout">' + svg('logout') + esc(t('auth.signOut')) + '</button></div></section>';
    return h + '</main>';
  };
  app.after.akaun = function () {
    if (!me()) return;
    S.listCadanganSaya().then(function (rows) {
      var box = document.getElementById('my-sugg');
      if (!box) return;
      box.innerHTML = rows.length ? '<ul class="plain">' + rows.map(function (c) {
        return '<li><b>' + esc(c.tajuk) + '</b> <span class="st-chip s-' + esc(c.status) + '">' + esc(t('status.' + c.status)) + '</span>' +
          '<span class="muted"> · ' + esc(U.fmtDate(c.dicipta, I.lang)) + '</span>' +
          (c.status === 'baru' ? ' <button type="button" class="mini danger" data-act="sugg-del" data-id="' + esc(c.id) + '">' + svg('trash') + esc(t('admin.delete')) + '</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="muted">' + esc(t('suggest.none')) + '</p>';
    }, function (err) {
      var box = document.getElementById('my-sugg');
      if (box) box.innerHTML = '<p class="muted">' + esc(errText(err)) + '</p>';
    });
  };

  VIEWS.notfound = function () {
    return topbar('#/', '') + '<main class="page"><h1 class="page-h">' + esc(t('notfound.title')) + '</h1>' + emptyBox(t('notfound.title'), t('notfound.body'), '<a class="btn" href="#/">' + esc(t('nav.home')) + '</a>') + '</main>';
  };

  /* ======================= layers (sheets, lightbox, video, welcome) ======================= */
  var layers = [], layerSeq = 0, ignorePop = 0;
  function openLayer(opts) {
    var L = { id: ++layerSeq, opts: opts, opener: document.activeElement };
    var el = document.createElement('div');
    el.className = 'layer ' + (opts.cls || 'sheet-wrap');
    el.setAttribute('role', opts.role || 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (opts.label) el.setAttribute('aria-label', opts.label);
    L.el = el;
    paintLayer(L);
    $layer.appendChild(el);
    layers.push(L);
    document.body.classList.add('lock');
    try { history.pushState({ gepLayer: L.id }, ''); L.pushed = true; } catch (e) { L.pushed = false; }
    el.addEventListener('click', function (e) { if (e.target === el && opts.dismiss !== false) closeLayer(L); });
    setTimeout(function () {
      var f = el.querySelector('[autofocus]') || el.querySelector('input:not([type=hidden]),textarea,select') || el.querySelector('h2, h1, button');
      if (f) { if (!f.matches('input,textarea,select,button,a')) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
    }, 30);
    if (opts.onOpen) opts.onOpen(L);
    return L;
  }
  function paintLayer(L) {
    var keep = L.el.childNodes.length ? captureFields(L.el) : null;
    L.el.innerHTML = L.opts.render(L);
    if (keep) restoreFields(L.el, keep);
    if (L.opts.onPaint) L.opts.onPaint(L);
  }
  function closeLayer(L, viaPop) {
    if (!L || L.closed) return;
    L.closed = true;
    var i = layers.indexOf(L);
    if (i >= 0) layers.splice(i, 1);
    L.el.remove();
    if (!layers.length) document.body.classList.remove('lock');
    if (L.opts.onClose) L.opts.onClose(L);
    if (L.pushed && !viaPop) {
      ignorePop++;
      backPending = true;
      clearTimeout(backTimer);
      backTimer = setTimeout(flushPending, 600);
      history.back();
    }
    if (L.opener && document.contains(L.opener)) { try { L.opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function closeAllLayers(thenHref, replace) {
    var pushed = layers.filter(function (l) { return l.pushed; }).length;
    layers.slice().reverse().forEach(function (l) { closeLayer(l, true); });
    if (pushed) {
      ignorePop++;
      backPending = true;
      pendingHash = thenHref ? { href: thenHref, replace: replace } : null;
      clearTimeout(backTimer);
      backTimer = setTimeout(flushPending, 600);
      history.go(-pushed);
    } else if (thenHref) {
      if (replace) location.replace(thenHref); else location.hash = thenHref.replace(/^#/, '');
    }
  }
  function flushPending() {
    clearTimeout(backTimer);
    backPending = false;
    var p = pendingHash; pendingHash = null;
    if (p) { if (p.replace) location.replace(p.href); else location.hash = p.href.replace(/^#/, ''); }
  }
  window.addEventListener('popstate', function () {
    if (ignorePop > 0) { ignorePop--; if (ignorePop === 0) flushPending(); return; }
    var top = layers[layers.length - 1];
    if (top) closeLayer(top, true);
  });
  app.openLayer = openLayer; app.closeLayer = closeLayer; app.closeAllLayers = closeAllLayers;
  app.topLayer = function () { return layers[layers.length - 1]; };
  function repaintLayers() { layers.forEach(paintLayer); }

  function sheetHtml(title, body, opts) {
    opts = opts || {};
    return '<div class="sheet' + (opts.wide ? ' wide' : '') + '"><div class="sheet-head"><h2 class="sheet-title" id="sheet-title">' + esc(title) + '</h2>' +
      (opts.lang ? langToggle() : '') +
      '<button type="button" class="icon-btn" data-act="close" aria-label="' + esc(t('form.close')) + '">' + svg('x') + '</button></div>' + body + '</div>';
  }
  app.sheetHtml = sheetHtml;

  function sheet(opts) {
    return openLayer({
      cls: 'sheet-wrap', label: opts.label, dismiss: opts.dismiss,
      render: function (L) { return sheetHtml(typeof opts.title === 'function' ? opts.title() : opts.title, opts.body(L), opts); },
      onPaint: opts.onPaint, onClose: opts.onClose, onOpen: opts.onOpen
    });
  }
  app.sheet = sheet;

  function confirmBox(o) {
    return new Promise(function (resolve) {
      var done = false;
      var L = openLayer({
        cls: 'sheet-wrap', role: 'alertdialog', label: o.title,
        render: function () {
          return '<div class="sheet"><h2 class="sheet-title">' + esc(o.title) + '</h2>' + (o.body ? '<p class="sheet-sub">' + esc(o.body) + '</p>' : '') +
            '<div class="btn-row"><button type="button" class="btn" data-act="confirm-no">' + esc(o.no || t('form.cancel')) + '</button>' +
            '<button type="button" class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-act="confirm-yes" autofocus>' + esc(o.yes || t('form.ok')) + '</button></div></div>';
        },
        onClose: function () { if (!done) { done = true; resolve(false); } }
      });
      L.resolve = function (v) { done = true; resolve(v); closeLayer(L); };
    });
  }
  app.confirm = confirmBox;
  app.ACT['confirm-yes'] = function (el) { var L = layerOf(el); if (L && L.resolve) L.resolve(true); };
  app.ACT['confirm-no'] = function (el) { var L = layerOf(el); if (L && L.resolve) L.resolve(false); };
  function layerOf(el) { return layers.filter(function (l) { return l.el.contains(el); })[0]; }
  app.layerOf = layerOf;
  app.ACT.close = function (el) { closeLayer(layerOf(el)); };

  function toast(msg, kind) {
    $toast.textContent = msg;
    $toast.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $toast.className = 'toast'; }, kind === 'err' ? 5200 : 3200);
  }
  app.toast = toast;

  /* ---------- lightbox ---------- */
  function openLightbox(l, n) {
    var zoom = 1;
    openLayer({
      cls: 'lightbox', label: t('step.zoom', { n: n }),
      render: function () {
        return '<div class="lb-top"><span>' + esc(t('step.label', { n: n })) + '</span><span class="sp"></span>' +
          '<button type="button" class="icon-btn light" data-act="lb-zoom" aria-label="' + esc(t(zoom > 1 ? 'zoom.out' : 'zoom.in')) + '">' + svg(zoom > 1 ? 'zoomOut' : 'zoomIn') + '</button>' +
          '<button type="button" class="icon-btn light" data-act="close" aria-label="' + esc(t('form.close')) + '">' + svg('x') + '</button></div>' +
          '<div class="lb-scroll"><span class="shot-in lb-img" style="width:' + (zoom * 100) + '%"><img src="' + esc(S.imageUrl(l.gambar_path)) + '" alt="' + esc(t('step.imgAlt', { n: n }) + ': ' + txt(l, 'teks')) + '">' + U.markersHtml(l.penanda) + '</span></div>' +
          '<p class="lb-cap">' + esc(txt(l, 'teks')) + '</p>';
      },
      onOpen: function (L) { L.toggleZoom = function () { zoom = zoom > 1 ? 1 : 2.4; paintLayer(L); }; }
    });
  }
  app.openLightbox = openLightbox;
  app.ACT['lb-zoom'] = function (el) { var L = layerOf(el); if (L && L.toggleZoom) L.toggleZoom(); };
  app.ACT.zoom = function (el) {
    if (el.closest('[data-swiped]')) return;
    var id = el.dataset.step;
    var all = [].concat.apply([], Object.keys(st.steps).map(function (k) { return st.steps[k]; }));
    var l = all.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    var list = st.steps[l.tutorial_id];
    openLightbox(l, list.indexOf(l) + 1);
  };

  /* ---------- video ---------- */
  function openVideo(url, title) {
    var id = U.ytId(url);
    if (!id) { toast(t('video.invalid'), 'err'); return; }
    openLayer({
      cls: 'videobox', label: title,
      render: function () {
        return '<div class="vb-in"><div class="lb-top"><span class="vb-title">' + esc(title) + '</span><span class="sp"></span>' +
          '<button type="button" class="icon-btn light" data-act="close" aria-label="' + esc(t('form.close')) + '">' + svg('x') + '</button></div>' +
          '<div class="vb-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + esc(id) + '?rel=0&amp;playsinline=1&amp;autoplay=1" title="' + esc(title) + '" ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>' +
          '<a class="vb-ext" href="https://www.youtube.com/watch?v=' + esc(id) + '" target="_blank" rel="noopener">' + svg('external') + esc(t('video.openYoutube')) + '</a></div>';
      }
    });
  }
  app.openVideo = openVideo;
  app.ACT.video = function (el) {
    var tu = st.tut[el.dataset.tid];
    if (tu) openVideo(videoOf(tu), txt(tu, 'tajuk'));
  };

  /* ---------- welcome ---------- */
  function openWelcome() {
    var i = 0;
    var L = openLayer({
      cls: 'welcome', label: t('welcome.label'), dismiss: false,
      render: function () {
        return '<div class="w-top">' + U.BRAND + '<span class="brand-name">GEP Help</span><span class="sp"></span>' + langToggle() +
          '<button type="button" class="w-skip" data-act="w-done">' + esc(t('welcome.skip')) + '</button></div>' +
          '<div class="w-track" style="transform:translateX(' + (-100 * i) + '%)">' + [1, 2, 3].map(function (k, j) {
            return '<section class="w-slide" aria-hidden="' + (j !== i) + '"' + (j !== i ? ' inert' : '') + '><div class="w-art">' + U.ART[j] + '</div>' +
              '<h2>' + esc(t('welcome.' + k + '.title')) + '</h2><p>' + esc(t('welcome.' + k + '.body')) + '</p></section>';
          }).join('') + '</div>' +
          '<div class="w-bottom"><div class="dots" aria-hidden="true">' + [0, 1, 2].map(function (j) { return '<span' + (j === i ? ' class="on"' : '') + '></span>'; }).join('') + '</div>' +
          '<p class="vh" aria-live="polite">' + esc(t('step.of', { n: i + 1, total: 3 })) + '</p>' +
          '<button type="button" class="w-next" data-act="' + (i < 2 ? 'w-next' : 'w-done') + '">' + esc(i < 2 ? t('welcome.next') : t('welcome.start')) + svg('next') + '</button></div>';
      },
      onPaint: function (L2) {
        var tr = L2.el.querySelector('.w-track');
        var x0 = null;
        tr.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
        tr.addEventListener('pointerup', function (e) {
          if (x0 === null) return;
          var dx = e.clientX - x0; x0 = null;
          if (dx < -50 && i < 2) { i++; paintLayer(L2); }
          else if (dx > 50 && i > 0) { i--; paintLayer(L2); }
        });
      },
      onClose: function () { U.local.set('gep_welcome_seen', 1); }
    });
    L.next = function () { if (i < 2) { i++; paintLayer(L); var b = L.el.querySelector('.w-next'); if (b) b.focus(); } };
  }
  app.ACT.welcome = function () { openWelcome(); };
  app.ACT['w-next'] = function (el) { var L = layerOf(el); if (L && L.next) L.next(); };
  app.ACT['w-done'] = function (el) { closeLayer(layerOf(el)); };

  /* ---------- sign in / sign up ---------- */
  function openLogin(mode) {
    mode = mode || 'in';
    var msg = '';
    sheet({
      title: function () { return mode === 'up' ? t('auth.signUp') : mode === 'reset' ? t('auth.forgot') : t('auth.signIn'); },
      lang: true, label: t('auth.signIn'),
      body: function () {
        var h = '';
        if (S.mode === 'demo') {
          h += '<div class="demo-pick"><p>' + esc(t('demo.pick')) + '</p><div class="foot-actions">' +
            ['admin', 'editor', 'staf'].map(function (r) { return '<button type="button" class="btn" data-act="demo-as" data-role="' + r + '">' + esc(t('role.' + r)) + '</button>'; }).join('') + '</div></div>';
        }
        if (mode !== 'reset') {
          h += '<div class="seg" role="tablist" aria-label="' + esc(t('auth.signIn')) + '">' +
            '<button type="button" role="tab" aria-selected="' + (mode === 'in') + '" data-act="auth-mode" data-mode="in">' + esc(t('auth.signIn')) + '</button>' +
            '<button type="button" role="tab" aria-selected="' + (mode === 'up') + '" data-act="auth-mode" data-mode="up">' + esc(t('auth.signUp')) + '</button></div>';
        }
        h += '<form data-form="auth" data-mode="' + mode + '" novalidate>';
        if (mode === 'up') h += '<div class="field"><label for="au-nama">' + esc(t('account.name')) + '</label><input id="au-nama" name="nama" maxlength="80" autocomplete="name"></div>';
        h += '<div class="field"><label for="au-emel">' + esc(t('auth.email')) + '</label><input id="au-emel" name="emel" type="email" autocomplete="email" inputmode="email" required></div>';
        if (mode !== 'reset') h += '<div class="field"><label for="au-pw">' + esc(t('auth.password')) + '</label><input id="au-pw" name="pw" type="password" minlength="6" autocomplete="' + (mode === 'up' ? 'new-password' : 'current-password') + '" required>' +
          (mode === 'up' ? '<small class="hint">' + esc(t('auth.passwordHint')) + '</small>' : '') + '</div>';
        h += '<p class="err" role="alert">' + esc(msg) + '</p>';
        h += '<div class="btn-row"><button type="submit" class="btn primary">' + esc(mode === 'up' ? t('auth.signUp') : mode === 'reset' ? t('auth.sendReset') : t('auth.signIn')) + '</button></div></form>';
        h += '<p class="sheet-foot">' + (mode === 'in' ? '<button type="button" class="linkish" data-act="auth-mode" data-mode="reset">' + esc(t('auth.forgot')) + '</button>' :
          mode === 'reset' ? '<button type="button" class="linkish" data-act="auth-mode" data-mode="in">' + esc(t('auth.backToSignIn')) + '</button>' : '') + '</p>';
        return h;
      },
      onOpen: function (L) {
        L.setMode = function (m) { mode = m; msg = ''; paintLayer(L); };
        L.setMsg = function (m) { msg = m; var e = L.el.querySelector('.err'); if (e) e.textContent = m; };
      }
    });
  }
  app.openLogin = openLogin;
  app.ACT.login = function () { openLogin('in'); };
  app.ACT['auth-mode'] = function (el) { var L = layerOf(el); if (L) L.setMode(el.dataset.mode); };
  app.ACT['demo-as'] = function (el) {
    S.demoLogin(el.dataset.role).then(function () {
      closeLayer(layerOf(el));
      toast(t('auth.welcomeBack', { name: me().nama }));
    });
  };
  app.FORM.auth = function (f) {
    var L = layerOf(f), mode = f.dataset.mode;
    var email = f.emel.value.trim(), pw = f.pw ? f.pw.value : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { L.setMsg(t('err.auth-email')); f.emel.focus(); return; }
    if (mode !== 'reset' && pw.length < 6) { L.setMsg(mode === 'up' ? t('err.auth-weak') : t('auth.needPassword')); f.pw.focus(); return; }
    var btn = f.querySelector('[type=submit]');
    busy(btn, true); L.setMsg('');
    var p;
    if (mode === 'in') p = S.signIn(email, pw).then(function () { closeLayer(L); toast(t('auth.welcomeBack', { name: me().nama || me().emel })); });
    else if (mode === 'up') p = S.signUp(email, pw, f.nama.value.trim(), I.lang).then(function (r) {
      if (r && r.needConfirm) {
        closeLayer(L);
        sheet({ title: t('auth.checkEmailTitle'), body: function () { return '<p class="sheet-sub">' + esc(t('auth.checkEmail', { email: email })) + '</p><div class="btn-row"><button type="button" class="btn primary" data-act="close">' + esc(t('form.ok')) + '</button></div>'; } });
      } else { closeLayer(L); toast(t('auth.welcomeNew')); }
    });
    else p = S.resetPassword(email).then(function () { closeLayer(L); toast(t('auth.resetSent', { email: email })); });
    p.catch(function (err) { busy(btn, false); L.setMsg(errText(err)); });
  };

  function openNewPassword(fromEmail) {
    sheet({
      title: t('auth.newPasswordTitle'), dismiss: !fromEmail,
      body: function () {
        return (fromEmail ? '<p class="sheet-sub">' + esc(t('auth.newPasswordBody')) + '</p>' : '') +
          '<form data-form="newpw" novalidate><div class="field"><label for="np1">' + esc(t('auth.newPassword')) + '</label><input id="np1" name="p1" type="password" minlength="6" autocomplete="new-password" required><small class="hint">' + esc(t('auth.passwordHint')) + '</small></div>' +
          '<div class="field"><label for="np2">' + esc(t('auth.repeatPassword')) + '</label><input id="np2" name="p2" type="password" minlength="6" autocomplete="new-password" required></div>' +
          '<p class="err" role="alert"></p><div class="btn-row"><button type="submit" class="btn primary">' + esc(t('form.save')) + '</button></div></form>';
      }
    });
  }
  app.ACT['new-password'] = function () { openNewPassword(false); };
  app.FORM.newpw = function (f) {
    var L = layerOf(f), err = f.querySelector('.err');
    if (f.p1.value.length < 6) { err.textContent = t('err.auth-weak'); return; }
    if (f.p1.value !== f.p2.value) { err.textContent = t('auth.mismatch'); return; }
    var btn = f.querySelector('[type=submit]');
    busy(btn, true);
    S.updatePassword(f.p1.value).then(function () { closeLayer(L); toast(t('auth.passwordChanged')); }, function (e) { busy(btn, false); err.textContent = errText(e); });
  };

  app.ACT.logout = function (el) {
    busy(el, true);
    S.signOut().then(function () { toast(t('auth.signedOut')); nav('#/'); }, function (e) { busy(el, false); toast(errText(e), 'err'); });
  };

  /* ---------- suggestions & reports ---------- */
  app.ACT.suggest = function (el) {
    if (!me()) { toast(t('suggest.signIn')); openLogin('in'); return; }
    var pre = el.dataset.produk || '';
    sheet({
      title: t('suggest.title'),
      body: function () {
        return '<p class="sheet-sub">' + esc(t('suggest.body')) + '</p><form data-form="suggest" novalidate>' +
          '<div class="field"><label for="sg-p">' + esc(t('suggest.product')) + '</label><select id="sg-p" name="produk"><option value="">' + esc(t('suggest.anyProduct')) + '</option>' +
          st.cat.produk.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === pre ? ' selected' : '') + '>' + esc(txt(p, 'nama')) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="sg-t">' + esc(t('suggest.topic')) + '</label><input id="sg-t" name="tajuk" maxlength="120" required placeholder="' + esc(t('suggest.topicPh')) + '"></div>' +
          '<div class="field"><label for="sg-b">' + esc(t('suggest.details')) + '</label><textarea id="sg-b" name="butiran" rows="3" maxlength="1000"></textarea></div>' +
          '<p class="err" role="alert"></p><div class="btn-row"><button type="submit" class="btn primary">' + svg('send') + esc(t('form.send')) + '</button></div></form>';
      }
    });
  };
  app.FORM.suggest = function (f) {
    var err = f.querySelector('.err');
    if (!f.tajuk.value.trim()) { err.textContent = t('suggest.needTopic'); f.tajuk.focus(); return; }
    var btn = f.querySelector('[type=submit]');
    busy(btn, true);
    S.addCadangan({ produk_id: f.produk.value || null, tajuk: f.tajuk.value, butiran: f.butiran.value }).then(function () {
      closeLayer(layerOf(f)); toast(t('suggest.thanks'));
      if (st.route && st.route.name === 'akaun') render();
    }, function (e) { busy(btn, false); err.textContent = errText(e); });
  };
  app.ACT['sugg-del'] = function (el) {
    confirmBox({ title: t('suggest.deleteQ'), yes: t('admin.delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      S.deleteRow('cadangan', el.dataset.id).then(function () { toast(t('form.deleted')); render(); }, function (e) { toast(errText(e), 'err'); });
    });
  };

  app.ACT.report = function (el) {
    if (!me()) { toast(t('report.signIn')); openLogin('in'); return; }
    var tid = el.dataset.tid;
    sheet({
      title: t('report.title'),
      body: function () {
        return '<form data-form="report" data-tid="' + esc(tid) + '" novalidate><fieldset class="field"><legend>' + esc(t('report.what')) + '</legend><div class="radios">' +
          ['video', 'gambar', 'langkah', 'lain'].map(function (k, i) {
            return '<label class="radio"><input type="radio" name="jenis" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(t('report.k.' + k)) + '</span></label>';
          }).join('') + '</div></fieldset>' +
          '<div class="field"><label for="rp-b">' + esc(t('report.details')) + '</label><textarea id="rp-b" name="butiran" rows="3" maxlength="1000"></textarea></div>' +
          '<p class="err" role="alert"></p><div class="btn-row"><button type="submit" class="btn primary">' + svg('send') + esc(t('form.send')) + '</button></div></form>';
      }
    });
  };
  app.FORM.report = function (f) {
    var btn = f.querySelector('[type=submit]'), err = f.querySelector('.err');
    var j = f.querySelector('input[name=jenis]:checked');
    busy(btn, true);
    S.addLaporan({ tutorial_id: f.dataset.tid, jenis: j ? j.value : 'lain', butiran: f.butiran.value }).then(function () {
      closeLayer(layerOf(f)); toast(t('report.thanks'));
    }, function (e) { busy(btn, false); err.textContent = errText(e); });
  };

  /* ---------- tutorial actions ---------- */
  app.ACT.fav = function (el) {
    if (!me()) { toast(t('fav.signIn')); openLogin('in'); return; }
    var tid = el.dataset.tid, on = !faved(tid);
    busy(el, true);
    S.setKegemaran(tid, on).then(function () {
      if (on) st.mine.kegemaran.unshift(tid); else st.mine.kegemaran = st.mine.kegemaran.filter(function (x) { return x !== tid; });
      toast(t(on ? 'fav.added' : 'fav.removed'));
      render();
    }, function (e) { busy(el, false); toast(errText(e), 'err'); });
  };
  function markUnderstood(tid, el) {
    busy(el, true);
    return S.markDitonton(tid).then(function () {
      if (!watched(tid)) st.mine.ditonton.push(tid);
      toast(t('tutorial.understoodToast'));
    }, function (e) { busy(el, false); toast(errText(e), 'err'); throw e; });
  }
  app.ACT.understood = function (el) { markUnderstood(el.dataset.tid, el).then(render, function () { /* toast shown */ }); };
  app.ACT['step-go'] = function (el) {
    var m = el.closest('.stepmode');
    goStep(m.dataset.tid, +el.dataset.n);
  };
  app.ACT['step-finish'] = function (el) {
    var tid = el.dataset.tid;
    markUnderstood(tid, el).then(function () { U.local.set('gep_last', { tid: tid, step: 0 }); nav('#/t/' + tid, true); }, function () { /* toast shown */ });
  };
  app.ACT['step-close'] = function (el) {
    var tid = el.dataset.tid;
    if (st.prevRoute && st.prevRoute.name === 't' && st.prevRoute.parts[1] === tid) history.back();
    else nav('#/t/' + tid, true);
  };

  app.FORM.note = function (f) {
    var tid = f.dataset.tid, btn = f.querySelector('[type=submit]');
    var v = f.teks.value.trim();
    busy(btn, true);
    S.saveNota(tid, v).then(function () {
      if (v) st.mine.nota[tid] = v; else delete st.mine.nota[tid];
      toast(t(v ? 'note.saved' : 'note.deleted'));
      render();
    }, function (e) { busy(btn, false); toast(errText(e), 'err'); });
  };
  app.ACT['note-del'] = function (el) {
    var tid = el.dataset.tid;
    confirmBox({ title: t('note.deleteQ'), yes: t('admin.delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      S.saveNota(tid, '').then(function () {
        delete st.mine.nota[tid];
        var ta = document.getElementById('note-' + tid); if (ta) ta.value = '';
        toast(t('note.deleted')); render();
      }, function (e) { toast(errText(e), 'err'); });
    });
  };

  app.FORM.ask = function (f) {
    var tid = f.dataset.tid, v = f.teks.value.trim(), btn = f.querySelector('[type=submit]');
    if (!v) { f.teks.focus(); return; }
    busy(btn, true);
    S.addSoalan(tid, v).then(function (row) {
      (st.qa[tid] = st.qa[tid] || []).push(row);
      f.teks.value = '';
      toast(t('qa.sent'));
      var box = document.getElementById('qa'); if (box) box.innerHTML = qaBody(tid);
    }, function (e) { busy(btn, false); toast(errText(e), 'err'); });
  };
  function findQ(id) {
    var out = null;
    Object.keys(st.qa).forEach(function (k) { (st.qa[k] || []).forEach(function (q) { if (q.id === id) out = q; }); });
    return out;
  }
  app.findQ = findQ;
  function qaTextSheet(q, answer) {
    sheet({
      title: answer ? t('qa.reply') : t('qa.editQuestion'),
      body: function () {
        return (answer ? '<p class="sheet-sub"><b>' + esc(q.nama) + ':</b> ' + esc(q.teks) + '</p>' : '') +
          '<form data-form="qa-text" data-id="' + esc(q.id) + '" data-answer="' + (answer ? 1 : 0) + '"><div class="field"><label for="qa-t">' + esc(answer ? t('qa.answer') : t('qa.ask')) + '</label>' +
          '<textarea id="qa-t" name="teks" rows="4" maxlength="' + (answer ? 2000 : 1000) + '">' + esc(answer ? q.jawapan : q.teks) + '</textarea></div>' +
          '<p class="err" role="alert"></p><div class="btn-row"><button type="submit" class="btn primary">' + esc(t('form.save')) + '</button></div></form>';
      }
    });
  }
  app.qaTextSheet = qaTextSheet;
  app.ACT['qa-edit'] = function (el) { var q = findQ(el.dataset.id); if (q) qaTextSheet(q, false); };
  app.ACT['qa-answer'] = function (el) { var q = findQ(el.dataset.id) || (app.inboxQ && app.inboxQ(el.dataset.id)); if (q) qaTextSheet(q, true); };
  app.FORM['qa-text'] = function (f) {
    var id = f.dataset.id, answer = f.dataset.answer === '1', v = f.teks.value.trim();
    var btn = f.querySelector('[type=submit]'), err = f.querySelector('.err');
    if (!answer && !v) { err.textContent = t('err.invalid'); return; }
    busy(btn, true);
    (answer ? S.answerSoalan(id, v) : S.updateSoalan(id, v)).then(function (row) {
      Object.keys(st.qa).forEach(function (k) { (st.qa[k] || []).forEach(function (q, i, arr) { if (q.id === id) arr[i] = row; }); });
      if (app.onInboxChange) app.onInboxChange(row);
      closeLayer(layerOf(f)); toast(t('form.saved')); render();
    }, function (e) { busy(btn, false); err.textContent = errText(e); });
  };
  app.ACT['qa-del'] = function (el) {
    var id = el.dataset.id;
    confirmBox({ title: t('qa.deleteQ'), yes: t('admin.delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      S.deleteRow('soalan', id).then(function () {
        Object.keys(st.qa).forEach(function (k) { if (st.qa[k]) st.qa[k] = st.qa[k].filter(function (q) { return q.id !== id; }); });
        if (app.onInboxChange) app.onInboxChange(null, id);
        toast(t('form.deleted')); render();
      }, function (e) { toast(errText(e), 'err'); });
    });
  };

  app.FORM.profile = function (f) {
    var btn = f.querySelector('[type=submit]');
    busy(btn, true);
    S.updateProfile({ nama: f.nama.value.trim() }).then(function () { toast(t('form.saved')); render(); }, function (e) { busy(btn, false); toast(errText(e), 'err'); });
  };

  /* ---------- language ---------- */
  app.ACT.lang = function (el) {
    var l = el.dataset.lang;
    if (l === I.lang) return;
    I.set(l, true);
    render();
    repaintLayers();
    var focusSame = document.querySelectorAll('[data-act="lang"][data-lang="' + l + '"]');
    if (focusSame.length) {
      var inLayer = app.topLayer();
      var target = [].filter.call(focusSame, function (b) { return inLayer ? inLayer.el.contains(b) : true; })[0] || focusSame[0];
      target.focus({ preventScroll: true });
    }
    if (me()) S.updateProfile({ bahasa: l }).catch(function (e) { if (e.code !== 'network') toast(errText(e), 'err'); });
  };
  app.ACT.retry = function () { st.loading = true; st.loadError = null; render(); refresh(); };

  /* ======================= events ======================= */
  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (el && !el.disabled) {
      var fn = app.ACT[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el, e); }
      return;
    }
    var a = e.target.closest('a[href^="#"]');
    if (a && layers.length && $layer.contains(a)) { e.preventDefault(); nav(a.getAttribute('href')); }
  }
  function onSubmit(e) {
    var f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    var fn = app.FORM[f.dataset.form];
    if (fn) fn(f, e);
  }
  var onSearch = U.debounce(function (v) {
    st.q = v;
    var box = document.getElementById('results');
    if (box) box.innerHTML = st.q.trim() ? searchResults() : homeBody();
  }, 120);
  function onInput(e) {
    if (e.target.id === 'q') onSearch(e.target.value);
    if (app.onInput) app.onInput(e);
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      var top = layers[layers.length - 1];
      if (top && top.opts.dismiss !== false) { e.preventDefault(); closeLayer(top); }
      else if (top && top.opts.cls === 'welcome') { e.preventDefault(); closeLayer(top); }
      return;
    }
    if (layers.length) {
      if (e.key === 'Tab') trapFocus(e, layers[layers.length - 1].el);
      return;
    }
    var m = document.querySelector('.stepmode');
    if (m && !/input|textarea|select/i.test((e.target.tagName || ''))) {
      var n = +m.dataset.n, total = +m.dataset.total;
      if (e.key === 'ArrowRight' && n < total) goStep(m.dataset.tid, n + 1);
      if (e.key === 'ArrowLeft' && n > 1) goStep(m.dataset.tid, n - 1);
    }
  }
  function trapFocus(e, box) {
    var f = [].filter.call(box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ======================= start ======================= */
  // Pinned supabase-js build, loaded only when Supabase keys are set in config.js.
  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';
  function hasBackend() { return !!(String(CFG.supabaseUrl || '').trim() && String(CFG.supabaseAnonKey || '').trim()); }
  function loadBackend() {
    if (!hasBackend() || (window.supabase && window.supabase.createClient)) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CFG.supabaseJs || SUPABASE_JS;
      s.crossOrigin = 'anonymous';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('supabase-js failed to load')); };
      document.head.appendChild(s);
    });
  }

  function createStore() {
    var url = String(CFG.supabaseUrl || '').trim(), key = String(CFG.supabaseAnonKey || '').trim();
    if (url && key) {
      if (!window.GEPSupabaseStore) throw new Error('store-supabase.js missing');
      return window.GEPSupabaseStore.create({ supabaseUrl: url, supabaseAnonKey: key });
    }
    return window.GEPDemoStore.create();
  }

  function fatal(msg) {
    $root.innerHTML = '<main class="page"><div class="empty-box" role="alert"><strong>GEP Help</strong><p>' + esc(msg) + '</p>' +
      '<button type="button" class="btn" onclick="location.reload()">' + esc(I.ready ? t('state.retry') : 'Cuba lagi / Retry') + '</button></div></main>';
  }

  function start() {
    $root = document.getElementById('app');
    $layer = document.getElementById('layers');
    $toast = document.getElementById('toast');
    I.set(I.detect(), false);
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey);
    window.addEventListener('online', function () { if (st.offline || st.loadError) refresh(); });
    I.load().then(function () {
      return loadBackend().catch(function (e) { fatal(t('err.backendLoad')); e.shown = true; throw e; });
    }).then(function () {
      try { S = createStore(); } catch (e) { fatal(t('err.config')); e.shown = true; throw e; }
      app.S = S;
      render();
      var authKick = false;
      S.onAuth(function (evt) {
        if (evt === 'recovery') { openNewPassword(true); return; }
        if (evt === 'confirmed') { toast(t('auth.confirmed')); }
        if (me() && me().bahasa && me().bahasa !== I.lang && (evt === 'signed-in' || evt === 'confirmed')) I.set(me().bahasa, true);
        if (authKick) { st.loading = st.loading && !st.cat; refresh(); }
      });
      var hashErr = /error_description=([^&]+)/.exec(location.hash);
      return S.init().then(function () {
        authKick = true;
        if (me() && me().bahasa && !U.local.get('gep_lang', '')) I.set(me().bahasa, true);
        else if (me() && me().bahasa && me().bahasa !== I.lang) I.set(me().bahasa, true);
        if (hashErr) { toast(t('auth.linkExpired'), 'err'); history.replaceState(null, '', location.pathname + '#/'); }
        else if (/^#(access_token|type=)/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/');
        return refresh();
      }).then(function () {
        if (!U.local.get('gep_welcome_seen', 0) && parseRoute().name === 'home') openWelcome();
      });
    }).catch(function (e) {
      console.error(e);
      if (e && e.shown) return;
      if (!S) fatal(I.ready ? t('err.config') : 'Tidak dapat memuatkan GEP Help. Semak sambungan internet. / Could not load GEP Help. Check your connection.');
      else { st.loading = false; st.loadError = e; render(); }
    });
    window.addEventListener('hashchange', function () {
      if (layers.length && !backPending) closeAllLayers();
      render();
    });
    var secure = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if ('serviceWorker' in navigator && secure && !CFG.noServiceWorker) {
      window.addEventListener('load', function () {
        try { navigator.serviceWorker.register('sw.js').catch(function () { /* not available here */ }); } catch (e) { /* not available here */ }
      });
    }
  }

  window.GEPApp = app;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
