// Baht Bus — รถสองแถว: drive the Beach Road baht bus through a 10-stop
// sunset shift. Loop fares are ฿15 a head and the passenger's payment is
// only SPOKEN, so making the right change trains number listening. Off-loop
// charters are negotiated like a taxi: you pick your quote from written Thai
// amounts (number reading), then judge their spoken counter-offer against
// your bottom line. Number/money/negotiation helpers are DOM-free at load
// time (unit-tested via node:vm).

// ── Thai numbers (1–999) ───────────────────────────────────────────────────

const _BB_DIG   = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const _BB_DIG_R = ["", "nùeng", "sǒong", "sǎam", "sìi", "hâa", "hòk", "jèt", "pàet", "kâo"];

// Composed Thai reading: 11 → สิบเอ็ด, 20 → ยี่สิบ, 145 → หนึ่งร้อยสี่สิบห้า
function _bbThaiNum(n) {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  let out = "";
  if (h) out += _BB_DIG[h] + "ร้อย";
  if (t) out += (t === 2 ? "ยี่" : t === 1 ? "" : _BB_DIG[t]) + "สิบ";
  if (u) out += (n >= 11 && u === 1) ? "เอ็ด" : _BB_DIG[u];
  return out;
}

function _bbRomanNum(n) {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  const parts = [];
  if (h) parts.push(_BB_DIG_R[h] + "-rói");
  if (t) parts.push((t === 2 ? "yîi-" : t === 1 ? "" : _BB_DIG_R[t] + "-") + "sìp");
  if (u) parts.push((n >= 11 && u === 1) ? "èt" : _BB_DIG_R[u]);
  return parts.join(" ");
}

// ── Money / stops ──────────────────────────────────────────────────────────

const _BB_FARE  = 15;                          // baht per person on the loop
const _BB_STOPS = 10;                          // stops in a shift
const _BB_TRAY  = [1, 2, 5, 10, 20, 50, 100];  // your money tray

// Real Thai money colours (note faces; ฿10 is the gold-centred coin)
const _BB_MONEY_COL = {
  1: "#b9c0c9", 2: "#c9a44a", 5: "#a9b2bd", 10: "#c9a44a",
  20: "#3f7d44", 50: "#3d5da8", 100: "#b03a3a",
};

// A loop stop: riders hop off, fare = 15 each; the payer hands one note (or
// exact change). Later stops mean more riders and bigger notes.
function _bbMakeFareStop(stop) {
  const maxR   = stop <= 3 ? 2 : stop <= 6 ? 3 : 4;
  const riders = 1 + Math.floor(Math.random() * maxR);
  const fare   = riders * _BB_FARE;
  let paid;
  if (Math.random() < 0.2) {
    paid = fare; // exact change — the right move is to give nothing back
  } else {
    const notes = [20, 50, 100].filter(n => n >= fare);
    paid = (stop > 5 && Math.random() < 0.5)
      ? 100
      : notes[Math.floor(Math.random() * notes.length)];
  }
  return { type: "fare", riders, fare, paid, change: paid - fare };
}

// Greedy change breakdown, for the "should have been" correction message
function _bbBreakdown(amount) {
  const out = [];
  for (const d of [50, 20, 10, 5, 2, 1]) {
    while (amount >= d) { out.push(d); amount -= d; }
  }
  return out;
}

// ── Charters ───────────────────────────────────────────────────────────────

// Off-loop destinations only — anywhere on the Beach Road/Second Road loop
// itself (Walking Street, Terminal 21…) is just the flat ฿15 fare.
const _BB_DESTS = [
  { en: "Soi Buakhao",         th: "ซอยบัวขาว",     fair: 40  },
  { en: "Naklua market",       th: "ตลาดนาเกลือ",   fair: 60  },
  { en: "Jomtien Beach",       th: "หาดจอมเทียน",    fair: 80  },
  { en: "Big Buddha Hill",     th: "เขาพระใหญ่",     fair: 120 },
  { en: "the floating market", th: "ตลาดน้ำ",       fair: 150 },
  { en: "Sanctuary of Truth",  th: "ปราสาทสัจธรรม",  fair: 200 },
  { en: "the Tiger Park",      th: "สวนเสือ",        fair: 250 },
  { en: "Nong Nooch Garden",   th: "สวนนงนุช",      fair: 300 },
];

function _bbMakeCharter() {
  const dest  = _BB_DESTS[Math.floor(Math.random() * _BB_DESTS.length)];
  const quote = dest.fair;
  const deltas = [-50, -30, -20, -10, 10, 20, 30, 50, 100]
    .filter(d => quote + d >= 20)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const choices = [quote, ...deltas.map(d => quote + d)].sort(() => Math.random() - 0.5);
  const bottom = quote - (quote >= 150 ? 50 : quote >= 80 ? 30 : 20);
  let counter = bottom + [-20, -10, 0, 10][Math.floor(Math.random() * 4)];
  counter = Math.max(10, Math.min(counter, quote - 10));
  return {
    type: "charter", dest, quote, choices, bottom, counter,
    hasCounter: Math.random() < 0.65,
  };
}

// The correct call is accepting any counter at or above your bottom line.
// Refusing a lowball makes them relent and pay your quote; accepting one
// still earns the counter but counts as underselling the ride.
function _bbDealOutcome(accepted, counter, bottom, quote) {
  if (counter >= bottom) return accepted ? { ok: true, fare: counter } : { ok: false, fare: 0 };
  return accepted ? { ok: false, fare: counter } : { ok: true, fare: quote };
}

