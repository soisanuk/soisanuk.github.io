// Tests for the SM-2 SRS engine in web/js/srs.js.
// The real source file is evaluated via node:vm (it's a classic browser
// script, not a module), so these tests exercise exactly the code that ships.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Evaluate in this realm so returned objects share our prototypes
vm.runInThisContext(
  readFileSync(new URL("../../web/js/srs.js", import.meta.url), "utf8"),
  { filename: "srs.js" }
);
const {
  defaultCard, getCard, peekCard, reviewCard,
  dueCards, newCards, requeue, dueForecast, srsStats,
} = globalThis;

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCard(overrides = {}) {
  return { ...defaultCard(), ...overrides };
}

// ── reviewCard ────────────────────────────────────────────────────────────────

describe("reviewCard", () => {
  test("perfect score increments repetitions", () => {
    const card = makeCard();
    reviewCard(card, 5);
    assert.equal(card.repetitions, 1);
  });

  test("first good review sets interval to 1", () => {
    const card = makeCard();
    reviewCard(card, 4);
    assert.equal(card.interval, 1);
  });

  test("second good review sets interval to 6", () => {
    const card = makeCard({ repetitions: 1, interval: 1 });
    reviewCard(card, 4);
    assert.equal(card.interval, 6);
  });

  test("third review multiplies by ease factor", () => {
    const card = makeCard({ repetitions: 2, interval: 6, easeFactor: 2.5 });
    reviewCard(card, 4);
    assert.equal(card.interval, Math.round(6 * 2.5));
  });

  test("wrong answer resets repetitions and interval", () => {
    const card = makeCard({ repetitions: 5, interval: 20 });
    reviewCard(card, 1);
    assert.equal(card.repetitions, 0);
    assert.equal(card.interval, 1);
  });

  test("wrong answer resets correct streak", () => {
    const card = makeCard({ correctStreak: 7 });
    reviewCard(card, 2);
    assert.equal(card.correctStreak, 0);
  });

  test("correct answer increments correct streak", () => {
    const card = makeCard({ correctStreak: 3 });
    reviewCard(card, 3);
    assert.equal(card.correctStreak, 4);
  });

  test("ease factor increases on perfect score", () => {
    const card = makeCard({ easeFactor: 2.5 });
    reviewCard(card, 5);
    assert.ok(card.easeFactor > 2.5);
  });

  test("ease factor decreases on hard", () => {
    const card = makeCard({ easeFactor: 2.5 });
    reviewCard(card, 2);
    assert.ok(card.easeFactor < 2.5);
  });

  test("ease factor never drops below 1.3", () => {
    const card = makeCard({ easeFactor: 1.3 });
    for (let i = 0; i < 10; i++) reviewCard(card, 0);
    assert.ok(card.easeFactor >= 1.3);
  });

  test("due date is set in the future", () => {
    const card = makeCard();
    const before = Date.now() / 1000;
    reviewCard(card, 4);
    assert.ok(card.due > before);
  });

  test("totalReviews increments", () => {
    const card = makeCard({ totalReviews: 3 });
    reviewCard(card, 4);
    assert.equal(card.totalReviews, 4);
  });

  test("quality 3 counts as correct", () => {
    const card = makeCard();
    reviewCard(card, 3);
    assert.equal(card.repetitions, 1);
  });

  test("quality 2 counts as wrong", () => {
    const card = makeCard({ repetitions: 3 });
    reviewCard(card, 2);
    assert.equal(card.repetitions, 0);
  });
});

// ── getCard / peekCard ────────────────────────────────────────────────────────

describe("getCard", () => {
  test("returns default card for new key", () => {
    const p = {};
    const card = getCard(p, "ไป");
    assert.equal(card.repetitions, 0);
    assert.equal(card.easeFactor, 2.5);
  });

  test("inserts new key into progress", () => {
    const p = {};
    getCard(p, "ไป");
    assert.ok("ไป" in p);
  });

  test("returns existing card unchanged", () => {
    const p = { "ไป": makeCard({ repetitions: 3 }) };
    assert.equal(getCard(p, "ไป").repetitions, 3);
  });

  test("does not overwrite existing card", () => {
    const p = { "ไป": makeCard({ interval: 21 }) };
    getCard(p, "ไป");
    assert.equal(p["ไป"].interval, 21);
  });
});

describe("peekCard", () => {
  test("returns default card for new key without inserting", () => {
    const p = {};
    const card = peekCard(p, "ไป");
    assert.equal(card.repetitions, 0);
    assert.ok(!("ไป" in p));
  });

  test("returns existing card", () => {
    const p = { "ไป": makeCard({ repetitions: 3 }) };
    assert.equal(peekCard(p, "ไป").repetitions, 3);
  });
});

// ── dueCards ──────────────────────────────────────────────────────────────────

