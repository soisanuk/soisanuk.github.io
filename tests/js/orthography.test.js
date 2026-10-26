// Tests for the Hidden letters chart (HIDDEN_RULES in web/js/numbers.js),
// added 2026-10-26 from a reference guide the user brought in. The guide was
// mostly right and wrong in three places — and it hand-typed its
// romanisations in four different systems. The lesson from Soi Buakhao, whose
// 499 stored syllables drifted for weeks with nothing checking them, is that
// romanised content needs an agreement check from the day it ships. These are
// those checks.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.document = undefined;
for (const f of ["data.js", "thai-script.js", "gloss-th.js", "srs.js", "wordcard.js", "app.js", "numbers.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"), { filename: f });

const COURSE_ROM = new Map(WORDS.map(w => [w[0], w[1]]));
const DICT_ROM = new Map();
for (const line of THAI_GLOSS.split("\n")) {
  const [th, , rom] = line.split("\t");
  if (th && !DICT_ROM.has(th)) DICT_ROM.set(th, rom || "");
}
const MARK = { "̀": "low", "̂": "falling", "́": "high", "̌": "rising" };
const toneOf = rom => { for (const c of rom.normalize("NFD")) if (MARK[c]) return MARK[c]; return "mid"; };
const examples = HIDDEN_RULES.flatMap(r => r.ex.map(e => ({ ...e, rule: r.title })));

describe("the Hidden letters chart", () => {
  test("it was read, and every rule carries at least two examples", () => {
    assert.ok(HIDDEN_RULES.length >= 9, `only ${HIDDEN_RULES.length} rules`);
    for (const r of HIDDEN_RULES) assert.ok(r.ex.length >= 2, `${r.title} has ${r.ex.length} example`);
  });

  test("every romanisation is the course's, else the shipped dictionary's", () => {
    // Course data wins where a word is a course word, which is the same rule
    // the rest of the app follows. A word in neither source cannot be checked,
    // so it is not allowed in.
    const bad = [];
    for (const e of examples) {
      const want = COURSE_ROM.has(e.th) ? COURSE_ROM.get(e.th) : DICT_ROM.get(e.th);
      if (!want) bad.push(`${e.th}: in neither the course nor the dictionary — cannot be checked`);
      else if (e.rom !== want) bad.push(`${e.th}: chart says "${e.rom}", source says "${want}"`);
    }
    assert.deepEqual(bad, []);
  });

  test("every 'on its own' tone is the engine's", () => {
    for (const e of examples.filter(x => x.alone))
      assert.equal(syllableTone(e.alone[0]), e.alone[1], `${e.th}: ${e.alone[0]} on its own`);
  });

  test("every leader really changes the tone — which is the whole point of the rule", () => {
    // The tone of the led syllable, read from the pinned romanisation, must
    // differ from what that syllable would be on its own. The led syllable is
    // the LAST one: ห and อ examples are single syllables, and a said leader is
    // the leader plus one syllable. The first version stored an index per
    // example instead, and mutation showed the cost: pointing ถนน at the wrong
    // syllable still passed, because "thà" also differs from mid. An index
    // the test takes from the data cannot catch that data being wrong.
    for (const e of examples.filter(x => x.alone)) {
      const sylls = e.rom.split("-");
      assert.ok(sylls.length <= 2, `${e.th}: a led example should be one syllable, or a leader plus one`);
      const led = toneOf(sylls[sylls.length - 1]);
      assert.notEqual(led, e.alone[1], `${e.th}: the leader leaves ${e.alone[0]} at ${led}`);
    }
  });

  test("the three corrections to the source guide stay corrected", () => {
    const rule = t => HIDDEN_RULES.find(r => r.title === t);
    // 1. อ นำ moves ย to MID class — the guide said low.
    assert.match(rule("Silent อ leads").body, /MID-class/);
    assert.doesNotMatch(rule("Silent อ leads").body, /low[- ]class/i);
    // 2. A final ร with no vowel reads -oon — the guide said นคร is "na-khon".
    assert.equal(examples.find(e => e.th === "นคร").rom, "ná-khoon");
    // 3. The omission that matters most: a leader that IS said.
    assert.ok(rule("Leaders you DO say").ex.some(e => e.th === "ถนน" && e.rom === "thà-nǒn"));
  });
});
