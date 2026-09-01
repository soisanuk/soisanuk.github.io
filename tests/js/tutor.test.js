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
  test("covers both layers of the Kedmanee board", () => {
    assert.equal(TUTOR_ALL.filter(e => !e.shift).length, 43, "unshifted");
    assert.equal(TUTOR_ALL.filter(e => e.shift).length, 38, "shifted");
  });

  // The pool shipped without บ ล ง ฝ — the [ ] ' / keys — so a learner who
  // finished "All Keys" still could not type บ้าน, เงิน or เล่น. Found by the
  // 2026-09-01 typist round, which noticed that pressing [ was silently
  // ignored. These four are the difference between a keyboard trainer and a
  // trainer for part of one.
  test("the common consonants on the outer keys are present", () => {
    for (const [key, thai] of [["[", "บ"], ["]", "ล"], ["'", "ง"], ["/", "ฝ"]]) {
      const e = TUTOR_ALL.find(x => x.key === key);
      assert.ok(e, `key ${key} missing from TUTOR_ALL`);
      assert.equal(e.thai, thai, `key ${key} should type ${thai}`);
    }
  });

  test("keys are unique WITHIN a layer", () => {
    // the same base key legitimately appears twice — h is ้ and Shift+h is ็ —
    // so identity is (key, shift), which is what _tKeyId encodes.
    const ids = TUTOR_ALL.map(e => (e.shift ? "S+" : "") + e.key);
    assert.equal(new Set(ids).size, ids.length);
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
  test("the full layout renders every key TUTOR_ALL defines", () => {
    const rendered = new Set(_T_ROWS_FULL.flat());
    for (const e of TUTOR_ALL) {
      assert.ok(rendered.has(e.key),
        `${e.thai} is on ${e.shift ? "Shift+" : ""}${e.key}, which no row renders`);
    }
  });

  // Every combining mark must survive _tDisp, or it renders as tofu on the
  // key face and in the prompt. The shifted layer is mostly marks.
  test("every combining mark gets a host consonant for display", () => {
    for (const e of TUTOR_ALL) {
      const disp = _tDisp(e.thai);
      const c = e.thai.charCodeAt(0);
      const combining = c === 0x0E31 || (c >= 0x0E33 && c <= 0x0E3A) || (c >= 0x0E47 && c <= 0x0E4E);
      assert.equal(disp.length, combining ? 2 : 1, `${e.thai} (${e.name}) displays as "${disp}"`);
    }
  });

  test("_tNormKey turns a browser key event back into (key, shift)", () => {
    assert.deepEqual(_tNormKey("C"), { key: "c", shift: true });
    assert.deepEqual(_tNormKey("c"), { key: "c", shift: false });
    assert.deepEqual(_tNormKey("^"), { key: "6", shift: true });
    assert.deepEqual(_tNormKey(":"), { key: ";", shift: true });
    assert.equal(_tNormKey("Shift"), null, "modifiers alone are not characters");
    assert.equal(_tNormKey("Enter"), null);
  });

  // The four glyphs this layer exists for. เป็น and อยู่ are the two commonest
  // verbs in Thai and both were untypable.
  test("the glyphs the course was blocked on are reachable", () => {
    for (const [key, thai] of [["6", "ู"], ["h", "็"], [";", "ซ"], ["p", "ญ"]]) {
      const e = _tEntry(key, true);
      assert.ok(e, `Shift+${key} maps to nothing`);
      assert.equal(e.thai, thai, `Shift+${key} should type ${thai}`);
    }
  });

  test("the three-row layout is a strict subset of the full one", () => {
    const full = new Set(_T_ROWS_FULL.flat());
    for (const k of _T_ROWS.flat()) assert.ok(full.has(k), `${k} not in the full layout`);
    assert.ok(_T_ROWS.flat().length < _T_ROWS_FULL.flat().length);
  });

  // The course asks the learner to TYPE a word on a keyboard it renders
  // itself — without the number row. It must therefore only ever choose
  // words that keyboard can spell; 38% of its candidates could not be typed.
  test("_tTypeable reports what a given layout can actually spell", () => {
    const three = _tTypeable(_T_ROWS);
    const four = _tTypeable(_T_ROWS_FULL);
    assert.ok(three.has("ก") && three.has("ง"), "three rows spell the letter keys");
    assert.ok(!three.has("ค"), "ค is on the number row, which three rows omit");
    assert.ok(four.has("ค") && four.has("ต") && four.has("ุ"), "four rows reach the number row");
    for (const c of three) assert.ok(four.has(c), `${c} lost when the number row was added`);
  });

  // 12/11/10 IS the physical letter block — q..p plus [ ], a..; plus ', z../.
  // This asserted [10, 10, 9] and called it "the physical qwerty layout": it
  // was pinning the subset that had been implemented, under a name that
  // claimed more. A test may not describe the keyboard it wishes existed.
  test("rows follow the physical qwerty layout widths", () => {
    assert.deepEqual(_T_ROWS.map(r => r.length), [12, 11, 10]);
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

// ── Adaptivity ──────────────────────────────────────────────────────────────
// The tutor drew uniformly at random: a key missed eight times in a row came
// back 4 times in the next 45 draws, indistinguishable from chance. For a
// persona whose whole goal is getting better at typing, "practise what you
// keep getting wrong" is the feature, so the weighting is pinned here rather
// than left to be eyeballed.

describe("_tWeight", () => {
  test("a key never practised outranks one answered correctly", () => {
    assert.ok(_tWeight({ seen: 0, wrong: 0 }) > _tWeight({ seen: 10, wrong: 0 }));
  });

  test("weight rises with the miss rate", () => {
    const perfect = _tWeight({ seen: 10, wrong: 0 });
    const half = _tWeight({ seen: 10, wrong: 5 });
    const awful = _tWeight({ seen: 10, wrong: 10 });
    assert.ok(perfect < half && half < awful, `${perfect} < ${half} < ${awful}`);
    assert.equal(perfect, 1, "a key you never miss carries the base weight");
  });

  test("a missed key is worth several correct ones", () => {
    assert.ok(_tWeight({ seen: 4, wrong: 4 }) >= 6 * _tWeight({ seen: 4, wrong: 0 }));
  });
});

describe("_tPick", () => {
  const pool = [{ key: "a" }, { key: "b" }, { key: "c" }];
  // deterministic stand-in for Math.random
  const seq = xs => { let i = 0; return () => xs[i++ % xs.length]; };

  test("never repeats the previous key while alternatives exist", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      assert.notEqual(_tPick(pool, { keys: {} }, pool[0], () => r).key, "a");
    }
  });

  test("a single-key pool still returns that key", () => {
    const one = [{ key: "z" }];
    assert.equal(_tPick(one, { keys: {} }, one[0], () => 0.5).key, "z");
  });

  test("the weighting actually biases the draw toward missed keys", () => {
    // b is missed every time; a and c are always right
    const store = { keys: { a: { seen: 20, wrong: 0 }, b: { seen: 20, wrong: 20 }, c: { seen: 20, wrong: 0 } } };
    let bs = 0;
    const N = 900;
    // sweep the whole [0,1) range so this samples the distribution exactly
    for (let i = 0; i < N; i++) {
      const r = (i + 0.5) / N;
      if (_tPick(pool, store, null, () => r).key === "b") bs++;
    }
    const share = bs / N;
    // weights: a=1, b=7, c=1 → b should take 7/9 of the draws
    assert.ok(share > 0.7 && share < 0.85, `b took ${(share * 100).toFixed(0)}% of draws, expected ~78%`);
  });

  test("an empty pool yields null rather than throwing", () => {
    assert.equal(_tPick([], { keys: {} }, null, () => 0.5), null);
  });
});
