// Tests for the Thai sentence tokeniser logic from index.html
// Run with: node --test tests/js/test_tokeniser.js

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── inline the tokeniser (mirrors _tokenise in index.html) ───────────────────

function makeTokeniser(wordMap) {
  const keys = Object.keys(wordMap).sort((a, b) => b.length - a.length);
  return function tokenise(sentence) {
    const tokens = [];
    let i = 0;
    while (i < sentence.length) {
      let matched = false;
      for (const key of keys) {
        if (sentence.startsWith(key, i)) {
          tokens.push({ text: key, word: wordMap[key] });
          i += key.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (tokens.length && !tokens[tokens.length - 1].word) {
          tokens[tokens.length - 1].text += sentence[i];
        } else {
          tokens.push({ text: sentence[i], word: null });
        }
        i++;
      }
    }
    return tokens;
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

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

  test("mixed known and unknown in sequence", () => {
    const tokenise = makeTokeniser({ "ดี": ["ดี", "dii", "good"] });
    const result = tokenise("!ดี!");
    assert.equal(result.length, 3);
    assert.equal(result[0].word, null); // "!"
    assert.equal(result[1].text, "ดี");
    assert.equal(result[2].word, null); // "!"
  });
});
