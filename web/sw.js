/* GEP Help service worker: keeps the app shell and recently viewed pictures available offline.
   Same-origin files: network first (always fresh when online), cache as fallback.
   Pictures from Supabase Storage and the supabase-js library: cache first. */
var VERSION = 'gep-help-v1.2.0';
var SHELL = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/util.js', 'js/i18n.js', 'js/store-demo.js', 'js/store-supabase.js', 'js/app.js', 'js/admin.js',
  'i18n/ms.json', 'i18n/en.json',
  'fonts/heros-regular.woff', 'fonts/heros-bold.woff', 'fonts/heroscn-bold.woff',
  'icons/icon-192.png', 'icons/icon-512.png',
  'img/contoh/app-1.jpg', 'img/contoh/app-2.jpg', 'img/contoh/app-3.jpg',
  'img/contoh/ops-1.jpg', 'img/contoh/ops-2.jpg', 'img/contoh/ops-3.jpg',
  'img/contoh/lite-1.jpg', 'img/contoh/lite-2.jpg', 'img/contoh/lite-3.jpg'
];
var RUNTIME = 'gep-help-runtime';
var RUNTIME_MAX = 200;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== RUNTIME; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function timeout(ms) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); }); }

function networkFirst(req) {
  return Promise.race([fetch(req), timeout(6000)]).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    });
  });
}

function trim(cache) {
  cache.keys().then(function (keys) {
    if (keys.length > RUNTIME_MAX) Promise.all(keys.slice(0, keys.length - RUNTIME_MAX).map(function (k) { return cache.delete(k); }));
  });
}

function cacheFirst(req) {
  return caches.open(RUNTIME).then(function (cache) {
    return cache.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()); trim(cache); }
        return res;
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (/\/storage\/v1\/object\/public\//.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
  if (url.hostname === 'cdn.jsdelivr.net' && /@supabase\/supabase-js@/.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
});
