/* GEP Help: shared helpers (no dependencies). Exposes window.GEPU. */
(function () {
  'use strict';
  var U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  U.uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 256 | 0; });
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  /* ---------- local storage that never throws ---------- */
  U.local = {
    get: function (k, def) {
      try { var v = window.localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    remove: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------- icons ---------- */
  var ICON = {
    chev: '<path d="M9 18l6-6-6-6"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    prev: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    play: '<path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8z" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    starOn: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="currentColor"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c.8-3.8 3.6-5.8 7.2-5.8s6.4 2 7.2 5.8"/>',
    logout: '<path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    note: '<path d="M6 3.5h9l4 4V20a.5.5 0 01-.5.5h-12A.5.5 0 016 20z"/><path d="M14.5 3.5V8H19M9 12.5h6M9 16h4"/>',
    chat: '<path d="M4 5.5h16v10H9l-5 4z"/>',
    flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 014.8.9c0 1.8-2.4 2.2-2.4 3.8"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    phone: '<path d="M5 4.5c0-.6.4-1 1-1h2.4l1.4 4-2 1.3a11 11 0 006.4 6.4l1.3-2 4 1.4V17c0 .6-.4 1-1 1A15 15 0 015 4.5z"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8"/>',
    circle: '<circle cx="12" cy="12" r="7.5"/>',
    arrow: '<path d="M18 18L7 7M7 15V7h8"/>',
    rotate: '<path d="M20 12a8 8 0 11-2.4-5.7"/><path d="M20 4v5h-5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8 11h6"/>',
    grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
    inbox: '<path d="M3.5 13.5l2.5-8h12l2.5 8V19a1 1 0 01-1 1h-15a1 1 0 01-1-1z"/><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/>',
    users: '<circle cx="9" cy="9" r="3.3"/><path d="M3 19c.6-3.2 2.8-5 6-5s5.4 1.8 6 5"/><path d="M15.5 6.2a3.2 3.2 0 010 5.8M17.5 14.4c1.8.6 3 2.2 3.5 4.6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
    steps: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>',
    wifiOff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.5a10 10 0 015.2-2.7M14.5 9.9A10 10 0 0119 12.5M2 9a15 15 0 014.4-2.6M11 5.1A15 15 0 0122 9"/><circle cx="12" cy="20" r=".8" fill="currentColor"/>',
    shield: '<path d="M12 3c2.6 1.3 5.4 1.8 7.8 1.9v6.9c0 5-3.3 8.3-7.8 10.2-4.5-1.9-7.8-5.2-7.8-10.2V4.9C6.6 4.8 9.4 4.3 12 3z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
    whatsapp: '<path d="M5 19l1-3.6A8 8 0 1110 19.3z"/><path d="M9.2 8.6c.2 2.6 2.2 4.8 5 5.4l.9-1.2 1.8.9c-.2 1-1 1.7-2 1.6-3.7-.5-6.6-3.3-7-7-.1-1 .6-1.8 1.6-2l.9 1.8z" fill="currentColor" stroke="none"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4"/>'
  };
  U.svg = function (name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICON[name] || '') + '</svg>';
  };

  U.BRAND =
    '<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
    '<rect width="40" height="40" rx="9" fill="#13202D"/>' +
    '<path d="M20 5.5l11 3.6v9.6c0 7.4-4.6 12.2-11 15.3-6.4-3.1-11-7.9-11-15.3V9.1z" fill="#FFC20E"/><path d="M26.2 16.2A7.6 7.6 0 1 0 27.4 21H20.6" fill="none" stroke="#13202D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.6 17.2v6.6c0 .6.7 1 1.2.6l4.3-3.3c.4-.3.4-.9 0-1.2l-4.3-3.3c-.5-.4-1.2 0-1.2.6z" fill="#13202D"/>' +
    '</svg>';

  /* ---------- welcome illustrations ---------- */
  function card(x, y, r, fill, ink, code) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ')">' +
      '<rect x="6" y="6" width="200" height="50" rx="10" fill="#13202D"/>' +
      '<rect x="0" y="0" width="200" height="50" rx="10" fill="#fff"/>' +
      '<rect x="8" y="8" width="34" height="34" rx="7" fill="' + fill + '"/>' +
      '<text x="25" y="30" text-anchor="middle" font-family="Heros Cn, Arial Narrow, sans-serif" font-weight="700" font-size="11" fill="' + ink + '" stroke="none">' + code + '</text>' +
      '<rect x="52" y="14" width="104" height="8" rx="4" fill="#C9D1DA" stroke="none"/>' +
      '<rect x="52" y="28" width="70" height="7" rx="3.5" fill="#DEE3E9" stroke="none"/>' +
      '<path d="M178 18l7 7-7 7" fill="none"/></g>';
  }
  U.ART = [
    // 1: phone showing a numbered step with a red circle, plus a shield sticker
    '<svg viewBox="0 0 300 240" aria-hidden="true" focusable="false"><g stroke="#13202D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="112" y="30" width="110" height="196" rx="18" fill="#13202D"/>' +
    '<rect x="104" y="22" width="110" height="196" rx="18" fill="#fff"/>' +
    '<rect x="115" y="44" width="88" height="146" rx="6" fill="#EEF1F4"/>' +
    '<line x1="147" y1="33" x2="171" y2="33"/>' +
    '<rect x="124" y="56" width="70" height="44" rx="5" fill="#fff"/>' +
    '<rect x="134" y="72" width="50" height="14" rx="7" fill="#FFC20E"/>' +
    '<circle cx="159" cy="79" r="20" fill="none" stroke="#E5262A" stroke-width="4"/>' +
    '<circle cx="132" cy="122" r="9" fill="#13202D"/>' +
    '<text x="132" y="126" text-anchor="middle" font-family="Heros Cn, Arial Narrow, sans-serif" font-weight="700" font-size="11" fill="#FFC20E" stroke="none">1</text>' +
    '<rect x="148" y="117" width="46" height="7" rx="3.5" fill="#C9D1DA" stroke="none"/>' +
    '<circle cx="132" cy="152" r="9" fill="#13202D"/>' +
    '<text x="132" y="156" text-anchor="middle" font-family="Heros Cn, Arial Narrow, sans-serif" font-weight="700" font-size="11" fill="#FFC20E" stroke="none">2</text>' +
    '<rect x="148" y="147" width="36" height="7" rx="3.5" fill="#C9D1DA" stroke="none"/>' +
    '<g transform="rotate(-10 86 174)">' +
    '<path d="M91 147c12 6 22 8 32 8v24c0 18-14 30-32 38-18-8-32-20-32-38v-24c10 0 20-2 32-8z" fill="#13202D"/>' +
    '<path d="M86 142c12 6 22 8 32 8v24c0 18-14 30-32 38-18-8-32-20-32-38v-24c10 0 20-2 32-8z" fill="#2563B8"/>' +
    '<path d="M72 177l10 10 19-21" stroke="#fff" stroke-width="6" fill="none"/></g>' +
    '<path d="M236 50l12-12M242 70l16-2M222 38l2-14" fill="none"/>' +
    '</g></svg>',
    // 2: three product cards, one being tapped
    '<svg viewBox="0 0 300 240" aria-hidden="true" focusable="false"><g stroke="#13202D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
    card(36, 26, -3, '#FFC20E', '#13202D', 'APP') +
    card(54, 94, 2, '#2563B8', '#fff', 'OPS') +
    card(38, 162, -1.5, '#2E9A63', '#fff', 'LITE') +
    '<circle cx="250" cy="124" r="17" fill="#fff"/><circle cx="250" cy="124" r="6" fill="#13202D"/>' +
    '<path d="M250 94v-10M274 108l8-6M276 132l9 2" fill="none"/>' +
    '</g></svg>',
    // 3: speech bubble with a play button and a tick: video + ask for help
    '<svg viewBox="0 0 300 240" aria-hidden="true" focusable="false"><g stroke="#13202D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="52" y="40" width="150" height="100" rx="14" fill="#13202D"/>' +
    '<rect x="44" y="32" width="150" height="100" rx="14" fill="#fff"/>' +
    '<circle cx="119" cy="82" r="24" fill="#FFC20E"/>' +
    '<path d="M112 70v24l19-12z" fill="#13202D"/>' +
    '<path d="M150 150h96a12 12 0 0112 12v32a12 12 0 01-12 12h-60l-24 18v-18h-12a12 12 0 01-12-12v-32a12 12 0 0112-12z" fill="#fff"/>' +
    '<rect x="160" y="166" width="70" height="8" rx="4" fill="#C9D1DA" stroke="none"/>' +
    '<rect x="160" y="182" width="48" height="8" rx="4" fill="#DEE3E9" stroke="none"/>' +
    '<circle cx="232" cy="64" r="28" fill="#2E9A63"/>' +
    '<path d="M219 64l9 9 17-18" stroke="#fff" stroke-width="6" fill="none"/>' +
    '<path d="M40 170l10 6M30 196l14-2M62 214l4-12" fill="none"/>' +
    '</g></svg>'
  ];

  /* ---------- colours ---------- */
  U.SWATCHES = ['#FFC20E', '#2563B8', '#2E9A63', '#E0582B', '#7A4FC4', '#13202D'];
  function lum(hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  // Picks navy or white text, whichever has the higher WCAG contrast on this background.
  U.onColor = function (hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return '#13202D';
    var l = lum(hex);
    var white = 1.05 / (l + 0.05), ink = (l + 0.05) / (lum('#13202D') + 0.05);
    return ink >= white ? '#13202D' : '#FFFFFF';
  };

  /* ---------- YouTube ---------- */
  U.ytId = function (url) {
    var s = String(url || '').trim();
    if (!s) return '';
    var m;
    try {
      if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
      var u = new URL(s);
      var host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
      if (host === 'youtu.be') m = u.pathname.split('/')[1];
      else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (u.pathname === '/watch') m = u.searchParams.get('v');
        else {
          var p = u.pathname.split('/');
          if (['embed', 'shorts', 'live', 'v'].indexOf(p[1]) >= 0) m = p[2];
        }
      }
    } catch (e) { return ''; }
    return /^[A-Za-z0-9_-]{11}$/.test(m || '') ? m : '';
  };
  U.ytNormalize = function (url) {
    var id = U.ytId(url);
    return id ? 'https://www.youtube.com/watch?v=' + id : '';
  };

  /* ---------- dates ---------- */
  U.fmtDate = function (iso, lang) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-MY' : 'ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    } catch (e) { return d.toISOString().slice(0, 10); }
  };
  U.fmtNum = function (n, lang) {
    try { return new Intl.NumberFormat(lang === 'en' ? 'en-MY' : 'ms-MY').format(n); } catch (e) { return String(n); }
  };
  U.isRecent = function (iso, days) {
    if (!iso) return false;
    var t = new Date(iso).getTime();
    return !isNaN(t) && Date.now() - t < days * 864e5;
  };

  /* ---------- image markers ---------- */
  U.cleanMarkers = function (arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    arr.forEach(function (m) {
      if (!m || typeof m !== 'object') return;
      var x = Number(m.x), y = Number(m.y);
      if (!isFinite(x) || !isFinite(y)) return;
      x = Math.max(0, Math.min(100, x)); y = Math.max(0, Math.min(100, y));
      if (m.t === 'o') {
        var r = Number(m.r); r = isFinite(r) ? Math.max(3, Math.min(40, r)) : 12;
        out.push({ t: 'o', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: Math.round(r * 10) / 10 });
      } else if (m.t === 'a') {
        var d = Number(m.d); d = isFinite(d) ? ((Math.round(d) % 360) + 360) % 360 : 135;
        out.push({ t: 'a', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, d: d });
      }
    });
    return out.slice(0, 20);
  };
  // Markers are HTML elements laid over the picture, positioned in % of the picture box.
  U.markersHtml = function (arr, selected) {
    return U.cleanMarkers(arr).map(function (m, i) {
      var sel = i === selected ? ' sel' : '';
      if (m.t === 'o') {
        return '<span class="mk mk-o' + sel + '" data-mk="' + i + '" style="left:' + m.x + '%;top:' + m.y + '%;width:' + (m.r * 2) + '%"></span>';
      }
      return '<span class="mk mk-a' + sel + '" data-mk="' + i + '" style="left:' + m.x + '%;top:' + m.y + '%;transform:rotate(' + m.d + 'deg)">' +
        '<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
        '<path d="M3 15L34 0v9h63v12H34v9z"/></svg></span>';
    }).join('');
  };

  // width/height attributes let the browser keep space for a picture before it loads.
  U.dims = function (l) {
    var w = Number(l && l.gambar_lebar), h = Number(l && l.gambar_tinggi);
    return w > 0 && h > 0 ? ' width="' + Math.round(w) + '" height="' + Math.round(h) + '"' : '';
  };

  /* ---------- image compression ---------- */
  var webpOk = null;
  function canWebp() {
    if (webpOk === null) {
      try { var c = document.createElement('canvas'); c.width = c.height = 1; webpOk = c.toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { webpOk = false; }
    }
    return webpOk;
  }
  // Resizes to at most maxSide px and re-encodes (WebP when possible, else JPEG) to ~target bytes.
  U.compressImage = function (file, maxSide, target) {
    maxSide = maxSide || 1600; target = target || 180 * 1024;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) { reject(new Error('image-type')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { reject(new Error('image-decode')); return; }
        var s = Math.min(1, maxSide / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        var g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, cw, ch);
        g.drawImage(img, 0, 0, cw, ch);
        var type = canWebp() ? 'image/webp' : 'image/jpeg';
        var q = 0.82;
        (function attempt() {
          c.toBlob(function (b) {
            if (!b) { reject(new Error('image-encode')); return; }
            if (b.type !== type && type === 'image/webp') { type = 'image/jpeg'; attempt(); return; }
            if (b.size > target && q > 0.45) { q -= 0.12; attempt(); return; }
            resolve({ blob: b, width: cw, height: ch, type: b.type, ext: b.type === 'image/webp' ? 'webp' : 'jpg' });
          }, type, q);
        })();
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image-decode')); };
      img.src = url;
    });
  };

  U.debounce = function (fn, ms) {
    var t;
    return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
  };

  U.isNetworkError = function (err) {
    if (!err) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    var m = String(err.message || err.details || err) || '';
    return /failed to fetch|networkerror|network request failed|load failed|fetch error|err_internet|timeout/i.test(m);
  };

  window.GEPU = U;
})();
