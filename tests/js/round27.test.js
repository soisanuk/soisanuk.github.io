// Round 27 (2026-10-08) — Dao, who only ever pastes real Thai (lens: do the
// eleven new words survive tokenise → lookup → extension).
//
// She cleared the pipeline she actually uses: over ~1,100 sentences the DP
// segmenter never once let ลา eat a word it shouldn't, the packaged extension
// matched the app on every resolvable word, and both ์ words refuse to claim a
// tone rather than guessing. What she found was on the surface she does NOT
// use: the curriculum tokeniser, which has no lexicon, carved ลา out of กลาง
// and พลาด in three shipped example sentences and offered "to take leave" as a
// tappable gloss under a sentence about a broken-down car.
//
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js", "curriculum.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
globalThis.WORD_MAP = Object.fromEntries(WORDS.map(w => [w[0], w]));

// What a learner can tap: the text of every token the tokeniser gave a gloss.
const glossed = s => _tokenise(s).filter(t => t.word).map(t => t.text);

describe("a match may not strand a lone consonant it clusters with", () => {
  // The regression. Adding bare ลา (2 characters, and a substring of a great
  // many ordinary words) made greedy longest-match carve it out of anything
  // the curriculum map does not hold whole: กลาง became ก|ลา|ง. The lone ก is
  // not a word and never can be, so the "match" was really the middle of a
  // word the map does not have — and the app offered it confidently.
  //
  // Fixed in _tkLegalBoundary's neighbourhood by refusing a match whose first
  // letter would form a true cluster (ควบกล้ำ) with a stranded lone consonant
  // behind it. Measured over all 971 example sentences: 10 sentences changed,
  // 10 wrong glosses removed, 0 glosses gained or lost elsewhere.
  //
  // Behavioural rather than a check on _TK_CLUSTERS: a test that the set
  // contains "กล" would pass just as happily if makeTokeniser stopped reading
  // the set at all. These assert what a learner can tap.
  for (const [word, wrong] of [
    ["กลาง", "ลา"],    // middle → "to take leave"
    ["พลาด", "ลา"],    // to miss → "to take leave"
    ["กรอบ", "รอ"],    // crispy → "to wait"
    ["ควัน", "วัน"],    // smoke → "day"
    ["กลม", "ลม"],     // round → "wind"
  ]) {
    test(`${word} is not offered as ${wrong}`, () => {
      assert.ok(!glossed(word).includes(wrong),
        `${word} tokenised as ${_tokenise(word).map(t => t.text).join("|")}`);
    });
  }

  test("a legitimate boundary between cluster letters still falls", () => {
    // The rule must not fire when the letter before the boundary is a real
    // syllable: ผักลวก is ผัก + ลวก, and ก|ล there spans a word boundary
    // rather than a cluster. The first candidate fix got this wrong — it
    // suppressed the next match whenever ANY lone consonant preceded it, and
    // destroyed 34 correct glosses across the examples (รอง|เท้า, ขาด|น้ำ,
    // เรือน|หลาย) to fix 1. Keep this test next to the one above.
    assert.deepEqual(glossed("ผักลวก"), ["ผัก"]);
    assert.ok(glossed("กลางคืน").includes("กลางคืน"));
  });

  test("the three live sentences no longer offer a word from inside another", () => {
    for (const s of ["รถเสียอยู่กลางถนน", "เรือแล่นอยู่กลางทะเล",
                     "ช่วยแก้ไขข้อผิดพลาดในรายงานด้วย"]) {
      assert.ok(!glossed(s).includes("ลา"),
        `${s} → ${_tokenise(s).map(t => t.text).join("|")}`);
    }
  });
});

describe("the words ลา is still carved out of are kept out of app text", () => {
  // Her finding 4, recorded as a NON-FIX. Fifteen ordinary words still split
  // wrongly, because the stranded piece is not a lone consonant and so the
  // cluster rule cannot see it: ตุลาคม → ตุ|ลา|คม, ยะลา → ยะ|ลา, ลายเซ็น →
  // ลา|ยเซ็น, and ดอลลาร์ ซาลาเปา จลาจล ลามก อำลา บุคลากร เกลา เหลา ลาด ลาย
  // ลาง สงขลา. None is reachable from any app surface today, and repairing
  // them needs a real word list — which is what segment.js and its 12k
  // lexicon are for, and which the open-text surfaces already use.
  //
  // So this pins the reachability instead of the split: the moment an example
  // ships one of these, it becomes a wrong gloss on a real card, and this
  // fails by name. ตุลาคม stays broken even with the lexicon loaded, because
  // คม is itself a word and the heal can never fire.
  const CARVED = ["ตุลาคม", "ยะลา", "ลายเซ็น", "สงขลา", "ดอลลาร์", "ซาลาเปา",
                  "จลาจล", "ลามก", "อำลา", "บุคลากร", "เกลา", "เหลา",
                  "ลาด", "ลาย", "ลาง"];

  test("the list is still accurate — each one is genuinely still carved", () => {
    // If a future fix repairs one of these, this fails and the entry should be
    // deleted rather than the test loosened. A stale non-fix list is worse
    // than none: it claims coverage it no longer has.
    const repaired = CARVED.filter(w => !glossed(w).some(t => t !== w));
    assert.deepEqual(repaired, [],
      "these are fixed now — delete them from CARWED and keep the list honest"
        .replace("CARWED", "CARVED"));
  });

  test("no example offers ลา from inside another word", () => {
    // The first version of this test asked whether the sentence CONTAINED one
    // of the fifteen, and flagged ตลาด and ฉลาด — both of which are WORDS
    // entries and tokenise whole, so the substring was harmless. What matters
    // is not the substring but whether a learner is offered the gloss: ลา may
    // be glossed in its own example and nowhere else.
    const offenders = [];
    for (const [word, ex] of Object.entries(EXAMPLES)) {
      if (word === "ลา") continue;
      if (glossed(ex[0]).includes("ลา"))
        offenders.push(`${word}: ${_tokenise(ex[0]).map(t => t.text).join("|")}`);
    }
    assert.deepEqual(offenders, [],
      "an example offers \"ลา — to take leave\" from inside a longer word");
  });
});

describe("a word the engine cannot read refuses to claim a tone", () => {
  // Cleared, and pinned because it is the honest-degradation behaviour the
  // rest of the round depends on. สตางค์ and ตังค์ carry ์ (การันต์), which
  // _analyseSyllable declares out of scope; จระเข้ is polysyllabic. All three
  // return null rather than asserting a tone, and the UI renders them
  // uncoloured with "Tone not determined".
  for (const w of ["สตางค์", "ตังค์", "จระเข้"]) {
    test(`${w} returns no tone rather than a wrong one`, () => {
      assert.equal(toneOfWord(w), null);
    });
  }

  test("a word the engine CAN read still reports its tone", () => {
    // Guards the test above: all three would also pass if toneOfWord were
    // broken outright and returned null for everything.
    assert.equal(toneOfWord("หมู"), "rising");
    assert.equal(toneOfWord("ลา"), "mid");
  });
});
