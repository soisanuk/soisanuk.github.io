// Tests for the Thai keyboard tutor data and pure helpers in web/js/tutor.js.
// The file is DOM-free at load time (DOM access only inside functions), so it
// can be evaluated via node:vm like the other sources.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

vm.runInThisContext(
  readFileSync(new URL("../../web/js/tutor.js", import.meta.url), "utf8"),
  { filename: "tutor.js" }
);
// Note: const/let from vm scripts live in the global lexical scope, not on
// globalThis — reference them as bare identifiers, don't destructure.

// ── TUTOR_ALL data integrity ──────────────────────────────────────────────────

describe("TUTOR_ALL", () => {
  test("covers all 29 tutor keys", () => {
    assert.equal(TUTOR_ALL.length, 29);
  });

  test("keys are unique", () => {
    const keys = TUTOR_ALL.map(e => e.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  test("thai characters are unique", () => {
    const chars = TUTOR_ALL.map(e => e.thai);
    assert.equal(new Set(chars).size, chars.length);
  });

  test("every entry has key, thai, name, and a valid category", () => {
    const cats = new Set(["consonant", "vowel", "tone", "other"]);
    for (const e of TUTOR_ALL) {
      assert.ok(e.key.length >= 1, `key missing for ${e.thai}`);
      assert.equal(e.thai.length, 1, `thai must be a single char: ${e.thai}`);
      assert.ok(e.name.length > 0, `name missing for ${e.thai}`);
      assert.ok(cats.has(e.cat), `bad category "${e.cat}" for ${e.thai}`);
    }
  });

  test("consonants mode has a non-trivial pool", () => {
    assert.ok(TUTOR_ALL.filter(e => e.cat === "consonant").length >= 10);
  });
});

// ── keyboard layout rows ──────────────────────────────────────────────────────

describe("_T_ROWS", () => {
  test("rows contain exactly the TUTOR_ALL keys", () => {
    const rowKeys = _T_ROWS.flat().sort();
    const allKeys = TUTOR_ALL.map(e => e.key).sort();
    assert.deepEqual(rowKeys, allKeys);
  });

  test("rows follow the physical qwerty layout widths", () => {
    assert.deepEqual(_T_ROWS.map(r => r.length), [10, 10, 9]);
  });
});

// ── _tDisp ────────────────────────────────────────────────────────────────────

describe("_tDisp", () => {
  test("combining marks get a ko kai host consonant", () => {
    assert.equal(_tDisp("ั"), "กั"); // mai han akat
    assert.equal(_tDisp("่"), "ก่"); // mai ek
    assert.equal(_tDisp("้"), "ก้"); // mai tho
    assert.equal(_tDisp("ี"), "กี"); // sara ii
  });

  test("standalone characters are unchanged", () => {
    assert.equal(_tDisp("ก"), "ก");
    assert.equal(_tDisp("เ"), "เ"); // leading vowel, renders on its own
    assert.equal(_tDisp("ๆ"), "ๆ"); // mai yamok
    assert.equal(_tDisp("ไ"), "ไ");
  });
});
