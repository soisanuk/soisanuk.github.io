// Tests for the gloss layer in web/js/gloss.js (+ the generated gloss-th.js).
// Evaluated via node:vm as classic browser scripts. data.js first, because
// thaiGloss prefers the curriculum's own gloss via WORD_MAP.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "thai-script.js", "gloss-extra.js", "gloss.js", "gloss-th.js", "gloss-vol.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
const { thaiGloss, thaiRoman, _glossInit, _glossReady } = globalThis;
globalThis.WORD_MAP = Object.fromEntries(WORDS.map(w => [w[0], w]));

describe("thaiGloss before the dictionary loads", () => {
  test("returns null rather than throwing", () => {
    assert.equal(_glossReady(), false);
    assert.equal(thaiGloss("จับกุม"), null);
  });
  test("curriculum words work without the dictionary at all", () => {
    // WORD_MAP is consulted first, so the course never depends on the download
    assert.equal(thaiGloss("ตำรวจ"), WORD_MAP["ตำรวจ"][2]);
  });
});

describe("the generated dictionary", () => {
  test("loads", () => {
    assert.ok(_glossInit(THAI_GLOSS) > 5000);
    assert.equal(_glossReady(), true);
  });

  test("every row is word + TAB + gloss + TAB + romanisation", () => {
    // guards the generator's escaping: a stray backslash once merged two rows
    for (const line of THAI_GLOSS.split("\n")) {
      const parts = line.split("\t");
      assert.equal(parts.length, 3, `malformed row: ${JSON.stringify(line)}`);
      assert.ok(parts[0].length > 0, `empty word: ${JSON.stringify(line)}`);
      assert.ok(parts[1].length > 0, `empty gloss: ${JSON.stringify(line)}`);
      // parts[2] MAY be empty — a romanisation the tone check refused
    }
  });

  test("no gloss exceeds the card's one-line budget", () => {
    for (const line of THAI_GLOSS.split("\n")) {
      const g = line.split("\t")[1];
      assert.ok(g.length <= 58, `${g.length} chars: ${g}`);
    }
  });

  test("romanisations are converted to the course's style, not raw Paiboon", () => {
    // raw Paiboon writes ก as g, ป as bp, ต as dt, and keeps IPA vowel letters
    const bad = [];
    for (const line of THAI_GLOSS.split("\n")) {
      const r = line.split("\t")[2];
      if (!r) continue;
      if (/[ɛɔʉə]/.test(r)) bad.push(["unconverted IPA vowel", line]);
      if (/(^|[- ])(g|bp|dt)[aeiouāīū]/.test(r)) bad.push(["raw Paiboon onset", line]);
    }
    assert.deepEqual(bad.slice(0, 5), [], `${bad.length} bad romanisations`);
  });

  test("a derived romanisation never contradicts the tone engine", () => {
    // the generator drops conflicts; this pins that it actually ran. Checked
    // here for monosyllables only — syllableTone's contract.
    const MARK = { mid: "", low: "\u0300", falling: "\u0302", high: "\u0301", rising: "\u030c" };
    let checked = 0;
    for (const line of THAI_GLOSS.split("\n")) {
      const [w, , r] = line.split("\t");
      if (!r || /[- ]/.test(r)) continue;
      const tone = syllableTone(w);
      if (!tone) continue;
      checked++;
      const got = (r.normalize("NFD").match(/[\u0300\u0301\u0302\u0303\u030c]/) || [""])[0];
      assert.equal(got, MARK[tone], `${w} reads ${tone} but romanises as ${r}`);
    }
    assert.ok(checked > 200, `only ${checked} monosyllables checked`);
  });

  test("thaiRoman prefers the course's own romanisation", () => {
    assert.equal(thaiRoman("ตำรวจ"), WORD_MAP["ตำรวจ"][1]);
    assert.equal(thaiRoman("มาตรการ"), "mâat-trà-kaan");
    assert.equal(thaiRoman("ไม่มีคำนี้จริงๆนะ"), null);
  });

  test("glosses are English, not Thai (the wrong-corpus trap)", () => {
    // PyThaiNLP's thai_dict is extracted from THAI wiktionary and defines Thai
    // in Thai — useless here. If a future rebuild picks the wrong source this
    // fails loudly rather than shipping Thai definitions.
    const thai = /[฀-๿]/;
    const sample = THAI_GLOSS.split("\n").slice(0, 400).map(l => l.split("\t")[1]);
    const thaiish = sample.filter(g => thai.test(g)).length;
    assert.ok(thaiish / sample.length < 0.1, `${thaiish}/${sample.length} glosses contain Thai script`);
  });

  test("known words resolve to sensible English", () => {
    assert.equal(thaiGloss("จับกุม"), "to arrest");
    assert.equal(thaiGloss("เศรษฐกิจ"), "economy");
    assert.match(thaiGloss("มาตรการ"), /^measure/);
  });

  // All below found by the 2026-08-30 fluent-Thai-reader persona round.

  test("no gloss redirects the learner to another Thai word", () => {
    // "alternative form of มกร" sends someone who needed a gloss to a word they
    // also don't know, often spelled in a romanisation scheme this app rejects.
    // No gloss is better; those entries are dropped at build time.
    const bad = THAI_GLOSS.split("\n").map(l => l.split("\t"))
      .filter(r => /alternative form of|synonym of|clipping of|abstract noun of/i.test(r[1]));
    assert.ok(bad.length <= 8, `${bad.length} redirect glosses: ${bad.slice(0,3).map(r=>r[0]+" → "+r[1])}`);
  });

  test("no gloss leaks Thai script, raw IPA, or Paiboon spellings", () => {
    for (const line of THAI_GLOSS.split("\n")) {
      const g = line.split("\t")[1];
      assert.ok(!/[฀-๿]/.test(g), `Thai script in an English gloss: ${g}`);
      assert.ok(!/[ɛɔʉə]/.test(g), `raw IPA in a gloss: ${g}`);
      assert.ok(!/\b(bp|dt)[aeiou]/.test(g), `raw Paiboon spelling in a gloss: ${g}`);
    }
  });

  test("no gloss ends mid-parenthesis", () => {
    // "public (of, relating to; public" — the cap used to cut inside a bracket
    for (const line of THAI_GLOSS.split("\n")) {
      const g = line.split("\t")[1];
      assert.ok((g.split("(").length - 1) <= (g.split(")").length - 1), `unclosed paren: ${g}`);
    }
  });

  test("a register-restricted sense keeps its warning", () => {
    // Stripping the tag is what made กู and มึง read as neutral pronouns —
    // words whose entire point is that using them wrongly causes offence.
    assert.match(thaiGloss("กู"), /vulgar/);
    assert.match(thaiGloss("มึง"), /vulgar/);
  });

  test("etymology-ordered senses are overridden where they mislead", () => {
    // English Wiktionary orders senses historically, so the everyday meaning
    // can fall outside the two senses kept: กรุงเทพ read "Ayutthaya Kingdom".
    assert.equal(thaiGloss("กรุงเทพ"), "Bangkok");
    assert.match(thaiGloss("โลก"), /world/);
    assert.match(thaiGloss("เมีย"), /wife/);
  });

  test("no romanisation ends a syllable outside Thai's final inventory", () => {
    // Thai finals are -k -t -p -m -n -ng -w -y or open. Wiktionary keeps the
    // foreign spelling for loanwords (โพสต์ "phóos", อีเมล "ii-meel"), which is
    // a pronunciation no Thai speaker produces.
    for (const line of THAI_GLOSS.split("\n")) {
      const r = line.split("\t")[2];
      if (!r) continue;
      for (const syl of r.split(/[- ]/)) {
        const t = syl.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (/ng$/.test(t)) continue;
        assert.ok(!/(s|l|f|d|b|v|z|r|c|h|x|j|q)$/.test(t), `illegal Thai final in ${r}`);
      }
    }
  });

  test("the curriculum still wins over the dictionary", () => {
    // ตำรวจ is in both; the course's own wording is the one learners see
    assert.equal(thaiGloss("ตำรวจ"), WORD_MAP["ตำรวจ"][2]);
  });

  test("an unknown word is null, not a guess", () => {
    assert.equal(thaiGloss("ไม่มีคำนี้จริงๆนะ"), null);
  });
});


