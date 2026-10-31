const CACHE_NAME = 'vibe-fighter-shell-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('vibe-fighter-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') void cache.put(request, response.clone());
        return response;
      } catch {
        const shell = await cache.match('/index.html');
        if (shell) return shell;
        throw new Error('Vibe Fighter is not available offline until its first online launch.');
      }
    }

    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') void cache.put(request, response.clone());
      return response;
    });

    if (cached) {
      void network.catch(() => undefined);
      return cached;
    }

    try {
      return await network;
    } catch (error) {
      if (request.mode === 'navigate') {
        const shell = await cache.match('/index.html');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
