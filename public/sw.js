// Animal Farts — offline-first service worker
// Precaches the app shell, all sound files, and the built JS/CSS bundles so
// the app works fully offline on first load. Asset paths are injected at
// build time by scripts/inject-sw-assets.mjs.

const CACHE = "animal-farts-v25r";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
];

// v25m: the catalog is 270+ farts (~23MB). Don't precache — too big.
// Runtime caching fetches and stores each fart on first play. After
// the kid has tapped 30 different animals, their active flavors are
// cached and the app works offline. Best of both worlds.
const SOUND_ASSETS = [];

// __PRECACHE_ASSETS__
const PRECACHE_ASSETS = self.__INJECTED_PRECACHE__ || [];

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // Shell: must succeed — if /index.html 404s we abort install
      await cache.addAll(SHELL_ASSETS);

      // Sound + JS/CSS: best-effort. If one fails (slow network, 404),
      // log and continue so the SW still installs.
      const optional = [...SOUND_ASSETS, ...(self.__INJECTED_PRECACHE__ || PRECACHE_ASSETS)];
      const results = await Promise.allSettled(
        optional.map(async (url) => {
          const res = await fetch(url, { cache: "reload" });
          if (res && res.ok) {
            await cache.put(url, res.clone());
            return { url, ok: true };
          }
          return { url, ok: false, status: res ? res.status : "no-res" };
        })
      );
      const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
      if (failed.length) {
        console.warn(`[sw] ${failed.length}/${optional.length} precache entries failed:`, failed.slice(0, 5));
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    (async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;

      try {
        const res = await fetch(e.request);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      } catch (err) {
        // Offline + not in cache. For navigation requests, return the shell
        // so the SPA still loads.
        if (e.request.mode === "navigate") {
          const shell = await caches.match("/index.html");
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});

// Allow the page to trigger a "skip waiting" so the new SW takes over immediately
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Push notification handler — shows a daily challenge reminder
self.addEventListener("push", (e) => {
  let data = { title: "💨 Animal Farts", body: "Today's challenge is live! Tap to play.", url: "/?action=challenge" };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
      tag: "animal-farts-daily",
      renotify: true,
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click → focus the app and navigate
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "navigate", url: targetUrl });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