// ── Passengers (flavour) ───────────────────────────────────────────────────

const _BB_PAX = [
  { e: "👵", name: "ป้า Noi" },
  { e: "🧔", name: "Farang Dave" },
  { e: "👒", name: "ลุง Somchai" },
  { e: "💋", name: "Pim" },
  { e: "🌸", name: "Nong" },
  { e: "🎒", name: "Backpacker Emma" },
  { e: "😈", name: "Madam Oy" },
];

// ── State ──────────────────────────────────────────────────────────────────

let _bbStop = 0, _bbEarn = 0, _bbPerfect = 0, _bbMistakes = 0;
let _bbPhase = "idle"; // arrive | fare | charter | counter | depart | end
let _bbCur = null, _bbPax = null;
let _bbSel = [];       // change selected so far (denominations)
let _bbReplays = 0;
let _bbQuoted = 0;     // the accepted quote, for the counter phase
let _bbTimerId = null;

function _bbActive() {
  return document.getElementById("bb-screen").classList.contains("active");
}

function _bbLater(ms, fn) {
  if (_bbTimerId) clearTimeout(_bbTimerId);
  _bbTimerId = setTimeout(() => { _bbTimerId = null; if (_bbActive()) fn(); }, ms);
}

function _bbEsc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _bbHUD() {
  document.getElementById("bb-hud").innerHTML =
    `<span>🚏 Stop <strong>${Math.min(_bbStop, _BB_STOPS)}</strong>/${_BB_STOPS}</span>` +
    `<span>฿ <strong>${_bbEarn}</strong></span>` +
    `<span>⭐ <strong>${_bbPerfect}</strong></span>`;
}

// Speak an amount in baht. TTS must never gate a state change — call last.
function _bbSpeakBaht(n, suffix) {
  try { _tts.speak(_bbThaiNum(n) + "บาท" + (suffix || "")); } catch (_) {}
}

// Reference chart of the number building blocks, docked under the game.
// Lives outside #bb-body so phase changes never wipe it; tap a cell to hear it.
function _bbBuildChart() {
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 100];
  // 100 shows as the bare building block ร้อย (like สิบ), not หนึ่งร้อย —
  // it's also the only label wide enough to wrap the mobile grid.
  const label = n => (n === 100 ? "ร้อย" : _bbThaiNum(n));
  const el = document.getElementById("bb-chart");
  el.innerHTML = `
    <div class="bb-chart-title" id="bb-chart-hdr">
      เลขไทย — tap a number to hear it
      <span class="touch-hint" id="bb-chart-tog" style="font-size:.68rem;color:#b08a9a;margin-left:.5rem">▶ show</span>
    </div>
    <div class="bb-chart-grid">` + nums.map(n => `
      <button class="bb-chart-cell" data-n="${n}">
        <span class="bb-chart-num">${n}</span>
        <span class="bb-chart-th">${label(n)}</span>
      </button>`).join("") + `</div>`;
  el.querySelectorAll(".bb-chart-cell").forEach(b =>
    b.addEventListener("click", e => {
      e.stopPropagation();
      try { _tts.speak(label(+b.dataset.n)); } catch (_) {}
    }));
  // mobile: tap the header row to reveal/hide the grid
  const hdr = document.getElementById("bb-chart-hdr");
  const tog = document.getElementById("bb-chart-tog");
  hdr.style.cursor = "pointer";
  hdr.addEventListener("click", () => {
    el.classList.toggle("bb-chart-open");
    if (tog) tog.textContent = el.classList.contains("bb-chart-open") ? "▼ hide" : "▶ show";
  });
}

// ── Entry / shift flow ─────────────────────────────────────────────────────

function startBahtBus() {
  showScreen("bb-screen", "R");
  if (_bbTimerId) { clearTimeout(_bbTimerId); _bbTimerId = null; }
  _bbStop = 0; _bbEarn = 0; _bbPerfect = 0; _bbMistakes = 0;
  _bbPhase = "idle";
  _bbHUD();
  _bbSceneStart();
  _bbBuildChart();
  document.getElementById("bb-body").innerHTML = `
    <div class="bb-caption">🌅 Evening shift on the Beach Road loop.
    ฿${_BB_FARE} a head — charters pay what you can talk them into.</div>`;
  _bbLater(900, _bbNextStop);
}

function _bbNextStop() {
  _bbStop++;
  if (_bbStop > _BB_STOPS) { _bbEnd(); return; }
  _bbHUD();
  _bbPax = _BB_PAX[Math.floor(Math.random() * _BB_PAX.length)];
  _bbCur = (_bbStop % 3 === 0) ? _bbMakeCharter() : _bbMakeFareStop(_bbStop);
  _bbSel = [];
  _bbReplays = 0;
  _bbPhase = "arrive";
  document.getElementById("bb-body").innerHTML =
    `<div class="bb-caption">🚏 Pulling in to stop ${_bbStop}…</div>`;
  _bbSceneArrive(); // scene calls _bbStopReady() when the bus has stopped
}

// Called by the scene once the bus is parked at the stop
function _bbStopReady() {
  if (_bbCur.type === "fare") _bbFareUI();
  else _bbCharterUI();
}

// ── Loop-fare stop (listening: the payment is only spoken) ────────────────

