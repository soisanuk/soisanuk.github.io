// Tests for Thai character classification and decomposition logic from index.html
// Run with: node --test tests/js/test_thai_char.js

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── inline the character logic (mirrors index.html) ───────────────────────────

function thaiCharKind(cp) {
  if (cp >= 0x0E01 && cp <= 0x0E2E) return "cons";
  if (cp === 0x0E40 || cp === 0x0E41 || cp === 0x0E42 || cp === 0x0E43 || cp === 0x0E44) return "vowel";
  if (cp >= 0x0E30 && cp <= 0x0E3A) return "vowel";
  if (cp >= 0x0E47 && cp <= 0x0E4B) return "tone";
  if (cp >= 0x0E4C && cp <= 0x0E4E) return "diac";
  return "other";
}

function buildDecomposition(word) {
  const chars = [...word];
  const clusters = [];
  let i = 0;
  while (i < chars.length) {
    const cp = chars[i].codePointAt(0);
    const kind = thaiCharKind(cp);
    if (kind === "vowel" && (cp >= 0x0E40 && cp <= 0x0E44)) {
      const cluster = [chars[i]];
      i++;
      if (i < chars.length && thaiCharKind(chars[i].codePointAt(0)) === "cons") {
        cluster.push(chars[i]); i++;
      }
      while (i < chars.length) {
        const k2 = thaiCharKind(chars[i].codePointAt(0));
        if (k2 === "vowel" || k2 === "tone" || k2 === "diac") { cluster.push(chars[i]); i++; }
        else break;
      }
      clusters.push(cluster);
    } else if (kind === "cons") {
      const cluster = [chars[i]]; i++;
      while (i < chars.length) {
        const k2 = thaiCharKind(chars[i].codePointAt(0));
        if (k2 === "vowel" || k2 === "tone" || k2 === "diac") { cluster.push(chars[i]); i++; }
        else break;
      }
      clusters.push(cluster);
    } else {
      clusters.push([chars[i]]); i++;
    }
  }
  return clusters;
}

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
