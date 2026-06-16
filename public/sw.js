// Chandra Paribahan offline service worker
// Strategy:
//  - HTML navigations: NetworkFirst with cached fallback
//  - Same-origin static assets (js/css/img/font): StaleWhileRevalidate
//  - Supabase / cross-origin API: never cache, let the app handle offline via IDB queue
const VERSION = "cp-v2";
const APP_SHELL = `app-shell-${VERSION}`;
const STATIC = `static-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((c) => c.addAll(["/"]).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip cross-origin (Supabase, OAuth, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip server-rendered API routes
  if (url.pathname.startsWith("/api/")) return;

  // HTML navigations -> NetworkFirst with offline fallback
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(APP_SHELL);
          cache.put("/", fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(APP_SHELL);
          const cached = (await cache.match(req)) || (await cache.match("/"));
          if (cached) return cached;
          return new Response(
            "<h1>অফলাইন</h1><p>ইন্টারনেট নেই এবং পেইজ ক্যাশে নেই।</p>",
            { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  // Static assets -> SWR
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
