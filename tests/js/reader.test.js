// Tests for the graded reader (web/js/reader.js) and the tone-colouring helper
// (web/js/curriculum.js). The real sources are evaluated via node:vm as classic
// browser scripts. reader.js needs the ladder from curriculum.js and taughtGlyphs;
// toneColorHtml needs the tokeniser and the tone engine.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "thai-script.js", "tokeniser.js", "curriculum.js", "reader.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
// functions are hoisted onto globalThis; READER_LEVELS is a top-level const, so
// it lives in the realm's lexical scope and must be referenced bare (see CLAUDE.md).
const { readerGrade, readerFeed, toneColorHtml, toneOfWord } = globalThis;

// ── readerGrade ──────────────────────────────────────────────────────────────
describe("readerGrade", () => {
  test("a first-batch word grades at 0", () => {
    assert.equal(readerGrade("มา"), 0); // ม, า both in batch 0
  });
  test("a word needing a later batch grades higher", () => {
    // ไม่ needs ไ (batch 2) and the mai-ek mark (batch 1)
    assert.equal(readerGrade("ไม่"), 2);
    // ผ is introduced only in batch 6 (the spice rack)
    assert.equal(readerGrade("ผ"), 6);
  });
  test("grade is the max over glyphs, not the sum", () => {
    assert.equal(readerGrade("มาม"), 0);
  });
  test("spaces, latin and digits are ignored", () => {
    assert.equal(readerGrade("มา a 1 ๆ".replace("ๆ", "")), 0);
    assert.equal(readerGrade("ก b 9"), 0);
  });
});

// ── readerFeed ───────────────────────────────────────────────────────────────
describe("readerFeed", () => {
  const EX = {
    a: ["มา", "maa", "come"],           // grade 0
    b: ["ไม่", "mâi", "no"],            // grade 2
    c: ["ผัก", "phàk", "vegetable"],    // grade 6 (ผ)
    d: ["มา", "maa", "come (dup)"],      // duplicate Thai of a
  };
  test("only returns sentences at or below the level's batch, easiest first", () => {
    const f = readerFeed(2, EX);
    assert.deepEqual(f.map(s => s.th), ["มา", "ไม่"]);
    assert.ok(f.every(s => s.grade <= 2));
  });
  test("de-dupes identical Thai sentences", () => {
    const f = readerFeed(7, EX);
    assert.equal(f.filter(s => s.th === "มา").length, 1);
  });
  test("levels are nested: an easier level is a subset of a harder one", () => {
    const first = READER_LEVELS[0].max, last = READER_LEVELS[READER_LEVELS.length - 1].max;
    const easy = new Set(readerFeed(first).map(s => s.th));
    const hard = new Set(readerFeed(last).map(s => s.th));
    assert.ok(easy.size < hard.size);
    for (const th of easy) assert.ok(hard.has(th), th + " dropped out of the harder level");
  });
  test("the real corpus fills every level with something to read", () => {
    for (const lv of READER_LEVELS) assert.ok(readerFeed(lv.max).length > 0, lv.name + " is empty");
  });
});

// ── toneOfWord / toneColorHtml ───────────────────────────────────────────────
describe("tone colouring", () => {
  test("a monosyllabic word gets its tone", () => {
    assert.equal(toneOfWord("ผม"), "rising");
    assert.equal(toneOfWord("สอง"), "rising");
    assert.equal(toneOfWord("น้ำ"), "high");
  });
  test("a multi-syllable word (hyphen/space in the romanisation) is not coloured", () => {
    // อร่อย = à-ròi — two syllables; must not be painted one colour
    assert.equal(toneOfWord("อร่อย"), null);
  });
  test("toneColorHtml wraps only the coloured tokens", () => {
    const html = toneColorHtml("ผม");
    assert.match(html, /<span style="color:[^"]+">ผม<\/span>/);
    // a two-syllable word stays plain text, no span
    assert.equal(toneColorHtml("อร่อย"), "อร่อย");
  });
  test("html-escapes token text", () => {
    assert.ok(!toneColorHtml("มา").includes("<script"));
  });
});
