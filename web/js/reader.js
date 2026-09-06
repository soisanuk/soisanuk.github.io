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
// Counts on the real corpus: ≤4 → 20, ≤6 → 289, ≤7 → 464, ≤11 → 959 (recounted
// 2026-09-06, at eleven rungs; 959 not 960 because _gradeCorpus de-dupes one
// sentence that is the example for two different words). These drift with EXAMPLES —
// editing ONE example sentence moved two of them the same day this comment was
// last corrected. The UI computes them live, so only this comment and
// architecture.md can ever be wrong; recount rather than trust them.
// Cutoffs rebalanced when the levels became bands. At max 4, "First reads"
// held 20 sentences — one sitting, and then a 269-sentence step. Grades 0–2 are
// empty (a full example sentence is letter-rich), so the only way to give the
// first rung any depth is to reach up to 5. The bands are now 125 / 164 / 175
// / 495; the last is the everything-else tier and grade 9 alone is 347 of it.
const READER_LEVELS = [
  { name: "First reads", max: 5 },
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
// Is a stored record from BEFORE the levels became bands?
//
// The index fallback below was written for one case — the remembered sentence
// left the corpus — and re-banding created a second that looks identical and
// means the opposite: the sentence is still in the corpus, just in a different
// level now. Reusing the index against a different list then invents progress.
// A record saying at:300 in the old nested level 3 became "300 / 495 read" on
// a band where nothing had been read, and a `done` on the old 20-sentence
// First reads became "✓ read all 125" over 105 sentences never seen. Worse,
// the first open rewrites `th`, so afterwards the record is indistinguishable
// from a real one — the evidence destroys itself.
//
// The anchor says which band it belongs to. If its grade is outside this
// level's range, the record predates the change and the only honest answer is
// to start the level over.
// Two ways an anchor can be missing from its level, and they mean opposite
// things. Gone from the CORPUS (an example was edited or removed) — the stored
// index is the best guess left, which is what _readerResumeAt does. Still in
// the corpus but in a DIFFERENT band — the record predates the re-banding, and
// its index describes a list that no longer exists.
//
// Telling them apart needs the whole corpus, so it happens here rather than
// inside _readerResumeAt, which stays pure and vm-tested against a feed a test
// hands it.
function _readerStale(saved, levelIdx) {
  if (!saved || !saved.th || typeof READER_LEVELS === "undefined") return false;
  const lv = READER_LEVELS[levelIdx];
  if (!lv) return false;
  const band = readerFeed(lv.max, null, _readerMin(levelIdx));
  if (band.some(s => s.th === saved.th)) {
    // The anchor is still here, so the position is fine — but a `done` can
    // still be a lie. Old First reads held twenty sentences and this one holds
    // 125; a record that says "finished" while its own last-read position is
    // near the start finished a shorter list. A real completion stores an `at`
    // at the end, because _readerRemember(true) runs when the feed runs out.
    const at = Number(saved.at);
    return !!saved.done && Number.isFinite(at) && at < band.length - 1;
  }
  const top = READER_LEVELS[READER_LEVELS.length - 1].max;
  return readerFeed(top).some(s => s.th === saved.th);
}

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
// A BAND, not a prefix. `minBatch` defaults to 0 so the old call still means
// "everything up to here", which is what the tests and _readerCorpus want.
function readerFeed(maxBatch, examples, minBatch) {
  const lo = minBatch || 0;
  const graded = examples ? _gradeCorpus(examples) : _readerCorpus();
  return graded.filter(s => s.grade <= maxBatch && s.grade >= lo);
}

// The rung a level STARTS at: one past the level below it.
//
// Every level used to be the one below it plus more on the end. Level 2 opened
// with level 1's twenty sentences in the same order; level 4's first unseen
// sentence was number 465 of 959, and the only navigation is ‹ / Next ›, so
// moving up a level meant pressing Next four hundred and sixty-four times
// before reading anything new. The card said "289 sentences" on a day you had
// read none of them, which is the part that actually misleads: the counter did
// not mean what it said.
function _readerMin(idx) {
  return idx > 0 ? READER_LEVELS[idx - 1].max + 1 : 0;
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
    const feed = readerFeed(lv.max, null, _readerMin(i));
    const n = feed.length;
    const saved = pos[i];
    // A stale `done` is the loudest lie of the lot — "✓ read all 125" over a
    // band whose contents changed underneath it. Same test as the resume.
    const stale = saved && _readerStale(saved, i);
    const read = (saved && !stale) ? (saved.done ? n : _readerResumeAt(saved, feed)) : 0;
    // `read` is the resume INDEX — how many sentences sit before the one you
    // are on — so parked on the last of 125 the card said "124 / 125 read"
    // while the 125th was on screen. Count the one you are looking at.
    const shown = Math.min(read + (read ? 1 : 0), n);
    const label = !read ? `${n} sentence${n === 1 ? "" : "s"}`
      : (saved.done && !stale) ? `✓ read all ${n}`
      : `${shown} / ${n} read`;
    // Say which rungs the level needs. The intro promises "letters up to a
    // level you choose" and then the cards named only a level and a count, so
    // there was no way to line the reader up against the course without
    // reading READER_LEVELS. A learner knows which unit they are on.
    // What you must KNOW, not which rungs the band spans. A sentence's grade is
    // its HARDEST letter, so a grade-7 sentence still uses letters from every
    // rung below it — "rungs 8–11" would suggest otherwise and undo the point
    // of banding the sentences in the first place.
    const hi = Math.min(lv.max, (typeof LETTER_BATCHES !== "undefined" ? LETTER_BATCHES.length : lv.max + 1) - 1);
    const rungs = `needs letters through rung ${hi + 1}`;
    return `<li class="reader-level" onclick="readerOpen(${i})">
      <span class="reader-level-name">${_tcEsc(lv.name)}</span>
      <span class="reader-level-rungs">${_tcEsc(rungs)}</span>
      <span class="reader-level-count">${label}</span>
      ${read && !saved.done ? `<span class="reader-level-bar"><i style="width:${
        Math.round(100 * shown / n)}%"></i></span>` : ""}</li>`;
  }).join("");
  body.innerHTML = `<div class="card-prompt reader-intro">Read Thai you can actually decode — every
    sentence here is built only from letters up to a level you choose. Tap any word to look it up;
    it lands in the same review deck as everything else.</div>
    <ul class="reader-levels">${cards}</ul>`;
  showScreen("reader-screen", "D");
}

