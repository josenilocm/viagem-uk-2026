const CACHE_NAME = "viagem-public-v3";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data/trip-public.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css"
];
const PUBLIC_PATHS = new Set(SHELL.map((path) => new URL(path, self.location.href).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const url = new URL(request.url);
  const cacheable = url.origin === self.location.origin && PUBLIC_PATHS.has(url.pathname);
  event.respondWith(
    fetch(request).then((response) => {
      if (cacheable) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || new Response("Conteúdo indisponível sem conexão.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })))
  );
});
