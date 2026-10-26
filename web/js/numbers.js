// Number flashcards and reference charts (alphabet, vowels, tone marks, numbers).

// ─── Number card data ─────────────────────────────────────────────────────────
// Thai numerals ๐-๙ (U+0E50–U+0E59) for display alongside the word.
const _THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

const NUM_CARDS = [
  { n: 0,    th: "ศูนย์",                              rom: "sǔun" },
  { n: 1,    th: "หนึ่ง",                               rom: "nùeng" },
  { n: 2,    th: "สอง",                                rom: "sǒong" },
  { n: 3,    th: "สาม",                                rom: "sǎam" },
  { n: 4,    th: "สี่",                                 rom: "sìi" },
  { n: 5,    th: "ห้า",                                 rom: "hâa" },
  { n: 6,    th: "หก",                                 rom: "hòk" },
  { n: 7,    th: "เจ็ด",                                rom: "jèt" },
  { n: 8,    th: "แปด",                                rom: "pàet" },
  { n: 9,    th: "เก้า",                                rom: "kâo" },
  { n: 10,   th: "สิบ",                                rom: "sìp" },
  { n: 11,   th: "สิบเอ็ด",                             rom: "sìp èt" },
  { n: 12,   th: "สิบสอง",                              rom: "sìp sǒong" },
  { n: 20,   th: "ยี่สิบ",                              rom: "yîi-sìp" },
  { n: 21,   th: "ยี่สิบเอ็ด",                          rom: "yîi-sìp èt" },
  { n: 30,   th: "สามสิบ",                              rom: "sǎam-sìp" },
  { n: 40,   th: "สี่สิบ",                               rom: "sìi-sìp" },
  { n: 50,   th: "ห้าสิบ",                               rom: "hâa-sìp" },
  { n: 60,   th: "หกสิบ",                               rom: "hòk-sìp" },
  { n: 70,   th: "เจ็ดสิบ",                              rom: "jèt-sìp" },
  { n: 80,   th: "แปดสิบ",                              rom: "pàet-sìp" },
  { n: 90,   th: "เก้าสิบ",                              rom: "kâo-sìp" },
  { n: 100,     th: "หนึ่งร้อย",                       rom: "nùeng-róoi" },
  { n: 1000,    th: "หนึ่งพัน",                        rom: "nùeng-phan" },
  // The scale words above 1,000 — no dedicated game teaches these (Baht Bus
  // caps at 999; the Last Bus clock never needs them), so the flashcards are
  // the only place a learner meets หมื่น/แสน/ล้าน at all.
  { n: 10000,   th: "หนึ่งหมื่น",                      rom: "nùeng-mùuen" },
  { n: 100000,  th: "หนึ่งแสน",                        rom: "nùeng-sǎen" },
  { n: 1000000, th: "หนึ่งล้าน",                        rom: "nùeng-láan" },
  { n: 9999,    th: "เก้าพันเก้าร้อยเก้าสิบเก้า",   rom: "kâo-phan kâo-róoi kâo-sìp kâo" },
];

// ─── Number flashcard session ─────────────────────────────────────────────────
let _nfSession = null;

function startNumFlash() {
  _nfSession = { deck: shuffle([...NUM_CARDS]), idx: 0 };
  _nfShow();
  showScreen("num-flash-screen", "N");
}

function _nfShow() {
  const { deck, idx } = _nfSession;
  if (idx >= deck.length) {
    _nfSession = { deck: shuffle([...NUM_CARDS]), idx: 0 };
    _nfShow();
    return;
  }
  const card = deck[idx];
  setProgress("nf-prog", idx, deck.length);
  document.getElementById("nf-counter").textContent = `Numbers  ${idx + 1} / ${deck.length}`;
  document.getElementById("nf-num").textContent = card.n.toLocaleString();
  const digEl = document.getElementById("nf-thai-dig");
  if (card.n >= 0 && card.n <= 9) {
    digEl.textContent = `${_THAI_DIGITS[card.n]} (${card.th})`;
    digEl.style.display = "";
  } else {
    digEl.style.display = "none";
  }
  const thEl = document.getElementById("nf-thai");
  thEl.textContent = card.th;
  // Shrink long answers. .thai-big is 7.5rem on mobile, which is right for สิบ
  // and catastrophic for เก้าร้อยเก้าสิบเก้า: at 120px on a 390px phone that
  // wrapped to FOUR lines and pushed the footer 533px below the fold, so
  // "← Menu" was unreachable without scrolling half a screen. CSS cannot size
  // by content length, but this is the code that knows the content.
  // Measured on iPhone 13; the size only shrinks, never grows past the
  // stylesheet's own value. Found by the 2026-08-30 look-and-feel round.
  const glyphs = [...card.th].length;
  thEl.style.fontSize = glyphs > 12 ? "3.2rem" : glyphs > 8 ? "4.0rem" : glyphs > 3 ? "5.0rem" : "";
  document.getElementById("nf-rom").textContent = card.rom;
  document.getElementById("nf-answer-area").style.display = "none";
  document.getElementById("nf-reveal-area").style.display = "";
}

