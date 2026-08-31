// Tests for the pure helpers behind the desktop home pane (web/js/home.js).
// _homeRender itself drives the DOM and is exercised in the browser; the
// decisions it renders — what Continue is about to do, which numbers matter,
// how the forecast scales, which words to show — are all pure and live here.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// home.js reads srs.js/learn.js state at call time; load the same stack the
// browser has. wordcard.js supplies _wcEsc (home.js's _homeEsc delegates).
global.localStorage = (() => {
  const s = new Map();
  return { getItem: k => (s.has(k) ? s.get(k) : null), setItem: (k, v) => s.set(k, String(v)), removeItem: k => s.delete(k) };
})();
// examples.js supplies EXAMPLES, which srsKeySets() needs to build the
// "sent:" namespace — without it the sentence branch is silently untestable.
for (const f of ["data.js", "examples.js", "srs.js", "wordcard.js", "app.js", "curriculum.js", "learn.js", "home.js"]) {
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"), { filename: f });
}

// ── homeCta: the card must announce exactly what the button will do ────────

describe("homeCta", () => {
  test("announces the review count when reviews are what Continue would run", () => {
    const c = homeCta({ kind: "review", due: [1, 2, 3, 4] }, { days: 0 });
    assert.match(c.title, /^4 reviews ready$/);
  });

  test("singularises a lone review", () => {
    assert.match(homeCta({ kind: "review", due: [1] }, {}).title, /^1 review ready$/);
  });

  test("nudges the streak only when there is one to keep", () => {
    assert.match(homeCta({ kind: "review", due: [1, 2, 3] }, { days: 5 }).sub, /streak/);
    assert.doesNotMatch(homeCta({ kind: "review", due: [1, 2, 3] }, { days: 0 }).sub, /streak/);
  });

  test("names the actual next unit when that's what Continue would open", () => {
    const c = homeCta({ kind: "unit", unitIdx: 2, unit: { label: "Read: the first six letters" } }, {});
    assert.equal(c.title, "Read: the first six letters");
    assert.match(c.sub, /next lesson/);
  });

  test("falls back to the speed round when everything is caught up", () => {
    assert.equal(homeCta({ kind: "speed" }, {}).title, "Speed round");
  });

  test("script and sentence reviews get their own card, not the vocab one", () => {
    const sc = homeCta({ kind: "script", n: 30 }, {});
    assert.match(sc.title, /30 script reviews ready/);
    const one = homeCta({ kind: "script", n: 1 }, {});
    assert.match(one.title, /^1 script review ready$/, "singular, not '1 script reviews'");
    assert.match(homeCta({ kind: "sentence", n: 4 }, {}).title, /4 sentence reviews ready/);
  });

  test("a missing plan still yields a usable card, never blank", () => {
    const c = homeCta(null, {});
    assert.ok(c.title.length > 0 && c.sub.length > 0);
  });
});

// continuePlan is the shared decision — if the card and the button ever
// computed it separately they would drift, so pin that they agree in shape.
const PLAN_KINDS = ["review", "script", "sentence", "unit", "speed"];

test("continuePlan returns a kind the CTA knows how to render", () => {
  const plan = continuePlan();
  assert.ok(PLAN_KINDS.includes(plan.kind));
  const c = homeCta(plan, {});
  assert.ok(c.title && c.sub, "every plan kind renders a title and subtitle");
});

// The list above is only worth anything if EVERY kind is actually rendered —
// a new kind that homeCta forgot would otherwise fall through to the "Speed
// round" default and quietly mislabel the button.
test("every plan kind renders a distinct, non-default card", () => {
  const sample = {
    review: { kind: "review", due: [1, 2, 3] },
    script: { kind: "script", n: 5 },
    sentence: { kind: "sentence", n: 5 },
    unit: { kind: "unit", unitIdx: 0, unit: { label: "Read: the first six letters" } },
    speed: { kind: "speed" },
  };
  const titles = new Set();
  for (const k of PLAN_KINDS) {
    const c = homeCta(sample[k], {});
    assert.ok(c.title && c.sub, `${k} renders`);
    if (k !== "speed") {
      assert.notEqual(c.title, "Speed round", `${k} fell through to the default card`);
    }
    titles.add(c.title);
  }
  assert.equal(titles.size, PLAN_KINDS.length, "each kind gets its own title");
});

// ── homeStats ──────────────────────────────────────────────────────────────

