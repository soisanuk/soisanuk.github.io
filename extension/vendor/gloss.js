// COPIED from web/js/gloss.js by scripts/build-extension.mjs — do not edit here.
// Edit the source and re-run the build; --check fails on drift.
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
//
// Rows carry a romanisation too, converted from Wiktionary's Paiboon into this
// course's style by scripts/build-gloss.mjs. It can be empty: the generator
// drops any form whose tone mark disagrees with the app's own tone engine,
// rather than print a romanisation that contradicts the colour on the text.

let _glossMap = null;
let _glossLoading = null;

function _glossReady() { return _glossMap !== null; }

function _glossInit(text) {
  _glossMap = new Map();
  for (const line of String(text).split("\n")) {
    const p = line.split("\t");                 // word, gloss, romanisation
    if (p.length === 3 && p[0]) _glossMap.set(p[0], { en: p[1], roman: p[2] });
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

// ── The gap-filler layer (gloss-vol.js, Volubilis, CC BY-SA 4.0) ───────────
// Loaded the same lazy way, and consulted LAST. It covers 3,595 words no other
// layer has, but its first row for a spelling is often a homograph — มา "moon",
// เขา "mountain", ดี "gallbladder" — so it must never be in a position to
// overwrite a gloss we already have. Where it carries genuinely distinct
// senses the generated row already joins them with " · " and the card shows
// both, rather than picking one.
let _volMap = null;
let _volLoading = null;
function _volReady() { return _volMap !== null; }
function _volInit(text) {
  _volMap = new Map();
  for (const line of String(text).split("\n")) {
    const p = line.split("\t");
    if (p.length === 2 && p[0]) _volMap.set(p[0], p[1]);
  }
  return _volMap.size;
}
function _volLoad(cb) {
  if (_volReady()) return cb(true);
  if (typeof GLOSS_VOL !== "undefined") { _volInit(GLOSS_VOL); return cb(true); }
  if (_volLoading) { _volLoading.push(cb); return; }
  _volLoading = [cb];
  const done = ok => { const qs = _volLoading; _volLoading = null; qs.forEach(f => f(ok)); };
  const el = document.createElement("script");
  el.src = "js/gloss-vol.js";
  el.onload = () => {
    if (typeof GLOSS_VOL === "undefined") return done(false);
    _volInit(GLOSS_VOL);
    done(true);
  };
  el.onerror = () => done(false);
  document.head.appendChild(el);
}

// Which source a word's gloss came from — "course", "extra", "wiktionary",
// "volubilis", or null. The card uses it to credit the right dictionary:
// Wiktionary is CC BY-SA 3.0 and Volubilis 4.0, and attribution is a condition
// of both, so a screen showing a gloss has to name the one it actually used.
function glossSource(word) {
  if (typeof WORD_MAP !== "undefined" && WORD_MAP[word]) return "course";
  if (_glossExtra(word)) return "extra";
  if (_glossMap && _glossMap.get(word)) return "wiktionary";
  if (_volMap && _volMap.get(word)) return "volubilis";
  return null;
}

// The best available English for a word, or null.
// The curriculum's own gloss ALWAYS wins: it is written for this course, it
// matches the romanisation style, and it comes with example sentences. The
// Wiktionary layer only fills the gaps.
// Precedence: the course's own words, then GLOSS_EXTRA (gloss-extra.js — hand-
// curated entries for words Wiktionary does not cover, or covers badly), then
// the Wiktionary layer. The supplement sits ABOVE Wiktionary on purpose: an
// entry someone wrote for this app after checking it beats a crowd-sourced one,
// and it is the only way to correct a Wiktionary gloss without editing a
// generated file. Kept in its own file so the CC BY-SA boundary of gloss-th.js
// stays exact — nothing of ours is mixed into the derived database.
function _glossExtra(word) {
  return (typeof GLOSS_EXTRA !== "undefined" && GLOSS_EXTRA[word]) || null;
}
function thaiGloss(word) {
  if (typeof WORD_MAP !== "undefined" && WORD_MAP[word]) return WORD_MAP[word][2];
  const x = _glossExtra(word);
  if (x) return x[1];
  const e = _glossMap && _glossMap.get(word);
  if (e) return e.en;
  return (_volMap && _volMap.get(word)) || null;
}

// The romanisation, same precedence: the course's hand-written one first, then
// the derived one, then null. Never a guess — an empty derived field means the
// generator refused it.
function thaiRoman(word) {
  if (typeof WORD_MAP !== "undefined" && WORD_MAP[word]) return WORD_MAP[word][1];
  const x = _glossExtra(word);
  if (x) return x[0] || null;
  const e = _glossMap && _glossMap.get(word);
  return (e && e.roman) ? e.roman : null;
}
