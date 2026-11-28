const CACHE = "kanto151-v3-2";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(["./", "./index.html", "./manifest.webmanifest"])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("kanto151-") && key !== CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first keeps catalog manifests and set records fresh after deploys.
  // Every successful same-origin response is cached, so the app, OCR runtime,
  // language models and lazily loaded card sets remain available offline later.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        try {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        } catch (cacheError) {
          // Storage quota or private-browsing restrictions must never turn a
          // successful network response into a failed application request.
        }
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await caches.match("./index.html");
        if (shell) return shell;
      }
      return new Response("Offline: dit onderdeel is nog niet lokaal opgeslagen.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
