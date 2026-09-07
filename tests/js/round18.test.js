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

for (const f of ["data.js", "tokeniser.js", "thai-script.js", "connect4.js"])
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
});
