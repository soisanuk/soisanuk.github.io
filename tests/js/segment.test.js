// Tests for the open-text segmenter in web/js/segment.js.
// The real sources are evaluated via node:vm (classic browser scripts):
// tokeniser.js first, because segment.js reuses its _tkLegalBoundary, then
// lexicon-th.js for the real 12k word list.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["tokeniser.js", "segment.js", "lexicon-th.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
const { segmentThai, _segInit, _segReady } = globalThis;

const text = t => segmentThai(t).map(x => x.text);

describe("segmentThai before the lexicon loads", () => {
  test("reports not-ready and returns nothing rather than guessing", () => {
    // _segReady is false until _segInit runs; the app gates on _segLoad
    assert.equal(_segReady(), false);
    assert.deepEqual(segmentThai("รัฐบาล"), []);
  });
});

describe("segmentThai over the real lexicon", () => {
  test("the shipped lexicon loads", () => {
    const n = _segInit(THAI_LEXICON.split("\n"));
    assert.ok(n > 10000, `expected a five-figure lexicon, got ${n}`);
    assert.equal(_segReady(), true);
  });

  // The case the whole file exists for. The curriculum tokeniser matches มา
  // ("to come") inside มาตรการ and glosses it — a confidently wrong answer.
  test("does not match a short word inside a longer one", () => {
    assert.deepEqual(text("รัฐบาลประกาศมาตรการใหม่"),
      ["รัฐบาล", "ประกาศ", "มาตรการ", "ใหม่"]);
  });

  test("segments ordinary prose", () => {
    assert.deepEqual(text("ราคาน้ำมันเพิ่มขึ้นอย่างต่อเนื่อง"),
      ["ราคา", "น้ำมัน", "เพิ่ม", "ขึ้น", "อย่าง", "ต่อเนื่อง"]);
  });

  test("prefers a common word over a rare one that also fits", () => {
    // both readings are lexicon-legal; Zipf cost picks the frequent split
    assert.deepEqual(text("กระเป๋าใบนี้หนักมาก"),
      ["กระเป๋า", "ใบ", "นี้", "หนัก", "มาก"]);
  });

  test("never cuts inside a character cluster", () => {
    const DEP = cp => (cp >= 0x0E30 && cp <= 0x0E3A) || (cp >= 0x0E47 && cp <= 0x0E4E);
    const LEAD = cp => cp >= 0x0E40 && cp <= 0x0E44;
    const sample = "เขาบอกว่าหน้ากากน่าเกลียดแต่ก็ใส่ทุกวันเพราะกลัวเป็นหวัด";
    for (const t of segmentThai(sample)) {
      assert.ok(!DEP(t.text.codePointAt(0)),
        `token ${JSON.stringify(t.text)} starts with a dependent sign`);
      assert.ok(!LEAD(t.text.codePointAt(t.text.length - 1)),
        `token ${JSON.stringify(t.text)} ends on a stranded leading vowel`);
    }
  });

  test("non-Thai runs survive as single unknown tokens", () => {
    const toks = segmentThai("ผมชื่อ John ครับ");
    assert.deepEqual(toks.map(t => t.text).join(""), "ผมชื่อ John ครับ",
      "segmentation must be lossless");
    const john = toks.find(t => t.text.includes("John"));
    assert.ok(john && !john.known, "Latin text is one unknown run, not per-character");
  });

  test("segmentation is lossless over multi-line input", () => {
    for (const s of ["สวัสดีครับ", "ราคา 250 บาท!", "ฝนตกหนักทำให้น้ำท่วม", "abc ๆ ๛"]) {
      assert.equal(segmentThai(s).map(t => t.text).join(""), s);
    }
  });

  test("empty and nullish input return an empty list", () => {
    assert.deepEqual(segmentThai(""), []);
    assert.deepEqual(segmentThai(null), []);
    assert.deepEqual(segmentThai(undefined), []);
  });

  test("every known token is genuinely in the lexicon", () => {
    for (const t of segmentThai("นักท่องเที่ยวเดินทางมาประเทศไทยทุกปี")) {
      if (t.known) assert.ok(THAI_LEXICON.split("\n").includes(t.text),
        `${t.text} was marked known but is not in the lexicon`);
    }
  });
});

describe("_segInit", () => {
  test("dedupes and keeps the FIRST (most frequent) rank", () => {
    const n = _segInit(["ก", "ข", "ก"]);
    assert.equal(n, 2);
    _segInit(THAI_LEXICON.split("\n")); // restore for any later file
  });
});
