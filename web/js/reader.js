// The graded reader — comprehensible-input practice over the EXAMPLES corpus.
// A sentence's GRADE is the latest LETTER_BATCHES rung needed to decode all its
// Thai glyphs, so each level shows only text the learner can actually sound
// out (Krashen's i+1, keyed to this app's own reading ladder). Tap any word to
// define it (the shared word-card → same SRS store); flip tone colours on to
// see each readable syllable painted by its tone (syllableTone/TONE_COLORS).
// App-only, not vendored. readerGrade/readerFeed are DOM-free and vm-tested.

// Cutoffs are the reading-ladder rung a sentence's hardest glyph needs. Full
// example sentences are letter-rich, so even "First reads" sits a few rungs in.
// The top tier used to be a catch-all for glyphs the course never taught —
// eighteen of them — which is no longer a category: the ladder teaches every
// Thai letter in WORDS as of the b9/b10 rungs, and a test holds it there.
// Counts on the real corpus: ≤4 → 20, ≤6 → 156, ≤7 → 378, ≤10 → 960 (recounted
// 2026-09-05, at ten rungs and 960 examples). These drift with EXAMPLES —
// editing ONE example sentence moved two of them the same day this comment was
// last corrected. The UI computes them live, so only this comment and
// architecture.md can ever be wrong; recount rather than trust them.
const READER_LEVELS = [
  { name: "First reads", max: 4 },
  { name: "Getting around", max: 6 },
  { name: "Street Thai", max: 7 },
  // DERIVED, not 8. The comment above always said "max = LETTER_BATCHES.length"
  // while the value was hardcoded, so the day the ladder grew two rungs the top
  // tier would have silently dropped every sentence needing them — exactly the
  // sentences the new rungs exist to unlock.
  { name: "The whole soi", max: LETTER_BATCHES.length },
];
const READER_COLOR_KEY = "soisanuk_tonecolor";
const READER_POS_KEY = "soisanuk_readerpos";

// Where you got to in each level. The reader was the app's largest countable
// collection — 940 sentences at the top tier — and the only one with no memory
// at all: leaving and coming back restarted at 1/940, and the controls are
// ‹ / Next › with no seek, so resuming at 251 meant 250 clicks. Every other
// collection (950 words, 60 script cards, 17 units) has a store behind it.
// Found by the 2026-08-30 completionist round.
//
// Keyed by level INDEX but anchored on the sentence TEXT: readerFeed is
// computed live from EXAMPLES, so adding examples shifts every index after the
// insertion point. On open we re-find the remembered sentence and use its
// current position; the stored index is only a fallback for when that sentence
// has left the corpus entirely.
function _readerPosLoad() {
  try { return JSON.parse(localStorage.getItem(READER_POS_KEY) || "{}"); } catch { return {}; }
}
function _readerPosSave(pos) {
  try { localStorage.setItem(READER_POS_KEY, JSON.stringify(pos)); } catch { /* private mode */ }
}
// Pure: given what was stored for a level and the CURRENT feed, where should we
// resume? Re-anchor on the text; fall back to the index, clamped; 0 if neither
// is usable. Never returns the end-of-level screen — finishing and coming back
// starts you over rather than dropping you on "you read them all".
function _readerResumeAt(saved, feed) {
  if (!saved || !feed || !feed.length) return 0;
  // A cleared level starts over. Its card says "✓ read all 18", so tapping it
  // means "again" — parking on the last sentence would be a strange place to
  // land, and the end screen is worse.
  if (saved.done) return 0;
  if (saved.th) {
    const i = feed.findIndex(s => s.th === saved.th);
    if (i >= 0) return i;
  }
  const at = Number(saved.at);
  if (!Number.isFinite(at) || at < 0) return 0;
  return Math.min(at, feed.length - 1);
}

// glyph -> earliest LETTER_BATCHES index, built once (LETTER_BATCHES is
// static data). readerGrade was doing up to LETTER_BATCHES.length fresh Set
// builds (taughtGlyphs) per glyph; this makes each lookup O(1) instead.
let _glyphBatchMap = null;
function _glyphBatch(ch) {
  if (!_glyphBatchMap) {
    _glyphBatchMap = new Map();
    for (let i = 0; i < LETTER_BATCHES.length; i++) {
      for (const g of LETTER_BATCHES[i].glyphs) {
        if (!_glyphBatchMap.has(g)) _glyphBatchMap.set(g, i);
      }
    }
  }
  return _glyphBatchMap.has(ch) ? _glyphBatchMap.get(ch) : LETTER_BATCHES.length;
}