describe("homeStats", () => {
  const srs = { totalSeen: 40, dueNow: 12, mature: 8 };
  test("surfaces due, streak, mature and unit progress", () => {
    const s = homeStats(srs, { days: 4 }, {}, [{ id: "a" }, { id: "b" }]);
    assert.deepEqual(s.map(x => x[1]), ["due now", "day streak", "mature", "units"]);
    assert.equal(s[0][0], 12);
    assert.equal(s[1][0], 4);
    assert.equal(s[2][0], 8);
  });

  test("units read as done/total", () => {
    const course = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const path = { units: { a: { done: true }, b: { done: true } } };
    assert.equal(homeStats(srs, {}, path, course)[3][0], "2/3");
  });

  test("a brand-new learner gets zeros, not undefined", () => {
    const s = homeStats({ totalSeen: 0, dueNow: 0, mature: 0 }, {}, {}, []);
    assert.deepEqual(s.map(x => x[0]), [0, 0, 0, "0/0"]);
  });
});

// ── homeForecastBars ───────────────────────────────────────────────────────

describe("homeForecastBars", () => {
  test("scales the tallest bucket to the max height", () => {
    const bars = homeForecastBars([10, 5, 0, 0], 40);
    assert.equal(bars[0].px, 40);
    assert.equal(bars[1].px, 20);
  });

  test("an all-zero forecast draws a flat baseline instead of dividing by zero", () => {
    const bars = homeForecastBars([0, 0, 0, 0]);
    assert.ok(bars.every(b => Number.isFinite(b.px) && b.px === 1),
      "a new learner with nothing scheduled must still get a valid chart");
  });

  test("a non-zero bucket never renders as invisible", () => {
    const bars = homeForecastBars([100, 1], 40);
    assert.ok(bars[1].px >= 3, "one card due should still be a visible sliver");
  });

  test("carries the raw count through for the label", () => {
    assert.deepEqual(homeForecastBars([7, 0]).map(b => b.n), [7, 0]);
  });
});

// ── homeWordPicks ──────────────────────────────────────────────────────────

describe("homeWordPicks", () => {
  const seq = () => { let i = 0; return () => ((i = (i * 9301 + 49297) % 233280), i / 233280); };

  test("prefers words you've actually met", () => {
    const prog = { [WORDS[5][0]]: { repetitions: 3 }, [WORDS[9][0]]: { repetitions: 1 } };
    const picks = homeWordPicks(WORDS, prog, 2, seq());
    assert.deepEqual(picks.map(w => w[0]).sort(), [WORDS[5][0], WORDS[9][0]].sort());
  });

  test("tops up with unseen words so a new learner still gets a full strip", () => {
    const picks = homeWordPicks(WORDS, {}, 8, seq());
    assert.equal(picks.length, 8);
    assert.equal(new Set(picks.map(w => w[0])).size, 8, "no duplicates");
  });

  test("never returns more than the corpus holds", () => {
    const tiny = WORDS.slice(0, 3);
    assert.equal(homeWordPicks(tiny, {}, 8, seq()).length, 3);
  });

  test("every pick is a real WORDS row the word-card can open", () => {
    for (const w of homeWordPicks(WORDS, {}, 8, seq())) {
      assert.ok(WORD_MAP[w[0]], `${w[0]} resolves in WORD_MAP`);
    }
  });
});

// ── continuePlan: reviews outrank new material, for all three card types ────
// The script-only learner was the case that exposed this: thirty overdue
// script cards, and Continue offered the next course lesson while every
// counter read "0 due now". Seed the store and walk each branch.

describe("continuePlan across the key namespaces", () => {
  const overdue = () => ({ interval: 5, repetitions: 2, easeFactor: 2.5,
    due: Date.now() / 1000 - 86400, totalReviews: 3, correctStreak: 1 });

  const seed = obj => localStorage.setItem("soisanuk_progress", JSON.stringify(obj));
  const clear = () => { localStorage.removeItem("soisanuk_progress"); localStorage.removeItem("soisanuk_path"); };

  test("overdue SCRIPT cards beat the next course unit", () => {
    clear();
    const keys = srsKeySets().script.slice(0, 6);
    seed(Object.fromEntries(keys.map(k => [k, overdue()])));
    const plan = continuePlan();
    assert.equal(plan.kind, "script", "script reviews must outrank a pending unit");
    assert.equal(plan.n, 6);
    clear();
  });

  test("overdue SENTENCE cards are offered too", () => {
    clear();
    const keys = srsKeySets().sentence.slice(0, 4);
    assert.ok(keys.length >= 4, "fixture needs example sentences");
    seed(Object.fromEntries(keys.map(k => [k, overdue()])));
    assert.equal(continuePlan().kind, "sentence");
    clear();
  });

  test("vocabulary keeps first claim over script", () => {
    clear();
    const vocab = srsKeySets().vocab.slice(0, 5);
    const script = srsKeySets().script.slice(0, 5);
    seed(Object.fromEntries([...vocab, ...script].map(k => [k, overdue()])));
    assert.equal(continuePlan().kind, "review");
    clear();
  });

  test("fewer than three due falls through to the course, not a stub session", () => {
    clear();
    seed(Object.fromEntries(srsKeySets().script.slice(0, 2).map(k => [k, overdue()])));
    assert.equal(continuePlan().kind, "unit");
    clear();
  });
});
