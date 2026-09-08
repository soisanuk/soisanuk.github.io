// Round 19 (2026-09-07) — Ray, a retired teacher who reads every chart
// (lens: cross-screen data agreement — idioms, the reference and display
// screens). Three script screens printed eight vowel examples with the tone
// stripped off, and the test that should have caught it stripped the
// diacritics off both sides before comparing. Two auxiliary files were outside
// the romanisation pin.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "srs.js", "tokeniser.js", "thai-script.js", "numbers.js", "idioms.js", "tutor.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

const map = new Map(WORDS.map(w => [w[0], w[1]]));
const spelled = (th, rom) => _tokenise(th).filter(x => x.word).map(x => x.text)
  .filter(t => map.has(t) &&
    !rom.replace(/[- ]/g, "").toLowerCase().includes(map.get(t).replace(/-/g, "").toLowerCase()))
  .map(t => `${th} "${rom}" — ${t} should read "${map.get(t)}"`);

describe("round 19 — what the reference screens print", () => {
  // VOWELS' example column surfaces on Vowel Cards, Script SRS and the Vowel &
  // Tone Drill. Eight of 21 spelled a non-mid tone flat — นี้ "nii", กุ้ง
  // "kung", น้ำ "naam", เขา "khao" — so a learner met เขา as "khao" on a script
  // card and "khǎo" on a vocab card in the same session. docs/architecture.md
  // names เขา khǎo as the exact reason bare RTGS is unusable here.
  test("no vowel example is spelled without the tone its own engine computes", () => {
    const MARK = { high: "́", low: "̀", falling: "̂", rising: "̌" };
    for (const [sym, , , ex] of VOWELS) {
      const m = /^(\S+)\s*\(([^)]+)\)/.exec(ex || "");
      if (!m) continue;
      const tone = syllableTone(m[1]);
      if (!tone || tone === "mid") continue;
      const marks = m[2].normalize("NFD").match(/[̀-ͯ]/g) || [];
      assert.ok(marks.includes(MARK[tone]),
        `${sym}: card romanises ${m[1]} as "${m[2]}", but the tone engine says ${tone}`);
    }
  });

  // ร้อย read "rói" on two number cards and "róoi" everywhere else; the ◌อย
  // rule was settled 2026-09-03 and pinned for WORDS and EXAMPLES only.
  test("every number card romanises its words the way data.js does", () => {
    const bad = NUM_CARDS.flatMap(c => spelled(c.th, c.rom));
    assert.deepEqual(bad, []);
  });

  // เมียน้อย read "mia-nói" against น้อย "nóoi", and ขายตัวไม่ได้ขายใจ had
  // "dâai" for ได้ "dâi". idioms.test.js asserted only that rom.length > 0.
  test("every idiom romanises its curriculum words the way data.js does", () => {
    const bad = PATTAYA_IDIOMS.flatMap(g => g.items).flatMap(([th, rom]) => spelled(th, rom));
    assert.deepEqual(bad, []);
  });

  // The tutor called ฟ "Fo Fa", which is ฝ's name — ฟ's acrophonic word is ฟัน,
  // so it is Fo Fan. The one collision in 42, and telling two letters apart is
  // the whole job of an acrophonic name.
  test("no two tutor consonants share a name, and each matches its CONSONANTS word", () => {
    const byName = new Map();
    for (const t of TUTOR_ALL.filter(x => x.cat === "consonant"))
      byName.set(t.name, [...(byName.get(t.name) || []), t.thai]);
    assert.deepEqual([...byName].filter(([, v]) => v.length > 1), []);
    assert.equal(TUTOR_ALL.find(t => t.thai === "ฟ").name, "Fo Fan");
    assert.equal(TUTOR_ALL.find(t => t.thai === "ฝ").name, "Fo Fa");
  });

  // Statistics contradicted itself the moment you got one card wrong. Its
  // headline counts records in `progress`; its own category rows, and the
  // Vocab List's dot, counted `repetitions > 0`. But `repetitions` is SM-2's
  // consecutive-SUCCESS counter and reviewCard zeroes it on any miss, so 55
  // Cards Seen sat 200px above rows summing to 40, and the Vocab List showed a
  // lapsed word as never opened — backwards, since a lapse is the word you most
  // need to find again.
  //
  // Asserted on the SOURCE because these are DOM-bound renderers, and on the
  // OPERATION rather than the vocabulary: what must never come back is the
  // predicate `repetitions > 0` being used to mean "seen".
  test("nothing decides 'seen' from the success streak", () => {
    const src = readFileSync(new URL("../../web/js/ui.js", import.meta.url), "utf8");
    const offenders = src.split("\n")
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => !l.trim().startsWith("//"))
      .filter(([, l]) => /\.repetitions\s*>\s*0/.test(l));
    assert.deepEqual(offenders, [],
      "`repetitions` resets on a miss — a lapsed card is still seen; use totalReviews");
  });

  // The same fact from the SM-2 side, so the reasoning above is checked and not
  // merely asserted: after a lapse the streak is gone but the card is still met.
  test("a lapsed card has repetitions 0 and totalReviews above 0", () => {
    const p = {};
    const c = getCard(p, "เขา");
    for (let i = 0; i < 3; i++) reviewCard(c, 5);
    reviewCard(c, 1);
    assert.equal(c.repetitions, 0, "a miss clears the success streak");
    assert.ok(c.totalReviews > 0, "but the card has still been reviewed");
  });

  // 794 of the 978 romanisations carry a combining tone mark and no phone
  // keyboard can produce ì á ǎ û, so the Vocab List could not find what the app
  // itself displays: "sip" found none of สิบ, "naam" one of sixteen.
  test("vocab search folds tone marks and separators", () => {
    const src = readFileSync(new URL("../../web/js/ui.js", import.meta.url), "utf8");
    const m = /function _vlFold\(s\) \{([\s\S]*?)\n\}/.exec(src);
    assert.ok(m, "_vlFold should exist");
    const fold = new Function("s", m[1] + "\n");
    assert.equal(fold("sà-baai"), "sabaai");
    assert.equal(fold("sìp"), "sip");
    assert.equal(fold("khǎo"), "khao");
    assert.equal(fold("náam"), "naam");
    // and the search must actually consult it
    assert.match(src, /_vlFold\(w\[1\]\)/,
      "filterVocabList has to compare the folded romanisation, not just define the folder");
  });
});
