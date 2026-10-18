// ── The Restaurant — ordering beat, v1 ─────────────────────────────────────
// Design: docs/restaurant-scenario.md. The mechanic in one line: you compose an
// order out of parts and the kitchen brings EXACTLY what you said. ไก่ทอด and
// ไก่ย่าง are one syllable apart and arrive as different plates; the waitress
// does not say "wrong", she says แต่คุณบอกว่าทอด — "but you said fried".
//
// Why only this beat: the proposal's recommendation was to build the ordering
// beat alone and find out whether it is fun before building anything around
// it. No arrival, no bill, one role (diner). If this is not fun, one beat was
// the cost of learning that.
//
// Two decisions that are not obvious from the code:
//
// 1. This file stores NO romanisations. Every rom shown is read from WORD_MAP
//    at render time, so the game cannot drift from data.js the way Soi
//    Buakhao's 499 romanised syllables did for weeks. The price is that every
//    Thai string here must be a WORDS entry — restaurant.test.js enforces it.
// 2. Protein and method are separate chips even though the course holds eight
//    protein+method compounds (ไก่ย่าง, หมูทอด…). Thai forms these by plain
//    juxtaposition, with no inflection, so composition yields correct Thai
//    whether or not the compound is an entry — and the eight that ARE entries
//    simply tokenise whole under longest-match when tapped.
//
// DOM-free at load; the pure helpers are unit-tested. Cross-file calls
// (showScreen, _sbThai, _sbEsc, _tts, _audio, WORD_MAP, _tokenise,
// openWordModal) all happen inside functions, after every script has loaded.

const _RST_PROTEINS = [
  { th: "หมู",     en: "pork",    e: "🐷" },
  { th: "ไก่",     en: "chicken", e: "🐔" },
  { th: "ปลา",     en: "fish",    e: "🐟" },
  { th: "เนื้อ",    en: "beef",    e: "🐄" },
  { th: "กุ้ง",     en: "prawn",   e: "🦐" },
  { th: "ปลาหมึก", en: "squid",   e: "🦑" },
];
const _RST_METHODS = [
  { th: "ย่าง", en: "grilled",    e: "🔥" },
  { th: "ทอด",  en: "fried",      e: "🍳" },
  { th: "ผัด",  en: "stir-fried", e: "🥘" },
  { th: "ต้ม",  en: "boiled",     e: "🍲" },
  { th: "นึ่ง",  en: "steamed",    e: "♨️" },
];
const _RST_QTY = [
  { th: "หนึ่ง", n: 1 },
  { th: "สอง",  n: 2 },
  { th: "สาม",  n: 3 },
];
const _RST_HEAT = [
  { th: "ไม่เผ็ด",  en: "not spicy",      e: "" },
  { th: "เผ็ดน้อย", en: "a little spicy", e: "🌶" },
  { th: "เผ็ดมาก",  en: "very spicy",     e: "🌶🌶🌶" },
];
const _RST_SLOTS = [
  { key: "p", label: "what",     list: _RST_PROTEINS },
  { key: "m", label: "how",      list: _RST_METHODS },
  { key: "q", label: "how many", list: _RST_QTY },
  { key: "h", label: "spice",    list: _RST_HEAT },
];
const _RST_ORDERS = 5;            // one sitting

// ── Pure helpers ────────────────────────────────────────────────────────────

function _rstPick(list, rand) { return list[Math.floor(rand() * list.length)]; }

// What the customer wants. `rand` is injectable so a test can pin a sitting.
function _rstTarget(rand = Math.random) {
  return { p: _rstPick(_RST_PROTEINS, rand), m: _rstPick(_RST_METHODS, rand),
           q: _rstPick(_RST_QTY, rand),      h: _rstPick(_RST_HEAT, rand) };
}

// ขอ + dish + number + classifier + heat + politeness. Thai lines these up
// with no inflection, which is the whole reason slot-composition works here.
function _rstCompose(o) {
  return "ขอ" + o.p.th + o.m.th + o.q.th + "จาน" + o.h.th + "ครับ";
}

// Romanisation assembled from the course data, never stored here.
function _rstRom(th) {
  return _tokenise(th).map(t => t.word ? t.word[1] : t.text).join(" ").replace(/\s+/g, " ").trim();
}

// The plate the kitchen actually makes from an order. Called with what the
// learner SAID, not what the customer wanted — that is the mechanic.
function _rstPlate(o) {
  return { e: o.p.e + o.m.e + o.h.e, en: `${o.q.n} × ${o.m.en} ${o.p.en}, ${o.h.en}` };
}

