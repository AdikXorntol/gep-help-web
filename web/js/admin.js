/* GEP Help: admin panel (#/admin). Content CRUD for admin + editor; inbox, users and settings for admin. */
(function () {
  'use strict';
  var app = window.GEPApp, U = window.GEPU, I = window.GEPI, t = I.t, esc = U.esc, svg = U.svg;
  var H = app.helpers, st = app.st;
  function S() { return app.S; }

  var adm = { filter: 'semua', inbox: null, inboxTab: 'soalan', users: null, orphans: null, ftab: 'ms', loadingInbox: false, loadingUsers: false };
  var VERSION = '1.0.0';

  function langComplete(tu, lang) {
    if (!String(tu['tajuk_' + lang] || '').trim()) return false;
    if (String(tu.ringkasan_ms || tu.ringkasan_en || '').trim() && !String(tu['ringkasan_' + lang] || '').trim()) return false;
    return (st.steps[tu.id] || []).every(function (l) { return String(l['teks_' + lang] || '').trim(); });
  }
  function trChips(tu) {
    return ['ms', 'en'].map(function (l) {
      var ok = langComplete(tu, l);
      return '<span class="tr ' + (ok ? 'ok' : 'no') + '" title="' + esc(t(ok ? 'admin.trDone' : 'admin.trMissing')) + '">' + (l === 'ms' ? 'BM' : 'EN') + ' ' + (ok ? '✓' : '✗') + '</span>';
    }).join('');
  }
  function statusChip(s) { return '<span class="st-chip s-' + esc(s) + '">' + esc(t('status.' + s)) + '</span>'; }

  function shell(active, body) {
    var tabs = [['kandungan', '#/admin', 'list', 'admin.tabContent']];
    if (H.isAdmin()) tabs.push(['kotak', '#/admin/kotak', 'inbox', 'admin.tabInbox'], ['pengguna', '#/admin/pengguna', 'users', 'admin.tabUsers'], ['tetapan', '#/admin/tetapan', 'gear', 'admin.tabSettings']);
    var badge = '';
    if (adm.inbox) {
      var n = adm.inbox.soalan.filter(function (q) { return !q.jawapan; }).length +
        adm.inbox.cadangan.filter(function (c) { return c.status === 'baru'; }).length +
        adm.inbox.laporan.filter(function (c) { return c.status === 'baru'; }).length;
      if (n) badge = '<span class="badge" aria-label="' + esc(I.tn('admin.newCount', n)) + '">' + n + '</span>';
    }
    return app.topbar('#/', esc(t('admin.panel'))) + '<main class="page admin">' + app.banners() +
      '<div class="adm-head"><h1 class="page-h">' + esc(t('admin.panel')) + '</h1><span class="role-chip r-' + esc(H.role()) + '">' + esc(t('role.' + H.role())) + '</span></div>' +
      '<nav class="tabs" aria-label="' + esc(t('admin.panel')) + '">' + tabs.map(function (x) {
        return '<a href="' + x[1] + '"' + (x[0] === active ? ' aria-current="page"' : '') + '>' + svg(x[2]) + '<span>' + esc(t(x[3])) + '</span>' + (x[0] === 'kotak' ? badge : '') + '</a>';
      }).join('') + '</nav>' + body + '</main>';
  }

  function gate() {
    if (st.loading) return app.topbar('#/', '') + '<main class="page">' + app.loadingBox() + '</main>';
    if (!H.me()) return app.topbar('#/', esc(t('admin.panel'))) + '<main class="page"><h1 class="page-h">' + esc(t('admin.panel')) + '</h1>' +
      app.emptyBox(t('admin.signInTitle'), t('admin.signInBody'), '<button type="button" class="btn primary" data-act="login">' + esc(t('auth.signIn')) + '</button>') + '</main>';
    if (!H.isEditor()) return app.topbar('#/', esc(t('admin.panel'))) + '<main class="page"><h1 class="page-h">' + esc(t('admin.panel')) + '</h1>' +
      app.emptyBox(t('err.permission'), t('admin.noAccess'), '<a class="btn" href="#/">' + esc(t('nav.home')) + '</a>') + '</main>';
    if (st.loadError) return shell('', app.errorBox(st.loadError));
    return '';
  }

  app.routes.admin = function (r) {
    var g = gate();
    if (g) return g;
    var sub = r.parts[1] || '';
    if (sub === 't') return viewTutorialEditor(r);
    if (sub && !H.isAdmin()) return shell('', app.emptyBox(t('err.permission'), t('admin.adminOnly')));
    if (sub === 'kotak') return shell('kotak', viewInbox());
    if (sub === 'pengguna') return shell('pengguna', viewUsers());
    if (sub === 'tetapan') return shell('tetapan', viewSettings());
    return shell('kandungan', viewContent());
  };
  app.after.admin = function (r) {
    if (!H.isEditor()) return;
    initSortables(document.getElementById('app'));
    var sub = r.parts[1] || '';
    var staleInbox = !adm.inboxAt || Date.now() - adm.inboxAt > 15000;
    if (H.isAdmin() && !adm.loadingInbox && (!adm.inbox || (sub === 'kotak' && staleInbox))) loadInbox();
    if (sub === 'pengguna' && H.isAdmin() && !adm.users && !adm.loadingUsers) loadUsers();
  };
  function loadInbox() {
    adm.loadingInbox = true;
    S().listInbox().then(function (x) { adm.inbox = x; adm.inboxAt = Date.now(); adm.inboxErr = null; }, function (e) { adm.inboxErr = e; }).then(function () {
      adm.loadingInbox = false;
      if (st.route && st.route.name === 'admin') app.render();
    });
  }
  function loadUsers() {
    adm.loadingUsers = true;
    S().listUsers().then(function (x) { adm.users = x; adm.usersErr = null; }, function (e) { adm.usersErr = e; }).then(function () {
      adm.loadingUsers = false;
      if (st.route && st.route.name === 'admin') app.render();
    });
  }
  // Signing in as someone else must not show the previous person's admin data.
  app.beforeRefresh = function () {
    var who = H.me() ? H.me().id : '';
    if (adm.who !== who) { adm.who = who; adm.inbox = null; adm.inboxErr = null; adm.users = null; adm.usersErr = null; adm.orphans = null; }
  };

  /* ======================= content ======================= */
  function viewContent() {
    var prods = st.cat.produk;
    var h = '<div class="seg filters" role="group" aria-label="' + esc(t('admin.filter')) + '">' +
      [['semua', 'admin.fAll'], ['draf', 'admin.fDraft'], ['en', 'admin.fNoEn']].map(function (f) {
        return '<button type="button" data-act="adm-filter" data-f="' + f[0] + '" aria-pressed="' + (adm.filter === f[0]) + '">' + esc(t(f[1])) + '</button>';
      }).join('') + '</div>';
    if (!prods.length) h += app.emptyBox(t('home.noProducts'), H.isAdmin() ? t('home.noProductsAdmin') : '');
    prods.forEach(function (p, pi) {
      var all = st.tutsOf[p.id] || [];
      var list = all.filter(function (tu) {
        if (adm.filter === 'draf') return tu.status === 'draf';
        if (adm.filter === 'en') return !langComplete(tu, 'en');
        return true;
      });
      h += '<section class="adm-prod" aria-labelledby="ap-' + esc(p.id) + '"><div class="adm-prod-head">' + H.patch(p, 'sm') +
        '<div class="grow"><h2 id="ap-' + esc(p.id) + '">' + esc(H.txt(p, 'nama')) + '</h2><span class="muted">' + esc(I.tn('product.count', all.length)) + '</span></div>' +
        (H.isAdmin() ? '<div class="tools">' +
          '<button type="button" class="mini icon" data-act="adm-prod-move" data-id="' + esc(p.id) + '" data-dir="-1" aria-label="' + esc(t('admin.moveUp')) + '"' + (pi === 0 ? ' disabled' : '') + '>' + svg('up') + '</button>' +
          '<button type="button" class="mini icon" data-act="adm-prod-move" data-id="' + esc(p.id) + '" data-dir="1" aria-label="' + esc(t('admin.moveDown')) + '"' + (pi === prods.length - 1 ? ' disabled' : '') + '>' + svg('down') + '</button>' +
          '<button type="button" class="mini" data-act="adm-prod-edit" data-id="' + esc(p.id) + '">' + svg('edit') + esc(t('admin.edit')) + '</button>' +
          '<button type="button" class="mini icon danger" data-act="adm-prod-del" data-id="' + esc(p.id) + '" aria-label="' + esc(t('admin.deleteProduct')) + '">' + svg('trash') + '</button></div>' : '') +
        '</div>';
      if (!list.length) h += '<p class="muted adm-none">' + esc(all.length ? t('admin.noneFiltered') : t('product.empty')) + '</p>';
      else {
        var sortable = adm.filter === 'semua';
        h += '<ol class="adm-list"' + (sortable ? ' data-sortable="tutorial"' : '') + '>' + list.map(function (tu, i) {
          var p2 = H.pick(tu, 'tajuk');
          return '<li data-id="' + esc(tu.id) + '">' +
            (sortable ? '<button type="button" class="grip" aria-label="' + esc(t('admin.drag')) + '" title="' + esc(t('admin.drag')) + '">' + svg('grip') + '</button>' : '') +
            '<a class="adm-row" href="#/admin/t/' + esc(tu.id) + '"><span class="l-title">' + esc(p2.text) + '</span>' +
            '<span class="chips">' + statusChip(tu.status) + trChips(tu) + '<span>' + esc(I.tn('tutorial.stepCount', (st.steps[tu.id] || []).length)) + '</span></span></a>' +
            (sortable ? '<span class="updown"><button type="button" class="mini icon" data-act="adm-tut-move" data-id="' + esc(tu.id) + '" data-dir="-1" aria-label="' + esc(t('admin.moveUp')) + '"' + (i === 0 ? ' disabled' : '') + '>' + svg('up') + '</button>' +
              '<button type="button" class="mini icon" data-act="adm-tut-move" data-id="' + esc(tu.id) + '" data-dir="1" aria-label="' + esc(t('admin.moveDown')) + '"' + (i === list.length - 1 ? ' disabled' : '') + '>' + svg('down') + '</button></span>' : '') +
            '</li>';
        }).join('') + '</ol>';
      }
      h += '<a class="add-btn" href="#/admin/t/baru?p=' + esc(p.id) + '">' + svg('plus') + esc(t('admin.addTutorial')) + '</a></section>';
    });
    if (H.isAdmin()) h += '<button type="button" class="add-btn strong" data-act="adm-prod-edit">' + svg('plus') + esc(t('admin.addProduct')) + '</button>';
    if (H.role() === 'editor') h += '<p class="note-box">' + svg('info') + esc(t('admin.editorNote')) + '</p>';
    return h;
  }
  app.ACT['adm-filter'] = function (el) { adm.filter = el.dataset.f; app.render(); };

  function moveIn(list, id, dir) {
    var ids = list.map(function (x) { return x.id; });
    var i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return null;
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    return ids;
  }
  function applyOrder(table, ids) {
    var map = table === 'produk' ? st.prod : table === 'tutorial' ? st.tut : null;
    ids.forEach(function (id, i) {
      var row = map ? map[id] : null;
      if (!row && table === 'langkah') Object.keys(st.steps).forEach(function (k) { st.steps[k].forEach(function (l) { if (l.id === id) row = l; }); });
      if (row) row.susunan = i + 1;
    });
    function bySus(a, b) { return a.susunan - b.susunan; }
    st.cat.produk.sort(bySus);
    Object.keys(st.tutsOf).forEach(function (k) { st.tutsOf[k].sort(bySus); });
    Object.keys(st.steps).forEach(function (k) { st.steps[k].sort(bySus); });
    st.cat.tutorial.sort(bySus);
    app.render();
    return S().reorder(table, ids).then(function () {
      return (table !== 'produk' ? app.refresh() : Promise.resolve()).then(function () { app.toast(t('admin.orderSaved')); });
    }, function (e) { app.toast(H.errText(e), 'err'); return app.refresh(); });
  }
  app.ACT['adm-prod-move'] = function (el) { var ids = moveIn(st.cat.produk, el.dataset.id, +el.dataset.dir); if (ids) applyOrder('produk', ids); };
  app.ACT['adm-tut-move'] = function (el) {
    var tu = st.tut[el.dataset.id]; if (!tu) return;
    var ids = moveIn(st.tutsOf[tu.produk_id], tu.id, +el.dataset.dir); if (ids) applyOrder('tutorial', ids);
  };
  app.ACT['adm-step-move'] = function (el) {
    var tid = el.dataset.tid;
    var ids = moveIn(st.steps[tid] || [], el.dataset.id, +el.dataset.dir); if (ids) applyOrder('langkah', ids);
  };

  /* ---------- drag to reorder (pointer events, works with touch) ---------- */
  function initSortables(root) {
    root.querySelectorAll('[data-sortable]').forEach(function (list) {
      if (list.dataset.bound) return;
      list.dataset.bound = '1';
      list.addEventListener('pointerdown', function (e) {
        var grip = e.target.closest('.grip');
        if (!grip || !list.contains(grip) || e.button > 0) return;
        var item = grip.closest('[data-id]');
        var items = [].slice.call(list.children);
        var idx = items.indexOf(item);
        if (idx < 0) return;
        e.preventDefault();
        try { grip.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        var rects = items.map(function (n) { return n.getBoundingClientRect(); });
        var y0 = e.clientY, target = idx;
        var gap = items.length > 1 ? Math.abs(rects[1].top - rects[0].bottom) : 0;
        var step = rects[idx].height + gap;
        item.classList.add('dragging');
        function move(ev) {
          var dy = ev.clientY - y0;
          item.style.transform = 'translateY(' + dy + 'px)';
          var c = rects[idx].top + rects[idx].height / 2 + dy;
          target = idx;
          for (var i = 0; i < rects.length; i++) {
            var mid = rects[i].top + rects[i].height / 2;
            if (i > idx && c > mid) target = i;
            if (i < idx && c < mid && target === idx) target = i;
          }
          items.forEach(function (n, i) {
            if (n === item) return;
            var shift = 0;
            if (target > idx && i > idx && i <= target) shift = -step;
            if (target < idx && i >= target && i < idx) shift = step;
            n.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
          });
        }
        function up() {
          grip.removeEventListener('pointermove', move);
          grip.removeEventListener('pointerup', up);
          grip.removeEventListener('pointercancel', up);
          items.forEach(function (n) { n.style.transform = ''; });
          item.classList.remove('dragging');
          if (target !== idx) {
            var ids = items.map(function (n) { return n.dataset.id; });
            ids.splice(target, 0, ids.splice(idx, 1)[0]);
            applyOrder(list.dataset.sortable, ids);
          }
        }
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
        grip.addEventListener('pointercancel', up);
      });
    });
  }

  /* ---------- products ---------- */
  app.ACT['adm-prod-edit'] = function (el) {
    var p = el.dataset.id ? st.prod[el.dataset.id] : null;
    var ltab = 'ms';
    var color = p ? p.warna : U.SWATCHES[(st.cat.produk.length) % U.SWATCHES.length];
    app.sheet({
      title: p ? t('admin.editProduct') : t('admin.addProduct'),
      body: function () {
        return '<form data-form="adm-prod" data-id="' + esc(p ? p.id : '') + '" novalidate>' +
          '<div class="field"><label for="pr-kod">' + esc(t('admin.code')) + '</label><input id="pr-kod" name="kod" maxlength="6" autocapitalize="characters" value="' + esc(p ? p.kod : '') + '" required><small class="hint">' + esc(t('admin.codeHint')) + '</small></div>' +
          langTabs('pr', ltab) +
          ['ms', 'en'].map(function (l) {
            return '<div class="lpane" data-lp="pr-' + l + '"' + (l !== ltab ? ' hidden' : '') + '>' +
              '<div class="field"><label for="pr-nama-' + l + '">' + esc(t('admin.productName')) + ' (' + (l === 'ms' ? 'BM' : 'EN') + ')' + (l === 'ms' ? ' *' : '') + '</label><input id="pr-nama-' + l + '" name="nama_' + l + '" maxlength="60" value="' + esc(p ? p['nama_' + l] : '') + '"' + (l === 'ms' ? ' required' : '') + '></div>' +
              '<div class="field"><label for="pr-ket-' + l + '">' + esc(t('admin.productDesc')) + ' (' + (l === 'ms' ? 'BM' : 'EN') + ')</label><textarea id="pr-ket-' + l + '" name="keterangan_' + l + '" rows="2" maxlength="200">' + esc(p ? p['keterangan_' + l] : '') + '</textarea></div>' +
              (l === 'en' ? '<small class="hint">' + esc(t('admin.enOptional')) + '</small>' : '') + '</div>';
          }).join('') +
          '<fieldset class="field"><legend>' + esc(t('admin.colour')) + '</legend><div class="swatches">' + U.SWATCHES.map(function (c) {
            return '<label class="sw" style="background:' + c + '"><input type="radio" name="warna" value="' + c + '"' + (c.toUpperCase() === String(color).toUpperCase() ? ' checked' : '') + '><span class="vh">' + c + '</span></label>';
          }).join('') + '<label class="sw custom"><input type="radio" name="warna" value="custom"' + (U.SWATCHES.indexOf(String(color).toUpperCase()) < 0 ? ' checked' : '') + '><span>#</span></label>' +
          '<input id="pr-hex" name="hex" class="hex" maxlength="7" aria-label="' + esc(t('admin.customColour')) + '" value="' + esc(color) + '"></div></fieldset>' +
          '<p class="err" role="alert"></p><div class="btn-row"><button type="button" class="btn" data-act="close">' + esc(t('form.cancel')) + '</button><button type="submit" class="btn primary">' + esc(t('form.save')) + '</button></div></form>';
      }
    });
  };
  function langTabs(prefix, cur) {
    return '<div class="seg ltabs" role="tablist" aria-label="' + esc(t('lang.label')) + '">' + ['ms', 'en'].map(function (l) {
      return '<button type="button" role="tab" data-act="ltab" data-prefix="' + prefix + '" data-l="' + l + '" aria-selected="' + (l === cur) + '">' + (l === 'ms' ? 'BM' : 'EN') + '</button>';
    }).join('') + '</div>';
  }
  app.ACT.ltab = function (el) {
    var box = el.closest('form') || el.closest('.sheet') || document;
    var prefix = el.dataset.prefix, l = el.dataset.l;
    box.querySelectorAll('[data-act="ltab"][data-prefix="' + prefix + '"]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.l === l)); });
    box.querySelectorAll('[data-lp^="' + prefix + '-"]').forEach(function (p) { p.hidden = p.dataset.lp !== prefix + '-' + l; });
    if (prefix === 'ed') adm.ftab = l;
  };
  app.FORM['adm-prod'] = function (f) {
    var err = f.querySelector('.err');
    var kod = f.kod.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    var w = f.querySelector('input[name=warna]:checked');
    var warna = w && w.value !== 'custom' ? w.value : f.hex.value.trim();
    if (!/^[A-Z0-9]{1,6}$/.test(kod)) { err.textContent = t('admin.codeHint'); f.kod.focus(); return; }
    if (!f.nama_ms.value.trim()) { err.textContent = t('admin.needNameMs'); showPane(f, 'pr', 'ms'); f.nama_ms.focus(); return; }
    if (!/^#[0-9A-Fa-f]{6}$/.test(warna)) { err.textContent = t('admin.badColour'); f.hex.focus(); return; }
    var row = { kod: kod, nama_ms: f.nama_ms.value.trim(), nama_en: f.nama_en.value.trim(), keterangan_ms: f.keterangan_ms.value.trim(), keterangan_en: f.keterangan_en.value.trim(), warna: warna.toUpperCase() };
    if (f.dataset.id) row.id = f.dataset.id; else row.susunan = st.cat.produk.length + 1;
    var btn = f.querySelector('[type=submit]');
    H.busy(btn, true);
    S().saveProduk(row).then(function () {
      app.closeLayer(app.layerOf(f));
      return app.refresh().then(function () { app.toast(t('form.saved')); });
    }, function (e) { H.busy(btn, false); err.textContent = H.errText(e); });
  };
  function showPane(f, prefix, l) { var b = f.querySelector('[data-act="ltab"][data-prefix="' + prefix + '"][data-l="' + l + '"]'); if (b) app.ACT.ltab(b); }

  app.ACT['adm-prod-del'] = function (el) {
    var p = st.prod[el.dataset.id]; if (!p) return;
    var n = (st.tutsOf[p.id] || []).length;
    app.confirm({ title: t('admin.deleteProductQ', { name: H.txt(p, 'nama') }), body: n ? I.tn('admin.deleteProductBody', n) : '', yes: t('admin.delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      S().deleteProduk(p.id).then(function () { return app.refresh().then(function () { app.toast(t('form.deleted')); }); }, function (e) { app.toast(H.errText(e), 'err'); });
    });
  };

  /* ======================= tutorial editor ======================= */
  function viewTutorialEditor(r) {
    var id = r.parts[2];
    var isNew = id === 'baru';
    var tu = isNew ? null : st.tut[id];
    if (!isNew && !tu) return shell('kandungan', app.emptyBox(t('notfound.title'), t('notfound.body'), '<a class="btn" href="#/admin">' + esc(t('admin.back')) + '</a>'));
    var pid = tu ? tu.produk_id : (r.params.p && st.prod[r.params.p] ? r.params.p : (st.cat.produk[0] || {}).id);
    if (!pid) return shell('kandungan', app.emptyBox(t('home.noProducts'), H.isAdmin() ? t('home.noProductsAdmin') : t('admin.askAdmin')));
    var steps = tu ? (st.steps[tu.id] || []) : [];
    var canDelete = tu && (H.isAdmin() || (H.role() === 'editor' && tu.status === 'draf' && tu.dicipta_oleh === H.me().id));
    var lt = adm.ftab;
    var h = app.topbar('#/admin', esc(t('admin.panel'))) + '<main class="page admin">' + app.banners();
    h += '<div class="adm-head"><h1 class="page-h">' + esc(isNew ? t('admin.newTutorial') : t('admin.editTutorial')) + '</h1>' + (tu ? statusChip(tu.status) : statusChip('draf')) + '</div>';
    if (tu) h += '<p class="muted">' + trChips(tu) + '</p>';
    h += '<form class="box" data-form="adm-tut" data-id="' + esc(tu ? tu.id : '') + '" novalidate>' +
      '<div class="field"><label for="ed-produk">' + esc(t('suggest.product')) + '</label><select id="ed-produk" name="produk_id">' +
      st.cat.produk.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === pid ? ' selected' : '') + '>' + esc(H.txt(p, 'nama')) + '</option>'; }).join('') + '</select></div>' +
      langTabs('ed', lt) +
      ['ms', 'en'].map(function (l) {
        var L = l === 'ms' ? 'BM' : 'EN';
        return '<div class="lpane" data-lp="ed-' + l + '"' + (l !== lt ? ' hidden' : '') + '>' +
          '<div class="field"><label for="ed-tajuk-' + l + '">' + esc(t('admin.title')) + ' (' + L + ')' + (l === 'ms' ? ' *' : '') + '</label><input id="ed-tajuk-' + l + '" name="tajuk_' + l + '" maxlength="120" value="' + esc(tu ? tu['tajuk_' + l] : '') + '"></div>' +
          '<div class="field"><label for="ed-ring-' + l + '">' + esc(t('admin.summary')) + ' (' + L + ')</label><textarea id="ed-ring-' + l + '" name="ringkasan_' + l + '" rows="3" maxlength="400">' + esc(tu ? tu['ringkasan_' + l] : '') + '</textarea></div>' +
          '<div class="field"><label for="ed-vid-' + l + '">' + esc(t('admin.videoLink')) + ' (' + L + ')</label><input id="ed-vid-' + l + '" name="video_url_' + l + '" type="url" inputmode="url" placeholder="https://youtu.be/..." value="' + esc(tu ? tu['video_url_' + l] : '') + '">' +
          '<small class="hint" id="ed-vid-' + l + '-hint">' + esc(l === 'ms' ? t('admin.videoHint') : t('admin.videoHintEn')) + '</small></div>' +
          (l === 'en' ? '<small class="hint">' + esc(t('admin.enOptional')) + '</small>' : '') + '</div>';
      }).join('') +
      '<p class="err" role="alert"></p>' +
      (H.role() === 'editor' ? '<p class="note-box">' + svg('info') + esc(t('admin.editorSaveNote')) + '</p>' : '') +
      '<div class="btn-row wrap"><button type="submit" class="btn primary" data-intent="save">' + esc(t('form.save')) + '</button>' +
      (H.isAdmin() ? (tu && tu.status === 'terbit'
        ? '<button type="submit" class="btn" data-intent="draf">' + esc(t('admin.unpublish')) + '</button>'
        : '<button type="submit" class="btn ok" data-intent="terbit">' + svg('check') + esc(t('admin.publish')) + '</button>') : '') +
      '</div></form>';

    if (tu) {
      h += '<section class="box"><div class="box-head"><h2>' + svg('steps', 'h-ic') + esc(t('admin.steps')) + '</h2>' +
        '<a class="mini" href="#/t/' + esc(tu.id) + '">' + svg('eye') + esc(t('admin.preview')) + '</a></div>';
      if (!steps.length) h += '<p class="muted">' + esc(t('admin.noSteps')) + '</p>';
      else {
        h += '<ol class="adm-steps" data-sortable="langkah">' + steps.map(function (l, i) {
          var en = String(l.teks_en || '').trim();
          return '<li data-id="' + esc(l.id) + '"><button type="button" class="grip" aria-label="' + esc(t('admin.drag')) + '">' + svg('grip') + '</button>' +
            '<span class="step-num" aria-hidden="true">' + (i + 1) + '</span>' +
            (l.gambar_path ? '<span class="st-thumb"><span class="shot-in"><img src="' + esc(S().imageUrl(l.gambar_path)) + '" alt="" loading="lazy">' + U.markersHtml(l.penanda) + '</span></span>' : '<span class="st-thumb none">' + svg('image') + '</span>') +
            '<span class="grow"><span class="st-text">' + esc(l.teks_ms) + '</span><span class="chips"><span class="tr ' + (en ? 'ok' : 'no') + '">EN ' + (en ? '✓' : '✗') + '</span>' +
            (l.penanda.length ? '<span>' + esc(I.tn('admin.markerCount', l.penanda.length)) + '</span>' : '') + '</span></span>' +
            '<span class="tools">' +
            '<button type="button" class="mini icon" data-act="adm-step-move" data-tid="' + esc(tu.id) + '" data-id="' + esc(l.id) + '" data-dir="-1" aria-label="' + esc(t('admin.moveUp')) + '"' + (i === 0 ? ' disabled' : '') + '>' + svg('up') + '</button>' +
            '<button type="button" class="mini icon" data-act="adm-step-move" data-tid="' + esc(tu.id) + '" data-id="' + esc(l.id) + '" data-dir="1" aria-label="' + esc(t('admin.moveDown')) + '"' + (i === steps.length - 1 ? ' disabled' : '') + '>' + svg('down') + '</button>' +
            '<button type="button" class="mini" data-act="adm-step-edit" data-tid="' + esc(tu.id) + '" data-id="' + esc(l.id) + '">' + svg('edit') + esc(t('admin.edit')) + '</button>' +
            '<button type="button" class="mini icon danger" data-act="adm-step-del" data-tid="' + esc(tu.id) + '" data-id="' + esc(l.id) + '" aria-label="' + esc(t('admin.deleteStep', { n: i + 1 })) + '">' + svg('trash') + '</button>' +
            '</span></li>';
        }).join('') + '</ol>';
      }
      h += '<button type="button" class="add-btn" data-act="adm-step-edit" data-tid="' + esc(tu.id) + '">' + svg('plus') + esc(t('admin.addStep')) + '</button></section>';
      if (canDelete) h += '<p class="foot"><button type="button" class="linkish danger" data-act="adm-tut-del" data-id="' + esc(tu.id) + '">' + svg('trash') + esc(t('admin.deleteTutorial')) + '</button></p>';
    } else {
      h += '<p class="note-box">' + svg('info') + esc(t('admin.saveFirst')) + '</p>';
    }
    return h + '</main>';
  }

  var submitIntent = 'save';
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button[type=submit][data-intent]');
    if (b) submitIntent = b.dataset.intent;
  }, true);

  app.FORM['adm-tut'] = function (f) {
    var err = f.querySelector('.err');
    var intent = submitIntent; submitIntent = 'save';
    var row = { produk_id: f.produk_id.value };
    ['ms', 'en'].forEach(function (l) {
      row['tajuk_' + l] = f['tajuk_' + l].value.trim();
      row['ringkasan_' + l] = f['ringkasan_' + l].value.trim();
      var v = f['video_url_' + l].value.trim();
      if (v && !U.ytId(v)) row.badVideo = l;
      row['video_url_' + l] = v ? U.ytNormalize(v) : '';
    });
    if (!row.tajuk_ms) { err.textContent = t('admin.needTitleMs'); showPane(f, 'ed', 'ms'); f.tajuk_ms.focus(); return; }
    if (row.badVideo) { err.textContent = t('video.invalid'); showPane(f, 'ed', row.badVideo); f['video_url_' + row.badVideo].focus(); return; }
    delete row.badVideo;
    var id = f.dataset.id;
    if (id) row.id = id;
    else row.susunan = (st.tutsOf[row.produk_id] || []).length + 1;
    if (intent === 'terbit' || intent === 'draf') row.status = intent;
    else if (!id) row.status = 'draf';
    var btns = f.querySelectorAll('[type=submit]');
    btns.forEach(function (b) { H.busy(b, true); });
    var wasPublished = id && st.tut[id] && st.tut[id].status === 'terbit';
    S().saveTutorial(row).then(function (saved) {
      var msg = intent === 'terbit' ? t('admin.published') : intent === 'draf' ? t('admin.unpublished') : t('form.saved');
      if (H.role() === 'editor' && wasPublished && saved.status === 'draf') msg = t('admin.editorBackToDraft');
      return app.refresh().then(function () {
        if (!id) app.nav('#/admin/t/' + saved.id, true);
        app.toast(msg);
      });
    }, function (e) {
      btns.forEach(function (b) { H.busy(b, false); });
      err.textContent = H.errText(e);
    });
  };
  app.onInput = function (e) {
    var m = /^ed-vid-(ms|en)$/.exec(e.target.id || '');
    if (!m) return;
    var hint = document.getElementById(e.target.id + '-hint');
    var v = e.target.value.trim();
    if (!hint) return;
    if (!v) { hint.textContent = m[1] === 'ms' ? t('admin.videoHint') : t('admin.videoHintEn'); hint.className = 'hint'; }
    else if (U.ytId(v)) { hint.textContent = t('admin.videoOk', { id: U.ytId(v) }); hint.className = 'hint ok'; }
    else { hint.textContent = t('video.invalid'); hint.className = 'hint bad'; }
  };

  app.ACT['adm-tut-del'] = function (el) {
    var tu = st.tut[el.dataset.id]; if (!tu) return;
    app.confirm({ title: t('admin.deleteTutorialQ', { name: H.txt(tu, 'tajuk') }), body: t('admin.deleteTutorialBody'), yes: t('admin.delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      S().deleteTutorial(tu.id).then(function () { return app.refresh().then(function () { app.nav('#/admin', true); app.toast(t('form.deleted')); }); }, function (e) { app.toast(H.errText(e), 'err'); });
    });
  };

  /* ---------- step editor ---------- */
  app.ACT['adm-step-edit'] = function (el) {
    var tid = el.dataset.tid;
    var steps = st.steps[tid] || [];
    var orig = el.dataset.id ? steps.filter(function (l) { return l.id === el.dataset.id; })[0] : null;
    var num = orig ? steps.indexOf(orig) + 1 : steps.length + 1;
    var s = {
      teks_ms: orig ? orig.teks_ms : '', teks_en: orig ? orig.teks_en : '',
      path: orig ? orig.gambar_path : '', marks: orig ? U.cleanMarkers(orig.penanda) : [],
      img: null, tool: 'o', sel: -1, ltab: adm.ftab, busy: '', err: ''
    };
    function imgUrl() { return s.img ? s.img.url : (s.path ? S().imageUrl(s.path) : ''); }
    var L = app.sheet({
      title: function () { return t('admin.stepN', { n: num }); },
      wide: true, dismiss: false,
      body: function () {
        var url = imgUrl();
        var h = '<form data-form="adm-step" novalidate>';
        if (url) {
          var selM = s.marks[s.sel];
          h += '<div class="mk-tools" role="toolbar" aria-label="' + esc(t('admin.markers')) + '">' +
            '<button type="button" class="mini" data-act="mk-tool" data-tool="o" aria-pressed="' + (s.tool === 'o') + '">' + svg('circle') + esc(t('admin.circle')) + '</button>' +
            '<button type="button" class="mini" data-act="mk-tool" data-tool="a" aria-pressed="' + (s.tool === 'a') + '">' + svg('arrow') + esc(t('admin.arrow')) + '</button>' +
            (selM && selM.t === 'o' ? '<button type="button" class="mini icon" data-act="mk-size" data-d="-2" aria-label="' + esc(t('admin.smaller')) + '">−</button><button type="button" class="mini icon" data-act="mk-size" data-d="2" aria-label="' + esc(t('admin.bigger')) + '">+</button>' : '') +
            (selM && selM.t === 'a' ? '<button type="button" class="mini" data-act="mk-rotate">' + svg('rotate') + esc(t('admin.rotate')) + '</button>' : '') +
            (selM ? '<button type="button" class="mini danger" data-act="mk-del">' + svg('trash') + esc(t('admin.removeMarker')) + '</button>' : '') +
            '</div>' +
            '<p class="hint">' + esc(t('admin.markerHint')) + '</p>' +
            '<div class="mk-stage-wrap"><span class="shot-in mk-stage" data-act="mk-tap" role="application" aria-label="' + esc(t('admin.markerArea')) + '"><img src="' + esc(url) + '" alt="' + esc(t('admin.stepImage')) + '" draggable="false">' + U.markersHtml(s.marks, s.sel) + '</span></div>' +
            '<div class="foot-actions"><label class="btn file-btn">' + svg('upload') + esc(t('admin.changeImage')) + '<input type="file" accept="image/*" data-pick="step" class="vh"></label>' +
            '<button type="button" class="btn" data-act="mk-noimg">' + svg('trash') + esc(t('admin.removeImage')) + '</button></div>';
        } else {
          h += '<label class="drop">' + svg('image') + '<b>' + esc(t('admin.pickImage')) + '</b><small>' + esc(t('admin.pickImageHint')) + '</small><input type="file" accept="image/*" data-pick="step" class="vh"></label>';
        }
        if (s.busy) h += '<p class="busy-line" role="status">' + esc(s.busy) + '</p>';
        h += langTabs('st', s.ltab) + ['ms', 'en'].map(function (l) {
          return '<div class="lpane" data-lp="st-' + l + '"' + (l !== s.ltab ? ' hidden' : '') + '><div class="field"><label for="st-teks-' + l + '">' + esc(t('admin.stepText')) + ' (' + (l === 'ms' ? 'BM' : 'EN') + ')' + (l === 'ms' ? ' *' : '') + '</label>' +
            '<textarea id="st-teks-' + l + '" name="teks_' + l + '" rows="3" maxlength="500" placeholder="' + esc(t('admin.stepTextPh')) + '">' + esc(s['teks_' + l]) + '</textarea></div>' +
            (l === 'en' ? '<small class="hint">' + esc(t('admin.enOptional')) + '</small>' : '') + '</div>';
        }).join('') +
          '<p class="err" role="alert">' + esc(s.err) + '</p><div class="btn-row"><button type="button" class="btn" data-act="close">' + esc(t('form.cancel')) + '</button>' +
          '<button type="submit" class="btn primary"' + (s.busy ? ' disabled' : '') + '>' + esc(t('form.save')) + '</button></div></form>';
        return h;
      },
      onClose: function () { if (s.img) { try { URL.revokeObjectURL(s.img.url); } catch (e) { /* ignore */ } } }
    });
    function keepText() {
      var f = L.el.querySelector('form');
      if (!f) return;
      s.teks_ms = f.teks_ms.value; s.teks_en = f.teks_en.value;
      var sel = L.el.querySelector('[data-act="ltab"][aria-selected="true"]');
      if (sel) s.ltab = sel.dataset.l;
    }
    function paint() {
      var f = L.el.querySelector('form');
      if (f) keepText();
      var body = L.el.querySelector('.sheet');
      var scroll = body ? body.scrollTop : 0;
      L.el.innerHTML = L.opts.render(L);
      var b2 = L.el.querySelector('.sheet'); if (b2) b2.scrollTop = scroll;
    }
    L.paint = paint;
    L.step = {
      state: s, tid: tid, orig: orig, num: num,
      tap: function (e, stage) {
        var mk = e.target.closest('[data-mk]');
        if (mk) { s.sel = +mk.dataset.mk; paint(); return; }
        var r = stage.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
        if (s.marks.length >= 20) { s.err = t('admin.tooManyMarkers'); paint(); return; }
        s.marks.push(s.tool === 'o' ? { t: 'o', x: x, y: y, r: 12 } : { t: 'a', x: x, y: y, d: 135 });
        s.marks = U.cleanMarkers(s.marks);
        s.sel = s.marks.length - 1; s.err = '';
        paint();
      },
      pick: function (file) {
        s.busy = t('admin.compressing'); s.err = ''; paint();
        U.compressImage(file).then(function (img) {
          if (s.img) { try { URL.revokeObjectURL(s.img.url); } catch (e) { /* ignore */ } }
          img.url = URL.createObjectURL(img.blob);
          s.img = img; s.busy = '';
          if (!s.path) s.marks = [];
          s.sel = -1;
          paint();
        }, function () { s.busy = ''; s.err = t('err.image-decode'); paint(); });
      }
    };
  };
  function stepOf(el) { var L = app.layerOf(el); return L && L.step ? L : null; }
  app.ACT['mk-tap'] = function (el, e) { var L = stepOf(el); if (L) L.step.tap(e, el); };
  app.ACT['mk-tool'] = function (el) { var L = stepOf(el); if (!L) return; L.step.state.tool = el.dataset.tool; L.paint(); };
  app.ACT['mk-size'] = function (el) {
    var L = stepOf(el); if (!L) return; var s = L.step.state, m = s.marks[s.sel];
    if (m && m.t === 'o') { m.r = Math.max(3, Math.min(40, m.r + (+el.dataset.d))); L.paint(); }
  };
  app.ACT['mk-rotate'] = function (el) {
    var L = stepOf(el); if (!L) return; var s = L.step.state, m = s.marks[s.sel];
    if (m && m.t === 'a') { m.d = (m.d + 45) % 360; L.paint(); }
  };
  app.ACT['mk-del'] = function (el) {
    var L = stepOf(el); if (!L) return; var s = L.step.state;
    if (s.sel >= 0) { s.marks.splice(s.sel, 1); s.sel = -1; L.paint(); }
  };
  app.ACT['mk-noimg'] = function (el) {
    var L = stepOf(el); if (!L) return; var s = L.step.state;
    if (s.img) { try { URL.revokeObjectURL(s.img.url); } catch (e) { /* ignore */ } }
    s.img = null; s.path = ''; s.marks = []; s.sel = -1; L.paint();
  };
  document.addEventListener('change', function (e) {
    var inp = e.target;
    if (!inp.matches || !inp.matches('input[type=file][data-pick="step"]')) return;
    var L = stepOf(inp);
    if (L && inp.files && inp.files[0]) L.step.pick(inp.files[0]);
  });

  app.FORM['adm-step'] = function (f) {
    var L = stepOf(f); if (!L) return;
    var s = L.step.state, orig = L.step.orig, tid = L.step.tid;
    s.teks_ms = f.teks_ms.value; s.teks_en = f.teks_en.value;
    if (!s.teks_ms.trim()) { s.err = t('admin.needStepMs'); s.ltab = 'ms'; L.paint(); var ta = L.el.querySelector('#st-teks-ms'); if (ta) ta.focus(); return; }
    var oldPath = orig ? orig.gambar_path : '';
    var uploaded = '';
    s.busy = s.img ? t('admin.uploading') : t('admin.saving'); s.err = ''; L.paint();
    var up = s.img ? S().uploadImage(tid, s.img).then(function (p) { uploaded = p; return p; }) : Promise.resolve(s.path);
    up.then(function (path) {
      var row = { tutorial_id: tid, teks_ms: s.teks_ms.trim(), teks_en: s.teks_en.trim(), gambar_path: path || '', penanda: path ? U.cleanMarkers(s.marks) : [] };
      if (orig) row.id = orig.id; else row.susunan = (st.steps[tid] || []).length + 1;
      return S().saveLangkah(row).then(function () {
        if (oldPath && oldPath !== (path || '')) S().removeImages([oldPath]);
      }, function (e) {
        if (uploaded) S().removeImages([uploaded]);
        throw e;
      });
    }).then(function () {
      var wasPub = st.tut[tid] && st.tut[tid].status === 'terbit';
      s.img && (s.img.saved = true);
      app.closeLayer(L);
      return app.refresh().then(function () { app.toast(H.role() === 'editor' && wasPub ? t('admin.editorBackToDraft') : t('form.saved')); });
    }, function (e) {
      s.busy = ''; s.err = H.errText(e); L.paint();
    });
  };

  app.ACT['adm-step-del'] = function (el) {
    var steps = st.steps[el.dataset.tid] || [];
    var l = steps.filter(function (x) { return x.id === el.dataset.id; })[0];
    if (!l) return;
    app.confirm({ title: t('admin.deleteStepQ', { n: steps.indexOf(l) + 1 }), yes: t('admin.delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      S().deleteLangkah(l).then(function () { return app.refresh().then(function () { app.toast(t('form.deleted')); }); }, function (e) { app.toast(H.errText(e), 'err'); });
    });
  };

  /* ======================= inbox ======================= */
  function tutLink(tid) {
    var tu = st.tut[tid];
    return tu ? '<a href="#/t/' + esc(tid) + '">' + esc(H.txt(tu, 'tajuk')) + '</a>' : '<span class="muted">' + esc(t('admin.deletedTutorial')) + '</span>';
  }
  function viewInbox() {
    if (adm.inboxErr && !adm.inbox) return app.errorBox(adm.inboxErr);
    if (!adm.inbox) return app.loadingBox();
    var x = adm.inbox;
    var counts = {
      soalan: x.soalan.filter(function (q) { return !q.jawapan; }).length,
      cadangan: x.cadangan.filter(function (c) { return c.status === 'baru'; }).length,
      laporan: x.laporan.filter(function (c) { return c.status === 'baru'; }).length
    };
    var h = '<div class="seg" role="tablist" aria-label="' + esc(t('admin.tabInbox')) + '">' + ['soalan', 'cadangan', 'laporan'].map(function (k) {
      return '<button type="button" role="tab" data-act="inbox-tab" data-k="' + k + '" aria-selected="' + (adm.inboxTab === k) + '">' + esc(t('inbox.' + k)) + (counts[k] ? ' <span class="badge">' + counts[k] + '</span>' : '') + '</button>';
    }).join('') + '</div><div class="inbox-actions"><button type="button" class="mini" data-act="inbox-reload">' + svg('rotate') + esc(t('admin.reload')) + '</button></div>';
    var k = adm.inboxTab;
    var list = x[k].slice();
    if (k === 'soalan') list.sort(function (a, b) { return (a.jawapan ? 1 : 0) - (b.jawapan ? 1 : 0); });
    else list.sort(function (a, b) { return (a.status === 'baru' ? 0 : 1) - (b.status === 'baru' ? 0 : 1); });
    if (!list.length) return h + app.emptyBox(t('inbox.empty'), '');
    h += '<ul class="inbox">' + list.map(function (row) {
      var meta = '<span class="muted">' + esc(row.nama || t('qa.someone')) + ' · ' + esc(U.fmtDate(row.dicipta, I.lang)) + '</span>';
      if (k === 'soalan') {
        return '<li class="box"><p>' + tutLink(row.tutorial_id) + '</p><p class="qa-text">' + esc(row.teks) + '</p>' + meta +
          (row.jawapan ? '<div class="qa-a"><b>' + esc(t('qa.answer')) + '</b><p>' + esc(row.jawapan) + '</p></div>' : '<p class="qa-wait">' + esc(t('qa.unanswered')) + '</p>') +
          '<div class="qa-tools"><button type="button" class="mini" data-act="qa-answer" data-id="' + esc(row.id) + '">' + svg('send') + esc(row.jawapan ? t('qa.editAnswer') : t('qa.reply')) + '</button>' +
          '<button type="button" class="mini danger" data-act="qa-del" data-id="' + esc(row.id) + '">' + svg('trash') + esc(t('admin.delete')) + '</button></div></li>';
      }
      if (k === 'cadangan') {
        var p = row.produk_id && st.prod[row.produk_id];
        return '<li class="box"><p><b>' + esc(row.tajuk) + '</b> ' + statusChip(row.status) + '</p>' + (p ? '<p class="muted">' + esc(H.txt(p, 'nama')) + '</p>' : '') +
          (row.butiran ? '<p>' + esc(row.butiran) + '</p>' : '') + meta + '<div class="qa-tools">' +
          (row.status !== 'selesai' ? '<button type="button" class="mini" data-act="inbox-status" data-table="cadangan" data-id="' + esc(row.id) + '" data-s="selesai">' + svg('check') + esc(t('inbox.done')) + '</button>' : '') +
          (row.status !== 'ditolak' ? '<button type="button" class="mini" data-act="inbox-status" data-table="cadangan" data-id="' + esc(row.id) + '" data-s="ditolak">' + esc(t('inbox.reject')) + '</button>' : '') +
          (row.status !== 'baru' ? '<button type="button" class="mini" data-act="inbox-status" data-table="cadangan" data-id="' + esc(row.id) + '" data-s="baru">' + esc(t('inbox.reopen')) + '</button>' : '') +
          '<button type="button" class="mini danger" data-act="inbox-del" data-table="cadangan" data-id="' + esc(row.id) + '">' + svg('trash') + esc(t('admin.delete')) + '</button></div></li>';
      }
      return '<li class="box"><p>' + tutLink(row.tutorial_id) + ' ' + statusChip(row.status) + '</p><p><b>' + esc(t('report.k.' + row.jenis)) + '</b>' + (row.butiran ? ': ' + esc(row.butiran) : '') + '</p>' + meta +
        '<div class="qa-tools">' + (row.status === 'baru'
          ? '<button type="button" class="mini" data-act="inbox-status" data-table="laporan" data-id="' + esc(row.id) + '" data-s="selesai">' + svg('check') + esc(t('inbox.done')) + '</button>'
          : '<button type="button" class="mini" data-act="inbox-status" data-table="laporan" data-id="' + esc(row.id) + '" data-s="baru">' + esc(t('inbox.reopen')) + '</button>') +
        (st.tut[row.tutorial_id] ? '<a class="mini" href="#/admin/t/' + esc(row.tutorial_id) + '">' + svg('edit') + esc(t('admin.edit')) + '</a>' : '') +
        '<button type="button" class="mini danger" data-act="inbox-del" data-table="laporan" data-id="' + esc(row.id) + '">' + svg('trash') + esc(t('admin.delete')) + '</button></div></li>';
    }).join('') + '</ul>';
    return h;
  }
  app.inboxQ = function (id) { return adm.inbox ? adm.inbox.soalan.filter(function (q) { return q.id === id; })[0] : null; };
  app.onInboxChange = function (row, deletedId) {
    if (!adm.inbox) return;
    if (row) adm.inbox.soalan = adm.inbox.soalan.map(function (q) { return q.id === row.id ? row : q; });
    if (deletedId) adm.inbox.soalan = adm.inbox.soalan.filter(function (q) { return q.id !== deletedId; });
  };
  app.ACT['inbox-tab'] = function (el) { adm.inboxTab = el.dataset.k; app.render(); };
  app.ACT['inbox-reload'] = function () { adm.inbox = null; app.render(); loadInbox(); };
  app.ACT['inbox-status'] = function (el) {
    H.busy(el, true);
    S().setStatus(el.dataset.table, el.dataset.id, el.dataset.s).then(function (row) {
      adm.inbox[el.dataset.table] = adm.inbox[el.dataset.table].map(function (r) { return r.id === row.id ? row : r; });
      app.toast(t('form.saved')); app.render();
    }, function (e) { H.busy(el, false); app.toast(H.errText(e), 'err'); });
  };
  app.ACT['inbox-del'] = function (el) {
    var table = el.dataset.table, id = el.dataset.id;
    app.confirm({ title: t('inbox.deleteQ'), yes: t('admin.delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      S().deleteRow(table, id).then(function () {
        adm.inbox[table] = adm.inbox[table].filter(function (r) { return r.id !== id; });
        app.toast(t('form.deleted')); app.render();
      }, function (e) { app.toast(H.errText(e), 'err'); });
    });
  };

  /* ======================= users ======================= */
  function viewUsers() {
    if (adm.usersErr && !adm.users) return app.errorBox(adm.usersErr);
    if (!adm.users) return app.loadingBox();
    return '<p class="muted">' + esc(t('users.intro')) + '</p><ul class="users">' + adm.users.map(function (u) {
      var self = H.me() && u.id === H.me().id;
      return '<li class="box"><div class="grow"><b>' + esc(u.nama || u.emel.split('@')[0]) + (self ? ' <span class="muted">(' + esc(t('users.you')) + ')</span>' : '') + '</b>' +
        '<span class="muted u-mail">' + esc(u.emel) + '</span><span class="muted">' + esc(t('users.joined', { date: U.fmtDate(u.dicipta, I.lang) })) + '</span></div>' +
        '<label class="vh" for="role-' + esc(u.id) + '">' + esc(t('users.role')) + '</label>' +
        '<select id="role-' + esc(u.id) + '" data-role-for="' + esc(u.id) + '">' + ['staf', 'editor', 'admin'].map(function (r) {
          return '<option value="' + r + '"' + (u.peranan === r ? ' selected' : '') + '>' + esc(t('role.' + r)) + '</option>';
        }).join('') + '</select></li>';
    }).join('') + '</ul><p class="note-box">' + svg('info') + esc(t('users.note')) + '</p>';
  }
  document.addEventListener('change', function (e) {
    var sel = e.target;
    if (!sel.matches || !sel.matches('select[data-role-for]')) return;
    var id = sel.dataset.roleFor, u = (adm.users || []).filter(function (x) { return x.id === id; })[0];
    var prev = u ? u.peranan : '';
    sel.disabled = true;
    S().setRole(id, sel.value).then(function (row) {
      if (u) u.peranan = row.peranan;
      app.toast(t('users.saved'));
      if (H.me() && id === H.me().id) { H.me().peranan = row.peranan; app.refresh(); }
      else app.render();
    }, function (err) {
      sel.value = prev; sel.disabled = false;
      app.toast(H.errText(err), 'err');
    });
  });

  /* ======================= settings ======================= */
  function viewSettings() {
    var s = st.settings;
    var h = '<form class="box" data-form="adm-settings" novalidate>' +
      '<div class="field"><label for="set-wa">' + esc(t('settings.whatsapp')) + '</label><input id="set-wa" name="whatsapp" inputmode="numeric" maxlength="15" placeholder="60123456789" value="' + esc(s.whatsapp || '') + '"><small class="hint">' + esc(t('settings.whatsappHint')) + '</small></div>' +
      '<label class="switch"><input type="checkbox" name="wajib" id="set-wajib"' + (s.wajib_log_masuk ? ' checked' : '') + '><span class="track" aria-hidden="true"></span><span><b>' + esc(t('settings.requireLogin')) + '</b><small>' + esc(t('settings.requireLoginHint')) + '</small></span></label>' +
      '<p class="err" role="alert"></p><div class="btn-row"><button type="submit" class="btn primary">' + esc(t('form.save')) + '</button></div></form>';
    h += '<section class="box"><h2>' + svg('image', 'h-ic') + esc(t('settings.orphans')) + '</h2><p class="muted">' + esc(t('settings.orphansHint')) + '</p>';
    if (adm.orphans === 'loading') h += '<p class="muted" aria-busy="true">' + esc(t('state.loading')) + '</p>';
    else if (Array.isArray(adm.orphans)) {
      h += '<p role="status"><b>' + esc(I.tn('settings.orphansFound', adm.orphans.length)) + '</b></p>';
      if (adm.orphans.length) h += '<button type="button" class="btn danger-o" data-act="orphans-del">' + svg('trash') + esc(t('settings.orphansDelete')) + '</button>';
    }
    h += '<button type="button" class="btn" data-act="orphans-find">' + svg('search') + esc(t('settings.orphansFind')) + '</button></section>';
    h += '<section class="box"><h2>' + svg('info', 'h-ic') + esc(t('settings.about')) + '</h2><p class="muted">' +
      esc(t('settings.mode')) + ': <b>' + esc(S().mode === 'demo' ? t('settings.modeDemo') : 'Supabase') + '</b><br>' + esc(t('settings.version')) + ': ' + VERSION + '</p></section>';
    return h;
  }
  app.FORM['adm-settings'] = function (f) {
    var err = f.querySelector('.err');
    var wa = f.whatsapp.value.replace(/[\s+\-()]/g, '');
    if (!/^[0-9]{0,15}$/.test(wa)) { err.textContent = t('settings.whatsappBad'); f.whatsapp.focus(); return; }
    var btn = f.querySelector('[type=submit]');
    H.busy(btn, true);
    S().saveSettings({ whatsapp: wa, wajib_log_masuk: f.wajib.checked }).then(function (s) {
      st.settings = s; app.toast(t('form.saved')); app.render();
    }, function (e) { H.busy(btn, false); err.textContent = H.errText(e); });
  };
  app.ACT['orphans-find'] = function () {
    adm.orphans = 'loading'; app.render();
    S().listOrphans().then(function (list) { adm.orphans = list; app.render(); }, function (e) { adm.orphans = null; app.render(); app.toast(H.errText(e), 'err'); });
  };
  app.ACT['orphans-del'] = function () {
    var list = adm.orphans;
    app.confirm({ title: I.tn('settings.orphansDeleteQ', list.length), yes: t('admin.delete'), danger: true }).then(function (ok) {
      if (!ok) return;
      S().removeImages(list).then(function () { adm.orphans = []; app.toast(t('form.deleted')); app.render(); }, function (e) { app.toast(H.errText(e), 'err'); });
    });
  };
})();
