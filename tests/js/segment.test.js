// Tests for the open-text segmenter in web/js/segment.js.
// The real sources are evaluated via node:vm (classic browser scripts):
// tokeniser.js first, because segment.js reuses its _tkLegalBoundary, then
// lexicon-th.js for the real 12k word list.
// Run with: node --test tests/js/

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// data.js for WORDS (the course-word guard below reads it), and the two
// corpus-derived layers segment.js now consults.
for (const f of ["data.js", "tokeniser.js", "seg-extra.js", "seg-phrases.js", "segment.js", "lexicon-th.js"]) {
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

// Found by the 2026-08-30 learner persona round: 7-Eleven and Grab — two of the
// commonest nouns in a Pattaya learner's messages — were shredded into real
// Thai words and glossed with full confidence. เซเว่น → เซ ("to stagger"),
// แกร็บ → แก ("a second person pronoun"). The card looked exactly as
// authoritative as the one for โรงแรม.
describe("fragment detection", () => {
  const seg = s => segmentThai(s);
  const frag = s => seg(s).filter(t => t.fragment).map(t => t.text);

  test("a word wedged against unmatched Thai is flagged", () => {
    assert.deepEqual(frag("ไปเซเว่น"), ["เซ"]);
    assert.ok(frag("เรียกแกร็บไปนะ").includes("แก"));
    assert.ok(frag("เฟซบุ๊ก").includes("บุ๊ก"));
  });

  test("ordinary Thai is not flagged", () => {
    for (const s of ["ตำรวจจับกุมผู้ต้องสงสัย", "รัฐบาลประกาศมาตรการใหม่",
                     "ราคาน้ำมันเพิ่มขึ้นอย่างต่อเนื่อง"]) {
      assert.deepEqual(frag(s), [], s);
    }
  });

  test("a space is an ordinary boundary, not a break", () => {
    // " John " is unmatched but its edges are spaces
    assert.deepEqual(frag("ผมชื่อ John ครับ"), []);
  });

  test("ๆ is a repetition mark, not residue", () => {
    // เด็กๆ correctly segments as เด็ก + an inert ๆ. Counting ๆ as Thai residue
    // flagged เด็ก — and ๆ is common enough that it was most of the noise
    // (0.60% of curriculum tokens flagged, down to 0.15% once excluded).
    assert.deepEqual(frag("เด็กๆวิ่งเล่น"), []);
    assert.deepEqual(frag("ต้มยำร้อนๆ"), []);
  });

  test("the flag is advisory — the token still segments normally", () => {
    const t = seg("ไปเซเว่น").find(x => x.text === "เซ");
    assert.equal(t.known, true, "still a lexicon match; only its MEANING is untrustworthy");
    assert.equal(seg("ไปเซเว่น").map(x => x.text).join(""), "ไปเซเว่น", "still lossless");
  });
});

describe("_segInit", () => {
  test("dedupes and keeps the FIRST (most frequent) rank", () => {
    const n = _segInit(["ก", "ข", "ก"]);
    assert.equal(n, 2);
    _segInit(THAI_LEXICON.split("\n")); // restore for any later file
  });
});

describe("stretched spellings", () => {
  // Thai writers stretch a final letter for emphasis and it is in every real
  // paste — อร่อยยยย, มากกกก, จังงงง. The DP had no notion of it, so มากกกก
  // parsed as มา|กก|กก, "to come / reed / reed", with a confident gloss on
  // each. Absorbed at the base word's own cost, so a stretch is never a better
  // parse than the word and never a worse one.
  test("a stretched word resolves to the word", () => {
    for (const [input, want] of [["มากกกก", "มาก"], ["จังงงง", "จัง"], ["อร่อยยยย", "อร่อย"]]) {
      const toks = segmentThai(input);
      assert.equal(toks.length, 1, `${input} should be one token, got ${toks.map(t => t.text).join("|")}`);
      assert.equal(toks[0].text, input, "the letters the writer typed are kept");
      assert.equal(toks[0].base, want, "and the meaning is looked up under the word");
    }
  });

  test("one extra letter is not a stretch", () => {
    // กก is a real word (rank 2886); collapsing a single repeat would eat it.
    assert.deepEqual(segmentThai("มากก").map(t => t.text), ["มา", "กก"]);
    assert.equal(segmentThai("ลูกกวาด").length, 1, "ลูกกวาด is one word, not a stretch");
  });

  test("a real word always beats a stretch of a shorter one", () => {
    // Five lexicon entries carry three identical consonants. เออออ ("to agree")
    // lost to เอ + a stretch before the guard, because เอ is far commoner.
    for (const w of ["คะแนนนิยม", "แวววาว", "เออออ", "งงงวย"]) {
      const toks = segmentThai(w);
      assert.equal(toks.length, 1, `${w} split as ${toks.map(t => t.text).join("|")}`);
      assert.equal(toks[0].base, undefined, `${w} is a word, not a stretch of one`);
    }
  });
});

describe("the corpus-derived layers", () => {
  // _segWords is module state and an earlier test in this file installs its own
  // small list. Reinstall the real one, through the real path, so the curated
  // supplement and the phrase filter are applied the way the app applies them.
  before(() => { _segWords = null; _segLoad(() => {}); });
  test("curated words are whole, and their pieces are not the answer", () => {
    // A word the segmenter does not know is not skipped — it is CUT UP, and
    // the pieces are usually real words, so the reader gets a confident wrong
    // answer rather than a blank. โอเลี้ยง was โอ|เลี้ยง, "a type of
    // lacquerware" plus "to maintain; to dribble".
    for (const w of ["โอเลี้ยง", "รีวิว", "ดราม่า", "เซเว่น"])
      assert.deepEqual(segmentThai(w).map(t => t.text), [w], `${w} should be one token`);
  });

  test("phrases the linguists split are no longer merged", () => {
    // ตกหนัก is in the frequency list at rank 6792 and cost less than ตก +
    // หนัก, so ฝนตกหนัก glossed as "shoulder a burden". VISTEC's annotators cut
    // through it in 24 of 24 occurrences.
    assert.deepEqual(segmentThai("ฝนตกหนัก").map(t => t.text), ["ฝน", "ตก", "หนัก"]);
  });

  test("but never a word the course teaches", () => {
    // 36 prune candidates are course vocabulary. VISTEC's convention splits
    // them; ours must not, or Paste Text would disagree with the flashcard
    // about the same word. The guard is on the PRUNE LIST — it cannot stop the
    // DP splitting a word on cost, and does not claim to: ไม่ใช่ sits at rank
    // 11,886 against ไม่ at 9 and ใช่ at 131, and has always come apart.
    const pruned = new Set(SEG_PHRASES.split("\n").filter(Boolean));
    const course = new Set(WORDS.map(w => w[0]));
    const clash = [...pruned].filter(w => course.has(w));
    assert.deepEqual(clash, [], `the course teaches these, they must not be pruned: ${clash.join(" ")}`);
    // and the ones that were whole before still are
    for (const w of ["ภาษาไทย", "วันจันทร์", "ที่ไหน"]) {
      assert.ok(course.has(w), `${w} should be a course word`);
      assert.deepEqual(segmentThai(w).map(t => t.text), [w], `${w} must stay whole`);
    }
  });

  test("ไม้ยมก belongs to the word it repeats", () => {
    // §1.5 of the corpus's own criteria, and 15,000 occurrences agree.
    const t = segmentThai("เด็กๆ");
    assert.deepEqual(t.map(x => x.text), ["เด็กๆ"]);
    assert.equal(t[0].base, "เด็ก", "looked up under the unrepeated word");
    // …but a space before it is still a boundary: formal Thai writes เพื่อน ๆ
    assert.ok(segmentThai("เพื่อน ๆ").length > 1);
  });
});
