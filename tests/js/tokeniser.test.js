// Tests for the Thai sentence tokeniser in web/js/tokeniser.js.
// The real source file is evaluated via node:vm (it's a classic browser
// script, not a module), so these tests exercise exactly the code that ships.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Evaluate in this realm so returned objects share our prototypes
vm.runInThisContext(
  readFileSync(new URL("../../web/js/tokeniser.js", import.meta.url), "utf8"),
  { filename: "tokeniser.js" }
);
const { makeTokeniser } = globalThis;

describe("tokeniser", () => {
  test("matches a single known word", () => {
    const tokenise = makeTokeniser({ "ไป": ["ไป", "pai", "go"] });
    const result = tokenise("ไป");
    assert.equal(result.length, 1);
    assert.equal(result[0].text, "ไป");
    assert.deepEqual(result[0].word, ["ไป", "pai", "go"]);
  });

  test("matches two adjacent known words", () => {
    const tokenise = makeTokeniser({
      "ไป": ["ไป", "pai", "go"],
      "มา": ["มา", "maa", "come"],
    });
    const result = tokenise("ไปมา");
    assert.equal(result.length, 2);
    assert.equal(result[0].text, "ไป");
    assert.equal(result[1].text, "มา");
  });

  test("unknown characters produce null-word tokens", () => {
    const tokenise = makeTokeniser({});
    const result = tokenise("abc");
    assert.equal(result.length, 1);
    assert.equal(result[0].word, null);
  });

  test("consecutive unknown chars are merged into one token", () => {
    const tokenise = makeTokeniser({});
    const result = tokenise("xyz");
    assert.equal(result.length, 1);
    assert.equal(result[0].text, "xyz");
  });

  test("unknown chars between known words are separate tokens", () => {
    const tokenise = makeTokeniser({
      "ไป": ["ไป", "pai", "go"],
      "มา": ["มา", "maa", "come"],
    });
    const result = tokenise("ไป และ มา");
    // "ไป", " และ ", "มา"
    assert.equal(result[0].text, "ไป");
    assert.equal(result[1].word, null);
    assert.equal(result[2].text, "มา");
  });

  test("longer match wins over shorter prefix", () => {
    const tokenise = makeTokeniser({
      "ไป": ["ไป", "pai", "go"],
      "ไปมา": ["ไปมา", "pai maa", "go and come"],
    });
    const result = tokenise("ไปมา");
    assert.equal(result.length, 1);
    assert.equal(result[0].text, "ไปมา");
  });

  test("empty string returns empty array", () => {
    const tokenise = makeTokeniser({ "ไป": ["ไป", "pai", "go"] });
    assert.deepEqual(tokenise(""), []);
  });

  // ── cluster boundaries ────────────────────────────────────────────────
  // Greedy longest-match will happily start a token in the middle of a Thai
  // character cluster if that's where a key happens to align. The resulting
  // token is broken TEXT, not just a bad guess: "ี้" has no base consonant to
  // hang on and renders as a tofu box. These are the real shapes it hit.

  test("a match that would end before a dependent sign is rejected", () => {
    // บน ("on") aligns inside ใบนี้, and taking it would leave "ี้" stranded.
    const tokenise = makeTokeniser({ "บน": ["บน", "bon", "on"] });
    const result = tokenise("ใบนี้");
    assert.equal(result.length, 1, "no token may start mid-cluster");
    assert.equal(result[0].text, "ใบนี้");
    assert.equal(result[0].word, null);
  });

  test("a match that would strand a leading vowel is rejected", () => {
    // หมา ("dog") aligns inside เหมาะ; taking it would leave the เ behind.
    const tokenise = makeTokeniser({ "หมา": ["หมา", "mǎa", "dog"] });
    const result = tokenise("เหมาะ");
    assert.equal(result.length, 1);
    assert.equal(result[0].text, "เหมาะ");
    assert.equal(result[0].word, null);
  });

  test("a legal match adjacent to a cluster still wins", () => {
    // the guard must not block correct matches: นี้ ends the string cleanly.
    const tokenise = makeTokeniser({ "ใบ": ["ใบ", "bai", "leaf"], "นี้": ["นี้", "níi", "this"] });
    const result = tokenise("ใบนี้");
    assert.deepEqual(result.map(t => t.text), ["ใบ", "นี้"]);
  });

  test("an unknown run consumes whole clusters, never a lone mark", () => {
    const tokenise = makeTokeniser({ "หนัก": ["หนัก", "nàk", "heavy"] });
    const result = tokenise("ใบนี้หนัก");
    assert.deepEqual(result.map(t => t.text), ["ใบนี้", "หนัก"]);
    for (const t of result) {
      const cp = t.text.codePointAt(0);
      assert.ok(!((cp >= 0x0E30 && cp <= 0x0E3A) || (cp >= 0x0E47 && cp <= 0x0E4E)),
        `token ${JSON.stringify(t.text)} starts with a dependent sign`);
    }
  });

  test("mixed known and unknown in sequence", () => {
    const tokenise = makeTokeniser({ "ดี": ["ดี", "dii", "good"] });
    const result = tokenise("!ดี!");
    assert.equal(result.length, 3);
    assert.equal(result[0].word, null); // "!"
    assert.equal(result[1].text, "ดี");
    assert.equal(result[2].word, null); // "!"
  });
});

describe("_tokenise app wrapper", () => {
  test("lazily builds a tokeniser over the global WORD_MAP", () => {
    // In the app WORD_MAP is defined after tokeniser.js loads; the wrapper
    // must not touch it until first call. The script above was evaluated
    // without WORD_MAP, so defining it now proves the lazy lookup.
    globalThis.WORD_MAP = { "ไป": ["ไป", "pai", "go"] };
    const result = globalThis._tokenise("ไปx");
    assert.equal(result.length, 2);
    assert.equal(result[0].text, "ไป");
    assert.equal(result[1].word, null);
  });
});