function nfReveal() {
  const card = _nfSession.deck[_nfSession.idx];
  document.getElementById("nf-reveal-area").style.display = "none";
  document.getElementById("nf-answer-area").style.display = "";
  _tts.speak(card.th);
}

function nfSpeak() {
  _tts.speak(_nfSession.deck[_nfSession.idx].th);
}

function nfNext() {
  _nfSession.idx++;
  _nfShow();
}

// ─── Charts screen ────────────────────────────────────────────────────────────
let _chartsTab = "alphabet";

function showCharts() {
  _chartsTab = "alphabet";
  _buildCharts();
  showScreen("charts-screen", "A");
}

function showChartTab(tab) {
  _chartsTab = tab;
  document.querySelectorAll(".chart-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".chart-section").forEach(s => s.style.display = s.dataset.tab === tab ? "" : "none");
}

function _buildCharts() {
  _buildAlphabetChart();
  _buildVowelChart();
  _buildToneChart();
  _buildNumChart();
  _buildHiddenChart();
  showChartTab("alphabet");
}

// ─── Hidden letters ───────────────────────────────────────────────────────────
// Letters written and not said, and sounds said and not written. Added
// 2026-10-26 from a reference guide the user brought in, after every example
// was checked against the course data, the shipped dictionary and the tone
// engine. Three of the guide's claims were wrong and are corrected here: อ นำ
// moves ย to MID class (the guide said low — it confused low tone with low
// class); a final ร after a consonant with no written vowel reads -oon, so
// นคร is ná-khoon, not "na-khon"; and one romanisation system instead of four
// (the guide's "pâap" was Paiboon, where p is the aspirated พ). Three things
// it left out are added, the first by far the most important: a leader that
// IS said — it takes the hidden a AND lends its class to the next syllable,
// which is why ถนน is thà-nǒn, rising. The app's own tone engine has that blind
// spot too: alone, it reads the รุป of สรุป as high.
//
// Every `rom` is the course's own where the word is a course word, else the
// shipped dictionary's; every `alone` claim — the tone a syllable would have
// WITHOUT its leader — is the engine's. tests/js/orthography.test.js fails on
// drift in either, and checks that every leader really changes the tone.
const HIDDEN_RULES = [
  { title: "Silent ห leads", th: "ห นำ",
    body: "Written before ง ญ น ม ย ร ล ว and never said. It moves the next letter to HIGH-class tone rules.",
    ex: [
      { th: "หยุด", rom: "yùt", en: "to stop", alone: ["ยุด", "high"] },
      { th: "หมอ", rom: "mǒo", en: "doctor", alone: ["มอ", "mid"] },
      { th: "หนู", rom: "nǔu", en: "mouse; I (a young woman)", alone: ["นู", "mid"] },
    ] },
  { title: "Silent อ leads", th: "อ นำ",
    body: "Only before ย, and only in these four words. อ is a MID-class letter, so ย follows mid-class rules.",
    ex: [
      { th: "อยู่", rom: "yùu", en: "to be at; to live", alone: ["ยู่", "falling"] },
      { th: "อย่า", rom: "yàa", en: "don't", alone: ["ย่า", "falling"] },
      { th: "อย่าง", rom: "yàang", en: "kind; like", alone: ["ย่าง", "falling"] },
      { th: "อยาก", rom: "yàak", en: "to want", alone: ["ยาก", "falling"] },
    ] },
  { title: "Leaders you DO say", th: "อักษรนำ",
    body: "A high- or mid-class letter before ง ญ น ม ย ร ล ว is said, with a short a — and it still lends its class to the next syllable.",
    ex: [
      { th: "สนุก", rom: "sà-nùk", en: "fun", alone: ["นุก", "high"] },
      { th: "ตลาด", rom: "tà-làat", en: "market", alone: ["ลาด", "falling"] },
      { th: "ถนน", rom: "thà-nǒn", en: "road", alone: ["นน", "mid"] },
      { th: "สรุป", rom: "sà-rùp", en: "to sum up", alone: ["รุป", "high"] },
    ] },
  { title: "ร you don't hear", th: "ควบไม่แท้",
    body: "After จ ซ ศ ส the ร is written and not said. After ท, the pair ทร is said as ซ — an s.",
    ex: [
      { th: "จริง", rom: "jing", en: "true" },
      { th: "สร้าง", rom: "sâang", en: "to build" },
      { th: "ทราบ", rom: "sâap", en: "to know (polite)" },
      { th: "ทราย", rom: "saai", en: "sand" },
    ] },
  { title: "Hidden o", body: "Two consonants and no vowel make a closed syllable: say a short o between them.",
    ex: [
      { th: "คน", rom: "khon", en: "person" },
      { th: "ลม", rom: "lom", en: "wind" },
      { th: "ฝน", rom: "fǒn", en: "rain" },
    ] },
  { title: "Hidden a", body: "A consonant with no vowel and nothing after it in its syllable: say a short a. One letter can do two jobs — close one syllable and open the next.",
    ex: [
      { th: "สบาย", rom: "sà-baai", en: "comfortable" },
      { th: "ตุ๊กตา", rom: "túk-kà-taa", en: "doll", note: "one ก does two jobs: tú·k|kà" },
    ] },
  { title: "Final ร says -oon", body: "A consonant then ร, with no vowel written: the vowel is ออ, and ร at the end sounds n.",
    ex: [
      { th: "นคร", rom: "ná-khoon", en: "city" },
      { th: "พร", rom: "phoon", en: "blessing" },
      { th: "อักษร", rom: "àk-sǒon", en: "letter (of an alphabet)" },
    ] },
  { title: "Double ร says a", th: "ร หัน",
    body: "รร stands for a short a. With a final after it, that final ends the syllable; with nothing after it, add n.",
    ex: [
      { th: "กรรม", rom: "kam", en: "karma; action" },
      { th: "ธรรม", rom: "tham", en: "dharma" },
      { th: "สวรรค์", rom: "sà-wǎn", en: "heaven" },
    ] },
  { title: "The silencer ์", th: "การันต์",
    body: "Silences the letter it sits on — sometimes the letter before it too, or that letter's vowel with it.",
    ex: [
      { th: "ศุกร์", rom: "sùk", en: "Friday", note: "ร is silent" },
      { th: "ภาพยนตร์", rom: "phâap-phá-yon", en: "film", note: "ต and ร are silent; พ is said twice" },
      { th: "สิทธิ์", rom: "sìt", en: "right; entitlement", note: "ธ and its vowel are silent" },
      { th: "ศักดิ์", rom: "sàk", en: "rank; prestige", note: "ด and its vowel are silent" },
    ] },
];

function _hiddenEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function _buildHiddenChart() {
  const el = document.getElementById("chart-hidden");
  if (!el) return;
  el.innerHTML = `<p class="hidden-intro">Letters you write and don't say, and sounds you say and don't write. Tap a word to hear it.</p>` +
    HIDDEN_RULES.map(r => `<section class="hidden-rule">
      <h3 class="hidden-title">${_hiddenEsc(r.title)}${r.th ? ` <span class="hidden-th" lang="th">${_hiddenEsc(r.th)}</span>` : ""}</h3>
      <p class="hidden-body">${_hiddenEsc(r.body)}</p>
      <div class="hidden-exs">${r.ex.map(e => `<button class="hidden-ex" onclick="_tts.speak(${_hiddenEsc(JSON.stringify(e.th))})">
          <span class="hidden-ex-th" lang="th">${_hiddenEsc(e.th)}</span>
          <span class="hidden-ex-rom">${_hiddenEsc(e.rom)}</span>
          <span class="hidden-ex-en">${_hiddenEsc(e.en)}</span>
          ${e.alone ? `<span class="hidden-ex-why">on its own, <span lang="th">${_hiddenEsc(e.alone[0])}</span> would be ${_hiddenEsc(e.alone[1])}</span>` : ""}
          ${e.note ? `<span class="hidden-ex-why">${_hiddenEsc(e.note)}</span>` : ""}
        </button>`).join("")}</div>
    </section>`).join("");
}

function _alphaCellSpeak(ch) {
  _tts.speak(letterSpeechParts(ch));
}

function _vowelCellSpeak(idx) {
  // slower than the 0.85 default: the compound vowel names (สระเอือ, …) rush by
  _tts.speak(letterSpeechParts(VOWELS[idx][0]), null, 0.7);
}

// ─── Consonant chart ──────────────────────────────────────────────────────────
// Two orderings: alphabetical (Thai dictionary order) is the default; "by class"
// keeps the mid/high/low grouping. The choice persists. Both share the same cell
// styling/behaviour; alphabetical stays colour-coded by class (+ a legend) so the
// class is never lost. The grid itself is auto-fill and widens in landscape (CSS),
// so content reflows into more columns when the device rotates.
let _alphaOrder = (typeof localStorage !== "undefined" && localStorage.getItem("soisanuk_chartorder")) || "alpha";

function _setAlphaOrder(order) {
  _alphaOrder = order;
  try { localStorage.setItem("soisanuk_chartorder", order); } catch (e) { /* private mode */ }
  _buildAlphabetChart();
}

function _alphaCell({ ch, rom, cls, name }) {
  // The cell is small, so the meaning goes in the tooltip rather than the face:
  // "ก อไก่ — chicken" on hover, which is where somebody scanning the chart for
  // a half-remembered letter actually looks.
  const en = (typeof consNameEn === "function") ? consNameEn(ch) : null;
  return `<button class="alpha-cell alpha-${cls}" onclick="_alphaCellSpeak('${ch}')" title="${ch}อ${name}${en ? " — " + en : ""}">` +
    `<span class="alpha-char" lang="th">${ch}</span>` +
    `<span class="alpha-rom">${rom}</span>` +
    `<span class="alpha-name">${name}</span>` +
    `</button>`;
}

function _buildAlphabetChart() {
  const el = document.getElementById("chart-alphabet");
  const rows = CONSONANTS.map(([ch, rom, cls, name]) => ({ ch, rom, cls, name }));
  const classLabels = { mid: "Mid class · กลาง", high: "High class · สูง", low: "Low class · ต่ำ" };

  let html = `<div class="alpha-order-toggle" role="tablist">` +
    ["alpha", "class"].map(o =>
      `<button class="alpha-order-btn${_alphaOrder === o ? " active" : ""}" onclick="_setAlphaOrder('${o}')">` +
      `${o === "alpha" ? "Alphabetical" : "By class"}</button>`).join("") +
    `</div>`;

  if (_alphaOrder === "class") {
    const byClass = { mid: [], high: [], low: [] };
    for (const r of rows) (byClass[r.cls] || byClass.low).push(r);
    for (const cls of ["mid", "high", "low"]) {
      html += `<div class="alpha-class-label">${classLabels[cls]}</div><div class="alpha-grid">`;
      html += byClass[cls].map(_alphaCell).join("");
      html += `</div>`;
    }
  } else {
    // Thai code-point order is dictionary order; a legend keeps the class colours legible
    const sorted = rows.slice().sort((a, b) => a.ch.codePointAt(0) - b.ch.codePointAt(0));
    html += `<div class="alpha-legend">` +
      [["mid", "ก", "Mid · กลาง"], ["high", "ข", "High · สูง"], ["low", "ค", "Low · ต่ำ"]].map(([cls, ch, lbl]) =>
        `<span class="alpha-legend-item alpha-${cls}"><span class="alpha-char" lang="th">${ch}</span>${lbl}</span>`).join("") +
      `</div>`;
    html += `<div class="alpha-grid">${sorted.map(_alphaCell).join("")}</div>`;
  }
  el.innerHTML = html;
}

// ─── Vowel chart ──────────────────────────────────────────────────────────────
function _buildVowelChart() {
  const el = document.getElementById("chart-vowels");
  let html = `<div class="alpha-grid" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">`;
  for (let i = 0; i < VOWELS.length; i++) {
    const [sym, rom, desc] = VOWELS[i];
    // อ ("zero consonant") host: the vowel reads as its pure sound (อา = "aa"),
    // matching the audio (letterSpeech says "อา, สระอา").
    const disp = vowelDisp(sym, "อ");
    html += `<button class="alpha-cell" onclick="_vowelCellSpeak(${i})" title="${desc}">` +
      `<span class="alpha-char" style="color:var(--lotus);font-size:1.3rem" lang="th">${disp}</span>` +
      `<span class="alpha-rom">${rom}</span>` +
      // The whole description, not its first word. split(" ")[0] made 13 of
      // 21 cells read just "long" or "short" — the length survived and the
      // vowel it belonged to was thrown away.
      `<span class="alpha-name">${desc}</span>` +
      `</button>`;
  }
  html += `</div>`;
  html += `<p style="color:var(--dim);font-size:.72rem;text-align:center;margin-top:.7rem;line-height:1.5">Vowels shown on an อ host. Tap to hear sound + name.</p>`;
  el.innerHTML = html;
}

// ─── Tone marks chart ─────────────────────────────────────────────────────────
function _buildToneChart() {
  const el = document.getElementById("chart-tones");
  const marks = [
    { mark: "—",  nameTh: "สามัญ", nameEn: "mid tone",     desc: "Default — no mark",          example: "กา · kaa · crow",       speak: "กา" },
    { mark: "่",  nameTh: "เอก",   nameEn: "low tone",      desc: "Mai ek — low",                   example: "ข่า · khàa · galangal", speak: "ข่า" },
    { mark: "้",  nameTh: "โท",    nameEn: "falling tone",  desc: "Mai tho — falling from high", example: "ข้า · khâa · servant",  speak: "ข้า" },
    { mark: "๊",  nameTh: "ตรี",   nameEn: "high tone",     desc: "Mai tri — high (rare)",       example: "โต๊ะ · tó · table",     speak: "โต๊ะ" },
    { mark: "๋",  nameTh: "จัตวา", nameEn: "rising tone",   desc: "Mai chattawa — rising (rare)",example: "เดี๋ยว · dǐao · a moment", speak: "เดี๋ยว" },
  ];
  let html = `<table class="tone-table">
    <tr><th>Mark</th><th>Name</th><th>Type</th><th>Example</th></tr>`;
  for (const t of marks) {
    const markDisplay = t.mark === "—" ? `<span style="color:var(--dim)">—</span>` :
      `<span class="tone-mark-cell" style="font-size:1.5rem" lang="th">ก${t.mark}</span>`;
    html += `<tr onclick="_tts.speak('${t.speak}')" style="cursor:pointer">` +
      `<td style="text-align:center">${markDisplay}</td>` +
      `<td><div class="tone-name-th" lang="th">${t.nameTh}</div><div class="tone-name-en">${t.nameEn}</div></td>` +
      `<td class="tone-desc">${t.desc}</td>` +
      `<td class="tone-ex-cell">${t.example}</td>` +
      `</tr>`;
  }
  html += `</table>`;
  html += `<p style="color:var(--dim);font-size:.72rem;text-align:center;margin-top:.8rem;line-height:1.5">Actual tone depends on consonant class (mid/high/low) + syllable type.<br>Tap a row to hear an example.</p>`;
  el.innerHTML = html;
}

// ─── Numbers reference chart ──────────────────────────────────────────────────
function _buildNumChart() {
  const el = document.getElementById("chart-numbers");

  function digitCell(card) {
    // Digits 0-9: show Thai numeral glyph + spelling in parentheses
    return `<button class="num-chart-cell" onclick="_tts.speak('${card.th}')">` +
      `<span class="num-chart-arabic">${card.n}</span>` +
      `<span class="num-chart-thai-dig" lang="th">${_THAI_DIGITS[card.n]}</span>` +
      `<span class="num-chart-th" style="font-size:.7rem" lang="th">(${card.th})</span>` +
      `<span class="num-chart-rom">${card.rom}</span>` +
      `</button>`;
  }

  function wordCell(card, thStyle) {
    return `<button class="num-chart-cell" onclick="_tts.speak('${card.th}')">` +
      `<span class="num-chart-arabic">${card.n.toLocaleString()}</span>` +
      `<span class="num-chart-th" ${thStyle || ""} lang="th">${card.th}</span>` +
      `<span class="num-chart-rom">${card.rom}</span>` +
      `</button>`;
  }

  const digits = NUM_CARDS.slice(0, 10);
  const teens  = NUM_CARDS.slice(10, 15);
  const tens   = NUM_CARDS.slice(15, 22);
  const big    = NUM_CARDS.slice(22);

  let html = "";

  html += `<div class="num-chart-label">Digits · เลขไทย</div>`;
  html += `<div class="num-chart-grid" style="grid-template-columns:repeat(5,1fr)">`;
  for (const c of digits) html += digitCell(c);
  html += `</div>`;

  html += `<div class="num-chart-label">Teens &amp; Twenties</div>`;
  html += `<div class="num-chart-grid" style="grid-template-columns:repeat(5,1fr)">`;
  for (const c of teens) html += wordCell(c);
  html += `</div>`;

  html += `<div class="num-chart-label">Tens · สิบ</div>`;
  html += `<div class="num-chart-grid" style="grid-template-columns:repeat(4,1fr)">`;
  for (const c of tens) html += wordCell(c);
  html += `</div>`;

  html += `<div class="num-chart-label">Hundreds, Thousands &amp; Beyond</div>`;
  html += `<div class="num-chart-grid" style="grid-template-columns:repeat(3,1fr)">`;
  for (const c of big) html += wordCell(c, 'style="font-size:.72rem"');
  html += `</div>`;

  el.innerHTML = html;
}