// ── The supplement layer (gloss-extra.js) ───────────────────────────────────
// Hand-curated entries for words Wiktionary does not cover. บทสนทนา was the
// first: in the lexicon, segments as one token, and had nothing to say for
// itself because English Wiktionary has no entry for it — nor for บท or สนทนา.
describe("GLOSS_EXTRA", () => {
  test("fills a gap the dictionary leaves", () => {
    // not a course word, not in Wiktionary — only the supplement knows it
    assert.equal(WORD_MAP["บทสนทนา"], undefined);
    assert.equal(thaiGloss("บทสนทนา"), "conversation, dialogue");
    assert.equal(thaiRoman("บทสนทนา"), "bòt-sǒn-thá-naa");
  });

  test("outranks Wiktionary, so a wrong crowd-sourced gloss can be corrected here", () => {
    const saved = GLOSS_EXTRA["ทดสอบ"];
    GLOSS_EXTRA["ทดสอบ"] = ["thót-sòop", "OVERRIDE"];
    _glossInit("ทดสอบ\tfrom wiktionary\tthot-soop\n");
    try {
      assert.equal(thaiGloss("ทดสอบ"), "OVERRIDE");
      assert.equal(thaiRoman("ทดสอบ"), "thót-sòop");
    } finally {
      if (saved) GLOSS_EXTRA["ทดสอบ"] = saved; else delete GLOSS_EXTRA["ทดสอบ"];
    }
  });

  test("but never outranks the course's own words", () => {
    const saved = GLOSS_EXTRA["ไป"];
    GLOSS_EXTRA["ไป"] = ["WRONG", "WRONG"];
    try { assert.equal(thaiGloss("ไป"), WORD_MAP["ไป"][2]); }
    finally { if (saved) GLOSS_EXTRA["ไป"] = saved; else delete GLOSS_EXTRA["ไป"]; }
  });

  // Every entry's tone marks must agree with the engine — the same bar the
  // generator holds Wiktionary's romanisations to. A hand-typed mark is the
  // easiest thing in this file to get wrong and the hardest for a reader to
  // notice.
  test("every entry's tone marks agree with the tone engine", () => {
    const MARK = { "\u0300": "low", "\u0302": "falling", "\u0301": "high", "\u030C": "rising" };
    const toneOfSyl = syl => {
      const m = syl.normalize("NFD").match(/[\u0300\u0301\u0302\u030C]/);
      return m ? MARK[m[0]] : "mid";
    };
    for (const [thai, [roman]] of Object.entries(GLOSS_EXTRA)) {
      if (!roman) continue;
      const syls = roman.split(/[-\s]+/);
      // การันต์ (U+0E4C) silences a letter, so the WRITTEN syllable is not the
      // spoken one and syllableToneInfo — which models what is written —
      // returns null. That is the engine's honest answer, not a bad entry:
      // จันทร์ is spoken "jan" and spelled with a dead ทร the reader must
      // ignore. These are checked the way multi-syllable entries are, by
      // agreeing with the course's own compound (วันจันทร์ = wan-jan).
      if (/\u0E4C/.test(thai)) continue;
      // a single-syllable entry can be checked directly against the engine
      if (syls.length === 1) {
        const info = syllableToneInfo(thai);
        assert.ok(info, `${thai}: engine could not analyse it`);
        assert.equal(toneOfSyl(roman), info.tone, `${thai} is romanised "${roman}" but the engine says ${info.tone}`);
      }
      // multi-syllable: every mark must at least be one of the four the scheme uses
      for (const syl of syls) {
        const marks = syl.normalize("NFD").match(/[\u0300-\u036F]/g) || [];
        for (const mk of marks) assert.ok(MARK[mk] || mk === "\u030C", `${thai}: "${syl}" carries a mark outside the scheme`);
      }
    }
  });
});