function _bbFareUI() {
  _bbPhase = "fare";
  const c = _bbCur, hasTts = _tts.available();
  const body = document.getElementById("bb-body");
  body.innerHTML = `
    <div class="bb-caption">${c.riders} passenger${c.riders > 1 ? "s" : ""} hop${c.riders > 1 ? "" : "s"} off —
      fare <strong>฿${c.fare}</strong> <span class="bb-dim">(${c.riders} × ฿${_BB_FARE})</span></div>
    <div class="bb-pax">${_bbPax.e} <strong>${_bbEsc(_bbPax.name)}</strong> hands you money:
      ${hasTts
        ? `<button class="bb-speak" title="Replay" aria-label="Replay amount">🔊</button>`
        : `<strong class="bb-thai">${_bbThaiNum(c.paid)}บาท</strong>`}
      <span class="bb-hint" id="bb-hint"></span></div>
    <div class="bb-caption bb-dim">Give the right change — or take it with a wai if it's exact.</div>
    <div class="bb-money" id="bb-coins"></div>
    <div class="bb-money" id="bb-notes"></div>
    <div class="bb-given-row">
      <div class="bb-given" id="bb-given"></div>
      <button class="btn btn-primary bb-confirm" id="bb-confirm">✓</button>
    </div>`;
  const coins = document.getElementById("bb-coins");
  const notes = document.getElementById("bb-notes");
  _BB_TRAY.forEach((d, i) => {
    const b = document.createElement("button");
    b.className = d <= 10 ? "bb-coin" : "bb-note";
    b.style.background = _BB_MONEY_COL[d];
    b.innerHTML = `<span class="kb-hint bb-key">${i + 1}</span>฿${d}`;
    b.onclick = () => _bbTrayAdd(d);
    (d <= 10 ? coins : notes).appendChild(b);
  });
  document.getElementById("bb-confirm").onclick = _bbConfirmChange;
  body.querySelector(".bb-speak")?.addEventListener("click", () => {
    _bbSpeakBaht(c.paid);
    // like Connect สี่: replays gradually reveal the answer as text
    const hint = document.getElementById("bb-hint");
    if (++_bbReplays >= 3) hint.textContent = `${_bbThaiNum(c.paid)} — ${_bbRomanNum(c.paid)}`;
    else if (_bbReplays >= 2) hint.textContent = _bbThaiNum(c.paid);
  });
  _bbRenderGiven();
  if (hasTts) _bbSpeakBaht(c.paid);
}

function _bbTrayAdd(d) {
  if (_bbPhase !== "fare") return;
  _audio.sfx("coin");
  _bbSel.push(d);
  _bbRenderGiven();
}

function _bbRenderGiven() {
  const el = document.getElementById("bb-given");
  if (!el) return;
  const sum = _bbSel.reduce((a, b) => a + b, 0);
  el.innerHTML = _bbSel.length
    ? _bbSel.map((d, i) =>
        `<button class="bb-chip" style="background:${_BB_MONEY_COL[d]}" data-i="${i}" title="Take back">฿${d}</button>`
      ).join("") + `<span class="bb-sum">= ฿${sum}</span>`
    : `<span class="bb-dim">no change — รับไว้เลย 🙏</span>`;
  el.querySelectorAll(".bb-chip").forEach(b =>
    b.addEventListener("click", () => {
      if (_bbPhase !== "fare") return;
      _bbSel.splice(+b.dataset.i, 1);
      _bbRenderGiven();
    }));
}

function _bbConfirmChange() {
  if (_bbPhase !== "fare") return;
  const c = _bbCur;
  const given = _bbSel.reduce((a, b) => a + b, 0);
  if (given === c.change) {
    _audio.sfx("cash");
    _bbEarn += c.fare; _bbPerfect++;
    _bbSettle(`✓ ${_bbPax.e} “ขอบคุณค่ะ!” — paid ฿${c.paid}, change ฿${c.change}. Fare ฿${c.fare} in the box.`);
    try { _tts.speak("ขอบคุณค่ะ"); } catch (_) {}
  } else {
    _audio.sfx("bad");
    _bbMistakes++;
    const right = c.change === 0 ? "no change" :
      `฿${c.change} (${_bbBreakdown(c.change).map(d => "฿" + d).join(" + ")})`;
    _bbSettle(`✗ ${_bbPax.e} counts it and shakes her head — paid <strong>฿${c.paid}</strong> −
      fare ฿${c.fare} = ${right}, not ฿${given}. She takes her own change; no fare for you.`);
  }
}

// ── Charter stop (reading: pick your quote; then judge the counter) ───────

function _bbCharterUI() {
  _bbPhase = "charter";
  const c = _bbCur;
  const body = document.getElementById("bb-body");
  body.innerHTML = `
    <div class="bb-pax">${_bbPax.e} <strong>${_bbEsc(_bbPax.name)}</strong> flags you down:
      <span class="bb-thai">“ไป${_bbEsc(c.dest.th)} เท่าไหร่?”</span></div>
    <div class="bb-caption">To <strong>${_bbEsc(c.dest.en)}</strong> — fair price
      <strong>฿${c.quote}</strong>. Hold up the right sign:</div>
    <div class="bb-choices">` + c.choices.map((v, i) => `
      <button class="bb-choice" data-i="${i}">
        <span class="bb-cletter kb-hint">${i + 1}</span>
        <span class="bb-thai">${_bbThaiNum(v)}บาท</span>
      </button>`).join("") + `</div>`;
  body.querySelectorAll(".bb-choice").forEach(btn =>
    btn.addEventListener("click", () => _bbQuote(+btn.dataset.i)));
  try { _tts.speak("ไป" + c.dest.th + " เท่าไหร่"); } catch (_) {}
}

