/* GEP Help: demo data layer. Same interface as store-supabase.js, but everything lives in memory
   and disappears on reload. Used when config.js has no Supabase keys, so the site can be tried
   before the database is set up. Mirrors the database rules (roles, drafts) closely enough for testing. */
(function () {
  'use strict';
  var U = window.GEPU;

  function StoreError(code) { var e = new Error(code); e.code = code; return e; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function now() { return new Date().toISOString(); }
  function daysAgo(n) { return new Date(Date.now() - n * 864e5).toISOString(); }
  function later(v) { return new Promise(function (res) { setTimeout(function () { res(clone(v)); }, 60); }); }
  function fail(code) { return new Promise(function (_, rej) { setTimeout(function () { rej(StoreError(code)); }, 60); }); }

  var P = { app: 'a0000000-0000-4000-8000-000000000001', ops: 'a0000000-0000-4000-8000-000000000002', lite: 'a0000000-0000-4000-8000-000000000003' };
  var USERS = {
    admin: { id: 'd0000000-0000-4000-8000-00000000000a', emel: 'admin@demo.gep', nama: 'Aina (Admin)', peranan: 'admin', bahasa: '' },
    editor: { id: 'd0000000-0000-4000-8000-00000000000e', emel: 'editor@demo.gep', nama: 'Hafiz (Editor)', peranan: 'editor', bahasa: '' },
    staf: { id: 'd0000000-0000-4000-8000-00000000000s', emel: 'staf@demo.gep', nama: 'Kumar (Staf)', peranan: 'staf', bahasa: '' }
  };

  function seed() {
    var db = {
      tetapan: { whatsapp: '60123456789', wajib_log_masuk: false },
      produk: [
        { id: P.app, kod: 'APP', nama_ms: 'GEP APP', nama_en: 'GEP APP', keterangan_ms: 'App pengawal: pasang, log masuk dan buat rondaan.', keterangan_en: 'The guard app: install, sign in and patrol.', warna: '#FFC20E', susunan: 1 },
        { id: P.ops, kod: 'OPS', nama_ms: 'GEP OPS', nama_en: 'GEP OPS', keterangan_ms: 'Konsol penyelia untuk pantau pengawal dan buat laporan.', keterangan_en: 'The supervisor console to monitor guards and build reports.', warna: '#2563B8', susunan: 2 },
        { id: P.lite, kod: 'LITE', nama_ms: 'GEP LITE', nama_en: 'GEP LITE', keterangan_ms: 'Versi ringan untuk daftar masuk dengan cepat.', keterangan_en: 'A lighter version for quick check-ins.', warna: '#2E9A63', susunan: 3 }
      ],
      tutorial: [], langkah: [], nota: [], kegemaran: [], ditonton: [], soalan: [], cadangan: [], laporan: [],
      profiles: [clone(USERS.admin), clone(USERS.editor), clone(USERS.staf)]
    };
    function tut(id, prod, n, ms, en, sms, sen, status, opts) {
      opts = opts || {};
      db.tutorial.push({
        id: id, produk_id: prod, tajuk_ms: ms, tajuk_en: en, ringkasan_ms: sms, ringkasan_en: sen,
        video_url_ms: opts.video || '', video_url_en: opts.videoEn || opts.video || '', status: status, susunan: n,
        dicipta_oleh: opts.by || USERS.admin.id, diterbit_pada: status === 'terbit' ? (opts.pub || daysAgo(40)) : null,
        dicipta: daysAgo(60 - n), dikemas_kini: daysAgo(3)
      });
    }
    function step(tid, n, ms, en, img, mk) {
      db.langkah.push({ id: U.uid(), tutorial_id: tid, susunan: n, teks_ms: ms, teks_en: en, gambar_path: img || '', penanda: mk || [], dicipta: daysAgo(30), dikemas_kini: daysAgo(3) });
    }
    var T = {
      app1: 'b0000000-0000-4000-8000-000000000001', app2: 'b0000000-0000-4000-8000-000000000011', app3: 'b0000000-0000-4000-8000-000000000012',
      ops1: 'b0000000-0000-4000-8000-000000000002', ops2: 'b0000000-0000-4000-8000-000000000021',
      lite1: 'b0000000-0000-4000-8000-000000000003', lite2: 'b0000000-0000-4000-8000-000000000031'
    };
    tut(T.app1, P.app, 1, 'Pasang & log masuk GEP APP', 'Install & sign in to GEP APP',
      'Muat turun GEP APP, log masuk dengan akaun syarikat dan sampai ke skrin utama.',
      'Download GEP APP, sign in with your company account and reach the home screen.', 'terbit',
      { video: 'https://www.youtube.com/watch?v=M7lc1UVf-VE' });
    step(T.app1, 1, 'Buka Play Store, cari "GEP APP" dan tekan Pasang.', 'Open the Play Store, search for "GEP APP" and tap Install.', 'img/contoh/app-1.jpg', [{ t: 'o', x: 50, y: 50, r: 14 }]);
    step(T.app1, 2, 'Buka app dan masukkan e-mel serta kata laluan syarikat anda.', 'Open the app and enter your company email and password.', 'img/contoh/app-2.jpg', []);
    step(T.app1, 3, 'Tekan Log Masuk. Skrin utama akan muncul.', 'Tap Sign in. The home screen appears.', 'img/contoh/app-3.jpg', [{ t: 'a', x: 50, y: 70, d: 135 }]);
    tut(T.app2, P.app, 2, 'Mula rondaan', 'Start a patrol',
      'Mula, jeda dan tamatkan satu pusingan rondaan dalam app.', 'Start, pause and finish a patrol round in the app.', 'terbit', { pub: daysAgo(4) });
    step(T.app2, 1, 'Di skrin utama, tekan kad Rondaan.', 'On the home screen, tap the Patrol card.', 'img/contoh/app-3.jpg', [{ t: 'o', x: 50, y: 70, r: 22 }]);
    step(T.app2, 2, 'Imbas tag checkpoint pertama untuk mula.', 'Scan the first checkpoint tag to begin.', '', []);
    tut(T.app3, P.app, 3, 'Hantar laporan insiden', '', 'Buat dan hantar laporan insiden semasa rondaan.', '', 'terbit');
    step(T.app3, 1, 'Tekan butang Laporan di bawah skrin.', '', '', []);
    tut(T.ops1, P.ops, 1, 'Log masuk ke konsol GEP OPS', 'Sign in to the GEP OPS console',
      'Masuk ke papan pemuka GEP OPS dengan akaun penyelia.', 'Open the GEP OPS dashboard with your supervisor account.', 'terbit');
    step(T.ops1, 1, 'Buka pautan konsol GEP OPS dalam pelayar.', 'Open the GEP OPS console link in your browser.', 'img/contoh/ops-1.jpg', []);
    step(T.ops1, 2, 'Masukkan ID penyelia dan kata laluan.', 'Enter your supervisor ID and password.', 'img/contoh/ops-2.jpg', [{ t: 'o', x: 50, y: 45, r: 16 }]);
    step(T.ops1, 3, 'Papan pemuka dibuka. Anda sedia memantau.', 'The dashboard opens. You are ready to monitor.', 'img/contoh/ops-3.jpg', []);
    tut(T.ops2, P.ops, 2, 'Pantau pengawal secara langsung', 'Monitor guards live',
      'Lihat lokasi pengawal dan kemajuan rondaan di peta.', 'See guard locations and patrol progress on the map.', 'draf', { by: USERS.editor.id });
    step(T.ops2, 1, 'Buka tab Peta di papan pemuka.', 'Open the Map tab on the dashboard.', 'img/contoh/ops-3.jpg', []);
    tut(T.lite1, P.lite, 1, 'Pasang & log masuk GEP LITE', 'Install & sign in to GEP LITE',
      'Muat turun GEP LITE dan log masuk dengan akaun anda.', 'Download GEP LITE and sign in with your account.', 'terbit');
    step(T.lite1, 1, 'Pasang GEP LITE dari Play Store.', 'Install GEP LITE from the Play Store.', 'img/contoh/lite-1.jpg', []);
    step(T.lite1, 2, 'Buka app dan pilih Log Masuk.', 'Open the app and choose Sign in.', 'img/contoh/lite-2.jpg', [{ t: 'a', x: 50, y: 60, d: 45 }]);
    step(T.lite1, 3, 'Masukkan butiran akaun dan tekan Teruskan.', 'Enter your account details and tap Continue.', 'img/contoh/lite-3.jpg', []);
    tut(T.lite2, P.lite, 2, 'Daftar masuk & keluar', 'Check in & out',
      'Rekod masa anda tiba dan keluar dari tapak.', 'Record when you arrive at and leave the site.', 'terbit', { pub: daysAgo(2) });
    step(T.lite2, 1, 'Tekan Daftar Masuk bila sampai di tapak.', 'Tap Check in when you arrive on site.', 'img/contoh/lite-2.jpg', [{ t: 'o', x: 50, y: 60, r: 20 }]);
    step(T.lite2, 2, 'Tekan Daftar Keluar sebelum anda pulang.', 'Tap Check out before you leave.', '', []);

    db.soalan.push({ id: U.uid(), tutorial_id: T.app1, user_id: USERS.staf.id, nama: 'Kumar (Staf)', teks: 'Kalau lupa kata laluan, nak buat apa?', jawapan: 'Tekan "Lupa kata laluan" di skrin log masuk, atau hubungi penyelia anda.', dijawab_pada: daysAgo(1), dicipta: daysAgo(2), dikemas_kini: daysAgo(1) });
    db.soalan.push({ id: U.uid(), tutorial_id: T.lite1, user_id: USERS.staf.id, nama: 'Kumar (Staf)', teks: 'Boleh guna GEP LITE tanpa internet?', jawapan: '', dijawab_pada: null, dicipta: daysAgo(1), dikemas_kini: daysAgo(1) });
    db.cadangan.push({ id: U.uid(), user_id: USERS.staf.id, nama: 'Kumar (Staf)', produk_id: P.ops, tajuk: 'Cara eksport laporan ke PDF', butiran: 'Penyelia selalu tanya.', status: 'baru', dicipta: daysAgo(3), dikemas_kini: daysAgo(3) });
    db.laporan.push({ id: U.uid(), user_id: USERS.staf.id, nama: 'Kumar (Staf)', tutorial_id: T.app1, jenis: 'gambar', butiran: 'Gambar langkah 2 nampak lama.', status: 'baru', dicipta: daysAgo(1), dikemas_kini: daysAgo(1) });
    db.kegemaran.push({ user_id: USERS.staf.id, tutorial_id: T.lite1, dicipta: daysAgo(5) });
    return db;
  }

  function create() {
    var db = seed();
    var S = { mode: 'demo', me: null };
    var listeners = [];
    function emit(e) { listeners.forEach(function (fn) { try { fn(e); } catch (x) { console.error(x); } }); }
    function role() { return S.me ? S.me.peranan : 'tetamu'; }
    function isAdmin() { return role() === 'admin'; }
    function isEditor() { return role() === 'admin' || role() === 'editor'; }
    function find(list, id) { return list.filter(function (r) { return r.id === id; })[0]; }
    function canSeeTutorial(t) { return t && (t.status === 'terbit' && (S.me || !db.tetapan.wajib_log_masuk) || isEditor()); }

    S.init = function () { return Promise.resolve(); };
    S.onAuth = function (fn) { listeners.push(fn); };

    function login(u) {
      var p = find(db.profiles, u.id);
      if (!p) { p = clone(u); db.profiles.push(p); }
      S.me = clone(p);
      emit('signed-in');
    }
    S.demoLogin = function (r) { login(USERS[r] || USERS.staf); return later(S.me); };
    S.signIn = function (email, password) {
      email = String(email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('auth-email');
      if (!password) return fail('auth-wrong');
      var known = db.profiles.filter(function (p) { return p.emel === email; })[0];
      login(known || { id: U.uid(), emel: email, nama: email.split('@')[0], peranan: 'staf', bahasa: '' });
      return later(true);
    };
    S.signUp = function (email, password, nama, bahasa) {
      email = String(email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('auth-email');
      if (String(password || '').length < 6) return fail('auth-weak');
      if (db.profiles.some(function (p) { return p.emel === email; })) return fail('auth-exists');
      login({ id: U.uid(), emel: email, nama: nama || '', peranan: 'staf', bahasa: bahasa || 'ms' });
      return later({ needConfirm: false });
    };
    S.signOut = function () { S.me = null; emit('signed-out'); return later(true); };
    S.resetPassword = function () { return later(true); };
    S.updatePassword = function (pw) { return String(pw || '').length < 6 ? fail('auth-weak') : later(true); };
    S.updateProfile = function (f) {
      if (!S.me) return fail('permission');
      var p = find(db.profiles, S.me.id);
      if (f.nama != null) p.nama = String(f.nama).slice(0, 80);
      if (f.bahasa === 'ms' || f.bahasa === 'en') p.bahasa = f.bahasa;
      S.me.nama = p.nama; S.me.bahasa = p.bahasa;
      return later(S.me);
    };

    function sorted(list) {
      return list.slice().sort(function (a, b) { return (a.susunan - b.susunan) || String(a.dicipta).localeCompare(String(b.dicipta)); });
    }
    S.loadCatalog = function () {
      var showProducts = S.me || !db.tetapan.wajib_log_masuk;
      var tuts = db.tutorial.filter(canSeeTutorial);
      var ids = {};
      tuts.forEach(function (t) { ids[t.id] = 1; });
      return later({
        produk: showProducts ? sorted(db.produk) : [],
        tutorial: sorted(tuts),
        langkah: sorted(db.langkah.filter(function (l) { return ids[l.tutorial_id]; })),
        offline: false, at: Date.now()
      });
    };
    S.loadSettings = function () { return later(db.tetapan); };
    S.saveSettings = function (s) {
      if (!isAdmin()) return fail('permission');
      if (!/^[0-9]{0,15}$/.test(s.whatsapp || '')) return fail('invalid');
      db.tetapan = { whatsapp: s.whatsapp || '', wajib_log_masuk: !!s.wajib_log_masuk };
      return later(db.tetapan);
    };

    S.saveProduk = function (p) {
      if (!isAdmin()) return fail('permission');
      if (!/^[A-Z0-9]{1,6}$/.test(p.kod || '') || !String(p.nama_ms || '').trim() || !/^#[0-9A-Fa-f]{6}$/.test(p.warna || '')) return fail('invalid');
      var row = p.id ? find(db.produk, p.id) : null;
      if (p.id && !row) return fail('notfound');
      if (!row) { row = { id: U.uid(), dicipta: now(), susunan: db.produk.length + 1 }; db.produk.push(row); }
      ['kod', 'nama_ms', 'nama_en', 'keterangan_ms', 'keterangan_en', 'warna', 'susunan'].forEach(function (k) { if (p[k] !== undefined) row[k] = p[k]; });
      row.dikemas_kini = now();
      return later(row);
    };
    S.deleteProduk = function (id) {
      if (!isAdmin()) return fail('permission');
      var tids = db.tutorial.filter(function (t) { return t.produk_id === id; }).map(function (t) { return t.id; });
      db.produk = db.produk.filter(function (p) { return p.id !== id; });
      tids.forEach(removeTutorialRows);
      return later(true);
    };
    function removeTutorialRows(tid) {
      db.tutorial = db.tutorial.filter(function (t) { return t.id !== tid; });
      ['langkah', 'nota', 'kegemaran', 'ditonton', 'soalan', 'laporan'].forEach(function (k) {
        db[k] = db[k].filter(function (r) { return r.tutorial_id !== tid; });
      });
    }
    function contentChanged(a, b) {
      return ['tajuk_ms', 'tajuk_en', 'ringkasan_ms', 'ringkasan_en', 'video_url_ms', 'video_url_en', 'produk_id'].some(function (k) { return b[k] !== undefined && a[k] !== b[k]; });
    }
    var YT = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/[A-Za-z0-9_?=&/.%-]{1,200}$/;
    S.saveTutorial = function (t) {
      if (!isEditor()) return fail('permission');
      if (!String(t.tajuk_ms || '').trim() || !find(db.produk, t.produk_id)) return fail('invalid');
      if ((t.video_url_ms && !YT.test(t.video_url_ms)) || (t.video_url_en && !YT.test(t.video_url_en))) return fail('invalid');
      var row = t.id ? find(db.tutorial, t.id) : null;
      if (t.id && !row) return fail('notfound');
      var wasPublished = row && row.status === 'terbit';
      var changed = row ? contentChanged(row, t) : true;
      if (!row) {
        row = { id: U.uid(), dicipta: now(), dicipta_oleh: S.me.id, status: 'draf', diterbit_pada: null, susunan: 99 };
        db.tutorial.push(row);
      }
      ['produk_id', 'tajuk_ms', 'tajuk_en', 'ringkasan_ms', 'ringkasan_en', 'video_url_ms', 'video_url_en', 'susunan'].forEach(function (k) { if (t[k] !== undefined) row[k] = t[k]; });
      if (isAdmin()) {
        if (t.status) row.status = t.status;
      } else {
        if (t.status === 'draf') row.status = 'draf';
        if (changed) row.status = 'draf';
      }
      if (row.status === 'terbit' && !wasPublished) row.diterbit_pada = now();
      row.dikemas_kini = now();
      return later(row);
    };
    S.deleteTutorial = function (id) {
      var t = find(db.tutorial, id);
      if (!t) return fail('notfound');
      if (!(isAdmin() || (role() === 'editor' && t.status === 'draf' && t.dicipta_oleh === S.me.id))) return fail('permission');
      removeTutorialRows(id);
      return later(true);
    };
    function editorTouched(tid) {
      if (!isAdmin()) { var t = find(db.tutorial, tid); if (t) t.status = 'draf'; }
    }
    S.saveLangkah = function (l) {
      if (!isEditor()) return fail('permission');
      if (!String(l.teks_ms || '').trim() || !find(db.tutorial, l.tutorial_id)) return fail('invalid');
      var row = l.id ? find(db.langkah, l.id) : null;
      if (l.id && !row) return fail('notfound');
      if (!row) { row = { id: U.uid(), dicipta: now(), susunan: 99, penanda: [] }; db.langkah.push(row); }
      ['tutorial_id', 'susunan', 'teks_ms', 'teks_en', 'gambar_path'].forEach(function (k) { if (l[k] !== undefined) row[k] = l[k]; });
      if (l.penanda !== undefined) row.penanda = U.cleanMarkers(l.penanda);
      row.dikemas_kini = now();
      editorTouched(row.tutorial_id);
      return later(row);
    };
    S.deleteLangkah = function (l) {
      if (!isEditor()) return fail('permission');
      var row = find(db.langkah, l.id);
      if (!row) return fail('notfound');
      db.langkah = db.langkah.filter(function (r) { return r.id !== l.id; });
      editorTouched(row.tutorial_id);
      return later(true);
    };
    S.reorder = function (table, ids) {
      if (table === 'produk' ? !isAdmin() : !isEditor()) return fail('permission');
      var list = db[table];
      if (!list) return fail('invalid');
      ids.forEach(function (id, i) {
        var r = find(list, id);
        if (r && r.susunan !== i + 1) { r.susunan = i + 1; if (table === 'langkah') editorTouched(r.tutorial_id); }
      });
      return later(true);
    };

    S.uploadImage = function (tid, img) {
      if (!isEditor()) return fail('permission');
      return later(URL.createObjectURL(img.blob));
    };
    S.removeImages = function (paths) {
      (paths || []).forEach(function (p) { if (/^blob:/.test(p || '')) { try { URL.revokeObjectURL(p); } catch (e) { /* ignore */ } } });
      return later([]);
    };
    S.imageUrl = function (p) { return p || ''; };
    S.listOrphans = function () { return isAdmin() ? later([]) : fail('permission'); };

    var guestWatched = [];
    S.loadMine = function () {
      if (!S.me) return later({ nota: {}, kegemaran: [], ditonton: guestWatched });
      var uid = S.me.id;
      var m = { nota: {}, kegemaran: [], ditonton: [] };
      db.nota.forEach(function (n) { if (n.user_id === uid) m.nota[n.tutorial_id] = n.teks; });
      db.kegemaran.filter(function (k) { return k.user_id === uid; }).sort(function (a, b) { return String(b.dicipta).localeCompare(String(a.dicipta)); })
        .forEach(function (k) { m.kegemaran.push(k.tutorial_id); });
      db.ditonton.forEach(function (k) { if (k.user_id === uid) m.ditonton.push(k.tutorial_id); });
      return later(m);
    };
    S.saveNota = function (tid, teks) {
      if (!S.me) return fail('permission');
      teks = String(teks || '').trim().slice(0, 2000);
      db.nota = db.nota.filter(function (n) { return !(n.user_id === S.me.id && n.tutorial_id === tid); });
      if (teks) db.nota.push({ user_id: S.me.id, tutorial_id: tid, teks: teks, dikemas_kini: now() });
      return later(true);
    };
    S.setKegemaran = function (tid, on) {
      if (!S.me) return fail('permission');
      db.kegemaran = db.kegemaran.filter(function (k) { return !(k.user_id === S.me.id && k.tutorial_id === tid); });
      if (on) db.kegemaran.push({ user_id: S.me.id, tutorial_id: tid, dicipta: now() });
      return later(true);
    };
    S.markDitonton = function (tid) {
      if (!S.me) { if (guestWatched.indexOf(tid) < 0) guestWatched.push(tid); return later(true); }
      if (!db.ditonton.some(function (k) { return k.user_id === S.me.id && k.tutorial_id === tid; })) db.ditonton.push({ user_id: S.me.id, tutorial_id: tid, dicipta: now() });
      return later(true);
    };

    S.listSoalan = function (tid) {
      if (!S.me) return fail('permission');
      return later(db.soalan.filter(function (q) { return q.tutorial_id === tid; }).sort(function (a, b) { return String(a.dicipta).localeCompare(String(b.dicipta)); }));
    };
    S.addSoalan = function (tid, teks) {
      if (!S.me) return fail('permission');
      teks = String(teks || '').trim();
      if (!teks) return fail('invalid');
      var row = { id: U.uid(), tutorial_id: tid, user_id: S.me.id, nama: S.me.nama || S.me.emel.split('@')[0], teks: teks.slice(0, 1000), jawapan: '', dijawab_pada: null, dicipta: now(), dikemas_kini: now() };
      db.soalan.push(row);
      return later(row);
    };
    S.updateSoalan = function (id, teks) {
      var q = find(db.soalan, id);
      if (!q || !S.me || q.user_id !== S.me.id) return fail('permission');
      teks = String(teks || '').trim();
      if (!teks) return fail('invalid');
      q.teks = teks.slice(0, 1000); q.dikemas_kini = now();
      return later(q);
    };
    S.answerSoalan = function (id, jawapan) {
      if (!isAdmin()) return fail('permission');
      var q = find(db.soalan, id);
      if (!q) return fail('notfound');
      q.jawapan = String(jawapan || '').trim().slice(0, 2000);
      q.dijawab_pada = q.jawapan ? now() : null;
      return later(q);
    };
    S.deleteRow = function (table, id) {
      var list = db[table], r = list && find(list, id);
      if (!r) return fail('notfound');
      var own = S.me && r.user_id === S.me.id;
      var ok = isAdmin() || (table === 'soalan' && own) || (table !== 'soalan' && own && r.status === 'baru');
      if (!ok) return fail('permission');
      db[table] = list.filter(function (x) { return x.id !== id; });
      return later(true);
    };
    S.addCadangan = function (c) {
      if (!S.me) return fail('permission');
      if (!String(c.tajuk || '').trim()) return fail('invalid');
      var row = { id: U.uid(), user_id: S.me.id, nama: S.me.nama || S.me.emel.split('@')[0], produk_id: c.produk_id || null, tajuk: String(c.tajuk).trim().slice(0, 120), butiran: String(c.butiran || '').trim().slice(0, 1000), status: 'baru', dicipta: now(), dikemas_kini: now() };
      db.cadangan.push(row);
      return later(row);
    };
    S.listCadanganSaya = function () {
      if (!S.me) return later([]);
      return later(db.cadangan.filter(function (c) { return c.user_id === S.me.id; }).reverse());
    };
    S.addLaporan = function (l) {
      if (!S.me) return fail('permission');
      var row = { id: U.uid(), user_id: S.me.id, nama: S.me.nama || S.me.emel.split('@')[0], tutorial_id: l.tutorial_id, jenis: l.jenis || 'lain', butiran: String(l.butiran || '').trim().slice(0, 1000), status: 'baru', dicipta: now(), dikemas_kini: now() };
      db.laporan.push(row);
      return later(row);
    };
    S.setStatus = function (table, id, status) {
      if (!isAdmin()) return fail('permission');
      var r = find(db[table] || [], id);
      if (!r) return fail('notfound');
      r.status = status; r.dikemas_kini = now();
      return later(r);
    };
    S.listInbox = function () {
      if (!isAdmin()) return later({ soalan: [], cadangan: [], laporan: [] });
      function desc(a, b) { return String(b.dicipta).localeCompare(String(a.dicipta)); }
      return later({ soalan: db.soalan.slice().sort(desc), cadangan: db.cadangan.slice().sort(desc), laporan: db.laporan.slice().sort(desc) });
    };
    S.listUsers = function () { return isAdmin() ? later(db.profiles) : fail('permission'); };
    S.setRole = function (id, peranan) {
      if (!isAdmin()) return fail('permission');
      var p = find(db.profiles, id);
      if (!p) return fail('notfound');
      if (p.peranan === 'admin' && peranan !== 'admin' && db.profiles.filter(function (x) { return x.peranan === 'admin'; }).length <= 1) return fail('last-admin');
      p.peranan = peranan;
      if (S.me && S.me.id === id) S.me.peranan = peranan;
      return later(p);
    };

    S.classify = function (e) { return e && e.code ? e : StoreError('unknown'); };
    return S;
  }

  window.GEPDemoStore = { create: create };
})();
