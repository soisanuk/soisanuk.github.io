// Round 20 (2026-09-08) — Nat, an analyst prepping for a proficiency test
// (lens: can the score be earned without knowing the words — Quiz and the two
// flashcard directions). It could: a category-scoped quiz was passable at
// 77-99% while reading no Thai at all.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.document = undefined;
for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js",
                 "srs.js", "wordcard.js", "app.js", "sessions.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

describe("round 20 — a score that means something", () => {
  // Distractors came from all 978 words while the deck came from ONE category,
  // so in a Food quiz the answer was the only food on screen. Reading only the
  // four English glosses and remembering the topic you picked scored a mean of
  // 94.9% across 27 categories — 99% on the small ones — against 25% for a
  // coin, and all 27 scored above 75%.
  //
  // Asserted structurally, not statistically: every distractor must come from
  // the deck's own pool whenever that pool can fill the question. A sampling
  // test would need thousands of draws to be sure and could still flake.
  test("distractors come from the deck's own pool, not the whole corpus", () => {
    const bad = [];
    for (const cat of CATEGORIES) {
      const pool = CAT_WORDS[cat];
      if (!pool || pool.length < 4) continue;
      const inPool = new Set(pool.map(w => w[0]));
      for (let i = 0; i < 40; i++) {
        const word = pool[i % pool.length];
        for (const d of _quizDistractors(word, pool))
          if (!inPool.has(d[0])) bad.push(`${cat}: ${word[0]} drew ${d[0]} from outside the deck`);
      }
    }
    assert.deepEqual(bad.slice(0, 5), []);
  });

  // The two tests around this one call _quizDistractors directly, so they
  // check the function and not what quizShow HANDS it. Reverting the call site
  // to WORDS left both of them green — a check passing for the wrong reason,
  // which is the failure mode docs/persona-playtests.md warns about. This one
  // watches the call site.
  test("quizShow hands the distractor builder the session's own deck", () => {
    const src = readFileSync(new URL("../../web/js/sessions.js", import.meta.url), "utf8");
    const show = /function quizShow\(\)[\s\S]*?\n}/.exec(src);
    assert.ok(show, "quizShow should exist");
    const call = /_quizDistractors\(([^)]*)\)/.exec(show[0]);
    assert.ok(call, "quizShow should build distractors");
    assert.match(call[1], /session\.wordList/,
      "passing WORDS makes every topic quiz answerable from the topic");
  });

  // The tell, measured the way the round measured it. A blind player picks the
  // one option belonging to the topic they chose; if several do, they guess
  // among them. With the pool scoped this collapses to chance.
  test("a player who reads no Thai scores about what a coin scores", () => {
    const worst = [];
    for (const cat of CATEGORIES) {
      const pool = CAT_WORDS[cat];
      if (!pool || pool.length < 4) continue;
      let score = 0, n = 400;
      for (let i = 0; i < n; i++) {
        const word = pool[Math.floor(Math.random() * pool.length)];
        const choices = shuffle([word, ..._quizDistractors(word, pool)]);
        const matching = choices.filter(c => c[4] === cat);
        score += matching.length ? (matching.includes(word) ? 1 / matching.length : 0) : 0.25;
      }
      const pct = 100 * score / n;
      if (pct > 45) worst.push(`${cat}: blind score ${pct.toFixed(0)}%`);
    }
    assert.deepEqual(worst, [], "a topic quiz must not be answerable from the topic");
  });

  // _buildRatingHandler requeues a lapsed card into the same deck, so
  // deck.length grows as you relearn. A learner given 20 cards who cleared all
  // 20 was told "Reviewed: 29 · Rated ≥ OK: 20 · 69%" — working harder
  // in-session lowered the score. sessionProgress was added for this by the
  // 2026-08-30 lapsed round and wired into two of the five counters.
  test("every requeuing mode counts distinct cards, not deck entries", () => {
    // Only the rating-based modes requeue — Quiz, the browse drill and the
    // tone drill have no rating handler, so deck.length is correct for them.
    // These four render a counter over a deck that _buildRatingHandler grows.
    const src = readFileSync(new URL("../../web/js/sessions.js", import.meta.url), "utf8");
    const bad = [];
    for (const fn of ["flashShow", "_scriptFlashShow", "srsShow", "sentSrsShow"]) {
      const m = new RegExp(`function ${fn}\\([^)]*\\)[\\s\\S]*?\\n}`).exec(src);
      assert.ok(m, `${fn} should exist`);
      if (!/sessionProgress\(/.test(m[0]))
        bad.push(`${fn} renders its counter from the raw deck`);
    }
    const app = readFileSync(new URL("../../web/js/app.js", import.meta.url), "utf8");
    const end = /function showSessionEnd\([^)]*\)[\s\S]*?\n}/.exec(app);
    assert.ok(end, "showSessionEnd should exist");
    // strip comments first — the comment explaining this bug names deck.length
    const code = end[0].split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    if (/deck\.length/.test(code))
      bad.push("showSessionEnd scores against deck.length, which grows on a lapse");
    assert.deepEqual(bad, []);
  });

  // And the arithmetic itself, on the shape that broke it.
  test("five cards, three relearned, all passed, reads 100%", () => {
    const keys = WORDS.slice(0, 5).map(w => w[0]);
    const deck = [...keys, keys[0], keys[1], keys[2]];
    assert.equal(new Set(deck).size, 5, "eight entries, five cards");
    const sp = sessionProgress(deck, deck.length);
    assert.equal(sp.total, 5, "the denominator is cards, not ratings");
    assert.equal(sp.done, 5);
  });
});
