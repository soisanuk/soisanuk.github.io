// Tests for web/js/clock.js — the Thai six-hour clock behind ⏰ Last Bus.
// The readings themselves are the product here: if thaiTime() is wrong the
// game teaches a wrong thing, so the whole 24-hour day is pinned literally
// rather than derived (a derivation would just repeat the implementation).
// Run with: node --test tests/js/clock.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// clock.js reuses baht-bus.js's number composition, so both are loaded —
// the same arrangement the browser has (script order doesn't matter, the
// references are all inside functions).
for (const f of ["baht-bus.js", "clock.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}

// A deterministic stand-in for Math.random: cycles a fixed ramp so plans and
// shuffles are reproducible without depending on any particular sequence.
function seededRand(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

// ── The day, hour by hour ──────────────────────────────────────────────────

const DAY = [
  [0,  "เที่ยงคืน",        "thîang khuuen"],
  [1,  "ตีหนึ่ง",           "tii nùeng"],
  [2,  "ตีสอง",            "tii sǒong"],
  [3,  "ตีสาม",            "tii sǎam"],
  [4,  "ตีสี่",             "tii sìi"],
  [5,  "ตีห้า",             "tii hâa"],
  [6,  "หกโมงเช้า",        "hòk moong cháo"],
  [7,  "เจ็ดโมงเช้า",       "jèt moong cháo"],
  [8,  "แปดโมงเช้า",       "pàet moong cháo"],
  [9,  "เก้าโมงเช้า",       "kâo moong cháo"],
  [10, "สิบโมงเช้า",        "sìp moong cháo"],
  [11, "สิบเอ็ดโมงเช้า",    "sìp èt moong cháo"],
  [12, "เที่ยง",            "thîang"],
  [13, "บ่ายโมง",          "bàai moong"],
  [14, "บ่ายสองโมง",       "bàai sǒong moong"],
  [15, "บ่ายสามโมง",       "bàai sǎam moong"],
  [16, "สี่โมงเย็น",         "sìi moong yen"],
  [17, "ห้าโมงเย็น",        "hâa moong yen"],
  [18, "หกโมงเย็น",        "hòk moong yen"],
  [19, "หนึ่งทุ่ม",          "nùeng thûm"],
  [20, "สองทุ่ม",           "sǒong thûm"],
  [21, "สามทุ่ม",           "sǎam thûm"],
  [22, "สี่ทุ่ม",            "sìi thûm"],
  [23, "ห้าทุ่ม",            "hâa thûm"],
];

test("every hour of the day reads correctly", () => {
  for (const [h, th, rom] of DAY) {
    assert.equal(thaiTime(h, 0).th, th, `${h}:00 Thai`);
    assert.equal(thaiTime(h, 0).rom, rom, `${h}:00 romanisation`);
  }
});

test("13:00 is บ่ายโมง, not บ่ายหนึ่งโมง", () => {
  // the one irregular in the set — worth its own guard
  assert.equal(thaiTime(13, 0).th, "บ่ายโมง");
  assert.equal(thaiTime(14, 0).th, "บ่ายสองโมง");
});

test("no two hours share a reading", () => {
  // the reading round builds distractors from other hours; if two hours read
  // identically a question could show the right answer twice
  const seen = new Map();
  for (const [h] of DAY) {
    const th = thaiTime(h, 0).th;
    assert.equal(seen.has(th), false, `${th} is shared by ${seen.get(th)} and ${h}`);
    seen.set(th, h);
  }
});

test("half past appends ครึ่ง; other minutes fall back to นาที", () => {
  assert.equal(thaiTime(21, 30).th, "สามทุ่มครึ่ง");
  assert.equal(thaiTime(21, 30).rom, "sǎam thûm khrûeng");
  assert.equal(thaiTime(12, 30).th, "เที่ยงครึ่ง");
  assert.equal(thaiTime(9, 15).th, "เก้าโมงเช้าสิบห้านาที");
  assert.equal(thaiTime(9, 0).th, "เก้าโมงเช้า", "zero minutes adds nothing");
});

test("hours wrap and non-integers are floored", () => {
  assert.equal(thaiTime(24, 0).th, thaiTime(0, 0).th);
  assert.equal(thaiTime(25, 0).th, thaiTime(1, 0).th);
  assert.equal(thaiTime(-3, 0).th, thaiTime(21, 0).th);
});

// ── Alternate readings ─────────────────────────────────────────────────────

test("hours with a second everyday reading offer it", () => {
  assert.deepEqual(thaiTimeAlts(16, 0).map(a => a.th), ["บ่ายสี่โมง"]);
  assert.deepEqual(thaiTimeAlts(17, 0).map(a => a.th), ["บ่ายห้าโมง"]);
  assert.deepEqual(thaiTimeAlts(12, 0).map(a => a.th), ["เที่ยงวัน"]);
  assert.equal(thaiTimeAlts(16, 0)[0].rom, "bàai sìi moong");
});

test("hours with one settled reading offer nothing", () => {
  for (const h of [0, 3, 9, 13, 18, 21]) {
    assert.deepEqual(thaiTimeAlts(h, 0), [], `hour ${h} grew an alternate`);
  }
});

test("alternates take the same minute suffixes", () => {
  assert.deepEqual(thaiTimeAlts(16, 30).map(a => a.th), ["บ่ายสี่โมงครึ่ง"]);
  assert.equal(thaiTimeAlts(16, 30)[0].rom, "bàai sìi moong khrûeng");
  assert.deepEqual(thaiTimeAlts(16, 15).map(a => a.th), ["บ่ายสี่โมงสิบห้านาที"]);
});

test("เที่ยงวัน is offered on the hour only", () => {
  // เที่ยงครึ่ง is how half twelve is said; เที่ยงวันครึ่ง isn't
  assert.deepEqual(thaiTimeAlts(12, 30), []);
  assert.deepEqual(thaiTimeAlts(12, 0).map(a => a.th), ["เที่ยงวัน"]);
});

test("no alternate collides with another hour's reading", () => {
  // an alternate that doubles as some other hour's canonical form would be
  // ambiguous — the player would hear it and correctly set a different time
  const canonical = new Map();
  for (let h = 0; h < 24; h++) canonical.set(thaiTime(h, 0).th, h);
  for (let h = 0; h < 24; h++) {
    for (const alt of thaiTimeAlts(h, 0)) {
      const clash = canonical.get(alt.th);
      assert.ok(clash === undefined || clash === h,
        `${alt.th} (alternate for ${h}:00) also reads as ${clash}:00`);
    }
  }
});

test("no two hours share an alternate", () => {
  const seen = new Map();
  for (let h = 0; h < 24; h++) {
    for (const alt of thaiTimeAlts(h, 0)) {
      assert.equal(seen.has(alt.th), false, `${alt.th} is shared by ${seen.get(alt.th)} and ${h}`);
      seen.set(alt.th, h);
    }
  }
});

// ── Display formats ────────────────────────────────────────────────────────

test("24h and 12h display strings", () => {
  assert.equal(thaiTime(21, 30).h24, "21:30");
  assert.equal(thaiTime(9, 0).h24, "09:00");
  assert.equal(thaiTime(21, 30).clock, "9:30 PM");
  assert.equal(thaiTime(0, 0).clock, "12:00 AM", "midnight is 12 AM, not 0 AM");
  assert.equal(thaiTime(12, 0).clock, "12:00 PM", "noon is 12 PM");
  assert.equal(thaiTime(13, 0).clock, "1:00 PM");
});

test("clock face → 24h handles the 12 o'clock flip", () => {
  assert.equal(_ckHour24(12, false), 0,  "12 AM is hour 0");
  assert.equal(_ckHour24(12, true), 12,  "12 PM is hour 12");
  assert.equal(_ckHour24(1, false), 1);
  assert.equal(_ckHour24(9, true), 21);
  assert.equal(_ckHour24(11, true), 23);
});

// ── The confusion model ────────────────────────────────────────────────────

test("spoken number is what the cycles collide on", () => {
  assert.equal(_ckSpokenNum(3), 3);    // ตีสาม
  assert.equal(_ckSpokenNum(15), 3);   // บ่ายสามโมง
  assert.equal(_ckSpokenNum(21), 3);   // สามทุ่ม
  assert.equal(_ckSpokenNum(6), 6);    // หกโมงเช้า
  assert.equal(_ckSpokenNum(18), 6);   // หกโมงเย็น
  assert.equal(_ckSpokenNum(0), 0);    // เที่ยงคืน — no number
  assert.equal(_ckSpokenNum(12), 0);   // เที่ยง — no number
});

test("confusable hours are the same-number twins", () => {
  assert.deepEqual(_ckConfusable(21).sort((a, b) => a - b), [3, 15]);
  assert.deepEqual(_ckConfusable(4).sort((a, b) => a - b), [16, 22]);
  assert.deepEqual(_ckConfusable(6).sort((a, b) => a - b), [18]);
  assert.deepEqual(_ckConfusable(0), [12], "midnight's twin is noon");
  assert.deepEqual(_ckConfusable(7), [], "เจ็ดโมงเช้า stands alone");
});

test("distractors: three distinct wrong hours, twins preferred", () => {
  for (let h = 0; h < 24; h++) {
    const d = _ckDistractorHours(h, seededRand(h + 1));
    assert.equal(d.length, 3, `hour ${h} got ${d.length} distractors`);
    assert.equal(new Set(d).size, 3, `hour ${h} has duplicate distractors`);
    assert.equal(d.includes(h), false, `hour ${h} offered as its own distractor`);
    // every same-number twin should make the cut (there are never more than 3)
    for (const twin of _ckConfusable(h)) {
      assert.ok(d.includes(twin), `hour ${h} dropped its twin ${twin}`);
    }
  }
});

test("distractors still fill out for an hour with no twin", () => {
  const d = _ckDistractorHours(7, seededRand(9));
  assert.equal(d.length, 3);
  assert.equal(d.includes(7), false);
});

// ── The round plan ─────────────────────────────────────────────────────────

test("a plan is ten non-repeating rounds covering every cycle", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const plan = _ckPlan(seededRand(seed));
    assert.equal(plan.length, 10, `seed ${seed}: wrong length`);
    assert.equal(new Set(plan.map(p => p.h)).size, 10, `seed ${seed}: repeated hour`);
    const cycles = new Set(plan.map(p => thaiTime(p.h, 0).cycle));
    for (const c of ["tii", "cháo", "bàai", "yen", "thûm"]) {
      assert.ok(cycles.has(c), `seed ${seed}: cycle ${c} never appears`);
    }
    assert.ok(cycles.has("midnight") || cycles.has("noon"),
      `seed ${seed}: neither เที่ยง nor เที่ยงคืน appears`);
  }
});

test("plan alternates reading and setting rounds", () => {
  const plan = _ckPlan(seededRand(7));
  plan.forEach((p, i) => assert.equal(p.type, i % 2 === 0 ? "read" : "set"));
});

test("plan minutes are only o'clock or half past, never at midnight", () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const p of _ckPlan(seededRand(seed))) {
      assert.ok(p.m === 0 || p.m === 30, `seed ${seed}: odd minutes ${p.m}`);
      if (p.h === 0) assert.equal(p.m, 0, `seed ${seed}: เที่ยงคืนครึ่ง generated`);
    }
  }
});