// the latest ladder rung a sentence needs (max over its Thai letters/vowels/
// marks); a glyph taught in no batch pushes the sentence past the ladder.
function readerGrade(thai) {
  let g = 0;
  for (const ch of String(thai)) {
    const cp = ch.codePointAt(0);
    // ฿ (U+0E3F, baht sign) falls inside the mark range below but is
    // currency, not a letter — skip it so a price doesn't inflate the grade.
    if (cp === 0x0E3F) continue;
    // …0x0E4C, not 0x0E4B. การันต์ (U+0E4C) sat one codepoint outside the
    // range, so it never raised a sentence's grade: every word carrying a
    // silent letter — เบียร์, บาร์, ดวงจันทร์, สัปดาห์ — graded as if the mark
    // were not there. 17 such sentences sat in "Getting around" (max 6) and 38
    // in "Street Thai" (max 7) while ์ is not taught until rung 8. It is the
    // exact letter the rung-8 note exists to introduce.
    const isLetter = (cp >= 0x0E01 && cp <= 0x0E2E) || (cp >= 0x0E30 && cp <= 0x0E4C);
    if (!isLetter) continue; // skip spaces, punctuation, digits
    g = Math.max(g, _glyphBatch(ch));
  }
  return g;
}

// grade + de-dupe + sort a {key: [th,rtgs,en]} corpus, easiest first.
function _gradeCorpus(src) {
  const out = [], seen = new Set();
  for (const key in src) {
    const e = src[key];
    if (!e || seen.has(e[0])) continue;
    seen.add(e[0]);
    out.push({ th: e[0], rtgs: e[1], en: e[2], grade: readerGrade(e[0]), key });
  }
  out.sort((a, b) => a.grade - b.grade || [...a.th].length - [...b.th].length);
  return out;
}

// the full EXAMPLES corpus, graded once and memoized — it's static data, so
// startReader's 4-level count pass (and readerOpen right after it) reuse this
// instead of re-grading ~870 sentences on every screen open.
let _readerCorpusCache = null;
function _readerCorpus() {
  if (!_readerCorpusCache) _readerCorpusCache = _gradeCorpus(typeof EXAMPLES !== "undefined" ? EXAMPLES : {});
  return _readerCorpusCache;
}

// every EXAMPLES sentence decodable by `maxBatch`, easiest first, de-duped.
// An explicit `examples` override (tests) always grades fresh, bypassing the
// memo, which only ever caches the real corpus.
function readerFeed(maxBatch, examples) {
  const graded = examples ? _gradeCorpus(examples) : _readerCorpus();
  return graded.filter(s => s.grade <= maxBatch);
}

// ── Rendering ────────────────────────────────────────────────────────────────
let _rd = null; // { feed, at, level }

function _readerColorOn() {
  try { return localStorage.getItem(READER_COLOR_KEY) === "1"; } catch { return false; }
}
// The write on its own. Paste Text shares this preference (one 🎨 setting for
// both screens) but must NOT inherit _readerShow() — with no reader session
// open that falls through to startReader() and navigates away mid-toggle.
function _readerSetColor(on) {
  try { localStorage.setItem(READER_COLOR_KEY, on ? "1" : "0"); } catch {}
}
function _readerToggleColor() {
  _readerSetColor(!_readerColorOn());
  _readerShow();
}

function startReader() {
  _rd = null;
  const body = document.getElementById("reader-body");
  const pos = _readerPosLoad();
  const cards = READER_LEVELS.map((lv, i) => {
    const feed = readerFeed(lv.max);
    const n = feed.length;
    const saved = pos[i];
    const read = saved ? (saved.done ? n : _readerResumeAt(saved, feed)) : 0;
    const label = !read ? `${n} sentence${n === 1 ? "" : "s"}`
      : saved.done ? `✓ read all ${n}`
      : `${read} / ${n} read`;
    return `<li class="reader-level" onclick="readerOpen(${i})">
      <span class="reader-level-name">${_tcEsc(lv.name)}</span>
      <span class="reader-level-count">${label}</span>
      ${read && !saved.done ? `<span class="reader-level-bar"><i style="width:${
        Math.round(100 * read / n)}%"></i></span>` : ""}</li>`;
  }).join("");
  body.innerHTML = `<div class="card-prompt reader-intro">Read Thai you can actually decode — every
    sentence here is built only from letters up to a level you choose. Tap any word to look it up;
    it lands in the same review deck as everything else.</div>
    <ul class="reader-levels">${cards}</ul>`;
  showScreen("reader-screen", "D");
}