function _bbQuote(i) {
  if (_bbPhase !== "charter") return;
  const c = _bbCur;
  const v = c.choices[i];
  const btns = document.querySelectorAll(".bb-choice");
  btns.forEach(b => b.disabled = true);
  btns[c.choices.indexOf(c.quote)]?.classList.add("bb-ok");
  if (v === c.quote) {
    _audio.sfx("good");
    if (c.hasCounter) { _bbSpeakBaht(v); _bbLater(1100, _bbCounterUI); return; }
    _bbEarn += c.quote; _bbPerfect++;
    _bbSettle(`✓ “โอเค ไปเลย!” — hop in. Charter to ${_bbEsc(c.dest.en)} for ฿${c.quote}.`);
  } else if (v < c.quote) {
    _audio.sfx("bad");
    btns[i]?.classList.add("bb-bad");
    _bbMistakes++; _bbEarn += v;
    _bbSettle(`✗ That sign said <strong>฿${v}</strong> (${_bbThaiNum(v)}) — she grabs the deal
      before you can blink. Undersold by ฿${c.quote - v}.`);
  } else {
    _audio.sfx("bad");
    btns[i]?.classList.add("bb-bad");
    _bbMistakes++;
    _bbSettle(`✗ That sign said <strong>฿${v}</strong> (${_bbThaiNum(v)}) — “แพงไป!” She waves
      you off and waits for the next truck.`);
  }
  _bbSpeakBaht(v);
}

function _bbCounterUI() {
  _bbPhase = "counter";
  const c = _bbCur, hasTts = _tts.available();
  _bbQuoted = c.quote;
  _bbReplays = 0;
  const body = document.getElementById("bb-body");
  body.innerHTML = `
    <div class="bb-pax">${_bbPax.e} <strong>${_bbEsc(_bbPax.name)}</strong> squints and counters:
      ${hasTts
        ? `<button class="bb-speak" title="Replay" aria-label="Replay counter-offer">🔊</button>`
        : `<strong class="bb-thai">${_bbThaiNum(c.counter)}บาทได้ไหม</strong>`}
      <span class="bb-hint" id="bb-hint"></span></div>
    <div class="bb-caption">Your bottom line: <strong>฿${c.bottom}</strong>. Worth it?</div>
    <div class="bb-choices">
      <button class="bb-choice" data-deal="1"><span class="bb-cletter kb-hint">1</span>
        <span class="bb-thai">โอเค ตกลง</span> <span class="bb-dim">deal</span></button>
      <button class="bb-choice" data-deal="0"><span class="bb-cletter kb-hint">2</span>
        <span class="bb-thai">ไม่ได้</span> <span class="bb-dim">no deal</span></button>
    </div>`;
  body.querySelectorAll(".bb-choice").forEach(btn =>
    btn.addEventListener("click", () => _bbDeal(btn.dataset.deal === "1")));
  body.querySelector(".bb-speak")?.addEventListener("click", () => {
    _bbSpeakBaht(c.counter, "ได้ไหม");
    const hint = document.getElementById("bb-hint");
    if (++_bbReplays >= 3) hint.textContent = `฿${c.counter}`;
    else if (_bbReplays >= 2) hint.textContent = _bbThaiNum(c.counter);
  });
  if (hasTts) _bbSpeakBaht(c.counter, "ได้ไหม");
}

function _bbDeal(accepted) {
  if (_bbPhase !== "counter") return;
  const c = _bbCur;
  const res = _bbDealOutcome(accepted, c.counter, c.bottom, c.quote);
  _bbEarn += res.fare;
  if (res.ok) {
    _audio.sfx("cash");
    _bbPerfect++;
    _bbSettle(res.fare === c.quote
      ? `✓ You hold firm — “โอเค โอเค…” She pays your ฿${c.quote}. Her offer was only ฿${c.counter}.`
      : `✓ Deal at ฿${c.counter} — fair enough. “ไปกันเลย!”`);
  } else {
    _audio.sfx("bad");
    _bbMistakes++;
    _bbSettle(res.fare
      ? `✗ She only offered <strong>฿${c.counter}</strong> — under your ฿${c.bottom} line. You drive
        to ${_bbEsc(c.dest.en)} for peanuts.`
      : `✗ Her ฿${c.counter} was over your line! She shrugs and walks — empty truck.`);
  }
}

// ── Stop resolution / shift end ────────────────────────────────────────────

function _bbSettle(msg) {
  _bbPhase = "depart";
  _bbHUD();
  document.getElementById("bb-body").innerHTML = `<div class="bb-caption">${msg}</div>`;
  _bbSceneDepart(); // scene calls _bbNextStop() once the bus is off screen
}

