// Thai Trainer service worker — cache-first for all app assets
// "thaicab-dev" is replaced with "thaicab-<commit sha>" by CI on deploy,
// so every release invalidates the previous cache automatically.
const CACHE = "thaicab-dev";

const PRECACHE = [
  "./index.html",
  "./favicon.svg",
  "./js/mobile.js",
  "./js/data.js",
  "./js/srs.js",
  "./js/examples.js",
  "./js/tokeniser.js",
  "./js/thai-script.js",
  "./js/app.js",
  "./js/tts.js",
  "./js/audio.js",
  "./js/ui.js",
  "./js/sessions.js",
  "./js/tutor.js",
  "./js/soi-buakhao.js",
  "./js/connect4.js",
  "./js/game.js",
  "./js/main.js",
  "./manifest.json",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  // Only handle same-origin GET requests
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
