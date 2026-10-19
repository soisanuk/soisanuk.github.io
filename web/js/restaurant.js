// ── The Restaurant — ordering beat, v1.1 ───────────────────────────────────
// Design: docs/restaurant-scenario.md. The mechanic in one line: you compose an
// order out of parts and the kitchen brings EXACTLY what you said. ไก่ทอด and
// ไก่ย่าง are one syllable apart and arrive as different plates; the waitress
// does not say "wrong", she says แต่คุณบอกว่าทอด — "but you said fried".
//
// v1.1 is round 28 (Khun Preeya, a teacher's lens) applied to v1. What changed
// and why, in her order of severity:
//
// - Chips are SHUFFLED per order. v1 laid them out in a fixed order, and a
//   learner who never read a chip — who remembered which POSITION gave which
//   English on the arrival card — scored 3 of 5 by the fourth sitting
//   (simulated, 20,000 runs; her own run scored 4/5 by the second). Shuffled,
//   the same strategy scores 0.02 at every sitting. The only route to the
//   right chip now runs through the word.
// - A miss shows the RIGHT order in Thai, tappable, not only "the table
//   wanted" in English. v1 quoted the wrong word and never printed the right
//   one, so the learner learned "ทอด was wrong" and had to guess among the
//   other four — which is exactly the position strategy above.
// - Targets are drawn from dishes a Thai kitchen can act on, not from every
//   cell of the protein × method grid. Half the grid is not an order
//   (ไก่นึ่ง, หมูต้ม, bare หมูผัด with no complement) and v1 drilled those
//   with TTS and ถูกต้องค่ะ. The chips still offer every method, so a wrong
//   choice still composes — it is the TARGET that is now always real.
// - Quantity and spice are optional, as they are at a table. ขอไก่ย่างครับ —
//   the order g3 teaches and the one a diner actually says — is complete. A
//   target that does not state spice is a dish nobody puts chilli on, and
//   stating it anyway is a miss: v1 taught learners to tack เผ็ดน้อย onto
//   steamed fish.
// - Soup takes ถ้วย, not จาน. v1 put every ต้ม on a plate.
// - The particle is the learner's choice, ครับ or ค่ะ. v1 hard-wired ครับ into
//   every learner's mouth; the course's own g2 makes ค่ะ the first thing it
//   teaches a woman.
// - Quantity chips carry an English gloss, so "But you said สาม." no longer
//   leaves the weakest learner with no English on the one slot that needs it.
// - The waitress's question is spoken. Still not listening practice — nothing
//   depends on hearing it — but it is no longer silent either.
//
// Still true from v1, and still the right calls:
//
// 1. This file stores NO romanisations. Every rom shown is read from WORD_MAP
//    at render time, so the game cannot drift from data.js. Every Thai string
//    here must therefore be a WORDS entry; restaurant.test.js enforces it.
// 2. Protein and method are separate chips. Thai forms the compound by plain
//    juxtaposition, so composition yields correct Thai whether or not the
//    compound is an entry; the seven that are entries tokenise whole.
//
// Not done, recorded in the design doc: a stage with the chips face-down
// (production rather than recognition), re-serving a missed slot within the
// sitting, and anything written to SRS or progress.
//
// DOM-free at load; the pure helpers are unit-tested. Cross-file calls happen
// inside functions, after every script has loaded.