function _bbEnd() {
  _bbPhase = "end";
  _audio.sfx(_bbPerfect >= 6 ? "win" : "lose");
  const grade =
    _bbPerfect >= 10 ? "🏆 Perfect shift — a Beach Road legend." :
    _bbPerfect >= 8  ? "😎 Smooth operator. Even Madam Oy nods." :
    _bbPerfect >= 6  ? "👍 Solid night. The regulars trust you." :
    _bbPerfect >= 4  ? "😅 Tourists made money off YOU tonight." :
                       "🫠 Maybe stick to walking, พี่.";
  document.getElementById("bb-body").innerHTML = `
    <div class="bb-end">
      <div class="bb-end-title">🌙 Shift over</div>
      <div class="bb-end-earn">฿ ${_bbEarn}</div>
      <div class="bb-caption">${_bbPerfect}/${_BB_STOPS} perfect stops · ${_bbMistakes} slip-up${_bbMistakes === 1 ? "" : "s"}</div>
      <div class="bb-caption">${grade}</div>
      <div class="c4-end-btns">
        <button class="sb-btn" onclick="startBahtBus()">อีกกะ — Another shift</button>
        <button class="sb-btn sb-btn-ghost" onclick="endSession()">กลับบ้าน — Go home</button>
      </div>
    </div>`;
}

// ── Keyboard (desktop) ─────────────────────────────────────────────────────

function _bbKey(key) {
  if (!_bbActive()) return false;
  if (_bbPhase === "fare") {
    const i = "1234567".indexOf(key);
    if (i >= 0) { _bbTrayAdd(_BB_TRAY[i]); return true; }
    if (key === "Backspace") { _bbSel.pop(); _bbRenderGiven(); return true; }
    if (key === "Enter") { _bbConfirmChange(); return true; }
    if (key === "r" || key === "R") { document.querySelector(".bb-speak")?.click(); return true; }
  }
  if (_bbPhase === "charter" && ["1", "2", "3", "4"].includes(key)) {
    _bbQuote(+key - 1);
    return true;
  }
  if (_bbPhase === "counter") {
    if (key === "1") { _bbDeal(true); return true; }
    if (key === "2") { _bbDeal(false); return true; }
    if (key === "r" || key === "R") { document.querySelector(".bb-speak")?.click(); return true; }
  }
  return false;
}

// ── Sky colour helpers ─────────────────────────────────────────────────────

function _bbLerpCol(h1, h2, t) {
  const h = s => parseInt(s, 16);
  const [r1,g1,b1] = [h(h1.slice(1,3)), h(h1.slice(3,5)), h(h1.slice(5,7))];
  const [r2,g2,b2] = [h(h2.slice(1,3)), h(h2.slice(3,5)), h(h2.slice(5,7))];
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}

// Five keyframes across the 10-stop shift: golden hour → orange dusk → twilight → night
const _BB_SKY_KF = [
  { p:0.00, top:"#1a0b3d", mid:"#7a2a58", hor:"#ff9b5e" },
  { p:0.40, top:"#150930", mid:"#6a1a40", hor:"#e05520" },
  { p:0.70, top:"#080520", mid:"#320a2a", hor:"#903040" },
  { p:0.85, top:"#030210", mid:"#150520", hor:"#4a1838" },
  { p:1.00, top:"#010008", mid:"#06001a", hor:"#120628" },
];

function _bbSkyAt(prog) {
  for (let i = 1; i < _BB_SKY_KF.length; i++) {
    const a = _BB_SKY_KF[i-1], b = _BB_SKY_KF[i];
    if (prog <= b.p) {
      const t = (prog - a.p) / (b.p - a.p);
      return { top:_bbLerpCol(a.top,b.top,t), mid:_bbLerpCol(a.mid,b.mid,t), hor:_bbLerpCol(a.hor,b.hor,t) };
    }
  }
  const kf = _BB_SKY_KF[_BB_SKY_KF.length - 1];
  return { top:kf.top, mid:kf.mid, hor:kf.hor };
}

// Deterministic star field via golden-ratio spread — same every session
const _BB_STARS = Array.from({length: 22}, (_, i) => [
  (i * 0.618034) % 1,
  0.06 + ((i * 0.381966) % 1) * 0.78,
]);

// ── Canvas scene: sunset Beach Road ────────────────────────────────────────
// Sky → sun → sea → beach (tented loungers left, neon palms) → boardwalk →
// road, with the baht bus sliding in and out, dropped-off riders joining the
// boardwalk strollers, and far-lane traffic passing behind the parked bus.
// All state transitions are driven from the RAF loop via _bbStopReady/
// _bbNextStop.

let _bbCanvas = null, _bbCtx = null, _bbAnimId = null;
let _bbBusX = -1, _bbLeavers = [], _bbWaiter = false, _bbSpawnedLeavers = false;
let _bbAmbient = [], _bbNextAmb = 0;
let _bbLadies = []; // mutable per-shift lady state; built in _bbSceneStart

// Tall palm, neon-green fronds over a warm trunk
const _BB_PALM = [
  "..G.gGG.G....",
  ".GGgGGGgGG...",
  "GGg.GGG.gGG..",
  ".g..GTG...g..",
  "....gT.g.....",
  ".....T.......",
  ".....T.......",
  "....T........",
  "....T........",
  "....T........",
  "...T.........",
  "...TT........",
];
const _BB_PALM_COL = { G: "#39ff7f", g: "#00c957", T: "#4e2f1a" };

// Brown beach lounger, profile, backrest toward the sea breeze
const _BB_CHAIR = [
  "B....",
  "BBBB.",
  "bBBBb",
];
const _BB_CHAIR_COL = { B: "#9c6b3d", b: "#5f3d20" };

