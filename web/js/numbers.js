// Number flashcards and reference charts (alphabet, tone marks, numbers).

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
  { n: 100,  th: "หนึ่งร้อย",                            rom: "nùeng-rói" },
  { n: 1000, th: "หนึ่งพัน",                             rom: "nùeng-phan" },
  { n: 9999, th: "เก้าพันเก้าร้อยเก้าสิบเก้า",       rom: "kâo-phan kâo-rói kâo-sìp kâo" },
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
  const dig = card.n >= 0 && card.n <= 9 ? _THAI_DIGITS[card.n] : "";
  const digEl = document.getElementById("nf-thai-dig");
  digEl.textContent = dig;
  digEl.style.display = dig ? "" : "none";
  document.getElementById("nf-thai").textContent = card.th;
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
  _buildToneChart();
  _buildNumChart();
  showChartTab("alphabet");
}

function _alphaCellSpeak(ch) {
  _tts.speak(letterSpeechParts(ch));
}

// ─── Alphabet chart ───────────────────────────────────────────────────────────
function _buildAlphabetChart() {
  const el = document.getElementById("chart-alphabet");
  const byClass = { mid: [], high: [], low: [] };
  for (const c of CONSONANTS) {
    const [ch, rom, cls, name] = c;
    (byClass[cls] || byClass.low).push({ ch, rom, name });
  }
  const classLabels = { mid: "Mid class · กลาง", high: "High class · สูง", low: "Low class · ต่ำ" };
  let html = "";
  for (const cls of ["mid", "high", "low"]) {
    html += `<div class="alpha-class-label">${classLabels[cls]}</div><div class="alpha-grid">`;
    for (const { ch, rom, name } of byClass[cls]) {
      html += `<button class="alpha-cell alpha-${cls}" onclick="_alphaCellSpeak('${ch}')" title="${ch}อ${name}">` +
        `<span class="alpha-char">${ch}</span>` +
        `<span class="alpha-rom">${rom}</span>` +
        `<span class="alpha-name">${name}</span>` +
        `</button>`;
    }
    html += `</div>`;
  }
  el.innerHTML = html;
}

// ─── Tone marks chart ─────────────────────────────────────────────────────────
function _buildToneChart() {
  const el = document.getElementById("chart-tones");
  // TONES from data.js: [Thai name, type, description, example]
  // Supplement with the actual mark character
  const marks = [
    { mark: "—",  nameTh: "สามัญ", nameEn: "mid tone",     desc: "Default — no mark",          example: "กา · kaa · crow",          speak: "กา" },
    { mark: "่",  nameTh: "เอก",   nameEn: "low tone",      desc: "Mai ek — low falling",        example: "ข่า · khàa · galangal",    speak: "ข่า" },
    { mark: "้",  nameTh: "โท",    nameEn: "falling tone",  desc: "Mai tho — falling from high", example: "ข้า · khâa · servant",     speak: "ข้า" },
    { mark: "๊",  nameTh: "ตรี",   nameEn: "high tone",     desc: "Mai tri — high rising (rare)",example: "ค๊าน — rare",             speak: "สาม" },
    { mark: "๋",  nameTh: "จัตวา", nameEn: "rising tone",   desc: "Mai chattawa — rising (rare)",example: "ค๋าน — rare",             speak: "ห้า" },
  ];
  let html = `<table class="tone-table">
    <tr><th>Mark</th><th>Name</th><th>Type</th><th>Example</th></tr>`;
  for (const t of marks) {
    const markDisplay = t.mark === "—" ? `<span style="color:var(--dim)">—</span>` :
      `<span class="tone-mark" style="font-size:1.6rem">ก${t.mark}</span>`;
    html += `<tr onclick="_tts.speak('${t.speak}')" style="cursor:pointer">` +
      `<td style="text-align:center">${markDisplay}</td>` +
      `<td><div class="tone-name-th">${t.nameTh}</div><div class="tone-name-en">${t.nameEn}</div></td>` +
      `<td class="tone-desc">${t.desc}</td>` +
      `<td class="tone-ex">${t.example}</td>` +
      `</tr>`;
  }
  html += `</table>`;
  html += `<p style="color:var(--dim);font-size:.75rem;text-align:center;margin-top:.9rem;line-height:1.6">Actual tone depends on consonant class (mid/high/low) + live/dead syllable.<br>Tap a row to hear an example.</p>`;
  el.innerHTML = html;
}

// ─── Numbers reference chart ──────────────────────────────────────────────────
function _buildNumChart() {
  const el = document.getElementById("chart-numbers");

  function cell(card) {
    const dig = card.n >= 0 && card.n <= 9 ? `<span class="num-chart-thai-dig">${_THAI_DIGITS[card.n]}</span>` : "";
    return `<button class="num-chart-cell" onclick="_tts.speak('${card.th}')">` +
      `<span class="num-chart-arabic">${card.n}</span>` +
      (dig ? dig : `<span class="num-chart-th">${card.th}</span>`) +
      `<span class="num-chart-rom">${card.rom}</span>` +
      `</button>`;
  }

  const digits = NUM_CARDS.slice(0, 10);   // 0-9
  const teens  = NUM_CARDS.slice(10, 15);  // 10-21 (10,11,12,20,21)
  const tens   = NUM_CARDS.slice(15, 22);  // 30-90
  const big    = NUM_CARDS.slice(22);      // 100, 1000, 9999

  let html = "";

  html += `<div class="num-chart-section-label">Digits · เลขไทย</div>`;
  html += `<div class="num-chart-grid" style="grid-template-columns:repeat(5,1fr)">`;
  for (const c of digits) html += cell(c);
  html += `</div>`;

  html += `<div class="num-chart-section-label">Teens &amp; Twenties</div>`;
  html += `<div class="num-chart-grid" style="grid-template-columns:repeat(5,1fr)">`;
  for (const c of teens) html += cell(c);
  html += `</div>`;

  html += `<div class="num-chart-section-label">Tens · สิบ</div>`;
  html += `<div class="num-chart-grid" style="grid-template-columns:repeat(4,1fr)">`;
  for (const c of tens) {
    html += `<button class="num-chart-cell" onclick="_tts.speak('${c.th}')">` +
      `<span class="num-chart-arabic">${c.n}</span>` +
      `<span class="num-chart-th">${c.th}</span>` +
      `<span class="num-chart-rom">${c.rom}</span>` +
      `</button>`;
  }
  html += `</div>`;

  html += `<div class="num-chart-section-label">Hundreds &amp; Thousands</div>`;
  html += `<div class="num-chart-grid" style="grid-template-columns:repeat(3,1fr)">`;
  for (const c of big) {
    html += `<button class="num-chart-cell" onclick="_tts.speak('${c.th}')">` +
      `<span class="num-chart-arabic">${c.n.toLocaleString()}</span>` +
      `<span class="num-chart-th" style="font-size:.75rem">${c.th}</span>` +
      `<span class="num-chart-rom" style="font-size:.58rem">${c.rom}</span>` +
      `</button>`;
  }
  html += `</div>`;

  el.innerHTML = html;
}
