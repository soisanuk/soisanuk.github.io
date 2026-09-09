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

  // On the day a long streak breaks, the home tile read "0 / day streak" — a
  // naked zero on the pane a daily user looks at first, with `ended` and
  // `maxDays` already in hand and discarded. Records says "0 (ended) · best
  // 256 days" from the same object.
  test("a broken streak reports the best, not a bare zero", () => {
    const ended = { days: 0, ended: true, maxDays: 256 };
    const tile = homeStats({ dueNow: 714, mature: 400 }, ended, {}, []).find(t => /streak/.test(t[1]));
    assert.equal(tile[0], 256, "the number worth showing is the one he reached");
    assert.match(tile[1], /best/, "and it must be labelled as a best, not as a current run");
    // a live streak is unchanged
    const live = homeStats({ dueNow: 5, mature: 400 }, { days: 64, maxDays: 256 }, {}, [])
      .find(t => /streak/.test(t[1]));
    assert.deepEqual(live, [64, "day streak"]);
  });

  // Bucket 0 carries everything overdue, so at any real backlog it dwarfed the
  // week: 713 against 27-57 a day put seven of eight bars on the 3px floor. A
  // chart whose only readable statement is "you have a backlog" is not a
  // forecast.
  test("a backlog does not flatten the week behind it", () => {
    const bars = homeForecastBars([713, 57, 35, 27, 49, 35, 51, 42], 34);
    const ahead = bars.slice(1).map(b => b.px);
    assert.ok(new Set(ahead).size >= 4,
      `the forward days must be distinguishable, got ${ahead.join(",")}`);
    assert.ok(ahead.every(px => px <= 34), "and none may overflow the chart");
    assert.equal(bars[0].px, 34, "today stays the tallest");
  });

  // The 🏁 heading wore .sidebar-section — the sidebar's COLLAPSIBLE nav
  // header — so it carried cursor:pointer, a hover colour, a focus outline and
  // a "▾", with no handler behind any of it. That class is also
  // display:flex/space-between, which made its inline text-align:center inert,
  // so the heading sat left in a body where everything else is centred.
  test("the fastest-reads heading is a heading, not a dead control", () => {
    const src = readFileSync(new URL("../../web/js/learn.js", import.meta.url), "utf8");
    assert.ok(!/sidebar-section[^"]*"[^`]*🏁/.test(src) && !/🏁[^`]*sidebar-section/.test(src),
      "the records/speedometer heading must not use the collapsible nav class");
    assert.equal((src.match(/class="stat-heading">🏁/g) || []).length, 2,
      "both the Records screen and the path speedometer use the plain heading");
    const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");
    const rule = /\.stat-heading\s*\{([^}]*)\}/.exec(html);
    assert.ok(rule, ".stat-heading should be defined");
    assert.ok(!/cursor:\s*pointer/.test(rule[1]), "it is not clickable");
    assert.match(rule[1], /text-align:\s*center/, "and it is centred, like the body it heads");
  });
});