// The 12k-word segmentation lexicon, loaded lazily — and until now, ONLY by
// Paste Text. The tokeniser's stranded-letter repair consults _segWords, so
// the reader rendered รอ|ง|เท้า, ชา|ว|บ้าน and รอ|ย|ยิ้ม with a dead single
// letter in the middle, and the SAME sentence healed itself if the reader
// happened to open Paste Text first. Behaviour that depends on which screen
// you visited earlier is close to unreportable — a fluent reader found it by
// noticing that a sentence changed between two sessions.
//
// The predicate reads _segWords at call time, so a late load fixes future
// tokenising by itself; the repaint is for the sentence already on screen.
function _readerEnsureLexicon() {
  if (typeof _segLoad !== "function" || (typeof _segReady === "function" && _segReady())) return;
  _segLoad(() => { if (_rd) _readerShow(); });
}

function readerOpen(levelIdx, restart) {
  _readerEnsureLexicon();
  const lv = READER_LEVELS[levelIdx];
  const feed = readerFeed(lv.max, null, _readerMin(levelIdx));
  const raw = _readerPosLoad()[levelIdx];
  const saved = _readerStale(raw, levelIdx) ? null : raw;
  _rd = { feed, at: restart ? 0 : _readerResumeAt(saved, feed), level: lv, idx: levelIdx };
  _readerShow();
}

// The 12k-word segmenter, not the 950-word curriculum matcher.
//
// The reader shows open text, and the curriculum tokeniser matches greedily
// against course words only — so any course word sitting inside a longer word
// was cut out and made tappable with its own card. จังหวัด rendered as
// จัง|ห|วัด and tapping วัด said "temple"; ฤดู became ฤ|ดู, "to look". 25
// sentences and 36 wrong cards, every one of which segmentThai gets right.
//
// Tappable = a real lexicon word that is not a flagged fragment, which is the
// rule Paste Text already uses. The key for the card is `base || text`, so a
// stretched or reduplicated form looks its meaning up under the plain word.
// Returns null before the lexicon has loaded; the caller then gets the old
// behaviour for one paint and _readerEnsureLexicon repaints.
function _readerTokens(thai) {
  if (typeof segmentThai !== "function" || typeof _segReady !== "function" || !_segReady()) return null;
  return segmentThai(thai).map(t => {
    const key = t.base || t.text;
    const known = t.known && !t.fragment;
    return {
      text: t.text,
      key,
      word: known ? ((typeof WORD_MAP !== "undefined" && WORD_MAP[key]) || [key, "", ""]) : null,
    };
  });
}

// interactive, optionally tone-coloured Thai line (reuses the word-card modal)
function _readerThaiHtml(thai, colorOn) {
  return toneColorHtml(thai, (escaped, tone, tok) => {
    if (!tok.word) return escaped; // unknown token: plain, no tap-to-define span
    const style = (colorOn && tone) ? ` style="color:${TONE_COLORS[tone]}"` : "";
    const key = _wcEsc(tok.key || tok.text);
    return `<span class="w-token"${style} data-w="${key}">${escaped}</span>`;
  }, _readerTokens(thai));
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
  // _pasteWireTokens, not _wcWireTokens. The latter attaches a handler only
  // when the word is in the CURRICULUM map — fine when the tokens came from
  // the curriculum matcher, which is where it was written. Now that the reader
  // segments with the 12k-word lexicon it paints far more words as tappable
  // than the course teaches, and 510 of 5,419 rendered tokens looked like
  // controls — hover highlight, pointer cursor — and did nothing when tapped.
  // In "The whole soi" that is 41% of sentences carrying at least one.
  //
  // The cruelty is the selection: the dead ones are exactly the words a reader
  // cannot already read. ตึก, เศรษฐกิจ, รัฐบาล, หน้าต่าง all have glosses and
  // all open properly in Paste Text, through this same function.
  (typeof _pasteWireTokens === "function" ? _pasteWireTokens : _wcWireTokens)(
    document.getElementById("reader-thai"));
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
