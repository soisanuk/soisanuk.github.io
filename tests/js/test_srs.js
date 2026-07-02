// Tests for the SM-2 SRS logic mirrored in web/js/srs.js
// Run with: node --test tests/js/test_srs.js

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── inline the SRS logic (mirrors srs.js exactly) ────────────────────────────

function defaultCard() {
  return { interval: 1, repetitions: 0, easeFactor: 2.5, due: 0, totalReviews: 0, correctStreak: 0 };
}

function getCard(p, key) {
  if (!p[key]) p[key] = defaultCard();
  return p[key];
}

function reviewCard(card, quality) {
  const now = Date.now() / 1000;
  card.totalReviews++;
  if (quality >= 3) {
    if (card.repetitions === 0) card.interval = 1;
    else if (card.repetitions === 1) card.interval = 6;
    else card.interval = Math.round(card.interval * card.easeFactor);
    card.repetitions++;
    card.correctStreak++;
  } else {
    card.repetitions = 0;
    card.interval = 1;
    card.correctStreak = 0;
  }
  card.easeFactor = Math.max(1.3,
    card.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  card.due = now + card.interval * 86400;
}

function dueCards(p, keys) {
  const now = Date.now() / 1000;
  return keys.filter(k => getCard(p, k).due <= now);
}

function newCards(p, keys, limit = 10) {
  return keys.filter(k => !p[k] || p[k].repetitions === 0).slice(0, limit);
}

function srsStats(p) {
  const now = Date.now() / 1000;
  const cards = Object.values(p);
  return {
    totalSeen: cards.length,
    dueNow: cards.filter(c => c.due <= now).length,
    mature: cards.filter(c => c.interval >= 21).length,
  };
}

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

// ── getCard ───────────────────────────────────────────────────────────────────

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

  test("unseen card (due=0) is included", () => {
    assert.ok(dueCards({}, ["ไป"]).includes("ไป"));
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
