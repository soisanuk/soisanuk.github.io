// Round 26 (2026-10-08) — Fon, a Bangkok proofreader (lens: the eleven words
// added 2026-10-08, judged where a learner actually meets them).
//
// Her verdict: the sounds were right — she went after the tone marks and vowel
// lengths expecting to find one that would send a learner into a shop saying
// the wrong word, and found none. What she found instead was meaning in place:
// three of the eleven were taught by a sentence that did not teach them, and
// one gloss quietly taught a compound. The data file was defensible in every
// case; the learner's screen was not.
//
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "tokeniser.js", "seg-extra.js",
                 "seg-phrases.js", "segment.js", "lexicon-th.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
const { segmentThai, _segInit, _segEffective } = globalThis;
const MAP = Object.fromEntries(WORDS.map(w => [w[0], w]));

describe("an example has to teach its own headword", () => {
  // F2/F3/F5. The three examples below each sat under an English translation
  // with no word for the headword in it. That is invisible on a word card and
  // fatal in Sentence SRS, which blanks the Thai and shows only the English:
  // "Where is the wallet?" cannot yield สตางค์, and "The bill, please." invites
  // ขอ — which is better Thai, and which the app itself teaches on บิล in that
  // very sentence. So the cloze punished the natural answer.
  //
  // Pinned per word rather than as a general rule on purpose. The general
  // version — every example's English must share a content word with its
  // headword's gloss — was measured over all 971 examples and flags 131, of
  // which most are honest inflections ("to sit" / "He is sitting", "to buy" /
  // "Mom buys"). Too noisy to gate on, so these three carry their own guard.
  const needs = {
    "สตางค์": /money|satang/i,   // gloss: satang (1/100 baht); money
    "เช็ค":   /check|cheque/i,    // gloss: to check; cheque
    "ลา":     /farewell|formal|final/i, // register, not a bare "Goodbye."
  };
  for (const [word, want] of Object.entries(needs)) {
    test(`${word}'s example says in English what the word means`, () => {
      const ex = EXAMPLES[word];
      assert.ok(ex, `${word} has no example`);
      assert.match(ex[2], want,
        `${word} glossed "${MAP[word][2]}" but its example reads "${ex[2]}" — ` +
        `nothing in that English can produce the word, so the cloze is unanswerable`);
    });
  }

  test("ลา's example still carries its register, whatever the wording", () => {
    // ลาก่อน is a final farewell, not what you say leaving a 7-Eleven. The
    // course's only other partings are สวัสดี and แล้วเจอกัน, so this card is
    // where a learner learns how to say goodbye — a bare "Goodbye." sent them
    // out sounding like they were emigrating.
    assert.ok(!/^goodbye\.?$/i.test(EXAMPLES["ลา"][2].trim()),
      "a bare \"Goodbye.\" hides that ลาก่อน is final and formal");
  });
});

describe("a gloss leads with the bare word's meaning, not a compound's", () => {
  test("ย้าย is the general verb, not only ย้ายบ้าน", () => {
    // F4. "to move house; to relocate" encoded the meaning of the compound
    // ย้ายบ้าน onto the bare verb, which is ย้ายโต๊ะ / ย้ายงาน / ย้ายห้อง too.
    // Both shipped dictionaries lead with the general sense (THAI_GLOSS: "to
    // move; to change; to transfer"), so data.js was losing to them — and the
    // example ผมจะย้ายบ้าน already supplies the house.
    const gloss = MAP["ย้าย"][2];
    assert.ok(!/^to move house/i.test(gloss),
      `ย้าย leads with a compound's meaning: "${gloss}"`);
    assert.match(gloss, /move/i);
  });
});

describe("a course word must survive the open-text segmenter", () => {
  test("the shipped lexicon loads, with the extra word lists folded in", () => {
    // _segEffective is the step that folds in SEG_EXTRA and SEG_PHRASES.
    // Calling _segInit on the raw lexicon — as segment.test.js still does —
    // silently tests a segmenter that has never seen seg-extra.js, and both
    // pins below passed as failures until this line was corrected.
    assert.ok(_segInit(_segEffective(THAI_LEXICON.split("\n"))) > 10000);
  });

  // F1/F7. Both of these are WORDS entries whose parts are also words, so the
  // segmenter — which does not consult the curriculum — cut them up and glossed
  // the pieces. หมูปิ้ง read as "pig" + "to cook by direct exposure to fire or
  // heat"; ร้านสะดวกซื้อ read as "shop convenient buy", with ซื้อ twice. That
  // is exactly what seg-extra.js exists to prevent, and neither was in it.
  //
  // Behavioural on purpose: asserting SEG_EXTRA contains the string would pass
  // just as happily if segmentThai stopped consulting SEG_EXTRA at all.
  for (const [sentence, want] of [
    ["ขอหมูปิ้งครับ", "หมูปิ้ง"],
    ["เขาซื้อบุหรี่ที่ร้านสะดวกซื้อ", "ร้านสะดวกซื้อ"],
  ]) {
    test(`${want} stays whole in running text`, () => {
      const toks = segmentThai(sentence).map(t => t.text);
      assert.ok(toks.includes(want),
        `${want} is a course word but segmented as ${toks.join("|")}`);
    });
  }

  test("neither of the two is in the segmenter's blind spot any more", () => {
    // The general form of F1 — every multi-syllable course word must survive
    // inside its own example — is NOT pinned, deliberately. Measured over all
    // 971 examples it flags 28 Thai-only words, and most are compounds a
    // reader may legitimately meet split: ไม่ดี ("not good"), ออกไป ("go
    // out"), ต่างกัน, เหมือนกัน. Splitting those is the segmenter doing its
    // job, so gating on the whole set would pin 28 non-defects. What made
    // หมูปิ้ง and ร้านสะดวกซื้อ different is that their parts carry
    // misleading glosses — "pig" plus "to cook by direct exposure to fire",
    // and "shop convenient buy" with ซื้อ twice.
    const MULTI = Object.entries(EXAMPLES)
      .filter(([w]) => MAP[w] && [...w].length >= 5 && /^[\u0E00-\u0E7F]+$/.test(w));
    const broken = MULTI
      .filter(([w, ex]) => !segmentThai(ex[0]).map(t => t.text).includes(w))
      .map(([w]) => w);
    for (const w of ["หมูปิ้ง", "ร้านสะดวกซื้อ"]) {
      assert.ok(!broken.includes(w), `${w} is split inside its own example again`);
    }
  });
});