// ── The gap-filler layer (gloss-vol.js, Volubilis) ──────────────────────────
// It covers 80% of the words no other layer can gloss, but its first row for a
// spelling is often a homograph — มา "moon", เขา "mountain", ดี "gallbladder".
// So it is consulted LAST and may never displace a gloss we already have.
describe("GLOSS_VOL", () => {
  test("fills words no other layer has", () => {
    _volInit(GLOSS_VOL);
    assert.equal(WORD_MAP["ความรู้สึก"], undefined, "not a course word");
    assert.match(thaiGloss("ความรู้สึก"), /feeling/i);
    assert.equal(glossSource("ความรู้สึก"), "volubilis");
  });

  test("never outranks the course, the supplement, or Wiktionary", () => {
    _volInit("ไป\tWRONG-VOL\nทดสอบ\tWRONG-VOL\n");
    _glossInit("ทดสอบ\tfrom wiktionary\tthot-soop\n");
    // course word: WORD_MAP wins
    assert.equal(thaiGloss("ไป"), WORD_MAP["ไป"][2]);
    assert.equal(glossSource("ไป"), "course");
    // Wiktionary has it: Volubilis must not displace it
    assert.equal(thaiGloss("ทดสอบ"), "from wiktionary");
    assert.equal(glossSource("ทดสอบ"), "wiktionary");
  });

  test("the homographs that caused this ordering never reach a reader", () => {
    _volInit(GLOSS_VOL);
    // every one of these is glossed by a higher layer, so Volubilis's
    // homograph row is unreachable no matter what it says
    for (const [w, wrong] of [["มา", /moon/i], ["เขา", /mountain/i], ["ดี", /gallbladder/i], ["ต่อ", /wasp/i]]) {
      const g = thaiGloss(w);
      assert.ok(g, `${w} should be glossed by a higher layer`);
      assert.doesNotMatch(g, wrong, `${w} is showing the Volubilis homograph`);
    }
  });

  test("multi-sense rows disclose rather than pick", () => {
    _volInit(GLOSS_VOL);
    const multi = GLOSS_VOL.split("\n").filter(r => r.includes(" \u00b7 "));
    assert.ok(multi.length > 300, `expected many multi-sense rows, saw ${multi.length}`);
    // and the joined line stays card-sized
    for (const row of GLOSS_VOL.split("\n")) {
      const en = row.split("\t")[1] || "";
      assert.ok(en.length <= 90, `gloss too long for a card: ${row.slice(0, 60)}`);
    }
  });

  test("carries no romanisation — Volubilis tone marks disagree with the engine", () => {
    for (const row of GLOSS_VOL.split("\n").slice(0, 200)) {
      assert.ok(row.split("\t").length <= 2, `unexpected third column: ${row.slice(0, 50)}`);
    }
    assert.equal(thaiRoman("ความรู้สึก"), null, "romanisation must not come from this layer");
  });
});

