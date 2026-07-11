// Tests for the pure, rule-based helpers in web/js/sessions.js — tone
// detection (the tone drill's answer key) and the tone-drill word pool. The
// rest of sessions.js drives the DOM and is exercised in the browser; these
// two are DOM-free and load cleanly under node:vm, so they ship exactly as
// tested. srs.js is loaded because sessions.js references its helpers at
// call time (not needed by the functions under test, but keeps the load honest).
// Run with: node --test tests/js/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "srs.js", "sessions.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}

// ── _detectWordTone: the tone-drill answer key ──────────────────────────────
// Returns 0 (no mark / natural) through 4, one per Thai tone mark.

test("_detectWordTone maps each tone mark to its index", () => {
  assert.equal(_detectWordTone("นก"), 0, "no mark → natural");
  assert.equal(_detectWordTone("ไก่"), 1, "ไม้เอก ่");
  assert.equal(_detectWordTone("น้ำ"), 2, "ไม้โท ้");
  assert.equal(_detectWordTone("โต๊ะ"), 3, "ไม้ตรี ๊");
  assert.equal(_detectWordTone("จ๋า"), 4, "ไม้จัตวา ๋");
});

test("_detectWordTone returns the first tone mark in the word", () => {
  // ่ appears before ้ here — the earlier mark wins the scan
  assert.equal(_detectWordTone("ก่ข้"), 1);
  assert.equal(_detectWordTone("ก้ข่"), 2);
});

test("_detectWordTone ignores non-tone Thai and Latin alike", () => {
  assert.equal(_detectWordTone("สวัสดี"), 0);
  assert.equal(_detectWordTone("hello"), 0);
  assert.equal(_detectWordTone(""), 0);
});

// ── _toneDrillPool: filter + cap over WORDS ─────────────────────────────────
// Skips words longer than 5 UTF-16 units and caps the session at 100. shuffle
// lives in the DOM-heavy app.js, so stub it deterministically.

test("_toneDrillPool caps at 100 and drops long words", () => {
  globalThis.shuffle = arr => arr; // identity: deterministic, order-independent asserts
  const pool = _toneDrillPool();
  assert.ok(pool.length <= 100, "capped at 100");
  assert.ok(pool.every(w => w[0].length <= 5), "no word over 5 chars");
  const wordSet = new Set(WORDS);
  assert.ok(pool.every(w => wordSet.has(w)), "every entry comes straight from WORDS");
});
