// The letter ladder's own invariants.
//
// These exist because the ladder shipped with a hole nothing could see: for
// eight batches it taught 43 glyphs and WORDS used 61, so 18 Thai letters
// appeared in the vocabulary and in no batch at all. courseDecodable is a pure
// function of both, and it silently returned false forever for any word using
// one — 188 words, 19% of the course, unreachable no matter how far a learner
// got. The worst were not exotic: ์ (47 words), ุ (51), โ (39), which meant
// finishing the entire guided course still left you unable to read เบียร์ or
// โรงแรม. Beer and hotel, in Thailand.
//
// Nothing failed. Every test passed, every screen rendered, and the ladder
// simply stopped short. So the invariant is pinned here rather than trusted.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "thai-script.js", "curriculum.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"), { filename: f });

// A Thai LETTER or vowel/tone mark — the things a reading ladder is responsible
// for. Deliberately excludes digits (๐-๙) and punctuation like ฯ (paiyannoi):
// those are not spelling, and a letter ladder that pretended to teach them
// would be lying about what it covers.
const isLetter = (ch) => {
  const cp = ch.codePointAt(0);
  return (cp >= 0x0E01 && cp <= 0x0E2E) || (cp >= 0x0E30 && cp <= 0x0E4C);
};

describe("the letter ladder covers the vocabulary", () => {
  test("every Thai letter used in WORDS is taught by some batch", () => {
    const taught = taughtGlyphs(LETTER_BATCHES.length - 1);
    const missing = new Map();
    for (const w of WORDS)
      for (const ch of w[0])
        if (isLetter(ch) && !taught.has(ch)) missing.set(ch, (missing.get(ch) || 0) + 1);
    const report = [...missing].sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c} (U+${c.codePointAt(0).toString(16).toUpperCase()}, ${n} words)`).join(", ");
    assert.equal(missing.size, 0,
      `untaught letters block words from ever being decodable: ${report}`);
  });

  test("the full ladder makes almost all of WORDS decodable", () => {
    const n = courseDecodable(LETTER_BATCHES.length - 1, WORDS).length;
    // Not 100%: a couple of entries carry ฯ or a Thai digit, which the ladder
    // correctly does not teach as letters. 99% is the real ceiling.
    assert.ok(n / WORDS.length > 0.98,
      `only ${n} of ${WORDS.length} words decodable after the whole ladder`);
  });

  test("every batch has a COURSE unit that teaches it", () => {
    // Adding a rung to LETTER_BATCHES without a matching COURSE entry makes it
    // unreachable: placement walks batches, the spine walks units, and a batch
    // no unit names is taught to nobody.
    for (let b = 0; b < LETTER_BATCHES.length; b++)
      assert.ok(COURSE.some(u => u.kind === "letters" && u.batch === b),
        `batch ${b} (${LETTER_BATCHES[b].id}) has no COURSE unit`);
  });

  test("no glyph is taught twice", () => {
    const seen = new Set();
    for (const b of LETTER_BATCHES)
      for (const g of b.glyphs) {
        assert.ok(!seen.has(g), `${g} is taught in more than one batch (${b.id})`);
        seen.add(g);
      }
  });
});

describe("script notes", () => {
  // A note explains how Thai is WRITTEN — where the vowel sits, why ร is silent
  // — hung on a real word. If its anchor is not decodable at that rung, the
  // card shows a learner letters they have not met, which is exactly the
  // confusion the note exists to remove.
  const noted = LETTER_BATCHES.map((b, i) => [i, b]).filter(([, b]) => b.note);

  test("there is at least one, and each is anchored to a real word", () => {
    assert.ok(noted.length >= 3, "the placement concepts are the point");
    for (const [, b] of noted) {
      const w = WORDS.find(x => x[0] === b.note.word);
      assert.ok(w, `${b.id}'s note anchors on ${b.note.word}, which is not in WORDS`);
      assert.equal(w[1], b.note.rom, `${b.id}: note romanisation disagrees with WORDS`);
    }
  });

  // A persona who does not read prose found this: a note is only teaching if
  // the unit it opens goes on to SHOW the thing. The unwritten-vowel note sat
  // on batch 4 whose eight new words contain no unwritten vowel at all, and
  // anchored on ตลาด, which no batch ever teaches — so the rule was stated,
  // never demonstrated, and never asked. Decodable is not enough; it has to be
  // a word the learner actually meets in that unit.
  test("each note's word is one the unit actually teaches", () => {
    for (const [i, b] of noted) {
      const fresh = courseNewWords(i).slice(0, 8).map(w => w[0]);
      assert.ok(fresh.includes(b.note.word),
        `${b.id}: note anchors on ${b.note.word}, but batch ${i} teaches ${fresh.join(" ")}`);
    }
  });

  // CLAUDE.md: a combining mark with no base character renders as a dotted
  // circle where the font has U+25CC and as tofu where it does not. Two notes
  // shipped with one — "ู in ดู hangs underneath" and "the curl — ์ — above
  // it" — in the exact sentence pointing AT the mark, which is the worst place
  // for it to be unreadable.
  test("no note text contains a combining mark with nothing to attach to", () => {
    const COMB = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;
    const CONS = /[\u0E01-\u0E2E]/;
    for (const [, b] of noted) {
      const t = b.note.text;
      for (let i = 0; i < t.length; i++) {
        if (!COMB.test(t[i])) continue;
        assert.ok(CONS.test(t[i - 1] || ""),
          `${b.id}: orphan ${t[i]} (U+${t.codePointAt(i).toString(16).toUpperCase()}) in "...${t.slice(Math.max(0, i - 20), i + 10)}..."`);
      }
    }
  });

  test("each note's word is decodable at its own batch", () => {
    for (const [i, b] of noted) {
      const ok = courseDecodable(i, WORDS).some(w => w[0] === b.note.word);
      assert.ok(ok, `${b.id}: ${b.note.word} needs letters not taught by batch ${i}`);
    }
  });

  test("notes carry actual prose, not a placeholder", () => {
    for (const [, b] of noted) {
      assert.ok(b.note.title && b.note.text, `${b.id}: note is missing title or text`);
      assert.ok(b.note.text.length > 80, `${b.id}: note text is too thin to teach anything`);
    }
  });
});
