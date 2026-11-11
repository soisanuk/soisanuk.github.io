// Grammar & Examples — every GRAMMAR_LESSONS entry with the EXAMPLES sentences
// that show its pattern at work. Reference material beside the Guided Course,
// not part of it: the course keeps its order, and this screen only makes the
// rest of the sentences findable by pattern. Bonus lessons (bonus: true in
// curriculum.js) live only here.
//
// Pure logic up top (vm-testable, DOM-free at load). scripts/export-grammar.mjs
// runs the same functions, so the app and the trellis export can never
// disagree about which sentence shows which pattern.

// Example sentences a fluent native Thai reader has reviewed, keyed by
// headword, holding the exact sentence they approved. Recorded in git:
//   b71a3af (2026-09-04) — seven rewrites of sentences a persona round flagged
//   fbd2933 (2026-09-05) — examples for the words The Last Baht Bus asked for
// A sentence only counts as reviewed while it still reads exactly as approved,
// so editing one silently drops its mark rather than carrying a claim it no
// longer earns. ขาว is missing on purpose: its reviewed draft (แมวตัวนี้สีขาว)
// was rewritten after the review, and the shipped sentence was never re-read.
// The reviewer is not named in the record. See PROVENANCE.md §2.
const EXAMPLE_REVIEWS = {
  "ไม่เผ็ด":    ["เด็กๆ ชอบกินอาหารไม่เผ็ดนะ", "b71a3af"],
  "ไก่":       ["ซุปไก่ต้มจนนุ่มและอร่อยมาก", "b71a3af"],
  "ปิดเส้นทาง": ["ถนนสายนี้มีการปิดเส้นทางเพราะอุบัติเหตุ", "b71a3af"],
  "ใต้":       ["แมวนอนอยู่ใต้โต๊ะกินข้าว", "b71a3af"],
  "ท้อง":      ["ฉันปวดท้องเพราะหิวมาก", "b71a3af"],
  "ตรง":       ["เดินตรงไปเลยแล้วจะเห็นร้าน", "b71a3af"],
  "พูดตามฉัน":  ["ครูบอกว่า พูดตามฉันนะ", "b71a3af"],
  "จีบ":       ["เขาจีบผู้หญิงคนนั้นทุกวัน", "fbd2933"],
  "ทิป":       ["อย่าลืมให้ทิปนะ", "fbd2933"],
  "เบอร์":      ["ขอเบอร์คุณได้ไหม", "fbd2933"],
  "ข้อความ":    ["ฉันส่งข้อความหาเธอแล้ว", "fbd2933"],
  "ถ่ายรูป":    ["เราถ่ายรูปด้วยกันที่ชายหาด", "fbd2933"],
  "รูป":       ["รูปนี้สวยมาก", "fbd2933"],
  "นวด":       ["ไปนวดมาแล้วสบายมาก", "fbd2933"],
  "ว่ายน้ำ":    ["เขาว่ายน้ำเก่งมาก", "fbd2933"],
  "เต้น":      ["เธอเต้นเก่งที่สุด", "fbd2933"],
  "ร้องเพลง":   ["เพื่อนของฉันร้องเพลงเพราะมาก", "fbd2933"],
  "แท็กซี่":    ["เรานั่งแท็กซี่ไปสนามบิน", "fbd2933"],
  "ชายหาด":    ["ชายหาดที่นี่สวยและเงียบ", "fbd2933"],
  "บุหรี่":     ["เขาซื้อบุหรี่ที่ร้านสะดวกซื้อ", "fbd2933"],
  "เงินสด":    ["ร้านนี้รับแต่เงินสด", "fbd2933"],
  "ถอนเงิน":    ["ฉันต้องถอนเงินที่ธนาคาร", "fbd2933"],
  "บัญชี":     ["เขาเปิดบัญชีใหม่ที่ธนาคาร", "fbd2933"],
  "ไฟ":        ["ช่วยเปิดไฟหน่อยได้ไหม", "fbd2933"],
  "อย่า":      ["อย่าเดินกลับบ้านดึก", "fbd2933"],
};

// The commit that recorded the review, or null if this sentence was never
// reviewed or has changed since.
function exampleReview(key) {
  const r = EXAMPLE_REVIEWS[key];
  const ex = typeof EXAMPLES !== "undefined" && EXAMPLES[key];
  return (r && ex && ex[0] === r[0]) ? r[1] : null;
}

// Token keys for a sentence. The 12k-word segmenter when its lexicon is
// loaded — it is what the graded reader uses, and it does not carve course
// words out of longer ones — else the curriculum tokeniser. `base` is the
// plain form of a stretched or reduplicated token.
function grammarTokens(thai) {
  if (typeof segmentThai === "function" && typeof _segReady === "function" && _segReady()) {
    return segmentThai(thai).map(t => t.base || t.text).filter(k => k.trim());
  }
  return _tokenise(thai).map(t => t.text).filter(k => k.trim());
}

function _grMarkerHit(marker, keys) {
  if (marker.includes(" ")) {
    const seq = marker.split(" ");
    for (let i = 0; i + seq.length <= keys.length; i++) {
      if (seq.every((m, j) => keys[i + j] === m)) return true;
    }
    return false;
  }
  if (marker.endsWith("…")) {
    const stem = marker.slice(0, -1);
    return keys.some(k => k.startsWith(stem));
  }
  return keys.includes(marker);
}

