// Round 23 (2026-09-09) — Jesse, a good ear and no Thai (lens: is the
// listening drill passable by looking — Tone Drill and the two Browse
// screens). It is not gameable, which was the hypothesis. What it did instead
// was explain the answer wrongly, and teach tones without playing any.
//
// NOTE: the two fixes these guard landed in 943ba4d, whose message describes
// only the backup restore. They rode along in web/js/sessions.js and should
// have been their own commit.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.document = undefined;
for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js",
                 "curriculum.js", "srs.js", "wordcard.js", "app.js", "sessions.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

describe("round 23 — the drill must not teach the wrong rule", () => {
  // The answer key is toneOfWord, which honours TONE_EXCEPTIONS (ก็ falling,
  // แอป high). The reveal line was built from syllableToneInfo, which derives
  // from the spelling alone and knows nothing about them — so on those two
  // words it printed a CORRECT RULE WRONGLY APPLIED: "mid class + no mark →
  // LOW tone" under a green "Correct!" on a card whose key is falling.
  //
  // The rule line is the entire pedagogy of this drill; everything else is a
  // five-way button press. 43% of 100-card sessions draw one of the two.
  //
  // It regressed on 2026-09-05, when TONE_EXCEPTIONS moved into toneOfWord to
  // fix a tone COLOUR on another screen. Before that the two sides disagreed
  // and the pool filter excluded both words — so the bug that filter's own
  // comment describes as fixed came back through a different door, which is
  // why this guards the agreement rather than the two words.
  test("the reveal never contradicts the answer key", () => {
    const bad = [];
    for (const w of WORDS) {
      const key = toneOfWord(w[0]);
      if (!key) continue;
      const info = syllableToneInfo(w[0]);
      if (!info || !info.tone || info.tone === key) continue;
      const line = _toneRuleLine(w[0]);
      const claimed = (TONE_LABELS[info.tone] || info.tone).toUpperCase();
      if (line.includes(`→ ${claimed} tone`))
        bad.push(`${w[0]} (${w[1]}): key ${key}, line says "${line}"`);
    }
    assert.deepEqual(bad, [],
      "a word whose tone is an exception must not be given the derivation that contradicts it");
  });

  test("the exception words say so, in both directions", () => {
    for (const [th, spoken] of [["ก็", "FALLING"], ["แอป", "HIGH"]]) {
      const line = _toneRuleLine(th);
      assert.match(line, /exception/, `${th} should be named as an exception`);
      assert.ok(line.includes(spoken), `${th} should say it is spoken ${spoken}`);
    }
    // and an ordinary word still gets its derivation
    assert.match(_toneRuleLine("ห้า"), /high class .* → FALLING tone/);
  });

  // Browse — Vowels & Tones speaks each entry. The five TONE rows have no ◌,
  // so the speak choice fell through to the tone's NAME: the falling row said
  // "โท", which is itself a mid-tone word. The example word — the only thing
  // on the card that carries the tone — was never spoken. The Reference
  // Charts render the same five rows and carry an explicit `speak:` per row;
  // this screen was left behind when that was fixed.
  test("a tone row speaks its example word, not the tone's name", () => {
    // Runs the function's own decision rather than reading it. The previous
    // version regexed the source for `exampleWord || symbol`; a mutation that
    // KEPT that string and made exampleWord always empty put the bug straight
    // back and the test stayed green. Found by the 2026-09-09 behaviour audit.
    const src = readFileSync(new URL("../../web/js/sessions.js", import.meta.url), "utf8");
    const body = /function drillShowVowelTone\(\)[\s\S]*?\n}/.exec(src);
    assert.ok(body, "drillShowVowelTone should exist");
    // lift the speak-choice expression out and evaluate it per row
    const expr = /const named = letterSpeech\(symbol\);[\s\S]*?: exampleWord \|\| symbol;/.exec(body[0]);
    assert.ok(expr, "the speak choice should still be one expression");
    const decide = new Function("symbol", "example", "letterSpeech", "letterSpeechParts",
      expr[0] + "\nreturn speakText;");
    for (const t of TONES) {
      const spoken = decide(t[0], t[3], letterSpeech, letterSpeechParts);
      const example = (t[3].match(/^([^\s(（]+)/) || [])[1];
      assert.ok(example && /[฀-๿]/.test(example),
        `tone row ${t[0]} needs a Thai example to speak, got "${t[3]}"`);
      assert.equal(spoken, example,
        `the ${t[0]} row must speak ${example}, not "${spoken}" — the tone's NAME carries its own tone`);
    }
    // and the vowel rows must be unaffected
    const v = VOWELS.find(x => x[0] === "◌า");
    assert.notEqual(decide(v[0], v[3], letterSpeech, letterSpeechParts), v[3],
      "a vowel row still speaks its sound, not its raw example string");
  });
});
