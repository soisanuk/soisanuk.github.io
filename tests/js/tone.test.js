// Tests for the Thai tone engine in web/js/thai-script.js:
// toneFromParts() (the pure rule table) and syllableTone() (the parser).
// The real source is evaluated via node:vm (classic browser script), with
// data.js first for CONSONANTS / TONE_CLASSES.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "thai-script.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
const { toneFromParts, syllableTone, syllableToneInfo } = globalThis;

// ── toneFromParts: the pure rule table ──────────────────────────────────────
describe("toneFromParts", () => {
  test("live, unmarked: mid→mid, high→rising, low→mid", () => {
    assert.equal(toneFromParts("mid", { live: true }), "mid");
    assert.equal(toneFromParts("high", { live: true }), "rising");
    assert.equal(toneFromParts("low", { live: true }), "mid");
  });

  test("dead, unmarked: mid→low, high→low", () => {
    assert.equal(toneFromParts("mid", { live: false }), "low");
    assert.equal(toneFromParts("high", { live: false }), "low");
  });

  test("dead, unmarked, low class splits on vowel length", () => {
    assert.equal(toneFromParts("low", { live: false, shortVowel: true }), "high");
    assert.equal(toneFromParts("low", { live: false, shortVowel: false }), "falling");
  });

  test("mai ek: low→falling, mid/high→low", () => {
    assert.equal(toneFromParts("low", { mark: "ek" }), "falling");
    assert.equal(toneFromParts("mid", { mark: "ek" }), "low");
    assert.equal(toneFromParts("high", { mark: "ek" }), "low");
  });

  test("mai tho: low→high, mid/high→falling", () => {
    assert.equal(toneFromParts("low", { mark: "tho" }), "high");
    assert.equal(toneFromParts("mid", { mark: "tho" }), "falling");
    assert.equal(toneFromParts("high", { mark: "tho" }), "falling");
  });

  test("mai tri → high, mai chattawa → rising", () => {
    assert.equal(toneFromParts("mid", { mark: "tri" }), "high");
    assert.equal(toneFromParts("mid", { mark: "chattawa" }), "rising");
  });

  test("a tone mark overrides liveness", () => {
    assert.equal(toneFromParts("mid", { mark: "tho", live: true }), "falling");
    assert.equal(toneFromParts("mid", { mark: "tho", live: false }), "falling");
  });

  test("defaults to a live syllable with no mark", () => {
    assert.equal(toneFromParts("mid"), "mid");
    assert.equal(toneFromParts("high"), "rising");
  });
});

// ── syllableTone: parser validated against real words ───────────────────────
// Each entry's tone is the one encoded by the word's RTGS diacritic in data.js.
const KNOWN = [
  // mid class
  ["กา", "mid"], ["ข่า", "low"], ["ข้า", "falling"],
  ["เก่า", "low"], ["เก้า", "falling"], ["ใจ", "mid"], ["จบ", "low"],
  ["แปด", "low"], ["เจ็ด", "low"], ["เก็บ", "low"], ["ตัว", "mid"],
  ["ดาว", "mid"],
  // low class
  ["มา", "mid"], ["ม้า", "high"], ["นา", "mid"], ["น่า", "falling"],
  ["นี้", "high"], ["นั้น", "high"], ["ไม่", "falling"], ["ไม้", "high"],
  ["คน", "mid"], ["คุณ", "mid"], ["มาก", "falling"], ["มัก", "high"],
  ["น้ำ", "high"], ["ร้อย", "high"], ["ยาย", "mid"], ["เมีย", "mid"],
  ["เล็ก", "high"],
  // high class
  ["สาม", "rising"], ["สี่", "low"], ["สิบ", "low"], ["หก", "low"],
  ["ห้า", "falling"], ["สอง", "rising"], ["ผม", "rising"], ["ฉัน", "rising"],
  ["เขา", "rising"],
  // ห / อ leaders (silent, class-promoting)
  ["หมา", "rising"], ["หนึ่ง", "low"], ["หญิง", "rising"],
  // bare ◌ือ (long "ue", no final — as opposed to ◌ื + final, e.g. มืด)
  ["มือ", "mid"], ["คือ", "mid"], ["ชื่อ", "falling"], ["ซื้อ", "high"],
  ["หรือ", "rising"], // ห leader promotes ร (low) to high before the ◌ือ
  // เ◌ิ is the LONG "oe" vowel (it's only ever written with a final; the short
  // counterpart is เ◌อะ). Length only changes the tone on a low-class DEAD
  // syllable, so เลิก is the one word in the corpus that exposes it — the
  // mid-class เกิด/เปิด come out "low" either way.
  ["เลิก", "falling"], ["เดิน", "mid"], ["เกิด", "low"], ["เพิ่ม", "falling"],
  // reduced ◌ัว (the ั is dropped from the ua vowel before a final consonant)
  ["สวย", "rising"], ["ด้วย", "falling"], ["ช่วย", "falling"],
  ["ควร", "mid"], ["ขวด", "low"], ["รวย", "mid"],
];