const _RST_PROTEINS = [
  { th: "หมู",     en: "pork",    e: "🐷" },
  { th: "ไก่",     en: "chicken", e: "🐔" },
  { th: "ปลา",     en: "fish",    e: "🐟" },
  { th: "เนื้อ",    en: "beef",    e: "🐄" },
  { th: "กุ้ง",     en: "prawn",   e: "🦐" },
  { th: "ปลาหมึก", en: "squid",   e: "🦑" },
];
const _RST_METHODS = [
  { th: "ย่าง", en: "grilled",    e: "🔥", cls: "จาน" },
  { th: "ทอด",  en: "fried",      e: "🍳", cls: "จาน" },
  { th: "ผัด",  en: "stir-fried", e: "🥘", cls: "จาน" },
  { th: "ต้ม",  en: "boiled",     e: "🍲", cls: "ถ้วย" },   // soup comes in a bowl
  { th: "นึ่ง",  en: "steamed",    e: "♨️", cls: "จาน" },
];
const _RST_QTY = [
  { th: "หนึ่ง", en: "one",   n: 1 },
  { th: "สอง",  en: "two",   n: 2 },
  { th: "สาม",  en: "three", n: 3 },
];
const _RST_HEAT = [
  { th: "ไม่เผ็ด",  en: "not spicy",      e: "" },
  { th: "เผ็ดน้อย", en: "a little spicy", e: "🌶" },
  { th: "เผ็ดมาก",  en: "very spicy",     e: "🌶🌶🌶" },
];
const _RST_PARTICLES = [
  { th: "ครับ", en: "polite (male)" },
  { th: "ค่ะ",  en: "polite (female)" },
];
// Slots in spoken order. `optional` slots may be left empty, and a target may
// leave them unstated; `graded` says whether the kitchen compares the slot.
const _RST_SLOTS = [
  { key: "p",  label: "what",     list: _RST_PROTEINS,  optional: false, graded: true },
  { key: "m",  label: "how",      list: _RST_METHODS,   optional: false, graded: true },
  { key: "q",  label: "how many", list: _RST_QTY,       optional: true,  graded: true },
  { key: "h",  label: "spice",    list: _RST_HEAT,      optional: true,  graded: true },
  { key: "pt", label: "you are",  list: _RST_PARTICLES, optional: false, graded: false },
];
const _RST_ORDERS = 5;            // one sitting

// Dishes a kitchen can act on, as protein × method index pairs. The grid has
// 30 cells; these 15 are orders. The other 15 — every ผัด with no complement,
// ต้ม and นึ่ง on meats that are not cooked that way — are grammatical Thai
// and real plates in the kitchen's literal sense, but nobody orders them, so
// they are never TARGETS. They remain reachable as wrong answers.
const _RST_DISHES = [
  [0, 0], [0, 1],                       // หมูย่าง หมูทอด
  [1, 0], [1, 1],                       // ไก่ย่าง ไก่ทอด
  [2, 0], [2, 1], [2, 4],               // ปลาย่าง ปลาทอด ปลานึ่ง
  [3, 0],                               // เนื้อย่าง
  [4, 0], [4, 1], [4, 3], [4, 4],       // กุ้งย่าง กุ้งทอด กุ้งต้ม กุ้งนึ่ง
  [5, 0], [5, 1], [5, 4],               // ปลาหมึกย่าง ปลาหมึกทอด ปลาหมึกนึ่ง
];
// Dishes nobody states spice for — grilled, fried and steamed things arrive as
// they are. A target on these leaves heat unstated.
const _RST_NO_HEAT_METHODS = new Set(["ย่าง", "ทอด", "นึ่ง"]);

// ── Pure helpers ────────────────────────────────────────────────────────────

function _rstPick(list, rand) { return list[Math.floor(rand() * list.length)]; }