test("the reference chart's examples land in the cycle they illustrate", () => {
  const want = {
    "ตี": "tii", "โมงเช้า": "cháo", "เที่ยง": "noon",
    "บ่าย": "bàai", "โมงเย็น": "yen", "ทุ่ม": "thûm", "เที่ยงคืน": "midnight",
  };
  for (const cell of _CK_CHART) {
    assert.equal(thaiTime(cell.eg, 0).cycle, want[cell.label],
      `chart row ${cell.label} illustrates the wrong cycle`);
  }
});

// ── findings from the 2026-08-30 Last Bus persona round ─────────────────────

test("a reading round always offers options on both sides of noon", () => {
  // Hours 7-11 have no same-number twin, so their distractors came from a
  // fallback where (h+12)%24 was one of five candidates and lost the draw about
  // two times in five. 4.55% of reading rounds — one every four games — showed
  // four options all before noon, e.g. 09:00 against สิบโมงเช้า / เจ็ดโมงเช้า /
  // สิบเอ็ดโมงเช้า, which anyone who knows เก้า = 9 answers without knowing a
  // cycle exists. Telling AM from PM is the whole point of this game.
  for (let h = 0; h < 24; h++) {
    for (let i = 0; i < 200; i++) {
      const all = [h, ..._ckDistractorHours(h, Math.random)];
      assert.ok(all.some(x => x < 12) && all.some(x => x >= 12),
        `hour ${h}: every option is the same side of noon — [${all}]`);
    }
  }
});