describe("dueCards", () => {
  test("past-due card is included", () => {
    const p = { "ไป": makeCard({ due: Date.now() / 1000 - 10 }) };
    assert.ok(dueCards(p, ["ไป"]).includes("ไป"));
  });

  test("future card is excluded", () => {
    const p = { "ไป": makeCard({ due: Date.now() / 1000 + 86400 }) };
    assert.ok(!dueCards(p, ["ไป"]).includes("ไป"));
  });

  test("unseen card is excluded (that's newCards' job)", () => {
    assert.ok(!dueCards({}, ["ไป"]).includes("ไป"));
  });

  test("does not create records in the progress store", () => {
    const p = {};
    dueCards(p, ["ไป", "มา", "ดี"]);
    assert.deepEqual(Object.keys(p), []);
  });

  test("only requested keys are checked", () => {
    const p = {
      "ไป": makeCard({ due: Date.now() / 1000 - 1 }),
      "มา": makeCard({ due: Date.now() / 1000 - 1 }),
    };
    const result = dueCards(p, ["ไป"]);
    assert.ok(!result.includes("มา"));
  });

  test("empty keys returns empty array", () => {
    assert.deepEqual(dueCards({}, []), []);
  });
});

// ── newCards ──────────────────────────────────────────────────────────────────

describe("newCards", () => {
  test("unseen key is new", () => {
    assert.ok(newCards({}, ["ไป"]).includes("ไป"));
  });

  test("seen key is not new", () => {
    const p = { "ไป": makeCard({ repetitions: 1 }) };
    assert.ok(!newCards(p, ["ไป"]).includes("ไป"));
  });

  test("zero repetitions counts as new", () => {
    const p = { "ไป": makeCard({ repetitions: 0 }) };
    assert.ok(newCards(p, ["ไป"]).includes("ไป"));
  });

  test("limit is respected", () => {
    const keys = Array.from({ length: 50 }, (_, i) => String(i));
    assert.equal(newCards({}, keys, 5).length, 5);
  });

  test("default limit is 10", () => {
    const keys = Array.from({ length: 50 }, (_, i) => String(i));
    assert.equal(newCards({}, keys).length, 10);
  });
});

// ── requeue (same-session relearning) ─────────────────────────────────────────

describe("requeue", () => {
  test("inserts the card gap positions ahead", () => {
    const deck = ["a", "b", "c", "d", "e", "f", "g"];
    const at = requeue(deck, 0, "a");
    assert.equal(at, 4);
    assert.equal(deck[4], "a");
    assert.equal(deck.length, 8);
  });

  test("clamps to end of deck when near the end", () => {
    const deck = ["a", "b"];
    const at = requeue(deck, 1, "b");
    assert.equal(at, 2);
    assert.deepEqual(deck, ["a", "b", "b"]);
  });

  test("custom gap is honoured", () => {
    const deck = ["a", "b", "c", "d", "e"];
    requeue(deck, 1, "b", 2);
    assert.equal(deck[3], "b");
  });

  test("does not disturb cards before the insertion point", () => {
    const deck = ["a", "b", "c", "d", "e", "f"];
    requeue(deck, 2, "c");
    assert.deepEqual(deck.slice(0, 5), ["a", "b", "c", "d", "e"]);
  });
});

// ── dueForecast ───────────────────────────────────────────────────────────────

describe("dueForecast", () => {
  const now = () => Date.now() / 1000;

  test("empty progress gives all-zero buckets", () => {
    assert.deepEqual(dueForecast({}, 7), [0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("overdue and due-now cards land in bucket 0", () => {
    const p = {
      a: makeCard({ due: now() - 99999 }),
      b: makeCard({ due: now() - 1 }),
    };
    assert.equal(dueForecast(p, 7)[0], 2);
  });

  test("card due tomorrow lands in bucket 1", () => {
    const p = { a: makeCard({ due: now() + 86400 / 2 }) };
    assert.equal(dueForecast(p, 7)[1], 1);
  });

  test("card due in 3 days lands in bucket 3", () => {
    const p = { a: makeCard({ due: now() + 2.5 * 86400 }) };
    assert.equal(dueForecast(p, 7)[3], 1);
  });

  test("card beyond the horizon is not counted", () => {
    const p = { a: makeCard({ due: now() + 30 * 86400 }) };
    assert.deepEqual(dueForecast(p, 7), [0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("returns days + 1 buckets", () => {
    assert.equal(dueForecast({}, 14).length, 15);
  });
});

// ── srsStats ──────────────────────────────────────────────────────────────────

describe("srsStats", () => {
  test("empty progress returns zeros", () => {
    assert.deepEqual(srsStats({}), { totalSeen: 0, dueNow: 0, mature: 0 });
  });

  test("counts total seen", () => {
    const p = { a: makeCard(), b: makeCard() };
    assert.equal(srsStats(p).totalSeen, 2);
  });

  test("counts due cards", () => {
    const p = {
      a: makeCard({ due: Date.now() / 1000 - 1 }),
      b: makeCard({ due: Date.now() / 1000 + 86400 }),
    };
    assert.equal(srsStats(p).dueNow, 1);
  });

  test("counts mature cards (interval >= 21)", () => {
    const p = {
      a: makeCard({ interval: 21 }),
      b: makeCard({ interval: 20 }),
      c: makeCard({ interval: 100 }),
    };
    assert.equal(srsStats(p).mature, 2);
  });

  test("mature threshold is exactly 21 days", () => {
    const p = { a: makeCard({ interval: 21 }) };
    assert.equal(srsStats(p).mature, 1);
    p.a.interval = 20;
    assert.equal(srsStats(p).mature, 0);
  });
});