// Fisher-Yates, local for the same reason _sbShuffle and _ckShuffle are: a
// sort-comparator shuffle is measurably skewed (round 18), and app.js's
// shuffle() drags srs.js in at load.
function _rstShuffle(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// What the table wants. `rand` is injectable so a test can pin a sitting.
// Quantity is unstated about a third of the time (one, unsaid, as a diner
// says it); spice is unstated whenever the dish takes none.
function _rstTarget(rand = Math.random) {
  const [pi, mi] = _rstPick(_RST_DISHES, rand);
  const p = _RST_PROTEINS[pi], m = _RST_METHODS[mi];
  const q = rand() < 0.34 ? null : _rstPick(_RST_QTY, rand);
  const h = _RST_NO_HEAT_METHODS.has(m.th) ? null : _rstPick(_RST_HEAT, rand);
  return { p, m, q, h, pt: null };
}

// ขอ + dish [+ number + classifier] [+ heat] + particle. Thai lines these up
// with no inflection, which is why slot-composition works here at all. The
// classifier follows the dish: soup is a bowl.
function _rstCompose(o) {
  let s = "ขอ" + o.p.th + o.m.th;
  if (o.q) s += o.q.th + o.m.cls;
  if (o.h) s += o.h.th;
  return s + (o.pt ? o.pt.th : "ครับ");
}

// Romanisation assembled from the course data, never stored here.
function _rstRom(th) {
  return _tokenise(th).map(t => t.word ? t.word[1] : t.text).join(" ").replace(/\s+/g, " ").trim();
}

// The plate the kitchen makes from an order. Called with what the learner
// SAID, not what the table wanted — that is the mechanic. An unstated
// quantity is one; an unstated heat is "as it comes".
function _rstPlate(o) {
  const n = o.q ? o.q.n : 1;
  const heat = o.h ? ", " + o.h.en : "";
  return { e: o.p.e + o.m.e + (o.h ? o.h.e : ""), en: `${n} × ${o.m.en} ${o.p.en}${heat}` };
}

// Graded slots where what was said differs from what was wanted, in spoken
// order. Quantity: unstated and หนึ่ง both mean one plate, so they agree.
// Heat: unstated means "as it comes", and stating a heat on such a dish IS a
// miss — the kitchen made it that way because you asked.
function _rstDiff(target, said) {
  const same = (k, a, b) => {
    if (k === "q") return (a ? a.n : 1) === (b ? b.n : 1);
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.th === b.th;
  };
  return _RST_SLOTS.filter(s => s.graded && !same(s.key, target[s.key], said[s.key]))
    .map(s => ({ slot: s.key, want: target[s.key], got: said[s.key], cls: target.m.cls }));
}

// What the waitress says when the plate lands. On a miss she quotes the first
// wrong word back — the learner's own word, not a verdict. A wrong slot the
// learner left EMPTY has no word to quote, so she asks about it instead.
function _rstWaiterLine(diff) {
  if (!diff.length) return "ถูกต้องค่ะ";
  const d = diff[0];
  if (d.got) return "แต่คุณบอกว่า" + d.got.th;
  return d.slot === "q" ? "กี่" + d.cls + "คะ" : "เผ็ดไหมคะ";   // how many plates/bowls? / spicy?
}

// The order the table wanted, said the way the learner would say it — their
// own particle, so the correction is a sentence they can repeat.
function _rstWantedLine(target, said) {
  return _rstCompose({ ...target, pt: said.pt });
}

// ── State ───────────────────────────────────────────────────────────────────

let _rstTarget_ = null, _rstSaid = null, _rstIdx = 0, _rstScore = 0, _rstShelf = [], _rstChipOrder = null;

function _rstBody() { return document.getElementById("rst-body"); }
function _rstFilled() { return _RST_SLOTS.every(s => s.optional || _rstSaid[s.key]); }

// ── Entry point ─────────────────────────────────────────────────────────────

function startRestaurant() {
  showScreen("rst-screen", "M");
  _rstIdx = 0; _rstScore = 0; _rstShelf = [];
  _rstNewOrder();
}

function _rstNewOrder() {
  _rstTarget_ = _rstTarget();
  _rstSaid = { p: null, m: null, q: null, h: null, pt: null };
  // A fresh permutation per slot per order. Chips are identified by their
  // index into the slot's LIST, so a chip means the same thing wherever it
  // sits — only the position is new.
  _rstChipOrder = Object.fromEntries(_RST_SLOTS.map(s => [s.key, _rstShuffle(s.list.map((_, i) => i))]));
  _rstRender();
}

// ── Ordering ────────────────────────────────────────────────────────────────

function _rstRender() {
  const t = _rstTarget_, want = _rstPlate(t);
  document.getElementById("rst-sub-label").textContent = `order ${_rstIdx + 1} of ${_RST_ORDERS} · ${_rstScore} right`;
  _rstBody().innerHTML = `
    <div class="sb-bubble-wrap">
      <div class="sb-avatar">👩‍🍳</div>
      <div class="sb-bubble">
        <div class="sb-bname">Pi Noi</div>
        <div class="sb-q-thai" id="rst-ask"></div>
        <div class="sb-rom" id="rst-ask-rom"></div>
        <div class="sb-en">What will you have?</div>
      </div>
    </div>
    <div class="rst-target">
      <div class="rst-target-label">the table wants</div>
      <div class="rst-plate-e">${want.e || "🍽️"}</div>
      <div class="rst-plate-en">${_sbEsc(want.en)}</div>
    </div>
    <div class="rst-slots">
      ${_RST_SLOTS.map(s => `
        <div class="rst-slot">
          <div class="rst-slot-label">${s.label}${s.optional ? " <span class='rst-opt'>(if you want)</span>" : ""}</div>
          <div class="rst-chips">${_rstChipOrder[s.key].map(i =>
            `<button class="rst-chip" data-slot="${s.key}" data-i="${i}" onclick="_rstChoose('${s.key}',${i})">${_sbEsc(s.list[i].th)}</button>`
          ).join("")}</div>
        </div>`).join("")}
    </div>
    <div class="rst-ticket">
      <div class="rst-ticket-label">your order</div>
      <div class="sb-q-thai" id="rst-ticket-th">…</div>
      <div class="sb-rom" id="rst-ticket-rom"></div>
    </div>
    <button class="sb-btn" id="rst-order-btn" onclick="_rstOrder()" disabled>สั่ง — Order</button>`;
  _sbThai(document.getElementById("rst-ask"), "รับอะไรดีคะ");
  document.getElementById("rst-ask-rom").textContent = _rstRom("รับอะไรดีคะ");
  _tts.speak("รับอะไรดีคะ");
  _rstRefreshTicket();
}

// Tapping a chosen chip again un-chooses it, so an optional slot can be
// cleared after a mis-tap rather than forcing a value into the order.
function _rstChoose(slot, i) {
  const s = _RST_SLOTS.find(x => x.key === slot);
  const cur = _rstSaid[slot];
  _rstSaid[slot] = (cur && cur === s.list[i] && s.optional) ? null : s.list[i];
  _audio.sfx("tap");
  if (_rstSaid[slot]) _tts.speak(s.list[i].th);
  document.querySelectorAll(`.rst-chip[data-slot="${slot}"]`).forEach(b =>
    b.classList.toggle("on", _rstSaid[slot] === s.list[Number(b.dataset.i)]));
  _rstRefreshTicket();
}

function _rstRefreshTicket() {
  const th = document.getElementById("rst-ticket-th");
  const rom = document.getElementById("rst-ticket-rom");
  const btn = document.getElementById("rst-order-btn");
  if (!_rstFilled()) {
    const parts = ["ขอ"].concat(_RST_SLOTS.filter(s => !s.optional).map(s => _rstSaid[s.key] ? _rstSaid[s.key].th : "＿"));
    th.textContent = parts.join(""); rom.textContent = ""; btn.disabled = true;
    return;
  }
  const full = _rstCompose(_rstSaid);
  _sbThai(th, full);
  rom.textContent = _rstRom(full);
  btn.disabled = false;
}

// ── The kitchen ─────────────────────────────────────────────────────────────

function _rstOrder() {
  if (!_rstFilled()) return;
  const said = _rstSaid, target = _rstTarget_;
  const full = _rstCompose(said);
  _tts.speak(full);
  const diff = _rstDiff(target, said);
  const ok = diff.length === 0;
  const got = _rstPlate(said), want = _rstPlate(target);
  const wantedTh = _rstWantedLine(target, said);
  _audio.sfx(ok ? "good" : "bad");
  if (ok) _rstScore++; else _rstShelf.push({ want, got, wantedTh, saidTh: full });

  const line = _rstWaiterLine(diff);
  const d = diff[0];
  const en = ok ? "That's right."
    : d.got ? `But you said ${_sbEsc(d.got.en || d.got.th)}.`
    : d.slot === "h" ? "You didn't say how spicy." : "You didn't say how many.";
  _rstBody().innerHTML = `
    <div class="rst-arrive">
      <div class="rst-arrive-label">${ok ? "the plate lands" : "a plate lands"}</div>
      <div class="rst-plate-e">${got.e || "🍽️"}</div>
      <div class="rst-plate-en">${_sbEsc(got.en)}</div>
    </div>
    <div class="sb-bubble-wrap">
      <div class="sb-avatar">👩‍🍳</div>
      <div class="sb-bubble ${ok ? "sb-react-ok" : "sb-react-bad"}">
        <div class="sb-bname">Pi Noi</div>
        <div class="sb-q-thai" id="rst-line"></div>
        <div class="sb-rom" id="rst-line-rom"></div>
        <div class="sb-en">${en}</div>
      </div>
    </div>
    ${ok ? "" : `
    <div class="rst-wanted">
      <div class="rst-ticket-label">the table wanted — say this</div>
      <div class="sb-q-thai" id="rst-wanted-th"></div>
      <div class="sb-rom" id="rst-wanted-rom"></div>
      <div class="sb-en">${_sbEsc(want.en)}</div>
    </div>`}
    <button class="sb-btn sb-btn-nxt" onclick="_rstNext()">${_rstIdx + 1 >= _RST_ORDERS ? "สรุป →" : "ต่อไป →"}</button>`;
  _sbThai(document.getElementById("rst-line"), line);
  document.getElementById("rst-line-rom").textContent = _rstRom(line);
  if (!ok) {
    _sbThai(document.getElementById("rst-wanted-th"), wantedTh);
    document.getElementById("rst-wanted-rom").textContent = _rstRom(wantedTh);
  }
  _rstIdx++;
}

function _rstNext() {
  if (_rstIdx >= _RST_ORDERS) _rstSummary(); else _rstNewOrder();
}

// ── Summary: the shelf of wrong plates ──────────────────────────────────────

function _rstSummary() {
  document.getElementById("rst-sub-label").textContent = `${_rstScore} of ${_RST_ORDERS} plates right`;
  const shelf = _rstShelf.length
    ? `<div class="rst-shelf-label">the shelf of wrong plates</div>
       <ul class="rst-shelf">${_rstShelf.map((s, i) =>
         `<li><span class="rst-plate-e">${s.got.e || "🍽️"}</span>
              <div>you got <b>${_sbEsc(s.got.en)}</b> — the table wanted ${_sbEsc(s.want.en)}
              <div class="sb-q-thai rst-shelf-th" id="rst-shelf-${i}"></div></div></li>`
       ).join("")}</ul>`
    : `<div class="rst-shelf-label">every plate was right. The shelf is empty.</div>`;
  _rstBody().innerHTML = `
    <div class="rst-arrive-label">${_rstScore === _RST_ORDERS ? "🏆 The kitchen loves you" : _rstScore >= 3 ? "🍽️ A decent sitting" : "😅 The kitchen is confused"}</div>
    ${shelf}
    <button class="sb-btn" onclick="startRestaurant()">สั่งอีก — Order again</button>
    <button class="sb-btn sb-btn-ghost" onclick="showMenu()">← Menu</button>`;
  _rstShelf.forEach((s, i) => _sbThai(document.getElementById(`rst-shelf-${i}`), s.wantedTh));
}
