// ⏰ รถคันสุดท้าย — Last Bus: the Thai six-hour clock.
//
// Thai doesn't count 1–12 twice; it counts 1–5 or 1–6 through four separate
// day cycles, so ONE number word lands in three different places:
// ตีสาม 03:00, บ่ายสามโมง 15:00, สามทุ่ม 21:00. That collision is the game.
// Two round types, the same split Baht Bus uses: a spoken time you set the
// clock to (listening), and a schedule board you read aloud (reading).
//
// Number composition is reused from baht-bus.js (_bbThaiNum / _bbRomanNum) —
// referenced only inside functions, so script order doesn't matter (the same
// safe cross-file pattern as baht-bus.js reusing game.js's _BUS_ROWS).
// DOM-free at load time, so the clock helpers below are vm-testable.

// ── The Thai clock (pure) ──────────────────────────────────────────────────

const _CK_ROUNDS = 10;
const _CK_LIVES  = 3;

// Every hour, tagged by the cycle its reading belongs to. เช้า 7–11 are the
// easy ones (the number simply IS the hour); the rest collide on purpose.
const _CK_POOL = [1,2,3,4,5, 6,7,8,9,10,11, 12, 13,14,15, 16,17,18, 19,20,21,22,23, 0];

// 24h → the Thai reading. m is minutes: 0, 30 (ครึ่ง), or anything else,
// which falls back to the plain "…N นาที" form.
function thaiTime(h, m) {
  h = ((Math.trunc(h) % 24) + 24) % 24;
  m = Math.trunc(m || 0);
  let th, rom, cycle;
  if (h === 0)       { th = "เที่ยงคืน";                          rom = "thîang khuuen";                        cycle = "midnight"; }
  else if (h < 6)    { th = "ตี" + _bbThaiNum(h);                  rom = "tii " + _bbRomanNum(h);                cycle = "tii"; }
  else if (h < 12)   { th = _bbThaiNum(h) + "โมงเช้า";             rom = _bbRomanNum(h) + " moong cháo";         cycle = "cháo"; }
  else if (h === 12) { th = "เที่ยง";                              rom = "thîang";                               cycle = "noon"; }
  // 13:00 is บ่ายโมง, never "บ่ายหนึ่งโมง" — the one irregular in the set
  else if (h === 13) { th = "บ่ายโมง";                             rom = "bàai moong";                           cycle = "bàai"; }
  else if (h <= 15)  { th = "บ่าย" + _bbThaiNum(h - 12) + "โมง";   rom = "bàai " + _bbRomanNum(h - 12) + " moong"; cycle = "bàai"; }
  else if (h <= 18)  { th = _bbThaiNum(h - 12) + "โมงเย็น";        rom = _bbRomanNum(h - 12) + " moong yen";     cycle = "yen"; }
  else               { th = _bbThaiNum(h - 18) + "ทุ่ม";            rom = _bbRomanNum(h - 18) + " thûm";          cycle = "thûm"; }
  if (m === 30)      { th += "ครึ่ง";                    rom += " khrûeng"; }
  else if (m)        { th += _bbThaiNum(m) + "นาที";     rom += " " + _bbRomanNum(m) + " naa-thii"; }
  return { h, m, th, rom, cycle, clock: _ckClock(h, m), h24: _ck24(h, m) };
}

