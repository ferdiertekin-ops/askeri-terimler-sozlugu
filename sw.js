const CACHE_VERSION = "ats-pwa-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/pwa.html",
  "/uygulama/",
  "/offline.html",
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon-96.png",
  "/apple-touch-icon.png",
  "/icons/ats-icon-192.png",
  "/icons/ats-icon-512.png",
  "/icons/ats-maskable-192.png",
  "/icons/ats-maskable-512.png",
  "/icons/ats-monochrome.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const validCaches = new Set([STATIC_CACHE, RUNTIME_CACHE, DATA_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => !validCaches.has(key)).map(key => caches.delete(key)));

    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }

    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/content") {
    event.respondWith(networkFirstData(request));
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/editor/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event, request, url));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNavigation(event, request, url) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cacheKey = new Request(`${url.origin}${url.pathname}`, {
    method: "GET",
    credentials: "same-origin"
  });

  try {
    const preload = await event.preloadResponse;
    const response = preload || await fetch(request);

    if (isCacheable(response)) {
      event.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  } catch (error) {
    return (await cache.match(cacheKey)) ||
           (await caches.match(url.pathname)) ||
           (await caches.match("/")) ||
           (await caches.match("/offline.html"));
  }
}

async function networkFirstData(request) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const response = await fetch(request, { cache: "no-store" });
    if (isCacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then(async response => {
      if (isCacheable(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || network;
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/icons/") ||
         /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(pathname);
}

function isCacheable(response) {
  return response && response.ok && response.type === "basic";
}
