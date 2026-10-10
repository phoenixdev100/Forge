/**
 * Forge service worker - installable app + honest offline behaviour.
 *
 * Gym basements eat signal, so this keeps the app itself usable offline and
 * serves the last copy of data you loaded. What it deliberately does NOT do is
 * pretend writes succeeded: logging a set with no connection fails loudly, so
 * you never finish a workout believing it was saved when it wasn't.
 */

const VERSION = 'v1';
const SHELL_CACHE = `forge-shell-${VERSION}`;
const ASSET_CACHE = `forge-assets-${VERSION}`;
const DATA_CACHE = `forge-data-${VERSION}`;

// Hashed bundles are cached on demand; only the entry points are precached.
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Lets a new build take over without the user hunting through browser menus. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // writes are never intercepted
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App data: fresh when online, last-known when not.
  if (url.pathname.startsWith('/api/')) {
    // Auth probes must never be answered from cache - a stale 200 would make
    // a signed-out user look signed in.
    if (url.pathname.startsWith('/api/auth/')) return;
    event.respondWith(
      networkFirst(request, DATA_CACHE).catch(
        () =>
          new Response(
            JSON.stringify({
              error: { code: 'OFFLINE', message: "You're offline. Reconnect to load this." },
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );
    return;
  }

  // Navigations: the SPA shell, so deep links work offline too.
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, SHELL_CACHE).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/index.html')) ?? Response.error();
      }),
    );
    return;
  }

  // Build output and uploaded media: immutable, so cache-first is safe.
  if (/\.(js|css|woff2?|png|jpe?g|svg|gif|webp|avif|ico)$/.test(url.pathname) || url.pathname.startsWith('/uploads/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => Response.error()));
  }
});
