/* GEP Help: data layer backed by Supabase (Auth, Postgres, Storage).
   Security is enforced by Row Level Security in supabase/schema.sql; this file only calls the API. */
(function () {
  'use strict';
  var U = window.GEPU;
  var BUCKET = 'langkah';
  var PAGE = 1000;

  function StoreError(code, cause) {
    var e = new Error(code);
    e.code = code;
    e.cause = cause;
    return e;
  }

  // Maps Supabase/PostgREST/Auth errors to a small set of codes the UI translates.
  function classify(err) {
    if (!err) return StoreError('unknown');
    if (err.code && /^(network|permission|invalid|notfound|auth-|image-|unknown)/.test(err.code) && !err.details && !err.hint) return err;
    if (U.isNetworkError(err)) return StoreError('network', err);
    var msg = String(err.message || '');
    var code = String(err.code || '');
    var status = Number(err.status || 0);
    if (/invalid login credentials/i.test(msg)) return StoreError('auth-wrong', err);
    if (/already registered|already exists|user_already_exists/i.test(msg) || code === 'user_already_exists') return StoreError('auth-exists', err);
    if (/email not confirmed/i.test(msg) || code === 'email_not_confirmed') return StoreError('auth-unconfirmed', err);
    if (/password/i.test(msg) && /(at least|weak|short|characters)/i.test(msg)) return StoreError('auth-weak', err);
    if (/rate limit|too many|security purposes/i.test(msg) || status === 429) return StoreError('auth-rate', err);
    if (/invalid.*email|email.*invalid|unable to validate email/i.test(msg)) return StoreError('auth-email', err);
    if (/signups? not allowed|signup.*disabled/i.test(msg)) return StoreError('auth-closed', err);
    if (code === '42501' || code === 'PGRST116' || /row-level security|permission denied|not authorized|unauthorized/i.test(msg) || status === 401 || status === 403) return StoreError('permission', err);
    if (code === '23514' || code === '23502' || code === '22P02' || code === '23505' || /violates check|invalid input/i.test(msg)) return StoreError('invalid', err);
    if (/mime type|payload too large|exceeded the maximum allowed size/i.test(msg) || status === 413 || status === 415) return StoreError('image-size', err);
    if (/admin/i.test(msg) && /sekurang-kurangnya|at least/i.test(msg)) return StoreError('last-admin', err);
    return StoreError('unknown', err);
  }
  function must(res) {
    if (res.error) throw classify(res.error);
    return res.data;
  }

  function isStoragePath(p) {
    return !!p && !/^(https?:|blob:|data:|img\/)/.test(p);
  }

  function create(cfg) {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw StoreError('network', new Error('supabase-js not loaded'));
    }
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    var S = { mode: 'supabase', me: null };
    var listeners = [];
    var lastUserId = null;
    // Links from Supabase e-mails arrive as #access_token=...&type=recovery|signup
    var urlType = (/[#&?]type=(recovery|signup|invite|magiclink|email_change|email)/.exec(location.hash + '&' + location.search) || [])[1] || '';
    var recoveryShown = false;
    function showRecovery() { if (!recoveryShown) { recoveryShown = true; emit('recovery'); } }

    function emit(evt) { listeners.forEach(function (fn) { try { fn(evt); } catch (e) { console.error(e); } }); }
    function cacheKey(name) { return 'gep_cache_' + name + '_' + (S.me ? S.me.id : 'tetamu'); }

    function loadProfile(user) {
      if (!user) { S.me = null; return Promise.resolve(null); }
      return sb.from('profiles').select('id,emel,nama,peranan,bahasa').eq('id', user.id).maybeSingle().then(function (res) {
        var p = res.data || {};
        if (res.error && !U.isNetworkError(res.error)) console.warn('profile', res.error.message);
        var cached = U.local.get('gep_profile_' + user.id, null);
        if (res.error && cached) p = cached;
        S.me = {
          id: user.id,
          emel: p.emel || user.email || '',
          nama: p.nama || '',
          peranan: p.peranan || 'staf',
          bahasa: p.bahasa === 'en' ? 'en' : (p.bahasa === 'ms' ? 'ms' : '')
        };
        if (!res.error) U.local.set('gep_profile_' + user.id, S.me);
        return S.me;
      });
    }

    function onSession(evt, session) {
      var uid = session && session.user ? session.user.id : null;
      if (evt === 'PASSWORD_RECOVERY') {
        lastUserId = uid;
        loadProfile(session && session.user).then(showRecovery);
        return;
      }
      if (uid === lastUserId && evt !== 'USER_UPDATED') return;
      lastUserId = uid;
      loadProfile(session && session.user).then(function () { emit(uid ? 'signed-in' : 'signed-out'); });
    }

    S.init = function () {
      var ready = false;
      // Supabase advises not to call other Supabase methods inside this callback directly.
      sb.auth.onAuthStateChange(function (evt, session) {
        setTimeout(function () {
          if (!ready && evt !== 'PASSWORD_RECOVERY') return;
          onSession(evt, session);
        }, 0);
      });
      return sb.auth.getSession().then(function (res) {
        var session = res.data && res.data.session;
        lastUserId = session && session.user ? session.user.id : null;
        return loadProfile(session && session.user);
      }).then(function () {
        ready = true;
        if (S.me && urlType === 'recovery') setTimeout(showRecovery, 0);
        else if (S.me && urlType) setTimeout(function () { emit('confirmed'); }, 0);
      });
    };
    S.onAuth = function (fn) { listeners.push(fn); };

    /* ---------------- auth ---------------- */
    function siteUrl() { return location.origin + location.pathname; }
    S.signIn = function (email, password) {
      return sb.auth.signInWithPassword({ email: email, password: password }).then(must).then(function (data) {
        lastUserId = data.user.id;
        return loadProfile(data.user);
      }).then(function () { emit('signed-in'); });
    };
    S.signUp = function (email, password, nama, bahasa) {
      return sb.auth.signUp({
        email: email, password: password,
        options: { data: { nama: nama || '', bahasa: bahasa }, emailRedirectTo: siteUrl() }
      }).then(must).then(function (data) {
        if (!data.session) {
          // Supabase hides existing accounts behind an empty identities list.
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw StoreError('auth-exists');
          return { needConfirm: true };
        }
        lastUserId = data.user.id;
        return loadProfile(data.user).then(function () { emit('signed-in'); return { needConfirm: false }; });
      });
    };
    S.signOut = function () {
      return sb.auth.signOut({ scope: 'local' }).then(function (res) {
        if (res && res.error && !U.isNetworkError(res.error)) throw classify(res.error);
        lastUserId = null; S.me = null; emit('signed-out');
      });
    };
    S.resetPassword = function (email) {
      return sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() }).then(must);
    };
    S.updatePassword = function (password) {
      return sb.auth.updateUser({ password: password }).then(must);
    };
    S.updateProfile = function (fields) {
      if (!S.me) return Promise.reject(StoreError('permission'));
      var f = {};
      if (fields.nama != null) f.nama = String(fields.nama).slice(0, 80);
      if (fields.bahasa === 'ms' || fields.bahasa === 'en') f.bahasa = fields.bahasa;
      return sb.from('profiles').update(f).eq('id', S.me.id).select('id,emel,nama,peranan,bahasa').single().then(must).then(function (p) {
        S.me.nama = p.nama; S.me.bahasa = p.bahasa;
        U.local.set('gep_profile_' + S.me.id, S.me);
        return S.me;
      });
    };

    /* ---------------- catalogue ---------------- */
    function selectAll(table, cols) {
      var rows = [];
      function page(from) {
        return sb.from(table).select(cols || '*').order('susunan', { ascending: true }).order('dicipta', { ascending: true }).order('id', { ascending: true })
          .range(from, from + PAGE - 1).then(must).then(function (data) {
            rows = rows.concat(data || []);
            return (data || []).length === PAGE ? page(from + PAGE) : rows;
          });
      }
      return page(0);
    }
    S.loadCatalog = function () {
      return Promise.all([selectAll('produk'), selectAll('tutorial'), selectAll('langkah')]).then(function (r) {
        var cat = { produk: r[0], tutorial: r[1], langkah: r[2], at: Date.now() };
        U.local.set(cacheKey('cat'), cat);
        cat.offline = false;
        return cat;
      }, function (err) {
        if (err.code === 'network') {
          var c = U.local.get(cacheKey('cat'), null) || U.local.get('gep_cache_cat_tetamu', null);
          if (c) { c.offline = true; return c; }
        }
        throw err;
      });
    };
    S.loadSettings = function () {
      return sb.from('tetapan').select('whatsapp,wajib_log_masuk').eq('id', 1).maybeSingle().then(must).then(function (s) {
        s = s || { whatsapp: '', wajib_log_masuk: false };
        U.local.set('gep_cache_settings', s);
        return s;
      }, function (err) {
        if (err.code === 'network') return U.local.get('gep_cache_settings', { whatsapp: '', wajib_log_masuk: false });
        throw err;
      });
    };
    S.saveSettings = function (s) {
      return sb.from('tetapan').update({ whatsapp: s.whatsapp, wajib_log_masuk: !!s.wajib_log_masuk })
        .eq('id', 1).select('whatsapp,wajib_log_masuk').single().then(must);
    };

    var PRODUK_COLS = ['kod', 'nama_ms', 'nama_en', 'keterangan_ms', 'keterangan_en', 'warna', 'susunan'];
    var TUTORIAL_COLS = ['produk_id', 'tajuk_ms', 'tajuk_en', 'ringkasan_ms', 'ringkasan_en', 'video_url_ms', 'video_url_en', 'status', 'susunan'];
    var LANGKAH_COLS = ['tutorial_id', 'susunan', 'teks_ms', 'teks_en', 'gambar_path', 'penanda'];
    function pickCols(obj, cols) {
      var o = {};
      cols.forEach(function (c) { if (obj[c] !== undefined) o[c] = obj[c]; });
      return o;
    }
    function save(table, cols, row) {
      var f = pickCols(row, cols);
      var q = row.id ? sb.from(table).update(f).eq('id', row.id) : sb.from(table).insert(f);
      return q.select('*').single().then(must);
    }
    function del(table, id) {
      return sb.from(table).delete().eq('id', id).select('id').then(must).then(function (rows) {
        if (!rows || !rows.length) throw StoreError('permission');
        return true;
      });
    }

    S.saveProduk = function (p) { return save('produk', PRODUK_COLS, p); };
    S.saveTutorial = function (t) { return save('tutorial', TUTORIAL_COLS, t); };
    S.saveLangkah = function (l) { return save('langkah', LANGKAH_COLS, l); };

    function imagesOfTutorials(ids) {
      if (!ids.length) return Promise.resolve([]);
      return sb.from('langkah').select('gambar_path').in('tutorial_id', ids).then(must).then(function (rows) {
        return (rows || []).map(function (r) { return r.gambar_path; });
      });
    }
    S.deleteProduk = function (id) {
      return sb.from('tutorial').select('id').eq('produk_id', id).then(must).then(function (rows) {
        return imagesOfTutorials((rows || []).map(function (r) { return r.id; }));
      }).then(function (paths) {
        return del('produk', id).then(function () { return S.removeImages(paths); });
      });
    };
    S.deleteTutorial = function (id) {
      return imagesOfTutorials([id]).then(function (paths) {
        return del('tutorial', id).then(function () { return S.removeImages(paths); });
      });
    };
    S.deleteLangkah = function (l) {
      return del('langkah', l.id).then(function () { return S.removeImages([l.gambar_path]); });
    };
    S.reorder = function (table, ids) {
      if (['produk', 'tutorial', 'langkah'].indexOf(table) < 0) return Promise.reject(StoreError('invalid'));
      return Promise.all(ids.map(function (id, i) {
        return sb.from(table).update({ susunan: i + 1 }).eq('id', id).select('id').then(must);
      }));
    };

    /* ---------------- images ---------------- */
    S.uploadImage = function (tutorialId, img) {
      var path = tutorialId + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + (img.ext || 'jpg');
      return sb.storage.from(BUCKET).upload(path, img.blob, { contentType: img.type || 'image/jpeg', cacheControl: '31536000', upsert: false })
        .then(must).then(function () { return path; });
    };
    S.removeImages = function (paths) {
      var list = (paths || []).filter(isStoragePath);
      if (!list.length) return Promise.resolve([]);
      return sb.storage.from(BUCKET).remove(list).then(function (res) {
        if (res.error) console.warn('remove images', res.error.message);
        return list;
      });
    };
    S.imageUrl = function (path) {
      if (!path) return '';
      if (!isStoragePath(path)) return path;
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    };
    // Files in the bucket that no step uses any more.
    S.listOrphans = function () {
      var files = [];
      return sb.storage.from(BUCKET).list('', { limit: 1000 }).then(must).then(function (top) {
        var folders = (top || []).filter(function (f) { return !f.id; });
        (top || []).forEach(function (f) { if (f.id) files.push(f.name); });
        return Promise.all(folders.map(function (f) {
          return sb.storage.from(BUCKET).list(f.name, { limit: 1000 }).then(must).then(function (items) {
            (items || []).forEach(function (it) { if (it.id) files.push(f.name + '/' + it.name); });
          });
        }));
      }).then(function () {
        return selectAll('langkah', 'id,gambar_path,susunan,dicipta');
      }).then(function (rows) {
        var used = {};
        rows.forEach(function (r) { used[r.gambar_path] = 1; });
        return files.filter(function (f) { return !used[f]; });
      });
    };

    /* ---------------- personal data ---------------- */
    var guestKey = 'gep_watched_guest';
    S.loadMine = function () {
      if (!S.me) {
        return Promise.resolve({ nota: {}, kegemaran: [], ditonton: U.local.get(guestKey, []) });
      }
      var uid = S.me.id;
      return Promise.all([
        sb.from('nota').select('tutorial_id,teks').eq('user_id', uid).then(must),
        sb.from('kegemaran').select('tutorial_id').eq('user_id', uid).order('dicipta', { ascending: false }).then(must),
        sb.from('ditonton').select('tutorial_id').eq('user_id', uid).then(must)
      ]).then(function (r) {
        var mine = { nota: {}, kegemaran: [], ditonton: [] };
        r[0].forEach(function (n) { mine.nota[n.tutorial_id] = n.teks; });
        mine.kegemaran = r[1].map(function (k) { return k.tutorial_id; });
        mine.ditonton = r[2].map(function (k) { return k.tutorial_id; });
        U.local.set(cacheKey('mine'), mine);
        return mine;
      }, function (err) {
        if (err.code === 'network') return U.local.get(cacheKey('mine'), { nota: {}, kegemaran: [], ditonton: [] });
        throw err;
      });
    };
    S.saveNota = function (tid, teks) {
      if (!S.me) return Promise.reject(StoreError('permission'));
      teks = String(teks || '').trim().slice(0, 2000);
      if (!teks) return sb.from('nota').delete().eq('user_id', S.me.id).eq('tutorial_id', tid).then(must);
      return sb.from('nota').upsert({ user_id: S.me.id, tutorial_id: tid, teks: teks }, { onConflict: 'user_id,tutorial_id' }).then(must);
    };
    S.setKegemaran = function (tid, on) {
      if (!S.me) return Promise.reject(StoreError('permission'));
      if (on) return sb.from('kegemaran').upsert({ user_id: S.me.id, tutorial_id: tid }, { onConflict: 'user_id,tutorial_id', ignoreDuplicates: true }).then(must);
      return sb.from('kegemaran').delete().eq('user_id', S.me.id).eq('tutorial_id', tid).then(must);
    };
    S.markDitonton = function (tid) {
      if (!S.me) {
        var w = U.local.get(guestKey, []);
        if (w.indexOf(tid) < 0) { w.push(tid); U.local.set(guestKey, w); }
        return Promise.resolve();
      }
      return sb.from('ditonton').upsert({ user_id: S.me.id, tutorial_id: tid }, { onConflict: 'user_id,tutorial_id', ignoreDuplicates: true }).then(must);
    };

    S.listSoalan = function (tid) {
      return sb.from('soalan').select('*').eq('tutorial_id', tid).order('dicipta', { ascending: true }).then(must);
    };
    S.addSoalan = function (tid, teks) {
      return sb.from('soalan').insert({ tutorial_id: tid, teks: String(teks).trim().slice(0, 1000) }).select('*').single().then(must);
    };
    S.updateSoalan = function (id, teks) {
      return sb.from('soalan').update({ teks: String(teks).trim().slice(0, 1000) }).eq('id', id).select('*').single().then(must);
    };
    S.answerSoalan = function (id, jawapan) {
      return sb.from('soalan').update({ jawapan: String(jawapan || '').trim().slice(0, 2000) }).eq('id', id).select('*').single().then(must);
    };
    S.deleteRow = function (table, id) {
      if (['soalan', 'cadangan', 'laporan'].indexOf(table) < 0) return Promise.reject(StoreError('invalid'));
      return del(table, id);
    };
    S.addCadangan = function (c) {
      return sb.from('cadangan').insert({ produk_id: c.produk_id || null, tajuk: String(c.tajuk).trim().slice(0, 120), butiran: String(c.butiran || '').trim().slice(0, 1000) })
        .select('*').single().then(must);
    };
    S.listCadanganSaya = function () {
      if (!S.me) return Promise.resolve([]);
      return sb.from('cadangan').select('*').eq('user_id', S.me.id).order('dicipta', { ascending: false }).then(must);
    };
    S.addLaporan = function (l) {
      return sb.from('laporan').insert({ tutorial_id: l.tutorial_id, jenis: l.jenis, butiran: String(l.butiran || '').trim().slice(0, 1000) })
        .select('*').single().then(must);
    };
    S.setStatus = function (table, id, status) {
      if (['cadangan', 'laporan'].indexOf(table) < 0) return Promise.reject(StoreError('invalid'));
      return sb.from(table).update({ status: status }).eq('id', id).select('*').single().then(must);
    };

    /* ---------------- admin ---------------- */
    S.listInbox = function () {
      return Promise.all([
        sb.from('soalan').select('*').order('dicipta', { ascending: false }).limit(300).then(must),
        sb.from('cadangan').select('*').order('dicipta', { ascending: false }).limit(300).then(must),
        sb.from('laporan').select('*').order('dicipta', { ascending: false }).limit(300).then(must)
      ]).then(function (r) { return { soalan: r[0], cadangan: r[1], laporan: r[2] }; });
    };
    S.listUsers = function () {
      return sb.from('profiles').select('id,emel,nama,peranan,bahasa,dicipta').order('dicipta', { ascending: true }).then(must);
    };
    S.setRole = function (id, peranan) {
      return sb.from('profiles').update({ peranan: peranan }).eq('id', id).select('id,peranan').single().then(must);
    };

    S.classify = classify;
    return S;
  }

  window.GEPSupabaseStore = { create: create, classify: classify };
})();
