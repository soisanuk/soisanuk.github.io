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
  test("initial consonant clusters stay out of scope (no cluster support)", () => {
    // ค+ว+า+ย (ควาย) and ก+ล+ั+ว (กลัว): ว/ล is a genuine cluster member
    // here, not a vowel-carrier — the ◌ือ/reduced-◌ัว branches don't touch
    // these because a real vowel mark (า, ั) still follows.
    assert.equal(syllableTone("ควาย"), null);
    assert.equal(syllableTone("กลัว"), null);
    assert.equal(syllableTone("ครับ"), null);
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
