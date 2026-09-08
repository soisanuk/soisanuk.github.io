// Round 21 (2026-09-08) — Owen, who reads Thai but freezes producing it
// (lens: production vs recognition, Sentence SRS). The one mode where you rate
// yourself was also the one that handed you the answer first — three separate
// ways, before you had touched anything. It could not be failed.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.document = undefined;
for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js",
                 "srs.js", "wordcard.js", "app.js", "sessions.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

describe("round 21 — the card must not give away its answer", () => {
  // _sentBlankRtgs split on /(\s+|-)/ and compared whole tokens, so a
  // hyphenated target could never equal itself: "mâi-dii" became mâi, -, dii.
  // ZERO of the corpus's 525 multi-syllable targets were ever blanked and 517
  // of 960 cards printed the answer verbatim under its own blank — 54.8%.
  //
  // The existing corpus sweep in sessions.test.js could not see it: it calls
  // _sentBlankThai only, and both _sentBlankRtgs unit tests used single-
  // syllable targets ("hǎa", "dii") — the one shape that worked. A check
  // written against the half of the implementation that was correct.
  test("no card leaks its answer, in either script, anywhere in the corpus", () => {
    const leaks = [];
    for (const key of Object.keys(EXAMPLES)) {
      const word = WORD_MAP[key];
      if (!word) continue;
      const [th, rom] = EXAMPLES[key];
      const target = wordLiteral(key), targetRom = wordLiteral(word[1]);
      const bt = _sentBlankThai(th, target), br = _sentBlankRtgs(rom, targetRom);
      if (th.includes(target) && bt.includes(target))
        leaks.push(`${key}: Thai answer still visible — ${bt}`);
      // Syllable-bounded, like the blanker: แขน's "khǎen" appears inside the
      // different word "khǎeng-raeng", and a raw substring test calls that a
      // leak when the answer is in fact blanked.
      const shown = br.replace(/<[^>]*>/g, "");
      const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const bounded = new RegExp("(^|[\\s-])" + esc(targetRom).replace(/[-\s]+/g, "[\\s-]") +
                                 "(?=[\\s-]|[.,!?;:]|$)", "i");
      if (bounded.test(shown))
        leaks.push(`${key}: romanised answer still visible — ${br}`);
    }
    assert.deepEqual(leaks, []);
  });

  // The blank used to CONTAIN the answer, hidden only by `color: transparent`:
  // in the DOM, selectable by a drag, read out by a screen reader, and sizing
  // its own box so the width told you the word's length. A test asserted it
  // belonged there "for the reveal to read" — but sentSrsReveal only toggles
  // #sent-answer-area, which holds its own copy, and no rule un-hides the span.
  test("the blank is a fixed placeholder, not the hidden answer", () => {
    const out = _sentBlankThai("เขากำลังหากระเป๋าของเขา", "หา");
    assert.ok(!out.includes("หา"), "the answer is not in the DOM");
    assert.ok(out.includes("＿＿"), "a placeholder stands in its place");
    // every blank the same width, whatever it hides
    const long = _sentBlankThai("ผมชอบกรุงเทพมหานคร", "กรุงเทพมหานคร");
    assert.equal((long.match(/＿＿/g) || []).length, 1);
    assert.ok(!long.includes("กรุงเทพ"), "a long answer is no wider a hint than a short one");
  });

  // It spoke the WHOLE sentence, blanked word included, 600ms after the card
  // appeared — before reveal, before rating, on all 960 cards, with no way to
  // mute it. learn.js's _wClozeX drills the identical card and speaks it as its
  // onRight callback. Asserted on the source because the speech path is
  // DOM-bound; asserted on the OPERATION — where the call sits, not that some
  // string is present.
  test("the sentence is spoken on reveal, never before it", () => {
    const src = readFileSync(new URL("../../web/js/sessions.js", import.meta.url), "utf8");
    const show = /function sentSrsShow\(\)[\s\S]*?\n}/.exec(src);
    const reveal = /function sentSrsReveal\(\)[\s\S]*?\n}/.exec(src);
    assert.ok(show && reveal, "both functions should exist");
    assert.ok(!/_tts\.speak/.test(show[0]),
      "sentSrsShow must not speak — that reads the answer out before you answer");
    assert.ok(/_tts\.speak/.test(reveal[0]),
      "sentSrsReveal is where the sentence gets spoken");
  });
});
