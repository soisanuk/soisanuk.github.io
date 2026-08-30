// Tests for the graded reader (web/js/reader.js) and the tone-colouring helper
// (web/js/curriculum.js). The real sources are evaluated via node:vm as classic
// browser scripts. reader.js needs the ladder from curriculum.js and taughtGlyphs;
// toneColorHtml needs the tokeniser and the tone engine, and (via _tcEsc)
// wordcard.js's _wcEsc — the single HTML-escaping implementation.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "thai-script.js", "tokeniser.js", "wordcard.js", "curriculum.js", "reader.js", "gloss.js", "gloss-th.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
// functions are hoisted onto globalThis; READER_LEVELS is a top-level const, so
// it lives in the realm's lexical scope and must be referenced bare (see CLAUDE.md).
const { readerGrade, readerFeed, toneColorHtml, toneOfWord, _readerThaiHtml,
        thaiRoman, _glossInit, _glossReady } = globalThis;
_glossInit(THAI_GLOSS);   // the gloss layer is what tells toneOfWord a short token is polysyllabic

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
  test("฿ (baht sign) is ignored — currency, not a letter", () => {
    // U+0E3F falls inside the mark codepoint range but isn't a taught glyph;
    // without the exclusion a price like "20฿" would grade past the ladder
    assert.equal(readerGrade("฿"), 0);
    assert.equal(readerGrade("มา฿"), 0);
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
  test("the real corpus is memoized: repeated calls return the same content, not stale/shared mutable state", () => {
    // readerFeed(max) with no `examples` override grades+caches the full
    // EXAMPLES corpus once; two independent calls must agree, and mutating
    // one call's result must not corrupt the memo (each call gets its own
    // array from .filter, but the underlying entry OBJECTS are shared —
    // that's fine as long as nothing mutates them, which nothing does).
    const a = readerFeed(8), b = readerFeed(8);
    assert.deepEqual(a, b);
    assert.notEqual(a, b, "each call returns its own array (filter), not the same reference");
  });
  test("an explicit `examples` override bypasses the memo (doesn't cache test data)", () => {
    const custom = { x: ["ก", "k", "test"] };
    const before = readerFeed(8).length; // warms/uses the real-corpus memo
    const f = readerFeed(8, custom);
    assert.deepEqual(f.map(s => s.th), ["ก"]);
    assert.equal(readerFeed(8).length, before, "the real corpus memo is untouched by the override call");
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

  // Found by the 2026-08-30 fluent-Thai-reader persona round. The old guard
  // only declined tokens LONGER than 3 characters, but a three-character Thai
  // string is very often two syllables — 35 short non-curriculum words were
  // painted a single tone colour that contradicted even their own first
  // syllable, right beside a correct two-syllable romanisation on the card.
  test("declines a short token whose derived romanisation is polysyllabic", () => {
    if (typeof thaiRoman !== "function" || !_glossReady()) return; // gloss layer absent
    for (const w of ["คณะ", "ขยะ", "คดี", "ชรา"]) {
      assert.ok(/[- ]/.test(thaiRoman(w) || ""), `${w} should have a polysyllabic romanisation`);
      assert.equal(toneOfWord(w), null, `${w} is two syllables — must not be painted one colour`);
    }
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
  test("an optional decorator receives (escapedText, tone, token) and fully controls rendering", () => {
    const calls = [];
    const html = toneColorHtml("ผมกิน", (escaped, tone, tok) => {
      calls.push({ escaped, tone, hasWord: !!tok.word });
      return `[${escaped}]`;
    });
    assert.equal(html, "[ผม][กิน]", "decorator output replaces the default span rendering entirely");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].tone, "rising", "the decorator still receives the computed tone");
    assert.ok(calls.every(c => c.hasWord), "known WORDS tokens carry tok.word");
  });
  test("_readerThaiHtml (reader.js) is built on toneColorHtml's decorator, not a separate implementation", () => {
    // unknown-to-WORDS tokens render plain, with no w-token wrapper — even
    // with colours on — exercising the exact branch _readerThaiHtml's
    // decorator adds on top of the shared default
    const html = _readerThaiHtml("ผมxyz", true);
    assert.match(html, /<span class="w-token"[^>]*data-w="ผม">ผม<\/span>/);
    assert.ok(html.endsWith("xyz"), "an unresolved run stays unwrapped plain text");
  });
});

// ── reading position ────────────────────────────────────────────────────────
// The reader was the app's largest countable collection — 940 sentences — and
// the only one with no memory: leaving and returning restarted at 1/940, and
// with only ‹ / Next › controls, resuming at 251 meant 250 clicks.
// Found by the 2026-08-30 completionist round.
describe("_readerResumeAt", () => {
  const feed = [{ th: "ก" }, { th: "ข" }, { th: "ค" }, { th: "ง" }];

  test("re-anchors on the sentence text, not the index", () => {
    // readerFeed is computed live from EXAMPLES, so adding one example shifts
    // every index after it. The text is the stable anchor. (Editing a single
    // example moved two level counts on the day this was written.)
    assert.equal(_readerResumeAt({ at: 999, th: "ค" }, feed), 2);
  });

  test("falls back to the stored index when the sentence has left the corpus", () => {
    assert.equal(_readerResumeAt({ at: 1, th: "หายไปแล้ว" }, feed), 1);
  });

  test("clamps an index past the end", () => {
    assert.equal(_readerResumeAt({ at: 99999, th: null }, feed), feed.length - 1);
  });

  test("a cleared level starts over rather than parking on its last sentence", () => {
    // its card reads "✓ read all N", so tapping it means "again"
    assert.equal(_readerResumeAt({ at: 3, th: "ง", done: true }, feed), 0);
  });

  test("no saved position, an empty feed, or junk all start at 0", () => {
    assert.equal(_readerResumeAt(null, feed), 0);
    assert.equal(_readerResumeAt({ at: 2, th: "ค" }, []), 0);
    assert.equal(_readerResumeAt({ at: "banana", th: null }, feed), 0);
    assert.equal(_readerResumeAt({ at: -5, th: null }, feed), 0);
  });
});
