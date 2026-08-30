// Baht Bus — Thai number composition, fare/change generation, charter
// negotiation. baht-bus.js is DOM-free at load time, so it vm-loads whole;
// scene/UI functions exist but are never called here. wordcard.js loads
// first: _bbEsc delegates to its _wcEsc, the single escaping implementation.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";

for (const f of ["wordcard.js", "baht-bus.js"]) {
  runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"), { filename: f });
}

describe("Thai numbers", () => {
  test("composes 1–999 correctly at the tricky spots", () => {
    const cases = {
      1: "หนึ่ง", 5: "ห้า", 10: "สิบ",
      11: "สิบเอ็ด",          // 11 uses เอ็ด, not หนึ่ง
      15: "สิบห้า",
      20: "ยี่สิบ",           // 20 uses ยี่, not สอง
      21: "ยี่สิบเอ็ด",
      45: "สี่สิบห้า",
      60: "หกสิบ",
      100: "หนึ่งร้อย",
      101: "หนึ่งร้อยเอ็ด",   // เอ็ด also directly after ร้อย
      110: "หนึ่งร้อยสิบ",
      111: "หนึ่งร้อยสิบเอ็ด",
      120: "หนึ่งร้อยยี่สิบ",
      150: "หนึ่งร้อยห้าสิบ",
      250: "สองร้อยห้าสิบ",
      999: "เก้าร้อยเก้าสิบเก้า",
    };
    for (const [n, th] of Object.entries(cases)) {
      assert.equal(_bbThaiNum(+n), th, `thai ${n}`);
    }
  });

  test("romanisation mirrors the same structure", () => {
    assert.equal(_bbRomanNum(11), "sìp èt");
    assert.equal(_bbRomanNum(20), "yîi-sìp");
    assert.equal(_bbRomanNum(45), "sìi-sìp hâa");
    assert.equal(_bbRomanNum(150), "nùeng-rói hâa-sìp");
  });
});

describe("loop fare stops", () => {
  test("fares are ฿15 a head and payment always covers the fare", () => {
    for (let i = 0; i < 500; i++) {
      const stop = 1 + (i % 10);
      const s = _bbMakeFareStop(stop);
      assert.equal(s.fare, s.riders * 15);
      assert.ok(s.riders >= 1 && s.riders <= 4, `riders ${s.riders}`);
      assert.ok(s.paid >= s.fare, `paid ${s.paid} < fare ${s.fare}`);
      assert.equal(s.change, s.paid - s.fare);
      // non-exact payments are always a single real note
      if (s.paid !== s.fare) assert.ok([20, 50, 100].includes(s.paid));
    }
  });

  test("early stops keep the rider count small", () => {
    for (let i = 0; i < 200; i++) {
      assert.ok(_bbMakeFareStop(1).riders <= 2);
    }
  });

  test("change breakdown is greedy and sums correctly", () => {
    assert.deepEqual(_bbBreakdown(55), [50, 5]);
    assert.deepEqual(_bbBreakdown(85), [50, 20, 10, 5]);
    assert.deepEqual(_bbBreakdown(5), [5]);
    assert.deepEqual(_bbBreakdown(0), []);
    for (let n = 0; n <= 99; n++) {
      assert.equal(_bbBreakdown(n).reduce((a, b) => a + b, 0), n);
    }
  });

  test("every possible change amount is payable from the tray", () => {
    for (let i = 0; i < 300; i++) {
      const s = _bbMakeFareStop(1 + (i % 10));
      const denoms = _bbBreakdown(s.change);
      for (const d of denoms) assert.ok(_BB_TRAY.includes(d), `฿${d} not in tray`);
    }
  });
});