// Ladies working the boardwalk near two of the palms. _bbLadies is the
// mutable runtime array (reset each shift); hagglers stop beside one, and
// at night a successful negotiation sends both off together.
const _BB_LADY_POS = [0.55, 0.75]; // horizontal positions (fraction of W)
const _BB_LADY_SHIRTS = [
  "#ff2d95", "#ff5fa2", "#ff80c8", "#cc2288", "#ff6090",
  "#dd44bb", "#ff4488", "#cc55ee", "#aa2299", "#ff9944",
];

function _bbSprite(ctx, rows, colors, x, y, scale, flipX) {
  ctx.save();
  if (flipX) { ctx.translate(Math.round(x) + rows[0].length * scale, Math.round(y)); ctx.scale(-1, 1); }
  else ctx.translate(Math.round(x), Math.round(y));
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === "." || !colors[ch]) continue;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(c * scale, r * scale, scale, scale);
    }
  ctx.restore();
}

function _bbSceneStart() {
  _bbCanvas = document.getElementById("bb-canvas");
  _bbCtx = _bbCanvas.getContext("2d");
  _bbBusX = 1.3;
  _bbLeavers = [];
  _bbAmbient = [];
  _bbNextAmb = 0;
  _bbWaiter = false;
  _bbLadies = _BB_LADY_POS.map(px => ({
    px,
    shirt: _BB_LADY_SHIRTS[Math.floor(Math.random() * _BB_LADY_SHIRTS.length)],
    gone: false, walking: false, returnAt: 0, heartUntil: 0,
  }));
  if (!_bbAnimId) _bbAnimId = requestAnimationFrame(_bbFrame);
}

// Ambient street life: strollers on the boardwalk (both ways), motorbikes
// and the odd rival songthaew in the far lane. Thailand drives on the left:
// the near lane (player bus) heads left, the far lane heads right — far-lane
// traffic passes behind the parked bus instead of rear-ending it.
function _bbSpawnAmbient(W) {
  const r = Math.random();
  if (r < 0.6) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    _bbAmbient.push({
      kind: "ped", x: dir === 1 ? -20 : W + 20,
      vx: dir * (0.3 + Math.random() * 0.25),
      shirt: _WALK_SHIRTS[Math.floor(Math.random() * _WALK_SHIRTS.length)],
      haggler: Math.random() < 0.5, // will stop at a lady exactly once
    });
  } else if (r < 0.9) {
    _bbAmbient.push({
      kind: "moto", x: -40, vx: 1.0 + Math.random() * 0.8,
      colors: Math.random() < 0.3 ? _MOTO_GRAB_COL : _MOTO_COL,
    });
  } else {
    _bbAmbient.push({ kind: "bus", x: -80, vx: 0.6 + Math.random() * 0.4 });
  }
}

function _bbSceneArrive() {
  _bbBusX = 1.3;
  _bbLeavers = [];
  _bbSpawnedLeavers = false;
  _bbWaiter = _bbCur.type === "charter";
}

function _bbSceneDepart() {
  _bbPhaseDepartT = performance.now();
  _bbWaiter = false;
}
let _bbPhaseDepartT = 0;