function _ck24(h, m) {
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function _ckClock(h, m) {
  return (h % 12 === 0 ? 12 : h % 12) + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM");
}

// Readings that are equally correct but aren't what thaiTime() returns.
// Deliberately short: only variants in everyday use — not archaic forms
// (ย่ำรุ่ง 06:00, ย่ำค่ำ 18:00, สองยาม midnight) and not the older โมงเช้า
// counting that starts 07:00 at โมงเช้า, both of which would teach noise.
// เที่ยงวัน is hourOnly because เที่ยงวันครึ่ง isn't how half twelve is said.
const _CK_ALTS = {
  12: [{ th: "เที่ยงวัน",   rom: "thîang wan",     hourOnly: true }],
  16: [{ th: "บ่ายสี่โมง",  rom: "bàai sìi moong" }],
  17: [{ th: "บ่ายห้าโมง", rom: "bàai hâa moong" }],
};

// Alternate readings of h:m, suffixed exactly as thaiTime() suffixes.
function thaiTimeAlts(h, m) {
  h = ((Math.trunc(h) % 24) + 24) % 24;
  m = Math.trunc(m || 0);
  return (_CK_ALTS[h] || []).filter(a => !(a.hourOnly && m)).map(a => {
    let th = a.th, rom = a.rom;
    if (m === 30)   { th += "ครึ่ง";                rom += " khrûeng"; }
    else if (m)     { th += _bbThaiNum(m) + "นาที"; rom += " " + _bbRomanNum(m) + " naa-thii"; }
    return { h, m, th, rom };
  });
}

// The number word actually heard in an hour's reading. Two hours sharing one
// are the trap this game is built on; เที่ยง/เที่ยงคืน carry no number, and
// share 0 with each other (their own real confusion).
function _ckSpokenNum(h) {
  if (h === 0 || h === 12) return 0;
  if (h < 12) return h;          // ตี 1–5, then 6–11 โมงเช้า
  if (h === 13) return 1;        // บ่ายโมง
  if (h <= 18) return h - 12;    // บ่าย 2–3, then 4–6 โมงเย็น
  return h - 18;                 // 1–5 ทุ่ม
}

// Hours whose reading uses the same number word as h.
function _ckConfusable(h) {
  const out = [];
  for (let x = 0; x < 24; x++) if (x !== h && _ckSpokenNum(x) === _ckSpokenNum(h)) out.push(x);
  return out;
}

function _ckPick(arr, r) { return arr[Math.floor(r() * arr.length)]; }

function _ckShuffle(arr, r) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Three wrong hours for a multiple choice. Same-number twins first — they're
// the mistake worth making — then top up, because เจ็ดโมงเช้า has no twin.
function _ckDistractorHours(h, rand) {
  const r = rand || Math.random;
  const out = _ckShuffle(_ckConfusable(h), r).slice(0, 3);
  const fallback = _ckShuffle([(h + 12) % 24, (h + 1) % 24, (h + 23) % 24, (h + 2) % 24, (h + 22) % 24], r);
  for (const c of fallback) {
    if (out.length >= 3) break;
    if (c !== h && !out.includes(c)) out.push(c);
  }
  return out;
}

// A ten-round night. Every cycle appears at least once, so one run always
// walks the whole system; the rest fills at random without repeating an hour.
function _ckPlan(rand) {
  const r = rand || Math.random;
  const byCycle = {};
  for (const h of _CK_POOL) {
    const c = thaiTime(h, 0).cycle;
    (byCycle[c] = byCycle[c] || []).push(h);
  }
  const picks = [];
  for (const c of ["tii", "cháo", "bàai", "yen", "thûm"]) picks.push(_ckPick(byCycle[c], r));
  picks.push(_ckPick([...byCycle.midnight, ...byCycle.noon], r));
  while (picks.length < _CK_ROUNDS) {
    const h = _ckPick(_CK_POOL, r);
    if (!picks.includes(h)) picks.push(h);
  }
  return _ckShuffle(picks, r).map((h, i) => ({
    h,
    // ครึ่ง on roughly half the rounds — but never on เที่ยงคืน, where
    // เที่ยงคืนครึ่ง is said but odd enough not to be worth teaching here.
    m: (h !== 0 && r() < 0.45) ? 30 : 0,
    type: i % 2 === 0 ? "read" : "set",
  }));
}

// Flavour lines. Purely cosmetic — the time is generated independently.
const _CK_LINES = [
  "🚌 The last songthaew leaves at…",
  "🛵 The bike rental shuts at…",
  "🍜 The noodle lady packs up at…",
  "🎤 Her shift starts at…",
  "⛴️ The boat to Koh Larn goes at…",
  "🍺 Happy hour ends at…",
  "🌅 Sunrise over Jomtien is at…",
  "🛎️ Checkout is at…",
  "💇 The salon opens at…",
  "🏍️ The driver says he'll come at…",
  "🥊 The fight starts at…",
  "🏪 The 7-Eleven delivery lands at…",
];

// ── Game state ─────────────────────────────────────────────────────────────

let _ckPlanned = null, _ckIdx = 0, _ckRight = 0, _ckLives = _CK_LIVES;
let _ckPhase = "idle";              // ask | judged | end
let _ckCur = null, _ckReplays = 0;
let _ckSel = { hr: null, pm: false, half: false };
let _ckTimerId = null;

function _ckActive() {
  return document.querySelector(".screen.active")?.id === "ck-screen";
}

function _ckLater(ms, fn) {
  if (_ckTimerId) clearTimeout(_ckTimerId);
  _ckTimerId = setTimeout(() => { _ckTimerId = null; if (_ckActive()) fn(); }, ms);
}

function _ckEsc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function _ckHUD() {
  document.getElementById("ck-hud").innerHTML =
    `Stop <strong>${Math.min(_ckIdx + 1, _CK_ROUNDS)}</strong>/${_CK_ROUNDS}` +
    `<span>✓ <strong>${_ckRight}</strong></span>` +
    `<span>${"🩷".repeat(_ckLives)}${"🖤".repeat(_CK_LIVES - _ckLives)}</span>`;
}

function _ckSpeak(t) {
  try { _tts.speak(t.th); } catch (_) {}
}

// ── Entry / round flow ─────────────────────────────────────────────────────

function startClock() {
  showScreen("ck-screen", "L");
  if (_ckTimerId) { clearTimeout(_ckTimerId); _ckTimerId = null; }
  _ckPlanned = _ckPlan();
  _ckIdx = 0; _ckRight = 0; _ckLives = _CK_LIVES;
  _ckPhase = "idle";
  _ckHUD();
  _ckBuildChart();
  document.getElementById("ck-body").innerHTML =
    `<div class="ck-caption">🌙 One night, ten times to be somewhere.
     Miss three and you're walking home from Jomtien.</div>`;
  _ckLater(900, _ckNextRound);
}

function _ckNextRound() {
  if (_ckIdx >= _CK_ROUNDS || _ckLives <= 0) { _ckEnd(); return; }
  const plan = _ckPlanned[_ckIdx];
  const time = thaiTime(plan.h, plan.m);
  const alts = thaiTimeAlts(plan.h, plan.m);
  _ckCur = {
    ...plan,
    time,
    alts,
    // A setting round grades on the hour, not the wording, so it can safely
    // say either form — and hearing บ่ายสี่โมง half the time is the only way
    // the variant ever reaches the player's ear.
    spoken: (plan.type === "set" && alts.length && Math.random() < 0.5) ? alts[0] : time,
    line: _CK_LINES[(_ckIdx * 5 + plan.h) % _CK_LINES.length],
  };
  _ckReplays = 0;
  _ckSel = { hr: null, pm: false, half: false };
  _ckPhase = "ask";
  _ckHUD();
  if (_ckCur.type === "read") _ckReadUI(); else _ckSetUI();
}

// Reading round: the board shows digits, you pick the Thai reading.
function _ckReadUI() {
  const t = _ckCur.time;
  const hours = _ckShuffle([t.h, ..._ckDistractorHours(t.h)], Math.random);
  document.getElementById("ck-body").innerHTML = `
    <div class="ck-caption">${_ckEsc(_ckCur.line)}</div>
    <div class="ck-board">
      <div class="ck-board-h24">${t.h24}</div>
      <div class="ck-board-ap">${t.clock}</div>
    </div>
    <div class="ck-caption ck-dim">How do you say it?</div>
    <div class="ck-choices" id="ck-choices"></div>`;
  const wrap = document.getElementById("ck-choices");
  hours.forEach((h, i) => {
    const opt = thaiTime(h, t.m);
    const b = document.createElement("button");
    b.className = "ck-choice";
    b.innerHTML = `<span class="ck-cletter kb-hint">${i + 1}</span><span class="ck-thai">${opt.th}</span>`;
    b.onclick = () => _ckJudge(h === t.h, opt);
    wrap.appendChild(b);
  });
}

// Setting round: you hear the Thai, you set the clock.
function _ckSetUI() {
  const t = _ckCur.spoken, hasTts = _tts.available();
  document.getElementById("ck-body").innerHTML = `
    <div class="ck-caption">${_ckEsc(_ckCur.line)}</div>
    <div class="ck-prompt">
      ${hasTts
        ? `<button class="ck-speak" id="ck-replay" title="Replay" aria-label="Replay the time">🔊</button>
           <span class="ck-hint" id="ck-hint"></span>`
        : `<span class="ck-thai">${t.th}</span>`}
    </div>
    <div class="ck-face" id="ck-face">
      <div class="ck-readout" id="ck-readout">--:--</div>
    </div>
    <div class="ck-toggles">
      <button class="ck-tog" id="ck-ampm">AM</button>
      <button class="ck-tog" id="ck-half">:00</button>
      <button class="btn btn-primary ck-confirm" id="ck-confirm">✓</button>
    </div>`;
  const face = document.getElementById("ck-face");
  for (let i = 1; i <= 12; i++) {
    const b = document.createElement("button");
    const a = (i % 12) * 30;
    b.className = "ck-hr";
    b.textContent = i;
    b.style.transform =
      `translate(-50%,-50%) rotate(${a}deg) translateY(calc(-1 * var(--ck-r))) rotate(${-a}deg)`;
    // guarded on phase: once judged, the face freezes on what was set, so the
    // verdict card can't be read against a clock the player has since nudged
    b.onclick = () => { if (_ckPhase !== "ask") return; _ckSel.hr = i; _ckRenderFace(); _audio.sfx("pop"); };
    face.appendChild(b);
  }
  document.getElementById("ck-ampm").onclick   = () => { if (_ckPhase !== "ask") return; _ckSel.pm = !_ckSel.pm; _ckRenderFace(); };
  document.getElementById("ck-half").onclick   = () => { if (_ckPhase !== "ask") return; _ckSel.half = !_ckSel.half; _ckRenderFace(); };
  document.getElementById("ck-confirm").onclick = _ckConfirmSet;
  document.getElementById("ck-replay")?.addEventListener("click", () => {
    _ckSpeak(t);
    // Same escalating rescue as Baht Bus / Connect สี่: replays turn the
    // listening round into a reading round rather than a dead end.
    const hint = document.getElementById("ck-hint");
    if (++_ckReplays >= 3) hint.textContent = `${t.th} — ${t.rom}`;
    else if (_ckReplays >= 2) hint.textContent = t.th;
  });
  _ckRenderFace();
  if (hasTts) _ckSpeak(t);
}

function _ckRenderFace() {
  const face = document.getElementById("ck-face");
  if (!face) return;
  [...face.querySelectorAll(".ck-hr")].forEach((b, i) =>
    b.classList.toggle("ck-hr-on", _ckSel.hr === i + 1));
  document.getElementById("ck-ampm").textContent = _ckSel.pm ? "PM" : "AM";
  document.getElementById("ck-ampm").classList.toggle("ck-tog-on", _ckSel.pm);
  document.getElementById("ck-half").textContent = _ckSel.half ? ":30 ครึ่ง" : ":00";
  document.getElementById("ck-half").classList.toggle("ck-tog-on", _ckSel.half);
  document.getElementById("ck-readout").textContent = _ckSel.hr === null
    ? "--:--"
    : `${_ckSel.hr}:${_ckSel.half ? "30" : "00"} ${_ckSel.pm ? "PM" : "AM"}`;
}

// Clock-face reading → 24h. 12 AM is hour 0 and 12 PM is hour 12, which is
// where this quietly goes wrong if written the obvious way.
function _ckHour24(hr, pm) {
  return (hr % 12) + (pm ? 12 : 0);
}

function _ckConfirmSet() {
  if (_ckPhase !== "ask" || _ckSel.hr === null) return;
  const t = _ckCur.time;
  const got = thaiTime(_ckHour24(_ckSel.hr, _ckSel.pm), _ckSel.half ? 30 : 0);
  _ckJudge(got.h === t.h && got.m === t.m, got);
}

// `got` is what the player actually said/set — naming it back to them is the
// whole correction ("you set 09:00, which is เก้าโมงเช้า").
function _ckJudge(ok, got) {
  if (_ckPhase !== "ask") return;
  _ckPhase = "judged";
  const t = _ckCur.time;
  if (ok) { _ckRight++; _audio.sfx("good"); }
  else    { _ckLives--; _audio.sfx("wrong"); }
  _ckHUD();
  document.querySelectorAll("#ck-choices .ck-choice").forEach(b => {
    b.disabled = true;
    if (b.querySelector(".ck-thai").textContent === t.th) b.classList.add("ck-ok");
    else if (!ok && b.querySelector(".ck-thai").textContent === got.th) b.classList.add("ck-bad");
  });
  const body = document.getElementById("ck-body");
  const card = document.createElement("div");
  card.className = "ck-verdict " + (ok ? "ck-verdict-ok" : "ck-verdict-bad");
  card.innerHTML = ok
    ? `<div class="ck-v-top">✓ ทันเวลา — on time</div>
       <div class="ck-v-line"><span class="ck-thai">${t.th}</span> — ${t.rom}</div>
       <div class="ck-v-line ck-dim">${t.h24} · ${t.clock}</div>`
    : `<div class="ck-v-top">✗ ตกรถ — missed it</div>
       <div class="ck-v-line">${t.h24} is <span class="ck-thai">${t.th}</span> — ${t.rom}</div>
       <div class="ck-v-line ck-dim">you said <span class="ck-thai">${got.th}</span>, which is ${got.h24}</div>`;
  // Where a second reading is just as correct, say so — otherwise the game
  // quietly teaches that the one it picked is the only way to say it.
  for (const alt of _ckCur.alts) {
    const line = document.createElement("div");
    line.className = "ck-v-line ck-dim";
    line.innerHTML = `also said <span class="ck-thai">${alt.th}</span> — ${alt.rom}`;
    card.appendChild(line);
  }
  body.appendChild(card);
  if (!ok) _ckLater(1400, () => _ckSpeak(t));
  _ckIdx++;
  _ckLater(ok ? 1700 : 3200, _ckNextRound);
}

function _ckEnd() {
  _ckPhase = "end";
  const walked = _ckLives <= 0;
  _audio.sfx(walked ? "lose" : "win");
  const grade =
    walked            ? "🥾 Out of chances — it's a long walk down Thepprasit." :
    _ckRight >= 10    ? "🏆 Ten for ten. You could run the schedule board." :
    _ckRight >= 8     ? "😎 Caught every bus that mattered." :
    _ckRight >= 6     ? "👍 Home before the bar shuts. Mostly." :
                        "😅 The ทุ่ม hours are still getting you.";
  document.getElementById("ck-body").innerHTML = `
    <div class="ck-end">
      <div class="ck-end-title">${walked ? "🌃 You missed the last one" : "🚌 คันสุดท้าย — you made it"}</div>
      <div class="ck-end-score">${_ckRight}<span class="ck-dim">/${_CK_ROUNDS}</span></div>
      <div class="ck-caption">${grade}</div>
      <div class="c4-end-btns">
        <button class="sb-btn" onclick="startClock()">อีกรอบ — Again</button>
        <button class="sb-btn sb-btn-ghost" onclick="endSession()">กลับบ้าน — Go home</button>
      </div>
    </div>`;
}

// ── Reference chart ────────────────────────────────────────────────────────
// The whole system on one strip: which cycle owns which hours. Docked outside
// #ck-body so a round change never wipes it; tap a cell to hear its example.

const _CK_CHART = [
  { label: "ตี",       span: "01–05", eg: 3  },
  { label: "โมงเช้า",  span: "06–11", eg: 9  },
  { label: "เที่ยง",   span: "12",    eg: 12 },
  { label: "บ่าย",     span: "13–15", eg: 15 },
  { label: "โมงเย็น",  span: "16–18", eg: 17 },
  { label: "ทุ่ม",      span: "19–23", eg: 21 },
  { label: "เที่ยงคืน", span: "00",    eg: 0  },
];

function _ckBuildChart() {
  const el = document.getElementById("ck-chart");
  el.innerHTML = `
    <div class="ck-chart-title" id="ck-chart-hdr">
      บอกเวลา — the six-hour clock, tap to hear
      <span class="touch-hint" id="ck-chart-tog" style="font-size:.68rem;color:#7f9ec4;margin-left:.5rem">▶ show</span>
    </div>
    <div class="ck-chart-grid">` + _CK_CHART.map(c => {
      const t = thaiTime(c.eg, 0);
      return `<button class="ck-chart-cell" data-h="${c.eg}">
        <span class="ck-chart-span">${c.span}</span>
        <span class="ck-chart-th">${c.label}</span>
        <span class="ck-chart-eg">${t.h24} = ${t.th}</span>
      </button>`;
    }).join("") + `</div>`;
  el.querySelectorAll(".ck-chart-cell").forEach(b =>
    b.addEventListener("click", e => {
      e.stopPropagation();
      _ckSpeak(thaiTime(+b.dataset.h, 0));
    }));
  const hdr = document.getElementById("ck-chart-hdr");
  const tog = document.getElementById("ck-chart-tog");
  hdr.style.cursor = "pointer";
  hdr.addEventListener("click", () => {
    el.classList.toggle("ck-chart-open");
    if (tog) tog.textContent = el.classList.contains("ck-chart-open") ? "▼ hide" : "▶ show";
  });
}

// ── Keyboard (desktop) ─────────────────────────────────────────────────────

function _ckKey(key) {
  if (!_ckActive() || _ckPhase !== "ask") return false;
  if (_ckCur?.type === "read") {
    const i = "1234".indexOf(key);
    const btns = document.querySelectorAll("#ck-choices .ck-choice");
    if (i >= 0 && btns[i]) { btns[i].click(); return true; }
    return false;
  }
  // Setting round: digits pick the hour (0 → 10, -/= → 11/12), arrows nudge.
  const digit = "1234567890-=".indexOf(key);
  if (digit >= 0) { _ckSel.hr = digit + 1; _ckRenderFace(); _audio.sfx("pop"); return true; }
  if (key === "ArrowRight" || key === "ArrowLeft") {
    const d = key === "ArrowRight" ? 1 : -1;
    _ckSel.hr = _ckSel.hr === null ? 12 : ((_ckSel.hr - 1 + d + 12) % 12) + 1;
    _ckRenderFace();
    return true;
  }
  if (key === "ArrowUp" || key === "ArrowDown") { _ckSel.pm = !_ckSel.pm; _ckRenderFace(); return true; }
  if (key === "h" || key === "H") { _ckSel.half = !_ckSel.half; _ckRenderFace(); return true; }
  if (key === "r" || key === "R") { document.getElementById("ck-replay")?.click(); return true; }
  if (key === "Enter") { _ckConfirmSet(); return true; }
  return false;
}
