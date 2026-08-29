// Tests for the gloss layer in web/js/gloss.js (+ the generated gloss-th.js).
// Evaluated via node:vm as classic browser scripts. data.js first, because
// thaiGloss prefers the curriculum's own gloss via WORD_MAP.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "gloss.js", "gloss-th.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
const { thaiGloss, _glossInit, _glossReady } = globalThis;
globalThis.WORD_MAP = Object.fromEntries(WORDS.map(w => [w[0], w]));

describe("thaiGloss before the dictionary loads", () => {
  test("returns null rather than throwing", () => {
    assert.equal(_glossReady(), false);
    assert.equal(thaiGloss("จับกุม"), null);
  });
  test("curriculum words work without the dictionary at all", () => {
    // WORD_MAP is consulted first, so the course never depends on the download
    assert.equal(thaiGloss("ตำรวจ"), WORD_MAP["ตำรวจ"][2]);
  });
});

describe("the generated dictionary", () => {
  test("loads", () => {
    assert.ok(_glossInit(THAI_GLOSS) > 5000);
    assert.equal(_glossReady(), true);
  });

  test("every row is word + TAB + gloss, with no empty halves", () => {
    // guards the generator's escaping: a stray backslash once merged two rows
    for (const line of THAI_GLOSS.split("\n")) {
      const parts = line.split("\t");
      assert.equal(parts.length, 2, `malformed row: ${JSON.stringify(line)}`);
      assert.ok(parts[0].length > 0 && parts[1].length > 0, `empty half: ${JSON.stringify(line)}`);
    }
  });

  test("no gloss exceeds the card's one-line budget", () => {
    for (const line of THAI_GLOSS.split("\n")) {
      const g = line.split("\t")[1];
      assert.ok(g.length <= 58, `${g.length} chars: ${g}`);
    }
  });

  test("glosses are English, not Thai (the wrong-corpus trap)", () => {
    // PyThaiNLP's thai_dict is extracted from THAI wiktionary and defines Thai
    // in Thai — useless here. If a future rebuild picks the wrong source this
    // fails loudly rather than shipping Thai definitions.
    const thai = /[฀-๿]/;
    const sample = THAI_GLOSS.split("\n").slice(0, 400).map(l => l.split("\t")[1]);
    const thaiish = sample.filter(g => thai.test(g)).length;
    assert.ok(thaiish / sample.length < 0.1, `${thaiish}/${sample.length} glosses contain Thai script`);
  });

  test("known words resolve to sensible English", () => {
    assert.equal(thaiGloss("จับกุม"), "to arrest");
    assert.equal(thaiGloss("มาตรการ"), "measure");
    assert.equal(thaiGloss("เศรษฐกิจ"), "economy");
  });

  test("the curriculum still wins over the dictionary", () => {
    // ตำรวจ is in both; the course's own wording is the one learners see
    assert.equal(thaiGloss("ตำรวจ"), WORD_MAP["ตำรวจ"][2]);
  });

  test("an unknown word is null, not a guess", () => {
    assert.equal(thaiGloss("ไม่มีคำนี้จริงๆนะ"), null);
  });
});
