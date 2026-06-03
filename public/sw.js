// Animal Farts — offline-first service worker
// Precaches the app shell + all sound files so it works fully offline on first load.

const CACHE = "animal-farts-v8-2";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
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
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // Add shell first; add sounds one-by-one so one missing file doesn't break install
      await c.addAll(SHELL_ASSETS);
      await Promise.all(
        SOUND_ASSETS.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((res) => (res.ok ? c.put(url, res.clone()) : null))
            .catch(() => null)
        )
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Only handle same-origin requests
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          // Cache successful responses for next time
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
