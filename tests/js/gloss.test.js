// Tests for the gloss layer in web/js/gloss.js (+ the generated gloss-th.js).
// Evaluated via node:vm as classic browser scripts. data.js first, because
// thaiGloss prefers the curriculum's own gloss via WORD_MAP.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "thai-script.js", "gloss.js", "gloss-th.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
const { thaiGloss, thaiRoman, _glossInit, _glossReady } = globalThis;
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

  test("every row is word + TAB + gloss + TAB + romanisation", () => {
    // guards the generator's escaping: a stray backslash once merged two rows
    for (const line of THAI_GLOSS.split("\n")) {
      const parts = line.split("\t");
      assert.equal(parts.length, 3, `malformed row: ${JSON.stringify(line)}`);
      assert.ok(parts[0].length > 0, `empty word: ${JSON.stringify(line)}`);
      assert.ok(parts[1].length > 0, `empty gloss: ${JSON.stringify(line)}`);
      // parts[2] MAY be empty — a romanisation the tone check refused
    }
  });

  test("no gloss exceeds the card's one-line budget", () => {
    for (const line of THAI_GLOSS.split("\n")) {
      const g = line.split("\t")[1];
      assert.ok(g.length <= 58, `${g.length} chars: ${g}`);
    }
  });

  test("romanisations are converted to the course's style, not raw Paiboon", () => {
    // raw Paiboon writes ก as g, ป as bp, ต as dt, and keeps IPA vowel letters
    const bad = [];
    for (const line of THAI_GLOSS.split("\n")) {
      const r = line.split("\t")[2];
      if (!r) continue;
      if (/[ɛɔʉə]/.test(r)) bad.push(["unconverted IPA vowel", line]);
      if (/(^|[- ])(g|bp|dt)[aeiouāīū]/.test(r)) bad.push(["raw Paiboon onset", line]);
    }
    assert.deepEqual(bad.slice(0, 5), [], `${bad.length} bad romanisations`);
  });

  test("a derived romanisation never contradicts the tone engine", () => {
    // the generator drops conflicts; this pins that it actually ran. Checked
    // here for monosyllables only — syllableTone's contract.
    const MARK = { mid: "", low: "\u0300", falling: "\u0302", high: "\u0301", rising: "\u030c" };
    let checked = 0;
    for (const line of THAI_GLOSS.split("\n")) {
      const [w, , r] = line.split("\t");
      if (!r || /[- ]/.test(r)) continue;
      const tone = syllableTone(w);
      if (!tone) continue;
      checked++;
      const got = (r.normalize("NFD").match(/[\u0300\u0301\u0302\u0303\u030c]/) || [""])[0];
      assert.equal(got, MARK[tone], `${w} reads ${tone} but romanises as ${r}`);
    }
    assert.ok(checked > 200, `only ${checked} monosyllables checked`);
  });

  test("thaiRoman prefers the course's own romanisation", () => {
    assert.equal(thaiRoman("ตำรวจ"), WORD_MAP["ตำรวจ"][1]);
    assert.equal(thaiRoman("มาตรการ"), "mâat-trà-kaan");
    assert.equal(thaiRoman("ไม่มีคำนี้จริงๆนะ"), null);
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
