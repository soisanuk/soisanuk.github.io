// Tests for the Restaurant's ordering beat (web/js/restaurant.js). The file is
// DOM-free at load, so node:vm evaluates it exactly as it ships; the rendering
// functions are not called here. See docs/restaurant-scenario.md.
// Run with: node --test tests/js/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js", "restaurant.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
globalThis.WORD_MAP = Object.fromEntries(WORDS.map(w => [w[0], w]));
const unresolved = th => _tokenise(th).filter(t => !t.word && /[ก-๎]/.test(t.text)).map(t => t.text);

describe("the restaurant stores no Thai the course cannot gloss", () => {
  // Design decision 1 in restaurant.js: romanisations are read from WORD_MAP
  // at render time, never stored. That only works if every chip is an entry.
  test("every chip on every slot is a WORDS entry", () => {
    const missing = [];
    for (const s of _RST_SLOTS) for (const it of s.list) if (!WORD_MAP[it.th]) missing.push(it.th);
    assert.deepEqual(missing, [], "chips the course does not teach");
  });

  test("no chip carries a romanisation of its own", () => {
    // Guards the design decision itself. A `rom` key appearing here is the
    // first step back towards Soi Buakhao's 499 unguarded syllables.
    for (const s of _RST_SLOTS) for (const it of s.list)
      for (const k of Object.keys(it))
        assert.ok(["th", "en", "e", "n", "cls"].includes(k), `${it.th} has a "${k}" key — romanisation belongs in data.js`);
  });

  test("the waitress's lines resolve, for every word she could quote back", () => {
    assert.deepEqual(unresolved("รับอะไรดีคะ"), []);
    assert.deepEqual(unresolved(_rstWaiterLine([])), []);
    for (const s of _RST_SLOTS) for (const it of s.list) {
      const line = _rstWaiterLine([{ slot: s.key, want: it, got: it }]);
      assert.deepEqual(unresolved(line), [], `"${line}" has an untaught word`);
      assert.ok(line.endsWith(it.th), `the quoted word should end the line: ${line}`);
    }
  });
});

describe("composition", () => {
  test("every one of the 270 possible orders tokenises with no untaught word", () => {
    let n = 0; const bad = [];
    for (const p of _RST_PROTEINS) for (const m of _RST_METHODS) for (const q of _RST_QTY) for (const h of _RST_HEAT) {
      n++;
      const th = _rstCompose({ p, m, q, h, pt: _RST_PARTICLES[n % 2] });
      const un = unresolved(th);
      if (un.length) bad.push(`${th}: ${un.join(",")}`);
    }
    assert.equal(n, 270);
    assert.deepEqual(bad, []);
  });

  test("the seven real compounds stay whole when tapped, the rest split cleanly", () => {
    // ไก่ย่าง is an entry and should be one tappable token; กุ้งนึ่ง is not an
    // entry and should split into two taught words. Both are correct Thai.
    const toks = th => _tokenise(th).map(t => t.text);
    assert.ok(toks(_rstCompose({ p: _RST_PROTEINS[1], m: _RST_METHODS[0], q: _RST_QTY[0], h: _RST_HEAT[0], pt: null })).includes("ไก่ย่าง"));
    const t = toks(_rstCompose({ p: _RST_PROTEINS[4], m: _RST_METHODS[4], q: _RST_QTY[0], h: _RST_HEAT[0], pt: null }));
    assert.ok(t.includes("กุ้ง") && t.includes("นึ่ง"));
  });

  test("the romanisation is assembled from data.js, word for word", () => {
    const o = { p: _RST_PROTEINS[1], m: _RST_METHODS[0], q: _RST_QTY[1], h: _RST_HEAT[0], pt: _RST_PARTICLES[0] };
    assert.equal(_rstRom(_rstCompose(o)), "khǒo kài-yâang sǒong jaan mâi-phèt khráp");
  });
});

describe("the kitchen is literal", () => {
  const T = { p: _RST_PROTEINS[1], m: _RST_METHODS[0], q: _RST_QTY[0], h: _RST_HEAT[0], pt: _RST_PARTICLES[0] }; // 1 grilled chicken, not spicy

  test("an exact order has no diff and gets ถูกต้องค่ะ", () => {
    assert.deepEqual(_rstDiff(T, { ...T }), []);
    assert.equal(_rstWaiterLine([]), "ถูกต้องค่ะ");
  });

  test("the plate describes what was SAID, not what was wanted", () => {
    // The mechanic. Say ทอด for ย่าง and fried chicken arrives.
    const said = { ...T, m: _RST_METHODS[1] };
    assert.match(_rstPlate(said).en, /fried chicken/);
    assert.doesNotMatch(_rstPlate(said).en, /grilled/);
  });

  test("the waitress quotes the first wrong word, in spoken order", () => {
    const said = { ...T, m: _RST_METHODS[1], h: _RST_HEAT[2] };   // ทอด and เผ็ดมาก both wrong
    const diff = _rstDiff(T, said);
    assert.deepEqual(diff.map(d => d.slot), ["m", "h"]);
    assert.equal(_rstWaiterLine(diff), "แต่คุณบอกว่าทอด");
  });

  test("quantity and heat each count as a miss on their own", () => {
    assert.equal(_rstDiff(T, { ...T, q: _RST_QTY[2] })[0].slot, "q");
    assert.equal(_rstDiff(T, { ...T, h: _RST_HEAT[1] })[0].slot, "h");
  });
});

describe("a sitting is reproducible", () => {
  test("_rstTarget with an injected rng is deterministic", () => {
    let i = 0; const seq = [0.1, 0.5, 0.9, 0.3];
    const rand = () => seq[i++ % seq.length];
    const a = _rstTarget(rand); i = 0; const b = _rstTarget(rand);
    assert.deepEqual(a, b);
    // 0.1 * 15 dishes → index 1 = หมูทอด; 0.5 ≥ 0.34 so quantity is stated: 0.9 * 3 → สาม
    assert.equal(a.p.th + a.m.th, "หมูทอด");
    assert.equal(a.q.th, _RST_QTY[2].th);
    assert.equal(a.h, null, "fried pork takes no spice");
  });
});
