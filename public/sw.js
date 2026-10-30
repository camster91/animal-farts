// Poot Party — offline-first service worker
// Precaches the app shell, the built JS/CSS bundles, and self-hosted
// fonts so the app works fully offline on first load. Asset paths
// are injected at build time by scripts/inject-sw-assets.mjs.
//
// v74: dropped the 7 scene-illustration JPEGs (scenes/farm.jpg etc.)
// from the precache list. v25w-era used them as canvas backgrounds
// for the bubble canvas; v61's CardGrid replaced that with a CSS
// gradient background.
// v56 audit: deleted public/scenes/ entirely (~1.7MB) — unused at runtime.
// v55: never cache /api/* (personalized social data). Validate
// notification click URLs to same-origin relative paths only.

const CACHE = "pootbox-v57-audio";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
  // v29: self-hosted Fredoka (privacy, COPPA). Used by index.css
  // @font-face declarations. Three weights.
  "/fonts/Fredoka-Regular.woff2",
  "/fonts/Fredoka-SemiBold.woff2",
  "/fonts/Fredoka-Bold.woff2",
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

/** Allow only same-origin relative paths (open-redirect defense). */
function safeAppUrl(raw) {
  if (typeof raw !== "string" || !raw) return "/";
  // Absolute http(s) URLs — only same origin.
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (u.origin !== self.location.origin) return "/";
      return u.pathname + u.search + u.hash;
    }
  } catch {
    return "/";
  }
  // Relative path only; reject protocol-relative and weird schemes.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

// A single audio byte range is enough for native HTML audio players.
async function audioRange(response, value) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return response;
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start >= size || start > end || (!match[1] && Number(match[2]) === 0)) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // API responses are personalized (feed, me, reactions) — never cache.
  // Network-only so stale social state can't be replayed offline/across users.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Media elements ask for byte ranges. Cache a complete 200 response and
  // answer their range from those bytes, including when the network is offline.
  // Cache.put rejects 206 responses, so storing the original request failed.
  if (url.pathname.startsWith("/sounds/") || url.pathname.startsWith("/uploads/")) {
    e.respondWith((async () => {
      const headers = new Headers(e.request.headers);
      headers.delete("range");
      headers.delete("if-range");
      const fullRequest = new Request(e.request, { headers });
      let cache;
      let response;
      try {
        cache = await caches.open(CACHE);
        response = await cache.match(fullRequest);
      } catch { /* Storage can be unavailable; online playback still works. */ }
      if (!response) {
        response = await fetch(fullRequest);
        if (response.status === 200 && cache) {
          try { await cache.put(fullRequest, response.clone()); }
          catch { /* Quota/storage failure must not interrupt playback. */ }
        }
      }
      const range = e.request.headers.get("range");
      if (!range || response.status !== 200) return response;
      return audioRange(response, range);
    })());
    return;
  }

  e.respondWith(
    (async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;

      try {
        const res = await fetch(e.request);
        if (res && res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}));
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
      data: { url: safeAppUrl(data.url) },
      tag: "animal-farts-daily",
      renotify: true,
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click → focus the app and navigate
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = safeAppUrl((e.notification.data && e.notification.data.url) || "/");
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
