// Number flashcard data — NUM_CARDS and _THAI_DIGITS.
// numbers.js is DOM-free at load time (DOM is only touched inside functions
// that the tests never call), so it vm-loads cleanly. data.js + app.js are
// loaded too, so the scale-word cards (หมื่น/แสน/ล้าน) can be checked against
// WORD_MAP's canonical rtgs, the same spelling the rest of the app teaches.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";

for (const f of ["data.js", "srs.js", "wordcard.js", "app.js", "numbers.js"]) {
  runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}

describe("NUM_CARDS", () => {
  test("has 28 cards covering the full set", () => {
    assert.equal(NUM_CARDS.length, 28);
  });

  test("every card has a numeric n, non-empty th and rom", () => {
    for (const c of NUM_CARDS) {
      assert.equal(typeof c.n, "number", `n on card ${c.n}`);
      assert.ok(c.th && c.th.length > 0, `th on card ${c.n}`);
      assert.ok(c.rom && c.rom.length > 0, `rom on card ${c.n}`);
    }
  });

  test("n values are unique", () => {
    const ns = NUM_CARDS.map(c => c.n);
    assert.equal(new Set(ns).size, ns.length, "duplicate n values");
  });

  test("specific Thai words and romanisations are correct", () => {
    const byN = Object.fromEntries(NUM_CARDS.map(c => [c.n, c]));
    // irregular forms
    assert.equal(byN[0].th,    "ศูนย์");
    assert.equal(byN[11].th,   "สิบเอ็ด");   // เอ็ด, not หนึ่ง
    assert.equal(byN[20].th,   "ยี่สิบ");    // ยี่, not สอง
    assert.equal(byN[21].th,   "ยี่สิบเอ็ด");
    assert.equal(byN[100].th,     "หนึ่งร้อย");
    assert.equal(byN[1000].th,    "หนึ่งพัน");
    assert.equal(byN[10000].th,   "หนึ่งหมื่น");
    assert.equal(byN[100000].th,  "หนึ่งแสน");
    assert.equal(byN[1000000].th, "หนึ่งล้าน");
    assert.ok(byN[9999],       "9999 card missing");
    // romanisations
    assert.equal(byN[0].rom,   "sǔun");
    assert.equal(byN[20].rom,  "yîi-sìp");
    assert.equal(byN[11].rom,  "sìp èt");
    // the scale words' rtgs must match their canonical data.js entries
    // (หมื่น/แสน/ล้าน), so a learner isn't taught two different spellings
    assert.equal(byN[10000].rom,   "nùeng-" + WORD_MAP["หมื่น"][1]);
    assert.equal(byN[100000].rom,  "nùeng-" + WORD_MAP["แสน"][1]);
    assert.equal(byN[1000000].rom, "nùeng-" + WORD_MAP["ล้าน"][1]);
  });

  test("covers digits 0–9, key teens, all tens 10–90, 100, 1000, the scale words, 9999", () => {
    const ns = new Set(NUM_CARDS.map(c => c.n));
    for (let i = 0; i <= 9; i++)   assert.ok(ns.has(i), `missing ${i}`);
    for (const n of [10, 11, 12, 20, 21]) assert.ok(ns.has(n), `missing ${n}`);
    for (let n = 30; n <= 90; n += 10) assert.ok(ns.has(n), `missing ${n}`);
    assert.ok(ns.has(100));
    assert.ok(ns.has(1000));
    assert.ok(ns.has(10000),   "missing หมื่น (10,000)");
    assert.ok(ns.has(100000),  "missing แสน (100,000)");
    assert.ok(ns.has(1000000), "missing ล้าน (1,000,000)");
    assert.ok(ns.has(9999));
  });
});

describe("_THAI_DIGITS", () => {
  test("has exactly 10 characters (๐–๙)", () => {
    assert.equal(_THAI_DIGITS.length, 10);
  });

  test("first digit is ๐ and last is ๙", () => {
    assert.equal(_THAI_DIGITS[0], "๐");
    assert.equal(_THAI_DIGITS[9], "๙");
  });

  test("each character is a Thai digit codepoint (U+0E50–U+0E59)", () => {
    for (let i = 0; i < 10; i++) {
      const cp = _THAI_DIGITS.codePointAt(i);
      assert.equal(cp, 0x0E50 + i, `digit ${i} wrong codepoint`);
    }
  });
});

// Found by the 2026-08-30 games look-and-feel round. .thai-big is 7.5rem on
// mobile, which is right for สิบ and catastrophic for เก้าร้อยเก้าสิบเก้า: at
// 120px on a 390px phone it wrapped to FOUR lines and pushed the footer 533px
// below the fold, so "← Menu" needed half a screen of scrolling to reach.
// CSS cannot size by content length; _nfShow is the code that knows the
// content. Measured worst-case overflow across 40 real cards: 565px → 31px,
// with the footer on screen at every answer length.
test("the Numbers answer shrinks as the answer gets longer", () => {
  const src = readFileSync(new URL("../../web/js/numbers.js", import.meta.url), "utf8");
  assert.match(src, /glyphs\s*>\s*\d+\s*\?/, "_nfShow no longer scales by glyph count");
  // the tiers must be monotone: more glyphs never means a bigger font
  const tiers = [...src.matchAll(/glyphs > (\d+) \? "([\d.]+)rem"/g)]
    .map(m => ({ over: +m[1], rem: +m[2] }))
    .sort((a, b) => a.over - b.over);
  assert.ok(tiers.length >= 2, "expected at least two size tiers");
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(tiers[i].rem <= tiers[i - 1].rem,
      `tier at >${tiers[i].over} glyphs is LARGER than at >${tiers[i - 1].over}`);
  }
});
