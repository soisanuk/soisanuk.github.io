// Round 25 (2026-09-09) — Aroon, fifteen months in, checks Records daily
// (lens: does it tell the truth about a long, messy history). Its numbers were
// honest; the surfaces around it disagreed with each other, and one all-time
// record could be inflated by the Undo button.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.document = undefined;
for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js",
                 "curriculum.js", "srs.js", "wordcard.js", "app.js", "learn.js", "home.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

describe("round 25 — a long history, told honestly", () => {
  // srsStats counts every namespace — 978 vocab + 63 script + 960 sentence —
  // while continuePlan counts only the one it picked. On a 15-month store the
  // home pane showed "418 reviews ready" about 60px above "714 due now", both
  // true, neither labelled, and clearing the 418 moved the tile by 296.
  // script and sentence already named their scope; vocabulary did not.
  test("a review count that is one namespace says which", () => {
    const cta = homeCta({ kind: "review", n: 418, due: new Array(10) }, {});
    assert.match(cta.title, /vocabulary/,
      "a vocabulary-only count must not read as every review due");
    // the other two kinds already did this and must keep doing it
    assert.match(homeCta({ kind: "script", n: 30 }, {}).title, /script/);
    assert.match(homeCta({ kind: "sentence", n: 4 }, {}).title, /sentence/);
    assert.match(_contText({ kind: "review", n: 418 }, { ended: true }, {}), /vocabulary/);
  });

  // homeWordPicks bucketed "met" from `repetitions`, which reviewCard zeroes on
  // any miss — so 180 lapsed words counted as never seen and fell into the
  // top-up bucket, which never gets a slot because the seen bucket alone
  // exceeds the strip's eight. Measured: 0 lapsed words in 400 slots. The
  // words most worth revisiting were the ones the strip could never show.
  //
  // ui.js was fixed for this on 2026-09-08 across four surfaces; home.js was
  // missed because the guard written for it read only ui.js. That guard now
  // reads every source (round19.test.js).
  test("a lapsed word is a word you have met", () => {
    const lapsed = { repetitions: 0, totalReviews: 12, interval: 1 };
    const prog = {};
    for (const w of WORDS.slice(0, 40)) prog[w[0]] = lapsed;
    const picks = homeWordPicks(WORDS, prog, 8, () => 0.5);
    const met = picks.filter(w => prog[w[0]]).length;
    assert.ok(met > 0,
      "lapsed words must be reachable in the strip, not sorted behind everything");
  });

  // _streakRecord bumps today.cards and can raise bestDay on every rating, and
  // undoLastRating restored the card, the index, the score and the requeue —
  // but not that. Rate/undo one card five times read as five cards, and
  // "📅 Biggest day" is an all-time monotonic record on the Records screen.
  // Undo exists to fix a misclick, so this was the normal path.
  test("undo rolls back the streak it just fed", () => {
    const src = readFileSync(new URL("../../web/js/sessions.js", import.meta.url), "utf8");
    const snap = /session\.undo = \{[\s\S]*?\};/.exec(src);
    const undo = /function undoLastRating\(\)[\s\S]*?\n}/.exec(src);
    assert.ok(snap && undo, "the snapshot and the undo should both exist");
    assert.match(snap[0], /STREAK_KEY/,
      "the undo snapshot must capture the streak before the rating feeds it");
    assert.match(undo[0], /STREAK_KEY/,
      "and undo must put it back, or Biggest day only ever climbs");
  });
});