// Slots where what was said differs from what was wanted, in spoken order.
function _rstDiff(target, said) {
  return _RST_SLOTS.filter(s => target[s.key].th !== said[s.key].th)
    .map(s => ({ slot: s.key, want: target[s.key], got: said[s.key] }));
}

// What the waitress says when the plate lands. On a miss she quotes the first
// wrong word back — the learner's own word, not a verdict.
function _rstWaiterLine(diff) {
  return diff.length ? "แต่คุณบอกว่า" + diff[0].got.th : "ถูกต้องค่ะ";
}

// ── State ───────────────────────────────────────────────────────────────────

let _rstTarget_ = null, _rstSaid = null, _rstIdx = 0, _rstScore = 0, _rstShelf = [];

function _rstBody() { return document.getElementById("rst-body"); }
function _rstFilled() { return _RST_SLOTS.every(s => _rstSaid[s.key]); }

// ── Entry point ─────────────────────────────────────────────────────────────

function startRestaurant() {
  showScreen("rst-screen", "M");
  _rstIdx = 0; _rstScore = 0; _rstShelf = [];
  _rstNewOrder();
}

function _rstNewOrder() {
  _rstTarget_ = _rstTarget();
  _rstSaid = { p: null, m: null, q: null, h: null };
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
          <div class="rst-slot-label">${s.label}</div>
          <div class="rst-chips">${s.list.map((it, i) =>
            `<button class="rst-chip" data-slot="${s.key}" data-i="${i}" onclick="_rstChoose('${s.key}',${i})">${_sbEsc(it.th)}</button>`
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
  _rstRefreshTicket();
}

function _rstChoose(slot, i) {
  const list = _RST_SLOTS.find(s => s.key === slot).list;
  _rstSaid[slot] = list[i];
  _audio.sfx("tap");
  _tts.speak(list[i].th);
  document.querySelectorAll(`.rst-chip[data-slot="${slot}"]`).forEach(b =>
    b.classList.toggle("on", Number(b.dataset.i) === i));
  _rstRefreshTicket();
}

function _rstRefreshTicket() {
  const th = document.getElementById("rst-ticket-th");
  const rom = document.getElementById("rst-ticket-rom");
  const btn = document.getElementById("rst-order-btn");
  if (!_rstFilled()) {
    // Show the slots filled so far, in order, so the sentence grows as you tap.
    const parts = ["ขอ"].concat(_RST_SLOTS.map(s => _rstSaid[s.key] ? _rstSaid[s.key].th : "＿"));
    th.textContent = parts.join("") ; rom.textContent = ""; btn.disabled = true;
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
  _audio.sfx(ok ? "good" : "bad");
  if (ok) _rstScore++; else _rstShelf.push({ want, got, diff });

  const line = _rstWaiterLine(diff);
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
        <div class="sb-en">${ok ? "That's right." : "But you said " + _sbEsc(diff[0].got.en || diff[0].got.th) + "."}</div>
      </div>
    </div>
    ${ok ? "" : `<div class="rst-wanted">the table wanted: ${_sbEsc(want.en)}</div>`}
    <button class="sb-btn sb-btn-nxt" onclick="_rstNext()">${_rstIdx + 1 >= _RST_ORDERS ? "สรุป →" : "ต่อไป →"}</button>`;
  _sbThai(document.getElementById("rst-line"), line);
  document.getElementById("rst-line-rom").textContent = _rstRom(line);
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
       <ul class="rst-shelf">${_rstShelf.map(s =>
         `<li><span class="rst-plate-e">${s.got.e || "🍽️"}</span> you got <b>${_sbEsc(s.got.en)}</b> — the table wanted ${_sbEsc(s.want.en)}</li>`
       ).join("")}</ul>`
    : `<div class="rst-shelf-label">every plate was right. The shelf is empty.</div>`;
  _rstBody().innerHTML = `
    <div class="rst-arrive-label">${_rstScore === _RST_ORDERS ? "🏆 The kitchen loves you" : _rstScore >= 3 ? "🍽️ A decent sitting" : "😅 The kitchen is confused"}</div>
    ${shelf}
    <button class="sb-btn" onclick="startRestaurant()">สั่งอีก — Order again</button>
    <button class="sb-btn sb-btn-ghost" onclick="showMenu()">← Menu</button>`;
}
