// SPDX-License-Identifier: AGPL-3.0-or-later
/* Globale Versionsnummer: eine neue Assetliste erhält vor der Veröffentlichung einen neuen Namen. */
const assetCache = 'wimm-app-assets-v1';
const appShell = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(assetCache).then((cache) => cache.addAll(appShell)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('wimm-app-assets-') && key !== assetCache).map((key) => caches.delete(key))
  )));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const assetRequest = request.destination === 'document' || ['font', 'image', 'script', 'style'].includes(request.destination);
  if (!assetRequest) return;
  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached !== undefined) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(assetCache);
      await cache.put(request, response.clone());
    }
    return response;
  }));
});
