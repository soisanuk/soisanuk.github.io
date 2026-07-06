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

const _BB_DESTS = [
  { en: "Walking Street",     th: "วอล์คกิ้งสตรีท", fair: 60  },
  { en: "Soi Buakhao",        th: "ซอยบัวขาว",     fair: 40  },
  { en: "Terminal 21",        th: "เทอร์มินอล 21",  fair: 100 },
  { en: "Jomtien Beach",      th: "หาดจอมเทียน",    fair: 80  },
  { en: "Big Buddha Hill",    th: "เขาพระใหญ่",     fair: 120 },
  { en: "the floating market", th: "ตลาดน้ำ",       fair: 150 },
  { en: "Sanctuary of Truth", th: "ปราสาทสัจธรรม",  fair: 200 },
  { en: "the Tiger Park",     th: "สวนเสือ",        fair: 250 },
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
  const el = document.getElementById("bb-chart");
  el.innerHTML = `<div class="bb-chart-title">เลขไทย — tap a number to hear it</div>
    <div class="bb-chart-grid">` + nums.map(n => `
      <button class="bb-chart-cell" data-n="${n}">
        <span class="bb-chart-num">${n}</span>
        <span class="bb-chart-th">${_bbThaiNum(n)}</span>
      </button>`).join("") + `</div>`;
  el.querySelectorAll(".bb-chart-cell").forEach(b =>
    b.addEventListener("click", () => {
      try { _tts.speak(_bbThaiNum(+b.dataset.n)); } catch (_) {}
    }));
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
    <div class="bb-money" id="bb-tray"></div>
    <div class="bb-given-row">
      <div class="bb-given" id="bb-given"></div>
      <button class="btn btn-primary bb-confirm" id="bb-confirm">✓</button>
    </div>`;
  const tray = document.getElementById("bb-tray");
  _BB_TRAY.forEach((d, i) => {
    const b = document.createElement("button");
    b.className = d >= 20 ? "bb-note" : "bb-coin";
    b.style.background = _BB_MONEY_COL[d];
    b.innerHTML = `<span class="kb-hint bb-key">${i + 1}</span>฿${d}`;
    b.onclick = () => _bbTrayAdd(d);
    tray.appendChild(b);
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

// ── Canvas scene: sunset Beach Road ────────────────────────────────────────
// Sky → sun → sea → beach (tented loungers left, neon palms) → boardwalk →
// road, with the baht bus sliding in and out, dropped-off riders joining the
// boardwalk strollers, and far-lane traffic passing behind the parked bus.
// All state transitions are driven from the RAF loop via _bbStopReady/
// _bbNextStop.

let _bbCanvas = null, _bbCtx = null, _bbAnimId = null;
let _bbBusX = -1, _bbLeavers = [], _bbWaiter = false, _bbSpawnedLeavers = false;
let _bbAmbient = [], _bbNextAmb = 0;

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
  _bbBusX = -0.3;
  _bbLeavers = [];
  _bbAmbient = [];
  _bbNextAmb = 0;
  _bbWaiter = false;
  if (!_bbAnimId) _bbAnimId = requestAnimationFrame(_bbFrame);
}

// Ambient street life: strollers on the boardwalk (both ways), motorbikes
// and the odd rival songthaew in the far lane (always heading left, so they
// pass behind the parked player bus instead of rear-ending it).
function _bbSpawnAmbient(W) {
  const r = Math.random();
  if (r < 0.6) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    _bbAmbient.push({
      kind: "ped", x: dir === 1 ? -20 : W + 20,
      vx: dir * (0.3 + Math.random() * 0.25),
      shirt: _WALK_SHIRTS[Math.floor(Math.random() * _WALK_SHIRTS.length)],
    });
  } else if (r < 0.9) {
    _bbAmbient.push({
      kind: "moto", x: W + 40, vx: -(1.0 + Math.random() * 0.8),
      colors: Math.random() < 0.3 ? _MOTO_GRAB_COL : _MOTO_COL,
    });
  } else {
    _bbAmbient.push({ kind: "bus", x: W + 80, vx: -(0.6 + Math.random() * 0.4) });
  }
}

function _bbSceneArrive() {
  _bbBusX = -0.3;
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

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, seaY);
  sky.addColorStop(0, "#1a0b3d");
  sky.addColorStop(0.55, "#7a2a58");
  sky.addColorStop(1, "#ff9b5e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, seaY);

  // sun on the horizon
  const sunX = W * 0.72;
  ctx.save();
  ctx.shadowColor = "#ffce7a"; ctx.shadowBlur = 26;
  ctx.fillStyle = "#ffd98a";
  ctx.beginPath(); ctx.arc(sunX, seaY - 12, 15, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // sea, with a shimmering sun column and a foam line on the sand
  const sea = ctx.createLinearGradient(0, seaY, 0, beachY);
  sea.addColorStop(0, "#4a2a6e"); sea.addColorStop(1, "#221540");
  ctx.fillStyle = sea;
  ctx.fillRect(0, seaY, W, beachY - seaY);
  ctx.fillStyle = "rgba(255,200,120,0.35)";
  for (let i = 0; i < 5; i++) {
    const y = seaY + 4 + i * ((beachY - seaY) / 5);
    const w = 14 + 10 * Math.sin(now * 0.002 + i * 2.1);
    ctx.fillRect(sunX - w / 2, y, w, 2);
  }
  ctx.fillStyle = "rgba(230,220,255,0.30)";
  for (let x = 0; x < W; x += 26) {
    ctx.fillRect(x + 6 * Math.sin(now * 0.0012 + x), beachY - 2, 14, 2);
  }

  // beach
  ctx.fillStyle = "#7d5a60";
  ctx.fillRect(0, beachY, W, walkY - beachY);

  // tented lounger group on the left third, facing the sea
  const tentX0 = W * 0.03, tentX1 = W * 0.30;
  ctx.fillStyle = "#5f3d20";
  ctx.fillRect(tentX0 + 2, beachY + 5, 2, walkY - beachY - 5);
  ctx.fillRect(tentX1 - 4, beachY + 5, 2, walkY - beachY - 5);
  const nChairs = Math.max(2, Math.floor((tentX1 - tentX0 - 14) / 24));
  for (let i = 0; i < nChairs; i++) {
    _bbSprite(ctx, _BB_CHAIR, _BB_CHAIR_COL, tentX0 + 9 + i * 24, walkY - 11, 3, false);
  }
  ctx.fillStyle = "#d8c9a8";
  ctx.fillRect(tentX0, beachY + 1, tentX1 - tentX0, 5);
  ctx.fillStyle = "#b03a3a";
  ctx.fillRect(tentX0, beachY + 1, tentX1 - tentX0, 2);

  // tall neon palms rooted at the boardwalk edge, crowns up in the sunset
  for (const px of [0.34, 0.55, 0.75, 0.94]) {
    _bbSprite(ctx, _BB_PALM, _BB_PALM_COL, W * px, walkY - 58, 5, px > 0.6);
  }

  // boardwalk: planks with seams
  ctx.fillStyle = "#7a4a30";
  ctx.fillRect(0, walkY, W, roadY - walkY);
  ctx.fillStyle = "#5f3d20";
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
  const ambFrame = Math.floor(now / 360) % 2;
  for (let i = _bbAmbient.length - 1; i >= 0; i--) {
    const a = _bbAmbient[i];
    a.x += a.vx;
    if (a.x < -100 || a.x > W + 100) { _bbAmbient.splice(i, 1); continue; }
    if (a.kind === "ped") {
      _bbSprite(ctx, _WALK_FRAMES[ambFrame], { ..._WALK_BASE, B: a.shirt },
        a.x, roadY - 26, 3, a.vx < 0);
    } else if (a.kind === "moto") {
      _bbSprite(ctx, _MOTO_ROWS, a.colors, a.x, roadY - 6, 3, true);
    } else {
      _bbSprite(ctx, _BUS_ROWS, _BUS_COL, a.x, roadY - 18, 4, true);
    }
  }

  // bus movement per phase
  const target = 0.42;
  if (_bbPhase === "arrive") {
    _bbBusX += (target - _bbBusX) * 0.045;
    if (target - _bbBusX < 0.004) {
      _bbBusX = target;
      if (_bbCur && _bbCur.type === "fare" && !_bbSpawnedLeavers) {
        _bbSpawnedLeavers = true;
        for (let i = 0; i < _bbCur.riders; i++)
          _bbLeavers.push({
            x: _bbBusX * W - 6 - i * 14,
            vx: -(0.35 + Math.random() * 0.25),
            shirt: _WALK_SHIRTS[Math.floor(Math.random() * _WALK_SHIRTS.length)],
          });
      }
      _bbStopReady(); // sets the phase, so this branch runs exactly once
    }
  } else if (_bbPhase === "depart") {
    const dt = now - _bbPhaseDepartT;
    if (dt > 1800) {
      _bbBusX += 0.004 + (dt - 1800) * 0.000012;
      if (_bbBusX * W > W + 80) _bbNextStop();
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

  // charter passenger waiting on the boardwalk ahead of the bus
  if (_bbWaiter) {
    _bbSprite(ctx, _WALK_FRAMES[0], { ..._WALK_BASE, B: "#cc2288" },
      W * target + 14 * 5 + 26, roadY - 26, 3, true);
  }

  // the player's bus, near lane (gentle idle bob while parked at a stop)
  const parked = _bbPhase === "fare" || _bbPhase === "charter" || _bbPhase === "counter";
  const bob = parked ? Math.round(Math.sin(now * 0.004)) : 0;
  _bbSprite(ctx, _BUS_ROWS, _BUS_COL, _bbBusX * W, H - 38 + bob, 5, false);
}