function _bbFrame(now) {
  if (!_bbActive()) { _bbAnimId = null; return; } // self-stops off screen
  _bbAnimId = requestAnimationFrame(_bbFrame);
  const cv = _bbCanvas, dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const ctx = _bbCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // layout bands
  const seaY = H * 0.50, beachY = H * 0.64, walkY = H * 0.76, roadY = H * 0.84;

  // sky shifts stop-by-stop from golden sunset → deep night
  const prog = Math.min(_bbStop / _BB_STOPS, 1);
  const sk = _bbSkyAt(prog);
  const sky = ctx.createLinearGradient(0, 0, 0, seaY);
  sky.addColorStop(0, sk.top);
  sky.addColorStop(0.55, sk.mid);
  sky.addColorStop(1, sk.hor);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, seaY);

  // stars — fade in from stop 5, fully bright by stop 9
  const starAlpha = Math.max(0, (prog - 0.5) / 0.35);
  if (starAlpha > 0) {
    for (const [sx, sy] of _BB_STARS) {
      const twinkle = 0.6 + 0.4 * Math.sin(now * 0.003 + sx * 19.7);
      ctx.fillStyle = `rgba(255,255,255,${(starAlpha * twinkle * 0.85).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(sx * W, sy * seaY, 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  // sun — starts high (stop 0), sinks to horizon (~stop 7), sets (~stop 8)
  const sunX = W * 0.72;
  const sunYOff = prog < 0.7
    ? -60 + (prog / 0.7) * 54          // -60 → -6 as sun descends
    : -6 + ((prog - 0.7) / 0.3) * 90;  // -6 → 84: sinking through the waterline
  const sunY = seaY + sunYOff;
  const sunR = Math.max(0, 15 - prog * 2);
  if (sunY < seaY + sunR) { // still at least partly above the waterline
    const sunCol = prog < 0.5 ? "#ffd98a"
      : prog < 0.8 ? _bbLerpCol("#ffd98a", "#ff5020", (prog - 0.5) / 0.3)
      : _bbLerpCol("#ff5020", "#cc1808", (prog - 0.8) / 0.2);
    const glowCol = prog < 0.7 ? "#ffce7a" : _bbLerpCol("#ffce7a", "#ff3010", (prog - 0.7) / 0.3);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, seaY); ctx.clip(); // clip to sky so sun sinks below horizon
    ctx.shadowColor = glowCol; ctx.shadowBlur = 26;
    ctx.fillStyle = sunCol;
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // moon — rises from the right horizon as the sun sets (~stop 6.5+)
  const moonAlpha = Math.min(1, Math.max(0, (prog - 0.65) / 0.15));
  const moonX = W * 0.22;
  if (moonAlpha > 0) {
    const moonY = seaY - 20 - moonAlpha * 75;
    ctx.save();
    ctx.globalAlpha = moonAlpha;
    ctx.shadowColor = "#b0c8ff"; ctx.shadowBlur = 18;
    ctx.fillStyle = "#eef0ff";
    ctx.beginPath(); ctx.arc(moonX, moonY, 11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // sea — purple sunset → dark night-blue
  const seaTop = _bbLerpCol("#4a2a6e", "#0a0520", prog);
  const seaBot = _bbLerpCol("#221540", "#040210", prog);
  const sea = ctx.createLinearGradient(0, seaY, 0, beachY);
  sea.addColorStop(0, seaTop); sea.addColorStop(1, seaBot);
  ctx.fillStyle = sea;
  ctx.fillRect(0, seaY, W, beachY - seaY);
  // sun shimmer fades out as sun sets
  if (prog < 0.85) {
    const shim = ((0.85 - prog) / 0.85 * 0.35).toFixed(2);
    ctx.fillStyle = `rgba(255,200,120,${shim})`;
    for (let i = 0; i < 5; i++) {
      const y = seaY + 4 + i * ((beachY - seaY) / 5);
      const w = 14 + 10 * Math.sin(now * 0.002 + i * 2.1);
      ctx.fillRect(sunX - w / 2, y, w, 2);
    }
  }
  // moon shimmer fades in
  if (moonAlpha > 0.1) {
    ctx.fillStyle = `rgba(180,200,255,${(moonAlpha * 0.22).toFixed(2)})`;
    for (let i = 0; i < 4; i++) {
      const y = seaY + 4 + i * ((beachY - seaY) / 5);
      const w = 8 + 5 * Math.sin(now * 0.002 + i * 1.8 + 1);
      ctx.fillRect(moonX - w / 2, y, w, 2);
    }
  }
  // foam
  ctx.fillStyle = "rgba(230,220,255,0.30)";
  for (let x = 0; x < W; x += 26) {
    ctx.fillRect(x + 6 * Math.sin(now * 0.0012 + x), beachY - 2, 14, 2);
  }

  // beach — warm sand at sunset, cool-dark at night
  ctx.fillStyle = _bbLerpCol("#7d5a60", "#2a1a2e", prog);
  ctx.fillRect(0, beachY, W, walkY - beachY);

  // tented lounger group on the left third, facing the sea; the canopy rises
  // above the horizon line so the tent reads tall, attendant off to the side
  const tentX0 = W * 0.03, tentX1 = W * 0.30, tentY = beachY - 8;
  ctx.fillStyle = "#5f3d20";
  ctx.fillRect(tentX0 + 2, tentY + 6, 2, walkY - tentY - 6);
  ctx.fillRect(tentX1 - 4, tentY + 6, 2, walkY - tentY - 6);
  const nChairs = Math.max(2, Math.floor((tentX1 - tentX0 - 14) / 24));
  for (let i = 0; i < nChairs; i++) {
    _bbSprite(ctx, _BB_CHAIR, _BB_CHAIR_COL, tentX0 + 9 + i * 24, walkY - 11, 3, false);
  }
  ctx.fillStyle = "#d8c9a8";
  ctx.fillRect(tentX0, tentY, tentX1 - tentX0, 6);
  ctx.fillStyle = "#b03a3a";
  ctx.fillRect(tentX0, tentY, tentX1 - tentX0, 2);
  _bbSprite(ctx, _WALK_FRAMES[0], { ..._WALK_BASE, B: "#e8e4d0" },
    tentX1 + 8, walkY - 26, 3, true);

  // tall neon palms rooted at the boardwalk edge, crowns up in the sunset
  for (const px of [0.34, 0.55, 0.75, 0.94]) {
    _bbSprite(ctx, _BB_PALM, _BB_PALM_COL, W * px, walkY - 58, 5, px > 0.6);
  }

  // boardwalk: planks with seams — darkens toward night
  ctx.fillStyle = _bbLerpCol("#7a4a30", "#22122a", prog);
  ctx.fillRect(0, walkY, W, roadY - walkY);
  ctx.fillStyle = _bbLerpCol("#5f3d20", "#16091a", prog);
  ctx.fillRect(0, walkY, W, 2);
  for (let x = 8; x < W; x += 16) ctx.fillRect(x, walkY + 2, 1, roadY - walkY - 2);

  // road
  ctx.fillStyle = "#171226";
  ctx.fillRect(0, roadY, W, H - roadY);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let x = (now * 0.01) % 40 - 40; x < W; x += 40) ctx.fillRect(x, H * 0.93, 18, 2);

  // ambient street life (far lane vehicles first, so they pass behind the bus)
  if (now > _bbNextAmb) {
    _bbSpawnAmbient(W);
    _bbNextAmb = now + 1800 + Math.random() * 2800;
  }
  // the ladies at their palms — may leave with a customer at night, then return
  for (const L of _bbLadies) {
    if (L.gone && now >= L.returnAt) {
      L.gone = false;
      L.shirt = _BB_LADY_SHIRTS[Math.floor(Math.random() * _BB_LADY_SHIRTS.length)];
    }
    if (L.heartUntil && now < L.heartUntil) {
      ctx.font = "13px sans-serif";
      ctx.fillText("💕", W * L.px + 26, roadY - 36);
    }
    if (!L.gone && !L.walking) {
      _bbSprite(ctx, _WALK_FRAMES[0], { ..._WALK_BASE, B: L.shirt },
        W * L.px + 30, roadY - 26, 3, L.px > 0.6);
    }
  }

  const ambFrame = Math.floor(now / 360) % 2;
  for (let i = _bbAmbient.length - 1; i >= 0; i--) {
    const a = _bbAmbient[i];
    if (a.kind === "ped") {
      const wasPaused = !!a.pauseUntil;
      const paused = a.pauseUntil && now < a.pauseUntil;
      // pause just ended — resolve the haggle
      if (wasPaused && !paused && a.haggledLady != null) {
        const li = a.haggledLady;
        a.haggledLady = null;
        a.pauseUntil = 0;
        const L = _bbLadies[li];
        if (prog >= 0.6 && !L.gone && !L.walking && Math.random() < 0.35) {
          // successful deal — walk off together (ped stays, lady walks beside it)
          L.heartUntil = now + 1600;
          L.walking = true;
          a.leavingWith = li;
        }
      }
      if (!paused) {
        a.x += a.vx;
        if (a.haggler) {
          for (let li = 0; li < _bbLadies.length; li++) {
            const L = _bbLadies[li];
            if (L.gone) continue;
            if (Math.abs(a.x - (W * L.px + 30) + (a.vx < 0 ? 16 : -16)) < 4) {
              a.haggler = false;
              a.haggledLady = li;
              a.pauseUntil = now + 2200 + Math.random() * 2600;
              break;
            }
          }
        }
      }
      if (a.x < -100 || a.x > W + 100) {
        if (a.leavingWith != null) {
          const L = _bbLadies[a.leavingWith];
          L.walking = false; L.gone = true;
          L.returnAt = now + 9000 + Math.random() * 8000;
        }
        _bbAmbient.splice(i, 1); continue;
      }
      _bbSprite(ctx, _WALK_FRAMES[paused ? 0 : ambFrame], { ..._WALK_BASE, B: a.shirt },
        a.x, roadY - 26, 3, a.vx < 0);
      if (a.leavingWith != null) {
        const Lw = _bbLadies[a.leavingWith];
        _bbSprite(ctx, _WALK_FRAMES[ambFrame], { ..._WALK_BASE, B: Lw.shirt },
          a.x + (a.vx < 0 ? 14 : -14), roadY - 26, 3, a.vx < 0);
      }
      if (paused) {
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = "#ffe600";
        ctx.fillText("฿?", a.x + 3, roadY - 29);
      }
      continue;
    }
    a.x += a.vx;
    if (a.x < -100 || a.x > W + 100) { _bbAmbient.splice(i, 1); continue; }
    if (a.kind === "moto") {
      _bbSprite(ctx, _MOTO_ROWS, a.colors, a.x, roadY - 6, 3, false);
    } else {
      _bbSprite(ctx, _BUS_ROWS, _BUS_COL, a.x, roadY - 18, 4, false);
    }
  }

  // bus movement per phase — near lane heads left (left-hand traffic)
  const target = 0.42;
  if (_bbPhase === "arrive") {
    _bbBusX += (target - _bbBusX) * 0.045;
    if (Math.abs(target - _bbBusX) < 0.004) {
      _bbBusX = target;
      if (_bbCur && _bbCur.type === "fare" && !_bbSpawnedLeavers) {
        _bbSpawnedLeavers = true;
        for (let i = 0; i < _bbCur.riders; i++)
          _bbLeavers.push({
            x: _bbBusX * W + 62 + i * 14, // off the back step, rear is right
            vx: -(0.35 + Math.random() * 0.25),
            shirt: _WALK_SHIRTS[Math.floor(Math.random() * _WALK_SHIRTS.length)],
          });
      }
      _bbStopReady(); // sets the phase, so this branch runs exactly once
    }
  } else if (_bbPhase === "depart") {
    const dt = now - _bbPhaseDepartT;
    if (dt > 1800) {
      _bbBusX -= 0.004 + (dt - 1800) * 0.000012;
      if (_bbBusX * W < -90) _bbNextStop();
    }
  }

  // dropped-off riders join the boardwalk, walking away
  for (let i = _bbLeavers.length - 1; i >= 0; i--) {
    const p = _bbLeavers[i];
    p.x += p.vx;
    if (p.x < -20) { _bbLeavers.splice(i, 1); continue; }
    _bbSprite(ctx, _WALK_FRAMES[ambFrame], { ..._WALK_BASE, B: p.shirt },
      p.x, roadY - 26, 3, true);
  }

  // charter passenger waiting on the boardwalk ahead of the bus (its left)
  if (_bbWaiter) {
    _bbSprite(ctx, _WALK_FRAMES[0], { ..._WALK_BASE, B: "#cc2288" },
      W * target - 40, roadY - 26, 3, false);
  }

  // the player's bus, near lane facing left (idle bob while parked at a stop)
  const parked = _bbPhase === "fare" || _bbPhase === "charter" || _bbPhase === "counter";
  const bob = parked ? Math.round(Math.sin(now * 0.004)) : 0;
  _bbSprite(ctx, _BUS_ROWS, _BUS_COL, _bbBusX * W, H - 38 + bob, 5, true);
}
