// English glosses for open-text words — the dictionary half of Paste Text.
//
// Kept separate from segment.js/lexicon-th.js on purpose, and not just for
// tidiness: the lexicon is CC0 and free of obligations, while these glosses
// are derived from English Wiktionary and carry CC BY-SA 3.0 (attribution +
// share-alike). One file per licence keeps the boundary obvious, and lets the
// gloss layer fail or be dropped without touching segmentation.
//
// Coverage is ~63% of the lexicon. A word with no gloss is NOT a failure —
// the word card still shows its decomposition and tone reasoning, which the
// script engine derives from spelling alone. Glosses are a bonus layer.

let _glossMap = null;
let _glossLoading = null;

function _glossReady() { return _glossMap !== null; }

function _glossInit(text) {
  _glossMap = new Map();
  for (const line of String(text).split("\n")) {
    const tab = line.indexOf("\t");
    if (tab > 0) _glossMap.set(line.slice(0, tab), line.slice(tab + 1));
  }
  return _glossMap.size;
}

// Lazily pull in js/gloss-th.js. Same <script>-injection approach as the
// lexicon (fetch() is blocked on file://), and likewise kept out of PRECACHE.
// cb(ok) — callers must treat ok === false as "no glosses", not as an error:
// the screen is fully usable without them.
function _glossLoad(cb) {
  if (_glossReady()) return cb(true);
  if (typeof THAI_GLOSS !== "undefined") { _glossInit(THAI_GLOSS); return cb(true); }
  if (_glossLoading) { _glossLoading.push(cb); return; }
  _glossLoading = [cb];
  const done = ok => { const qs = _glossLoading; _glossLoading = null; qs.forEach(f => f(ok)); };
  const el = document.createElement("script");
  el.src = "js/gloss-th.js";
  el.onload = () => {
    if (typeof THAI_GLOSS === "undefined") return done(false);
    _glossInit(THAI_GLOSS);
    done(true);
  };
  el.onerror = () => done(false);
  document.head.appendChild(el);
}

// The best available English for a word, or null.
// The curriculum's own gloss ALWAYS wins: it is written for this course, it
// matches the romanisation style, and it comes with example sentences. The
// Wiktionary layer only fills the gaps.
function thaiGloss(word) {
  if (typeof WORD_MAP !== "undefined" && WORD_MAP[word]) return WORD_MAP[word][2];
  return _glossMap ? (_glossMap.get(word) || null) : null;
}
