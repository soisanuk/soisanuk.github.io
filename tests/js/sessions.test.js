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

// thai-script.js + curriculum.js provide the tone engine (toneOfWord) that the
// drill's answer key now uses; data.js provides TONES it indexes into.
for (const f of ["data.js", "thai-script.js", "curriculum.js", "srs.js", "sessions.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}

// ── _detectWordTone: the tone-drill answer key ──────────────────────────────
// Returns the word's ACTUAL tone as an index into TONES (0 สามัญ/mid …
// 4 จัตวา/rising) via the tone engine — not the tone MARK, which an unmarked
// non-mid word (หมา, สิบ) doesn't have.

test("_detectWordTone returns the realised tone, not the mark", () => {
  assert.equal(_detectWordTone("มา"), 0, "low class, live, no mark → mid");
  assert.equal(_detectWordTone("ข่า"), 1, "high + mai ek → low");
  assert.equal(_detectWordTone("ม้า"), 3, "low + mai tho → high (NOT falling)");
  assert.equal(_detectWordTone("จ๋า"), 4, "mid + mai jattawa → rising");
});

test("_detectWordTone fixes the unmarked non-mid words the old scan missed", () => {
  assert.equal(_detectWordTone("หมา"), 4, "ห-leader → high class, live → rising");
  assert.equal(_detectWordTone("สิบ"), 1, "high class, dead → low");
  assert.equal(_detectWordTone("นก"), 3, "low class, dead short → high");
});

test("_detectWordTone falls back to 0 for words it can't grade", () => {
  assert.equal(_detectWordTone("สวัสดี"), 0, "multi-syllable → ungradable");
  assert.equal(_detectWordTone("hello"), 0);
  assert.equal(_detectWordTone(""), 0);
});

// ── _toneRuleLine: the reveal's rule explanation ────────────────────────────
// Spells out WHY a word has the tone it has — cls + mark → REALISED tone —
// so a learner reading the written mark (e.g. ้ mai tho on a low-class
// consonant) isn't contradicted by a bare "โท" choice label that names the
// mark, not the tone (โท the mark produces ตรี the tone on low class).

test("_toneRuleLine states class + mark → the realised tone", () => {
  assert.equal(_toneRuleLine("ม้า"), "low class + ้ mai tho → HIGH tone");
  assert.equal(_toneRuleLine("ข่า"), "high class + ่ mai ek → LOW tone");
  assert.equal(_toneRuleLine("มา"), "low class + no mark → MID tone");
});

test("_toneRuleLine is blank for words the engine can't grade", () => {
  assert.equal(_toneRuleLine("ครับ"), "");
  assert.equal(_toneRuleLine(""), "");
});

// ── _toneDrillPool: filter + cap over WORDS ─────────────────────────────────
// Skips words longer than 5 UTF-16 units and caps the session at 100. shuffle
// lives in the DOM-heavy app.js, so stub it deterministically.

test("_toneDrillPool caps at 100, drops long words, keeps only gradable ones", () => {
  globalThis.shuffle = arr => arr; // identity: deterministic, order-independent asserts
  const pool = _toneDrillPool();
  assert.ok(pool.length <= 100, "capped at 100");
  assert.ok(pool.length > 0, "the corpus yields a real pool");
  assert.ok(pool.every(w => w[0].length <= 5), "no word over 5 chars");
  const wordSet = new Set(WORDS);
  assert.ok(pool.every(w => wordSet.has(w)), "every entry comes straight from WORDS");
  // every pooled word has a gradable answer key (single readable syllable)
  assert.ok(pool.every(w => toneOfWord(w[0])), "only gradable words are pooled");
});
