/* Offline use, scope /2027/: network first, then the kept copy of same-origin program pages and their CSS, fonts,
   images and script. The build sets VERSION, and OFF from the day after Event Day: the worker then deletes its
   copies and removes itself. */
// One cache for every build: the copies survive Event Day's rebuilds, and network first keeps them fresh.
var VERSION = 'BUILD', OFF = false, CACHE = 'kcd-texas-2027', me = self.serviceWorker;
var KEEP = /^\/(?:2027\/(?:schedule\/|today\/|sessions\/[^/]+\/|speakers\/(?:[^/]+\/)?|speakers\/[^/]+\.webp)|(?:_astro|brand)\/[^/]+\.(?:css|webp|avif|png|jpe?g|svg)|fonts\/.+\.woff2|schedule\.(?:js|css))$/;
function kept(u) { u = new URL(u, location.href); return u.origin === location.origin && !u.search && KEEP.test(u.pathname); }
// Saves only while this worker is active, so it can't undo a newer one's clean-up.
function save(req, res) {
  if (!res.ok || res.redirected || res.type !== 'basic' || (me && self.registration.active !== me)) return Promise.resolve();
  var copy = res.clone();
  return caches.open(CACHE).then(function (c) { return c.put(req, copy); });
}
function clear() {
  return caches.keys().then(function (k) { return Promise.all(k.filter(function (n) { return n.indexOf('kcd-texas-') === 0 && (OFF || n !== CACHE); }).map(function (n) { return caches.delete(n); })); });
}

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(OFF
    // Again after 3 s: the old worker may still be saving a page.
    ? clear().then(function () { return self.registration.unregister(); }).then(function () { return new Promise(function (r) { setTimeout(r, 3000); }); }).then(clear)
    : clear().then(function () { return self.clients.claim(); }));
});

if (!OFF) {
  self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET' || !kept(req.url)) return;
    var net = fetch(req).then(function (res) { return save(req, res).then(function () { return res; }, function () { return res; }); });
    e.waitUntil(net.catch(function () {}));
    e.respondWith(new Promise(function (done, fail) {
      var over = false;
      function copy() { return caches.match(req, { cacheName: CACHE }); }
      function end(r) { if (!over && r) { over = true; done(r); } }
      net.then(end, function (err) { copy().then(function (r) { if (r) end(r); else if (!over) { over = true; fail(err); } }); });
      // A hanging connection, as on a crowded Wi-Fi: the kept copy after 4 s.
      setTimeout(function () { copy().then(end); }, 4000);
    }));
  });
  // A page lists what it loaded, so its first visit is kept too.
  self.addEventListener('message', function (e) {
    var urls = (e.data && e.data.keep || []).filter(kept);
    e.waitUntil(Promise.all(urls.map(function (u) {
      return caches.match(u, { cacheName: CACHE }).then(function (hit) { return hit || fetch(u).then(function (res) { return save(u, res); }); }).catch(function () {});
    })));
  });
}
