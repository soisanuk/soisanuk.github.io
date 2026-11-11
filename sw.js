// Thai Trainer service worker — cache-first for all app assets
// "soisanuk-13f0215" is replaced with "soisanuk-<commit sha>" by CI on deploy,
// so every release invalidates the previous cache automatically.
const CACHE = "soisanuk-13f0215";

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
  "./js/letter-audio.js",
  "./js/tts.js",
  "./js/audio.js",
  "./js/ui.js",
  "./js/sessions.js",
  "./js/curriculum.js",
  "./js/learn.js",
  "./js/reader.js",
  "./js/seg-extra.js",
  "./js/seg-phrases.js",
  "./js/segment.js",
  "./js/gloss-extra.js",
  "./js/gloss.js",
  "./js/paste.js",
  "./js/backup.js",
  "./js/tutor.js",
  "./js/soi-buakhao.js",
  "./js/restaurant.js",
  "./js/connect4.js",
  "./js/game.js",
  "./js/baht-bus.js",
  "./js/clock.js",
  "./js/numbers.js",
  "./js/idioms.js",
  "./js/grammar.js",
  "./js/dialogues.js",
  "./js/home.js",
  "./js/main.js",
  "./manifest.json",
  // The 42 consonant recordings (letter-audio.js), about 15 KB each. They
  // are precached because the letter course must work offline from day one.
  "./audio/letters/0E01.mp3",
  "./audio/letters/0E02.mp3",
  "./audio/letters/0E04.mp3",
  "./audio/letters/0E06.mp3",
  "./audio/letters/0E07.mp3",
  "./audio/letters/0E08.mp3",
  "./audio/letters/0E09.mp3",
  "./audio/letters/0E0A.mp3",
  "./audio/letters/0E0B.mp3",
  "./audio/letters/0E0C.mp3",
  "./audio/letters/0E0D.mp3",
  "./audio/letters/0E0E.mp3",
  "./audio/letters/0E0F.mp3",
  "./audio/letters/0E10.mp3",
  "./audio/letters/0E11.mp3",
  "./audio/letters/0E12.mp3",
  "./audio/letters/0E13.mp3",
  "./audio/letters/0E14.mp3",
  "./audio/letters/0E15.mp3",
  "./audio/letters/0E16.mp3",
  "./audio/letters/0E17.mp3",
  "./audio/letters/0E18.mp3",
  "./audio/letters/0E19.mp3",
  "./audio/letters/0E1A.mp3",
  "./audio/letters/0E1B.mp3",
  "./audio/letters/0E1C.mp3",
  "./audio/letters/0E1D.mp3",
  "./audio/letters/0E1E.mp3",
  "./audio/letters/0E1F.mp3",
  "./audio/letters/0E20.mp3",
  "./audio/letters/0E21.mp3",
  "./audio/letters/0E22.mp3",
  "./audio/letters/0E23.mp3",
  "./audio/letters/0E25.mp3",
  "./audio/letters/0E27.mp3",
  "./audio/letters/0E28.mp3",
  "./audio/letters/0E29.mp3",
  "./audio/letters/0E2A.mp3",
  "./audio/letters/0E2B.mp3",
  "./audio/letters/0E2C.mp3",
  "./audio/letters/0E2D.mp3",
  "./audio/letters/0E2E.mp3",
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
      // <audio> asks for byte ranges, and Safari will not play a recording
      // served whole in reply to a range request. Slice cached audio
      // (the letter clips, any dialogue already played) into a proper 206.
      const range = e.request.headers.get("range");
      if (cached && range) return _rangeResponse(cached, range);
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

// A 206 Partial Content reply for `range` ("bytes=start-end") cut from a
// cached full response. A malformed or unsatisfiable range gets the whole
// body, which is what a server ignoring Range would do.
function _rangeResponse(full, range) {
  return full.arrayBuffer().then(buf => {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    const size = buf.byteLength;
    let start = m && m[1] !== "" ? +m[1] : NaN, end = m && m[2] !== "" ? +m[2] : size - 1;
    if (m && m[1] === "" && m[2] !== "") { start = Math.max(0, size - +m[2]); end = size - 1; }
    if (!m || isNaN(start) || start >= size || end < start) {
      return new Response(buf, { status: 200, headers: full.headers });
    }
    end = Math.min(end, size - 1);
    const headers = new Headers(full.headers);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Accept-Ranges", "bytes");
    return new Response(buf.slice(start, end + 1), { status: 206, statusText: "Partial Content", headers });
  });
}