describe("syllableTone: real words", () => {
  for (const [word, tone] of KNOWN) {
    test(`${word} → ${tone}`, () => {
      assert.equal(syllableTone(word), tone);
    });
  }
});

describe("syllableTone: declines what it can't read", () => {
  test("silent-letter (การันต์) syllables return null", () => {
    assert.equal(syllableTone("รักษ์"), null);
  });
  test("empty and non-Thai input return null", () => {
    assert.equal(syllableTone(""), null);
    assert.equal(syllableTone("cat"), null);
  });
});

// ── initial clusters (ควบกล้ำ) ──────────────────────────────────────────────
// The class comes from the FIRST consonant; the ร/ล/ว is stepped over. The
// interesting cases are the ones that only LOOK like clusters — see
// _isClusterPair in thai-script.js.
describe("syllableTone: initial consonant clusters", () => {
  const CLUSTERS = [
    // true clusters, across all three classes
    ["ครับ", "high"], ["ครู", "mid"], ["ควาย", "mid"], ["ครัว", "mid"],
    ["กลัว", "mid"], ["กล้วย", "falling"], ["กลับ", "low"], ["เกลือ", "mid"],
    ["ปลา", "mid"], ["ปลวก", "low"], ["เปล่า", "low"], ["แปลก", "low"],
    ["เคร่ง", "falling"], ["เพราะ", "high"], ["พระ", "high"], ["โปรด", "low"],
    ["ตรง", "mid"], ["ตรวจ", "low"], ["โกรธ", "low"],
    // /Cw/ clusters: the vowel sits before (แขวน) or after (กวาด, กว่า) the ว
    ["กวาด", "low"], ["กว่า", "low"], ["แขวน", "rising"],
    // "false" clusters (ควบไม่แท้): ร silent, ทร reads /s/ — tone is still
    // taken from the written first consonant, so they parse the same way.
    ["ทราบ", "falling"], ["สร้าง", "falling"], ["จริง", "mid"], ["ทรง", "mid"],
  ];
  for (const [word, tone] of CLUSTERS) {
    test(`${word} → ${tone}`, () => {
      assert.equal(syllableTone(word), tone);
    });
  }

  test("a trailing ร/ล/ว is a FINAL, not a cluster member", () => {
    // พร = /phɔɔn/ (low class, live final, inherent vowel) → mid. Reading the
    // ร as a cluster partner would leave a bare dead syllable → "high".
    assert.equal(syllableTone("พร"), "mid");
  });

  test("C+ว+final with no written vowel is the reduced ◌ัว, not a cluster", () => {
    // ควบ is the sharp one: as reduced ◌ัว it's a LONG vowel → low class dead
    // long → falling. Mis-read as a คว cluster it would take the inherent
    // short vowel and come out "high".
    assert.equal(syllableTone("ควบ"), "falling");
    assert.equal(syllableTone("ควร"), "mid");
    assert.equal(syllableTone("ขวด"), "low");
    assert.equal(syllableTone("สวย"), "rising");
  });

  test("syllableToneInfo names the cluster member", () => {
    assert.equal(syllableToneInfo("ครับ").cluster, "ร");
    assert.equal(syllableToneInfo("มา").cluster, null);
  });
});

describe("syllableToneInfo exposes the reasoning", () => {
  test("ข่า: high class, live, mai ek → low", () => {
    const info = syllableToneInfo("ข่า");
    assert.equal(info.cls, "high");
    assert.equal(info.mark, "ek");
    assert.equal(info.tone, "low");
  });
  test("returns null on an unreadable shape", () => {
    assert.equal(syllableToneInfo("รักษ์"), null);
  });
});

// ── TONE_ORDER / TONE_LABELS / TONE_COLORS: the single tone vocabulary ──────
// TONE_ORDER is the canonical order every enumeration (drill choices, chart
// legends) is built from; TONES (data.js) must stay in the same row order —
// _detectWordTone (sessions.js) finds a TONES row by its tone name and uses
// that row's INDEX, so if the two orderings ever drift, the Tone Drill starts
// grading against the wrong choice with no error.
describe("TONE_ORDER is the single source of tone order/labels/colours", () => {
  test("TONES (data.js) rows are in TONE_ORDER order", () => {
    assert.deepEqual(TONES.map(t => t[1]), TONE_ORDER);
  });
  test("TONE_LABELS and TONE_COLORS cover exactly the tones in TONE_ORDER", () => {
    assert.deepEqual(Object.keys(TONE_LABELS), TONE_ORDER);
    assert.deepEqual(Object.keys(TONE_COLORS), TONE_ORDER);
  });
});
