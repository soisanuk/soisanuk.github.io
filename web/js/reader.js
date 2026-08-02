// The graded reader — comprehensible-input practice over the EXAMPLES corpus.
// A sentence's GRADE is the latest LETTER_BATCHES rung needed to decode all its
// Thai glyphs, so each level shows only text the learner can actually sound
// out (Krashen's i+1, keyed to this app's own reading ladder). Tap any word to
// define it (the shared word-card → same SRS store); flip tone colours on to
// see each readable syllable painted by its tone (syllableTone/TONE_COLORS).
// App-only, not vendored. readerGrade/readerFeed are DOM-free and vm-tested.

// Cutoffs are the reading-ladder rung a sentence's hardest glyph needs. Full
// example sentences are letter-rich, so even "First reads" sits a few rungs in;
// the top tier (max = LETTER_BATCHES.length) also admits sentences using
// consonants the guided course never formally teaches. Counts on the real
// corpus: ≤4 → 12, ≤6 → 119, ≤7 → 316, ≤8 → 849.
const READER_LEVELS = [
  { name: "First reads", max: 4 },
  { name: "Getting around", max: 6 },
  { name: "Street Thai", max: 7 },
  { name: "The whole soi", max: 8 },
];
const READER_COLOR_KEY = "soisanuk_tonecolor";

// the latest ladder rung a sentence needs (max over its Thai letters/vowels/
// marks); a glyph taught in no batch pushes the sentence past the ladder.
function readerGrade(thai) {
  let g = 0;
  for (const ch of String(thai)) {
    const cp = ch.codePointAt(0);
    const isLetter = (cp >= 0x0E01 && cp <= 0x0E2E) || (cp >= 0x0E30 && cp <= 0x0E4B);
    if (!isLetter) continue; // skip spaces, punctuation, digits
    let b = LETTER_BATCHES.length; // default: harder than the whole ladder
    for (let i = 0; i < LETTER_BATCHES.length; i++) {
      if (taughtGlyphs(i).has(ch)) { b = i; break; }
    }
    g = Math.max(g, b);
  }
  return g;
}

// every EXAMPLES sentence decodable by `maxBatch`, easiest first, de-duped.
function readerFeed(maxBatch, examples) {
  const src = examples || (typeof EXAMPLES !== "undefined" ? EXAMPLES : {});
  const out = [], seen = new Set();
  for (const key in src) {
    const e = src[key];
    if (!e || seen.has(e[0])) continue;
    const g = readerGrade(e[0]);
    if (g <= maxBatch) { seen.add(e[0]); out.push({ th: e[0], rtgs: e[1], en: e[2], grade: g, key }); }
  }
  out.sort((a, b) => a.grade - b.grade || [...a.th].length - [...b.th].length);
  return out;
}

// ── Rendering ────────────────────────────────────────────────────────────────
let _rd = null; // { feed, at, level }

function _readerColorOn() {
  try { return localStorage.getItem(READER_COLOR_KEY) === "1"; } catch { return false; }
}
function _readerToggleColor() {
  try { localStorage.setItem(READER_COLOR_KEY, _readerColorOn() ? "0" : "1"); } catch {}
  _readerShow();
}

function startReader() {
  _rd = null;
  const body = document.getElementById("reader-body");
  const cards = READER_LEVELS.map((lv, i) => {
    const n = readerFeed(lv.max).length;
    return `<li class="reader-level" onclick="readerOpen(${i})">
      <span class="reader-level-name">${lv.name}</span>
      <span class="reader-level-count">${n} sentence${n === 1 ? "" : "s"}</span></li>`;
  }).join("");
  body.innerHTML = `<div class="card-prompt reader-intro">Read Thai you can actually decode — every
    sentence here is built only from letters up to a level you choose. Tap any word to look it up;
    it lands in the same review deck as everything else.</div>
    <ul class="reader-levels">${cards}</ul>`;
  showScreen("reader-screen", "D");
}

function readerOpen(levelIdx) {
  const lv = READER_LEVELS[levelIdx];
  _rd = { feed: readerFeed(lv.max), at: 0, level: lv };
  _readerShow();
}

// interactive, optionally tone-coloured Thai line (reuses the word-card modal)
function _readerThaiHtml(thai, colorOn) {
  const toks = _tokenise(thai);
  return toks.map(tok => {
    if (!tok.word) return _tcEsc(tok.text);
    const tone = colorOn ? toneOfWord(tok.text) : null;
    const style = tone ? ` style="color:${TONE_COLORS[tone]}"` : "";
    return `<span class="w-token"${style} data-w="${_tcEsc(tok.text)}">${_tcEsc(tok.text)}</span>`;
  }).join("");
}

const _READER_TONE_ORDER = ["mid", "low", "falling", "high", "rising"];
function _readerLegend() {
  return `<div class="reader-legend">` + _READER_TONE_ORDER.map(t =>
    `<span style="color:${TONE_COLORS[t]}">● ${TONE_LABELS[t]}</span>`).join("") + `</div>`;
}

function _readerShow() {
  if (!_rd) { startReader(); return; }
  const body = document.getElementById("reader-body");
  if (_rd.at >= _rd.feed.length) {
    body.innerHTML = `<div class="thai-big">📖</div>
      <div class="card-prompt">You read all ${_rd.feed.length} — nice.</div>
      <div class="btn-row"><button class="btn btn-primary" onclick="startReader()">Pick another level</button>
      <button class="btn" onclick="endSession()">Menu</button></div>`;
    return;
  }
  const colorOn = _readerColorOn();
  const s = _rd.feed[_rd.at];
  const speak = JSON.stringify(s.th).replace(/"/g, "&quot;");
  body.innerHTML = `
    <div class="reader-topline">
      <span class="reader-counter">${_rd.level.name} · ${_rd.at + 1}/${_rd.feed.length}</span>
      <button class="btn btn-small ${colorOn ? "sel" : ""}" onclick="_readerToggleColor()">🎨 tones</button>
    </div>
    <div class="reader-thai" id="reader-thai">${_readerThaiHtml(s.th, colorOn)}</div>
    ${colorOn ? _readerLegend() : ""}
    <div class="reader-rtgs">${_tcEsc(s.rtgs)}</div>
    <div class="reader-en">${_tcEsc(s.en)}</div>
    <div class="btn-row reader-controls">
      <button class="btn btn-small" onclick="_readerPrev()" ${_rd.at === 0 ? "disabled" : ""}>‹</button>
      <button class="btn btn-small" onclick="_tts.speak(${speak})">🔊</button>
      <button class="btn btn-small" onclick="_tts.speak(${speak}, null, 1.25)">🚀</button>
      <button class="btn btn-primary" onclick="_readerNext()">${_rd.at + 1 === _rd.feed.length ? "Done" : "Next ›"}</button>
    </div>`;
  // wire tap-to-define + hover tooltips onto every known-word token
  document.querySelectorAll("#reader-thai .w-token").forEach(span => {
    const w = _wcMap()[span.dataset.w];
    if (!w) return;
    span.style.cursor = "pointer";
    span.addEventListener("click", () => openWordModal(w));
    if (typeof _tt !== "undefined") {
      span.addEventListener("mouseenter", e => _tt.show(w[0], w[1], w[2], e.clientX, e.clientY));
      span.addEventListener("mouseleave", () => _tt.hide());
    }
  });
}

function _readerNext() { if (_rd) { _rd.at++; _readerShow(); } }
function _readerPrev() { if (_rd && _rd.at > 0) { _rd.at--; _readerShow(); } }