// Which lessons' patterns a sentence shows, in GRAMMAR_LESSONS order.
function grammarPatternsOf(thai) {
  const keys = grammarTokens(thai);
  return GRAMMAR_LESSONS
    .filter(l => (l.markers || []).some(m => _grMarkerHit(m, keys)))
    .map(l => l.id);
}

// EXAMPLES headwords whose sentence shows a lesson's pattern. Reviewed
// sentences first, then shorter ones (easier to read), then by headword so
// the order is stable across runs.
function grammarExamples(lessonId) {
  if (typeof EXAMPLES === "undefined") return [];
  const out = Object.keys(EXAMPLES).filter(k => grammarPatternsOf(EXAMPLES[k][0]).includes(lessonId));
  return out.sort((a, b) =>
    (exampleReview(b) ? 1 : 0) - (exampleReview(a) ? 1 : 0) ||
    [...EXAMPLES[a][0]].length - [...EXAMPLES[b][0]].length ||
    (a < b ? -1 : a > b ? 1 : 0));
}

// ── Screen ──────────────────────────────────────────────────────────────────
const GRAMMAR_PAGE = 6;   // examples shown per lesson before "Show more"
let _grShown = {};        // lessonId → how many examples are showing
let _grOpen = null;       // lessonId whose card is expanded

function _grEsc(s) { return _wcEsc(s); }

function _grSentenceHtml(key) {
  const [thai, rom, en] = EXAMPLES[key];
  const toks = (typeof _readerTokens === "function" && _readerTokens(thai)) || _tokenise(thai);
  const map = _wcMap();
  const thaiHtml = toks.map(t => {
    const k = t.key || t.text;
    return (t.word && map[k])
      ? `<span class="w-token" data-w="${_grEsc(k)}">${_grEsc(t.text)}</span>`
      : _grEsc(t.text);
  }).join("");
  const reviewed = exampleReview(key)
    ? `<span class="gr-reviewed" title="Reviewed by a fluent Thai reader">✓ reviewed</span>` : "";
  const speak = _tts.available()
    ? `<button class="gr-spk" data-say="${_grEsc(thai)}" aria-label="listen">🔊</button>` : "";
  return `<div class="gr-ex"><div class="gr-ex-thai" lang="th">${speak}${thaiHtml}</div>` +
    `<div class="gr-ex-rom">${_grEsc(rom)}</div>` +
    `<div class="gr-ex-en">${_grEsc(en)}${reviewed}</div></div>`;
}

function _grLessonHtml(l) {
  const open = _grOpen === l.id;
  const where = l.bonus ? `<span class="gr-tag">bonus · not in the course</span>`
    : `<span class="gr-tag">from the Guided Course</span>`;
  let html = `<div class="gr-card${open ? " open" : ""}">` +
    `<button class="gr-head" onclick="_grToggle('${l.id}')" aria-expanded="${open}">` +
    `<span class="gr-title">${_grEsc(l.title)}</span>${where}</button>`;
  if (!open) return html + `</div>`;
  html += `<p class="gr-intro">${_grEsc(l.intro)}</p><div class="gr-pattern">` +
    l.pattern.map(([th, rom, en], i) =>
      `<button class="gr-chunk" onclick="_grChunk('${l.id}',${i})"><span lang="th">${_grEsc(th)}</span>` +
      `<span class="gr-chunk-rom">${_grEsc(rom)}</span><span class="gr-chunk-en">${_grEsc(en)}</span></button>`
    ).join("") + `</div>`;
  const keys = grammarExamples(l.id);
  const n = Math.min(keys.length, _grShown[l.id] || GRAMMAR_PAGE);
  html += `<div class="gr-ex-label">More examples · ${keys.length}</div>` +
    keys.slice(0, n).map(_grSentenceHtml).join("");
  if (n < keys.length) {
    html += `<button class="btn gr-more" onclick="_grMore('${l.id}')">Show more (${keys.length - n} left)</button>`;
  }
  return html + `</div>`;
}

function _buildGrammar() {
  const body = document.getElementById("grammar-body");
  body.innerHTML = GRAMMAR_LESSONS.map(_grLessonHtml).join("");
  _wcWireTokens(body);
  body.querySelectorAll(".gr-spk").forEach(b =>
    b.addEventListener("click", () => _tts.speak(b.dataset.say, b)));
}

function _grToggle(id) {
  _grOpen = _grOpen === id ? null : id;
  _buildGrammar();
  // On a phone the lesson below the one you tapped is off-screen once it opens
  const card = document.querySelector("#grammar-body .gr-card.open");
  if (card && card.scrollIntoView) card.scrollIntoView({ block: "start" });
}
function _grMore(id) { _grShown[id] = (_grShown[id] || GRAMMAR_PAGE) + GRAMMAR_PAGE; _buildGrammar(); }
function _grChunk(id, i) {
  const [th, rom, en] = GRAMMAR_LESSONS.find(l => l.id === id).pattern[i];
  openWordModal([th, rom, en]);
}

function showGrammar() {
  _grShown = {};
  showScreen("grammar-screen", "E");
  _buildGrammar();
  // The segmenter splits sentences the way the export does; repaint once its
  // lexicon arrives. Until then the curriculum tokeniser stands in.
  if (typeof _segLoad === "function" && !_segReady()) _segLoad(ok => { if (ok) _buildGrammar(); });
}