function readerOpen(levelIdx, restart) {
  const lv = READER_LEVELS[levelIdx];
  const feed = readerFeed(lv.max);
  const saved = _readerPosLoad()[levelIdx];
  _rd = { feed, at: restart ? 0 : _readerResumeAt(saved, feed), level: lv, idx: levelIdx };
  _readerShow();
}

// interactive, optionally tone-coloured Thai line (reuses the word-card modal)
function _readerThaiHtml(thai, colorOn) {
  return toneColorHtml(thai, (escaped, tone, tok) => {
    if (!tok.word) return escaped; // unknown token: plain, no tap-to-define span
    const style = (colorOn && tone) ? ` style="color:${TONE_COLORS[tone]}"` : "";
    return `<span class="w-token"${style} data-w="${escaped}">${escaped}</span>`;
  });
}

function _readerLegend() {
  return `<div class="reader-legend">` + TONE_ORDER.map(t =>
    `<span style="color:${TONE_COLORS[t]}">● ${TONE_LABELS[t]}</span>`).join("") + `</div>`;
}

function _readerShow() {
  if (!_rd) { startReader(); return; }
  const body = document.getElementById("reader-body");
  if (_rd.at >= _rd.feed.length) {
    _readerRemember(true);
    body.innerHTML = `<div class="thai-big">📖</div>
      <div class="card-prompt">You read all ${_rd.feed.length} — nice.</div>
      <div class="btn-row"><button class="btn btn-primary" onclick="startReader()">Pick another level</button>
      <button class="btn" onclick="readerOpen(${_rd.idx}, true)">Read it again</button>
      <button class="btn" onclick="endSession()">Menu</button></div>`;
    return;
  }
  _readerRemember(false);
  const colorOn = _readerColorOn();
  const s = _rd.feed[_rd.at];
  body.innerHTML = `
    <div class="reader-topline">
      <span class="reader-counter">${_rd.level.name} · ${_rd.at + 1}/${_rd.feed.length}</span>
      <button class="btn btn-small ${colorOn ? "sel" : ""}" onclick="_readerToggleColor()" aria-label="Toggle tone colours">🎨 tones</button>
    </div>
    <div class="reader-thai" id="reader-thai" lang="th">${_readerThaiHtml(s.th, colorOn)}</div>
    ${colorOn ? _readerLegend() : ""}
    <div class="reader-rtgs">${_tcEsc(s.rtgs)}</div>
    <div class="reader-en">${_tcEsc(s.en)}</div>
    <div class="btn-row reader-controls">
      <button class="btn btn-small" onclick="_readerPrev()" ${_rd.at === 0 ? "disabled" : ""} aria-label="Previous sentence">‹</button>
      ${_speakBtn(s.th)}
      <button class="btn btn-primary" onclick="_readerNext()">${_rd.at + 1 === _rd.feed.length ? "Done" : "Next ›"}</button>
    </div>`;
  _wcWireTokens(document.getElementById("reader-thai"));
}

// Save on every card rather than on exit: there is no exit event to hook —
// the learner leaves via the sidebar, the back button, or by closing the tab.
function _readerRemember(done) {
  if (!_rd || _rd.idx == null) return;
  const pos = _readerPosLoad();
  const prev = pos[_rd.idx] || {};
  pos[_rd.idx] = {
    at: _rd.at,
    th: _rd.feed[_rd.at] ? _rd.feed[_rd.at].th : (prev.th || null),
    done: done || prev.done || false,     // once cleared, stays cleared
  };
  _readerPosSave(pos);
}

function _readerNext() { if (_rd) { _rd.at++; _readerShow(); } }
function _readerPrev() { if (_rd && _rd.at > 0) { _rd.at--; _readerShow(); } }
