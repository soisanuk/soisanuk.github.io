// Round 18 (2026-09-07) — Kwan, a Thai speaker who plays games to win
// (lens: winnability + language quality, Soi Buakhao and Connect สี่).
// Soi Buakhao had never been opened by any round. It was on the Paiboon
// romanisation scheme this project has abandoned twice, all twelve of its
// hostess questions romanised the question particle with the wrong tone, and
// three files were placing their quiz options with a comparator instead of a
// shuffle.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "tokeniser.js", "thai-script.js", "connect4.js", "wordcard.js", "soi-buakhao.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

const SOI = readFileSync(new URL("../../web/js/soi-buakhao.js", import.meta.url), "utf8");
const LINES = [...SOI.matchAll(/(?:th|q):\s*"([^"]+)"\s*,\s*rom:\s*"([^"]+)"/g)];

describe("round 18 — the bar games", () => {
  // sort(() => Math.random() - 0.5) is not a shuffle: V8's sort turns it into a
  // badly skewed permutation. Over 400,000 shuffles of four items the correct
  // answer landed in slot A 28.1 per cent of the time and slot D 18.8, so a
  // learner who always picks the first option beat one who always picks the
  // last. The band is wide enough not to flake; the bug it replaces was 6
  // points out. This also catches a SUBTLE break — drawing j over the full
  // range instead of i+1 fails it.
  test("_c4Shuffle places an item in every slot equally often", () => {
    const N = 100000, hits = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) hits[_c4Shuffle([0, 1, 2, 3]).indexOf(0)]++;
    for (let i = 0; i < 4; i++) {
      const pct = 100 * hits[i] / N;
      assert.ok(Math.abs(pct - 25) < 3, `slot ${i} got ${pct.toFixed(1)}%, expected ~25%`);
    }
  });

  // Guarded on the IDIOM across every source rather than on any one file,
  // because the bug spread by copying: app.js has carried a correct
  // Fisher-Yates since the beginning and clock.js wrote its own correct one,
  // while connect4.js, baht-bus.js and soi-buakhao.js each kept a broken copy.
  test("no source uses a comparator as a shuffle", () => {
    const dir = new URL("../../web/js/", import.meta.url);
    const offenders = readdirSync(dir).filter(f => f.endsWith(".js")).filter(f =>
      /\.sort\(\s*\(\s*\)\s*=>\s*Math\.random\(\)\s*-/.test(readFileSync(new URL(f, dir), "utf8")));
    assert.deepEqual(offenders, [],
      "sort(() => Math.random() - 0.5) is a biased permutation — use a Fisher-Yates");
  });

  // soi-buakhao.js was the ONLY file in web/js carrying a Paiboon tell (gin,
  // gàp, châawp, tâwng-gaan): 16 of 75 strings, against 0 in examples.js's 960.
  // data.test.js pins the scheme for data.js and examples.js only, so the file
  // with the most original Thai prose in the repo was outside the pin.
  test("every Soi Buakhao line romanises its curriculum words the way data.js does", () => {
    const map = new Map(WORDS.map(w => [w[0], w[1]]));
    assert.ok(LINES.length >= 70, `expected the dialogue data, found ${LINES.length} lines`);
    const bad = [];
    for (const [, th, rom] of LINES)
      for (const t of _tokenise(th).filter(x => x.word).map(x => x.text)) {
        if (!map.has(t)) continue;
        const want = map.get(t).replace(/-/g, "").toLowerCase();
        if (!rom.replace(/[- ]/g, "").toLowerCase().includes(want))
          bad.push(`${th} "${rom}" — ${t} should read "${map.get(t)}"`);
      }
    assert.deepEqual(bad, []);
  });

  // ค่ะ closes a statement and is khâ, falling. คะ asks a question and is khá,
  // high. All twelve hostess questions romanised it khâ — the highest-frequency
  // particle in the language, taught with the wrong tone on every question.
  test("a question ending in คะ romanises its particle khá, not khâ", () => {
    const bad = [];
    for (const [, th, rom] of LINES) {
      if (!/คะ\s*\??\s*$/.test(th)) continue;
      const last = (rom.match(/kh[áâ]/g) || []).slice(-1)[0];
      if (last === "khâ") bad.push(`${th} → ${rom}`);
    }
    assert.deepEqual(bad, []);
  });

  // Madam Oy was fully deterministic — depth-5 negamax with fixed centre-out
  // tie-breaking — so every game against her was the identical nine moves and
  // the vowel quiz changed nothing: a sensible player lost 100% of the time at
  // 0% and at 100% quiz accuracy alike, and her three `lose:` lines could not
  // fire. She now has the same kind of mistake rate Nong and Pim already had.
  test("Madam Oy is not the same game every time", () => {
    const board = () => Array.from({ length: _C4_ROWS }, () => new Array(_C4_COLS).fill(0));
    const seen = new Set();
    for (let i = 0; i < 400; i++) seen.add(_c4AiMove(board(), 2));
    assert.ok(seen.size > 1,
      `Madam Oy opened with the same column 400 times running (${[...seen]})`);
  });

  // A mistake should cost her the long game, never hand over the short one.
  test("Madam Oy never blunders away an immediate win or an immediate block", () => {
    const at = (row, cols, who) => {
      const b = Array.from({ length: _C4_ROWS }, () => new Array(_C4_COLS).fill(0));
      for (const c of cols) b[row][c] = who;
      return b;
    };
    for (let i = 0; i < 500; i++) {
      assert.equal(_c4AiMove(at(5, [0, 1, 2], 2), 2), 3, "she must take her own win");
      assert.equal(_c4AiMove(at(5, [0, 1, 2], 1), 2), 3, "she must block the player's win");
    }
  });

  // The rate is measured, not decorative: outside this range the quiz stops
  // deciding anything (too low) or she stops being the hard tier (too high).
  test("the blunder rate is in the measured band", () => {
    assert.ok(_C4_OY_BLUNDER >= 0.15 && _C4_OY_BLUNDER <= 0.25,
      `_C4_OY_BLUNDER is ${_C4_OY_BLUNDER}`);
  });

  // Soi Buakhao was winnable without reading one Thai character. The correct
  // reply was always the elaborated, two-clause, polite one and every
  // distractor was a short deflection, so "pick the longest option" scored
  // 11/15 overall and 5/5 on night 3 — the climactic night. Twelve of twelve
  // simulated playthroughs reached the second-best ending deterministically.
  //
  // The gate is ceil(4 * 0.6) = 3 of 4, and _sbSample draws 4 of a night's 5
  // questions. So a strategy that gets 3 or more of the 5 right can land a
  // 4-subset containing them and pass; at 2 or fewer it cannot pass that night
  // no matter which 4 are drawn. Requiring every strategy to be held to 2 on at
  // least one night is therefore exactly "no length tell can reach the ending",
  // which is the thing that was broken — not a proxy for it.
  test("no length tell can carry a player through a night", () => {
    const METRICS = { th: c => c.th.length, en: c => c.en.length, rom: c => c.rom.length };
    const bad = [];
    for (const [name, len] of Object.entries(METRICS))
      for (const dir of [1, -1]) {
        const perNight = [1, 2, 3].map(n => {
          let hits = 0;
          for (const q of _SB_QS[n]) {
            const vals = q.choices.map(c => dir * len(c));
            const top = Math.max(...vals);
            const winners = q.choices.filter((c, i) => vals[i] === top);
            if (winners.length === 1 && winners[0].ok) hits++;
          }
          return hits;
        });
        const label = `${dir > 0 ? "longest" : "shortest"} ${name}`;
        if (Math.min(...perNight) > 2)
          bad.push(`${label} scores ${perNight.join("/")} — passes every night on shape alone`);
      }
    assert.deepEqual(bad, []);
  });
});
