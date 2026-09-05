// Thai Trainer service worker — cache-first for all app assets
// "soisanuk-638a04f" is replaced with "soisanuk-<commit sha>" by CI on deploy,
// so every release invalidates the previous cache automatically.
const CACHE = "soisanuk-638a04f";

const PRECACHE = [
  "./index.html",
  "./favicon.svg",
  "./js/mobile.js",
  "./js/data.js",
  "./js/srs.js",
  "./js/examples.js",
  "./js/tokeniser.js",
  "./js/thai-script.js",
  "./js/wordcard.js",
  "./js/app.js",
  "./js/tts.js",
  "./js/audio.js",
  "./js/ui.js",
  "./js/sessions.js",
  "./js/curriculum.js",
  "./js/learn.js",
  "./js/reader.js",
  "./js/segment.js",
  "./js/gloss-extra.js",
  "./js/gloss.js",
  "./js/paste.js",
  "./js/backup.js",
  "./js/tutor.js",
  "./js/soi-buakhao.js",
  "./js/connect4.js",
  "./js/game.js",
  "./js/baht-bus.js",
  "./js/clock.js",
  "./js/numbers.js",
  "./js/idioms.js",
  "./js/home.js",
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
      return fetch(e.request)
        .then(res => {
          if (!res || res.status !== 200 || res.type === "opaque") return res;
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => {
          // Offline and nothing cached under this exact URL. This is a
          // single-page app — every "screen" is in-page JS state, not a
          // real sub-route — so any top-level page load (e.request.mode ===
          // "navigate") should fall back to the cached app shell rather
          // than the browser's offline error page. This matters because
          // the precache only keys "./index.html" — the PWA's own
          // start_url ("/", from manifest.json) is a DIFFERENT cache key
          // and would otherwise miss here every time the app is launched
          // offline from its home-screen icon.
          if (e.request.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});