// ── Generated romanisations follow the settled vowel scheme ─────────────────
// build-gloss.mjs converts Wiktionary's Paiboon, and that input is split on
// vowel length: it gave หอย "hǒi" and เงิน "ngoen" where the Thai spelling
// plainly shows a long vowel. lengthenFromSpelling() now overrules the input
// from the spelling, so a regeneration cannot reintroduce the drift the
// 2026-09-03 pass removed from data.js and examples.js. These assert the
// OUTPUT, so they hold whether the file was regenerated or migrated.
describe("gloss-th.js vowel lengths", () => {
  const rows = () => THAI_GLOSS.split("\n").map(r => r.split("\t")).filter(r => r[2]);
  const strip = r => r.normalize("NFD").replace(/[̀-ͯ]/g, "");

  test("◌อย is romanised ooi, never a bare oi", () => {
    for (const [w, , r] of rows()) {
      if (!/อย/.test(w)) continue;
      assert.doesNotMatch(strip(r), /(?<!o)oi(?![a-z])/, `${w} = "${r}"`);
    }
  });

  test("เ◌ิ + final is romanised ooe", () => {
    for (const [w, , r] of rows()) {
      if (!/เ[ก-ฮ]ิ[ก-ฮ]/.test(w)) continue;
      assert.doesNotMatch(strip(r), /(?<!o)oe(?!i)/, `${w} = "${r}"`);
    }
  });

  // The guard that matters: a syllable with no written vowel romanises as a
  // short o before its final, character-for-character like the ◌อ+final rule's
  // target. Applying that rule across syllables turned ปกครอง into
  // "pòok-khroong" — the wrong syllable, because counting is not aligning.
  test("implicit-vowel syllables are left short", () => {
    for (const [w, expect] of [["ปกครอง", "pòk-khroong"], ["ทดสอบ", "thót-sòop"],
                               ["ส่งออก", "sòng-òok"], ["จอมพล", "joom-phon"]]) {
      const row = rows().find(r => r[0] === w);
      if (!row) continue;
      assert.equal(row[2], expect, `${w} must not have its short syllable lengthened`);
    }
  });
});
