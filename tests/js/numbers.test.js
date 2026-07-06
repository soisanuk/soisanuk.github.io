// Number flashcard data — NUM_CARDS and _THAI_DIGITS.
// numbers.js is DOM-free at load time (DOM is only touched inside functions
// that the tests never call), so it vm-loads cleanly.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";

runInThisContext(readFileSync(new URL("../../web/js/numbers.js", import.meta.url), "utf8"), { filename: "numbers.js" });

describe("NUM_CARDS", () => {
  test("has 25 cards covering the full set", () => {
    assert.equal(NUM_CARDS.length, 25);
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
    assert.equal(byN[100].th,  "หนึ่งร้อย");
    assert.equal(byN[1000].th, "หนึ่งพัน");
    assert.ok(byN[9999],       "9999 card missing");
    // romanisations
    assert.equal(byN[0].rom,   "sǔun");
    assert.equal(byN[20].rom,  "yîi-sìp");
    assert.equal(byN[11].rom,  "sìp èt");
  });

  test("covers digits 0–9, key teens, all tens 10–90, 100, 1000, 9999", () => {
    const ns = new Set(NUM_CARDS.map(c => c.n));
    for (let i = 0; i <= 9; i++)   assert.ok(ns.has(i), `missing ${i}`);
    for (const n of [10, 11, 12, 20, 21]) assert.ok(ns.has(n), `missing ${n}`);
    for (let n = 30; n <= 90; n += 10) assert.ok(ns.has(n), `missing ${n}`);
    assert.ok(ns.has(100));
    assert.ok(ns.has(1000));
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
