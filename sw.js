// App shell cache so the home screen icon opens instantly. links.enc.json is
// always fetched fresh (network first) so a changed link reaches every phone.
const CACHE = 'bsa-coaches-v2';
const SHELL = ['./', 'index.html', 'attendance.html', 'app.css', 'crypto.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first for everything on our origin; the cache is only the offline fallback.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && !url.pathname.endsWith('links.enc.json')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
