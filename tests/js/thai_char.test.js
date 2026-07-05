// Tests for Thai character classification and decomposition in
// web/js/thai-script.js. The real source file is evaluated via node:vm (it's
// a classic browser script, not a module), so these tests exercise exactly
// the code that ships.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Evaluate in this realm so returned objects share our prototypes.
// data.js provides CONSONANTS, which letterSpeech looks up at call time.
for (const f of ["data.js", "thai-script.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
const { _thaiCharKind: thaiCharKind, _buildDecomposition: buildDecomposition } = globalThis;

// ── thaiCharKind ─────────────────────────────────────────────────────────────

describe("thaiCharKind", () => {
  test("ก (0x0E01) is a consonant", () => {
    assert.equal(thaiCharKind(0x0E01), "cons");
  });

  test("ฮ (0x0E2E) is a consonant", () => {
    assert.equal(thaiCharKind(0x0E2E), "cons");
  });

  test("เ (0x0E40) is a leading vowel", () => {
    assert.equal(thaiCharKind(0x0E40), "vowel");
  });

  test("แ (0x0E41) is a leading vowel", () => {
    assert.equal(thaiCharKind(0x0E41), "vowel");
  });

  test("า (0x0E32) is a vowel", () => {
    assert.equal(thaiCharKind(0x0E32), "vowel");
  });

  test("่ (0x0E48 mai ek) is a tone mark", () => {
    assert.equal(thaiCharKind(0x0E48), "tone");
  });

  test("้ (0x0E49 mai tho) is a tone mark", () => {
    assert.equal(thaiCharKind(0x0E49), "tone");
  });

  test("๊ (0x0E4A mai tri) is a tone mark", () => {
    assert.equal(thaiCharKind(0x0E4A), "tone");
  });

  test("๋ (0x0E4B mai jattawa) is a tone mark", () => {
    assert.equal(thaiCharKind(0x0E4B), "tone");
  });

  test("์ (0x0E4C thanthakat) is a diacritic", () => {
    assert.equal(thaiCharKind(0x0E4C), "diac");
  });

  test("ASCII space is other", () => {
    assert.equal(thaiCharKind(0x0020), "other");
  });

  test("0x0E00 (reserved) is other", () => {
    assert.equal(thaiCharKind(0x0E00), "other");
  });
});

// ── buildDecomposition ────────────────────────────────────────────────────────

describe("buildDecomposition", () => {
  test("single consonant produces one cluster", () => {
    const clusters = buildDecomposition("ก");
    assert.equal(clusters.length, 1);
    assert.deepEqual(clusters[0], ["ก"]);
  });

  test("consonant + vowel are in same cluster", () => {
    // กา = ก + า
    const clusters = buildDecomposition("กา");
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0][0], "ก");
    assert.equal(clusters[0][1], "า");
  });

  test("leading vowel + consonant are in same cluster", () => {
    // เก = เ + ก
    const clusters = buildDecomposition("เก");
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0][0], "เ");
    assert.equal(clusters[0][1], "ก");
  });

  test("two consonant clusters", () => {
    // กม = ก + ม
    const clusters = buildDecomposition("กม");
    assert.equal(clusters.length, 2);
  });

  test("consonant + tone mark are in same cluster", () => {
    // ก่ = ก + ่
    const clusters = buildDecomposition("ก่");
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].length, 2);
    assert.equal(clusters[0][1], "่");
  });

  test("empty string produces empty clusters", () => {
    assert.deepEqual(buildDecomposition(""), []);
  });

  test("non-Thai character is its own cluster", () => {
    const clusters = buildDecomposition("A");
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0][0], "A");
  });
});

// ── letterSpeech ─────────────────────────────────────────────────────────────

describe("letterSpeech", () => {
  test("consonants get sound + traditional name", () => {
    assert.equal(letterSpeech("ก"), "ก, ก ไก่");
    assert.equal(letterSpeech("ข"), "ข, ข ไข่");
    assert.equal(letterSpeech("ม"), "ม, ม ม้า");
  });

  test("every consonant in the data gets an enhanced form", () => {
    for (const row of CONSONANTS) {
      const out = letterSpeech(row[0]);
      assert.equal(out, `${row[0]}, ${row[0]} ${row[3]}`);
    }
  });

  test("vowels are recited with the อ carrier", () => {
    assert.equal(letterSpeech("า"), "อา, สระอา");
    assert.equal(letterSpeech("ั"), "อะ, ไม้หันอากาศ");
    assert.equal(letterSpeech("ไ"), "ไอ, สระไอไม้มลาย");
  });

  test("◌ placeholder is stripped before lookup", () => {
    assert.equal(letterSpeech("◌า"), "อา, สระอา");
    assert.equal(letterSpeech("◌ี"), "อี, สระอี");
  });

  test("tone marks speak the name only", () => {
    assert.equal(letterSpeech("่"), "ไม้เอก");
    assert.equal(letterSpeech("้"), "ไม้โท");
  });

  test("compound vowel patterns get sound + name", () => {
    assert.equal(letterSpeech("เ◌าะ"), "เอาะ, สระเอาะ");
    assert.equal(letterSpeech("◌ัว"), "อัว, สระอัว");
    assert.equal(letterSpeech("เ◌ีย"), "เอีย, สระเอีย");
    assert.equal(letterSpeech("◌อ"), "ออ, สระออ");
  });

  test("every vowel in the data gets an enhanced spoken form", () => {
    for (const [sym] of VOWELS) {
      assert.notEqual(letterSpeech(sym), sym.replace(/◌/g, ""), `no spoken form for ${sym}`);
    }
  });

  test("words and unknown input pass through unchanged", () => {
    assert.equal(letterSpeech("สวัสดี"), "สวัสดี");
    assert.equal(letterSpeech("A"), "A");
  });
});

// ── vowelDisp ────────────────────────────────────────────────────────────────

describe("vowelDisp", () => {
  test("◌ placeholder becomes a ก host", () => {
    assert.equal(vowelDisp("◌ุ"), "กุ");
    assert.equal(vowelDisp("◌า"), "กา");
    assert.equal(vowelDisp("เ◌ะ"), "เกะ");
    assert.equal(vowelDisp("เ◌ีย"), "เกีย");
  });

  test("identity for text without the placeholder", () => {
    assert.equal(vowelDisp("ก"), "ก");
    assert.equal(vowelDisp("สวัสดี"), "สวัสดี");
    assert.equal(vowelDisp("เอก"), "เอก"); // tone drill names untouched
  });
});
