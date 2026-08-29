// Open-text Thai word segmenter — for text the curriculum doesn't know.
// Pure logic apart from _segLoad's script injection (unit-tested via node:vm).
//
// This is deliberately NOT makeTokeniser (tokeniser.js). The two solve
// different problems and the difference is not academic:
//
//   • _tokenise() greedy-matches the ~950-word curriculum map. Inside the
//     trainer that is exactly right — the corpus is known, and a match is a
//     word the learner is being taught.
//   • On arbitrary text a small map degrades badly: it matches มา inside
//     มาตรการ and glosses it "to come". A wrong gloss is worse than none.
//
// So the reader and example sentences keep using _tokenise unchanged, and this
// file is a separate entry point over a 12k-word frequency-ranked lexicon.
// Measured on 30 out-of-curriculum sentences: greedy+curriculum scores 84.8
// boundary-F1 with 23.9% of characters unmatched; this scores 95.0 with 0%.
// Full write-up: docs/chrome-extension-handoff.md §6.
//
// Algorithm: dictionary DP (newmm-style maximal matching). Every segmentation
// of the string is scored and the cheapest wins, where a known word costs
// log(rank) — its Zipf surprise, so common words beat rare ones — and an
// unknown cluster costs a flat penalty. Greedy longest-match can't do this:
// it commits to the first long match and cannot back out.

// Cost of an unknown character cluster. Tuned against the gold set: it has to
// exceed a plausible word's cost (log of a mid-rank ~ 9) so the DP prefers
// real words, without being so high that it forces absurd word chains over
// genuinely unknown text (names, loanwords, typos).
const _SEG_UNKNOWN_COST = 14;

let _segWords = null;    // Set of lexicon entries
let _segRank = null;     // word → 1-based frequency rank
let _segMaxLen = 0;

function _segReady() { return _segWords !== null; }

// Build the lookup tables from a frequency-ordered word list.
function _segInit(list) {
  _segWords = new Set();
  _segRank = new Map();
  _segMaxLen = 0;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w) continue;
    if (!_segWords.has(w)) { _segWords.add(w); _segRank.set(w, i + 1); }
    if (w.length > _segMaxLen) _segMaxLen = w.length;
  }
  return _segWords.size;
}

// Pull in js/lexicon-th.js on first use and call back with true/false.
// A <script> tag rather than fetch() on purpose: the app has to keep working
// from file://, where fetch() of a sibling file is blocked but a script tag
// is not. The service worker's runtime cache keeps it offline-available after
// the first load, so it does not need to be in PRECACHE.
let _segLoading = null;
function _segLoad(cb) {
  if (_segReady()) return cb(true);
  if (typeof THAI_LEXICON !== "undefined") { _segInit(THAI_LEXICON.split("\n")); return cb(true); }
  if (_segLoading) { _segLoading.push(cb); return; }
  _segLoading = [cb];
  const done = ok => { const qs = _segLoading; _segLoading = null; qs.forEach(f => f(ok)); };
  const el = document.createElement("script");
  el.src = "js/lexicon-th.js";
  el.onload = () => {
    if (typeof THAI_LEXICON === "undefined") return done(false);
    _segInit(THAI_LEXICON.split("\n"));
    done(true);
  };
  el.onerror = () => done(false);
  document.head.appendChild(el);
}

// Segment one string into [{text, known}]. Runs of text with no lexicon match
// (Latin, digits, punctuation, spaces, names) are merged into single unknown
// tokens rather than emitted one character at a time.
//
// Returns [] when the lexicon hasn't loaded — callers go through _segLoad.
function segmentThai(text) {
  const s = String(text == null ? "" : text);
  if (!_segReady() || !s) return [];
  const n = s.length;
  const best = new Float64Array(n + 1).fill(Infinity);
  const prev = new Int32Array(n + 1).fill(-1);
  const known = new Uint8Array(n + 1);
  best[0] = 0;

  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity || !_tkLegalBoundary(s, i)) continue;
    const lim = Math.min(_segMaxLen, n - i);
    for (let L = lim; L >= 1; L--) {
      // a word that would end mid-cluster is not a candidate — same rule the
      // curriculum tokeniser enforces, so both agree on where a cut may fall
      if (!_tkLegalBoundary(s, i + L)) continue;
      const w = s.substr(i, L);
      if (!_segWords.has(w)) continue;
      const c = best[i] + Math.log(_segRank.get(w) + 10);
      if (c < best[i + L]) { best[i + L] = c; prev[i + L] = i; known[i + L] = 1; }
    }
    // fall-through: swallow one whole character cluster as unknown
    let j = i + 1;
    while (j < n && !_tkLegalBoundary(s, j)) j++;
    const c = best[i] + _SEG_UNKNOWN_COST;
    if (c < best[j]) { best[j] = c; prev[j] = i; known[j] = 0; }
  }

  const raw = [];
  for (let p = n; p > 0; p = prev[p]) raw.unshift({ text: s.slice(prev[p], p), known: !!known[p] });

  const out = [];
  for (const t of raw) {
    const last = out[out.length - 1];
    if (!t.known && last && !last.known) last.text += t.text;   // merge unknown runs
    else out.push(t);
  }
  return out;
}
