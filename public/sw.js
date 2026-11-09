// Orbit offline cache. Caches the app shell and static files so the app opens
// without a connection. Database requests always go to the network. Saved
// entries are queued on the phone by lib/offline.js and synced by the shell.
const VERSION = 'orbit-v5';
const SHELL = ['/', '/journal', '/stats', '/topics', '/log', '/settings', '/login', '/study', '/progress', '/recall', '/atlas', '/awards', '/attention', '/resonance', '/guide', '/inspect', '/keystone', '/parallax'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Only our own origin is cached. Supabase calls go straight to the network.
  if (url.origin !== self.location.origin) return;

  // Static files: cache first, then fill the cache from the network.
  if (url.pathname.startsWith('/_next/static/') || /\.(png|css|js|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(VERSION).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Pages: network first, falling back to the cached copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('/')))
    );
  }
});