test("distractors stay distinct and never include the answer", () => {
  // the cross-cycle guarantee above must not cost the older invariants
  for (let h = 0; h < 24; h++) {
    for (let i = 0; i < 200; i++) {
      const d = _ckDistractorHours(h, Math.random);
      assert.equal(d.length, 3, `hour ${h}`);
      assert.equal(new Set(d).size, 3, `hour ${h} repeated a distractor`);
      assert.ok(!d.includes(h), `hour ${h} is among its own distractors`);
    }
  }
});

test("thaiTime never emits 'undefined', at any minute of any day", () => {
  // minutes were not normalised and NaN fell through every branch to ทุ่ม, so
  // thaiTime(0,-5) read "เที่ยงคืนundefinedร้อยundefinedสิบundefinedนาที" and
  // thaiTime(NaN,0) returned a bare, plausible "ทุ่ม" for a nonexistent time
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m++) {
      const t = thaiTime(h, m);
      assert.ok(!/undefined/.test(t.th + t.rom), `${h}:${m} → ${t.th}`);
    }
  }
});

test("thaiTime normalises malformed input instead of corrupting", () => {
  assert.equal(thaiTime(NaN, 0).th, "เที่ยงคืน");
  assert.equal(thaiTime(undefined, 0).th, "เที่ยงคืน");
  assert.equal(thaiTime(0, -5).h24, "00:55", "minutes wrap like hours do");
  assert.equal(thaiTime(9, 60).h24, "09:00");
  assert.equal(thaiTime(9, 30).th, "เก้าโมงเช้าครึ่ง", "ordinary input is untouched");
});

// Found by the 2026-08-30 games look-and-feel round: #ck-hud is display:flex
// with a 1.8rem gap, so the bare text nodes in `Stop <strong>1</strong>/10`
// became three separate flex items and it read "Stop 1 /10" with the
// denominator pushed 28.8px away. baht-bus.js wraps the identical string.
test("the HUD round counter is a single flex item", () => {
  const src = readFileSync(new URL("../../web/js/clock.js", import.meta.url), "utf8");
  assert.match(src, /<span>Stop <strong>/,
    "Stop N/10 must be wrapped, or the flex gap splits it into three items");
});
