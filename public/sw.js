// Animal Farts — offline-first service worker
// Precaches the app shell, all sound files, and the built JS/CSS bundles so
// the app works fully offline on first load. Asset paths are injected at
// build time by scripts/inject-sw-assets.mjs.

const CACHE = "animal-farts-v15";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
];

const SOUND_ASSETS = [
  "/sounds/cow.mp3",
  "/sounds/dog.mp3",
  "/sounds/cat.mp3",
  "/sounds/bird.mp3",
  "/sounds/horse.mp3",
  "/sounds/pig.mp3",
  "/sounds/duck.mp3",
  "/sounds/elephant.mp3",
  "/sounds/monkey.mp3",
  "/sounds/snake.mp3",
  "/sounds/lion.mp3",
  "/sounds/frog.mp3",
  "/sounds/bull.mp3",
  "/sounds/rabbit.mp3",
  "/sounds/bear.mp3",
  "/sounds/rooster.mp3",
  "/sounds/turtle.mp3",
  "/sounds/whale.mp3",
  "/sounds/ohno1.mp3",
  "/sounds/ohno2.mp3",
  "/sounds/ohno3.mp3",
  // v11: 2nd variants + 6 new animals
  "/sounds/extra/cow2.mp3",
  "/sounds/extra/dog_v2.mp3",
  "/sounds/extra/cat2.mp3",
  "/sounds/extra/bird2.mp3",
  "/sounds/extra/horse2.mp3",
  "/sounds/extra/pig2.mp3",
  "/sounds/extra/duck2.mp3",
  "/sounds/extra/elephant2.mp3",
  "/sounds/extra/monkey_v2.mp3",
  "/sounds/extra/snake2.mp3",
  "/sounds/extra/lion2.mp3",
  "/sounds/extra/frog2.mp3",
  "/sounds/extra/bull2.mp3",
  "/sounds/extra/rabbit_v2.mp3",
  "/sounds/extra/bear2.mp3",
  "/sounds/extra/rooster2.mp3",
  "/sounds/extra/turtle2.mp3",
  "/sounds/extra/whale2.mp3",
  "/sounds/extra/elephant_v3.mp3",
  "/sounds/extra/lion_v3.mp3",
  // v13: 15 v3 variants for existing animals
  "/sounds/extra/cow_v3.mp3",
  "/sounds/extra/dog_v3.mp3",
  "/sounds/extra/cat_v3.mp3",
  "/sounds/extra/bird_v3.mp3",
  "/sounds/extra/horse_v2.mp3",
  "/sounds/extra/pig_v3.mp3",
  "/sounds/extra/duck_v3.mp3",
  "/sounds/extra/monkey_v3.mp3",
  "/sounds/extra/snake_v3.mp3",
  "/sounds/extra/frog_v3.mp3",
  "/sounds/extra/bull_v3.mp3",
  "/sounds/extra/rabbit_v3.mp3",
  "/sounds/extra/bear_v3.mp3",
  "/sounds/extra/rooster_v3.mp3",
  "/sounds/extra/turtle_v3.mp3",
  "/sounds/extra/whale_v3.mp3",
  // v13: 6 v2 variants for v11 animals
  "/sounds/extra/goat_v2.mp3",
  "/sounds/extra/sheep_v2.mp3",
  "/sounds/extra/bee_v2.mp3",
  "/sounds/extra/turkey_v2.mp3",
  "/sounds/extra/owl_v2.mp3",
  "/sounds/extra/penguin_v2.mp3",
  // v13: 10 new animals
  "/sounds/extra/seal.mp3",
  "/sounds/extra/hippo.mp3",
  "/sounds/extra/rhino.mp3",
  "/sounds/extra/zebra.mp3",
  "/sounds/extra/giraffe.mp3",
  "/sounds/extra/moose.mp3",
  "/sounds/extra/kangaroo.mp3",
  "/sounds/extra/sloth.mp3",
  "/sounds/extra/skunk.mp3",
  "/sounds/extra/raccoon.mp3",
];

// __PRECACHE_ASSETS__
const PRECACHE_ASSETS = [
  "/assets/index-HfGtDziB.js",
  "/assets/index-BSNq1RqT.css"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // Shell: must succeed — if /index.html 404s we abort install
      await cache.addAll(SHELL_ASSETS);

      // Sound + JS/CSS: best-effort. If one fails (slow network, 404),
      // log and continue so the SW still installs.
      const optional = [...SOUND_ASSETS, ...(typeof PRECACHE_ASSETS !== "undefined" ? PRECACHE_ASSETS : [])];
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