describe("charters", () => {
  test("choices always include the fair quote, unique and plausible", () => {
    for (let i = 0; i < 300; i++) {
      const c = _bbMakeCharter();
      assert.equal(c.choices.length, 4);
      assert.ok(c.choices.includes(c.quote));
      assert.equal(new Set(c.choices).size, 4, "duplicate choice");
      for (const v of c.choices) assert.ok(v >= 20, `implausible ฿${v}`);
      assert.equal(c.quote, c.dest.fair);
    }
  });

  test("counter-offers sit around the bottom line, below the quote", () => {
    for (let i = 0; i < 300; i++) {
      const c = _bbMakeCharter();
      assert.ok(c.bottom < c.quote, "bottom line below quote");
      assert.ok(c.counter >= 10);
      assert.ok(c.counter <= c.quote - 10, `counter ${c.counter} vs quote ${c.quote}`);
    }
  });

  test("deal outcomes: accept at/above bottom, refuse lowballs", () => {
    // counter ≥ bottom: accepting is right (earn counter), refusing loses the ride
    assert.deepEqual(_bbDealOutcome(true, 80, 70, 100), { ok: true, fare: 80 });
    assert.deepEqual(_bbDealOutcome(false, 80, 70, 100), { ok: false, fare: 0 });
    assert.deepEqual(_bbDealOutcome(true, 70, 70, 100), { ok: true, fare: 70 });
    // counter < bottom: refusing is right (they pay the quote), accepting undersells
    assert.deepEqual(_bbDealOutcome(false, 50, 70, 100), { ok: true, fare: 100 });
    assert.deepEqual(_bbDealOutcome(true, 50, 70, 100), { ok: false, fare: 50 });
  });

  test("destination fair prices are round Thai-friendly amounts", () => {
    for (const d of _BB_DESTS) {
      assert.ok(d.fair % 10 === 0 && d.fair >= 40 && d.fair <= 500, d.en);
      assert.ok(d.th.length > 0 && d.en.length > 0);
    }
  });

  test("no charter destination is on the ฿15 loop", () => {
    for (const d of _BB_DESTS) {
      assert.ok(!/walking street|terminal 21|beach road|second road/i.test(d.en), d.en);
    }
  });
});

// ── findings from the 2026-08-30 Baht Bus persona round ─────────────────────

test("_bbThaiNum clamps instead of composing 'undefined'", () => {
  // _BB_DIG has ten entries, so _bbThaiNum(1000) returned "undefinedร้อย".
  // Unreachable today (the largest amount the game produces is ฿600) but it
  // would break the moment a pricier destination or bigger delta was added.
  assert.ok(!/undefined/.test(_bbThaiNum(1000)));
  assert.equal(_bbThaiNum(0), "");
  assert.equal(_bbThaiNum(NaN), "");
  assert.equal(_bbThaiNum(-5), "");
  for (let n = 1; n <= 999; n++) assert.ok(!/undefined/.test(_bbThaiNum(n)), `n=${n}`);
});

test("the number chart teaches เอ็ด, which the prices never can", () => {
  // Every amount the game speaks is a multiple of 10 except ฿15 and ฿45, so of
  // 55 reachable values NONE contains เอ็ด — the morpheme data.js teaches
  // explicitly. Real fares and charter prices are round; faking a ฿21 fare
  // would buy coverage with authenticity, so the chart carries it instead.
  const src = readFileSync(new URL("../../web/js/baht-bus.js", import.meta.url), "utf8");
  const nums = src.match(/const nums = \[([^\]]+)\]/);
  assert.ok(nums, "chart number list not found");
  const list = nums[1].split(",").map(n => +n.trim());
  const shown = list.map(n => (n === 100 ? "ร้อย" : _bbThaiNum(n)));
  assert.ok(shown.some(t => t.includes("เอ็ด")), `chart teaches no เอ็ด: ${shown.join(" ")}`);
  assert.ok(shown.some(t => t.includes("ยี่")), `chart teaches no ยี่: ${shown.join(" ")}`);
});

test("no fare round can be won 80% of the time by ignoring the audio", () => {
  // At ฿60 only the ฿100 note covers the fare, so the round has two possible
  // answers; the 20% exact-change rate made ฿100 right 80% of the time. A
  // two-option round can be no fairer than a coin, but it should be one.
  const seen = {};
  for (const stop of [1, 2, 4, 5, 7, 8, 10]) {
    for (let i = 0; i < 20000; i++) {
      const c = _bbMakeFareStop(stop);
      ((seen[c.fare] = seen[c.fare] || {})[c.paid] ||= 0), seen[c.fare][c.paid]++;
    }
  }
  for (const [fare, dist] of Object.entries(seen)) {
    const n = Object.values(dist).reduce((a, b) => a + b, 0);
    const best = Math.max(...Object.values(dist)) / n;
    assert.ok(best <= 0.55, `฿${fare}: always guessing the commonest payment wins ${(100*best).toFixed(0)}%`);
  }
});

test("change stays small enough to count out by hand", () => {
  // guards the fix above: raising the exact-change rate must not be "solved"
  // later by adding a bigger note — a ฿500 would push change from ฿85 to ฿485
  let max = 0;
  for (const stop of [1, 2, 4, 5, 7, 8, 10])
    for (let i = 0; i < 20000; i++) max = Math.max(max, _bbMakeFareStop(stop).change);
  assert.ok(max <= 100, `max change ฿${max} — too many notes to hand back`);
});
