// Tests for the pure merge logic in web/js/backup.js (backupMerge,
// _streakMerge). backupSnapshot/backupExport/etc. touch localStorage and are
// exercised in the browser; these two are DOM-free and vm-testable.
// Regression coverage for a real bug: backupMerge used to return
// path:{units} only, silently dropping path.best (speed records) on every
// import, and streak wasn't part of the backup at all.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// backup.js references LEARN_KEY/STREAK_KEY (learn.js) and loadProgress/
// saveProgress (srs.js) at call time, matching the codebase's convention of
// cross-file references inside function bodies only (see baht-bus.js/game.js).
for (const f of ["srs.js", "learn.js", "backup.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}

// ── backupMerge: progress ───────────────────────────────────────────────────

describe("backupMerge / progress", () => {
  test("keeps the record with more reviews", () => {
    const mine = { progress: { "ไป": { totalReviews: 2 } }, path: {} };
    const theirs = { progress: { "ไป": { totalReviews: 5 } }, path: {} };
    assert.equal(backupMerge(mine, theirs).progress["ไป"].totalReviews, 5);
  });

  test("keeps mine when mine has more reviews", () => {
    const mine = { progress: { "ไป": { totalReviews: 9 } }, path: {} };
    const theirs = { progress: { "ไป": { totalReviews: 1 } }, path: {} };
    assert.equal(backupMerge(mine, theirs).progress["ไป"].totalReviews, 9);
  });

  test("adds a card only theirs has seen", () => {
    const mine = { progress: {}, path: {} };
    const theirs = { progress: { "มา": { totalReviews: 1 } }, path: {} };
    assert.ok("มา" in backupMerge(mine, theirs).progress);
  });
});

// ── backupMerge: path.units ──────────────────────────────────────────────────

describe("backupMerge / units", () => {
  test("done stays done even if the other side has it not-done", () => {
    const mine = { progress: {}, path: { units: { L0: { done: true, acc: 0.9 } } } };
    const theirs = { progress: {}, path: { units: { L0: { done: false, acc: 0.5 } } } };
    assert.equal(backupMerge(mine, theirs).path.units.L0.done, true);
  });

  test("keeps the higher accuracy", () => {
    const mine = { progress: {}, path: { units: { L0: { done: true, acc: 0.6 } } } };
    const theirs = { progress: {}, path: { units: { L0: { done: true, acc: 0.95 } } } };
    assert.equal(backupMerge(mine, theirs).path.units.L0.acc, 0.95);
  });

  test("a unit only theirs has done is carried over", () => {
    const mine = { progress: {}, path: { units: {} } };
    const theirs = { progress: {}, path: { units: { L3: { done: true, acc: 1 } } } };
    assert.equal(backupMerge(mine, theirs).path.units.L3.done, true);
  });
});

// ── backupMerge: path.best (the bug) ────────────────────────────────────────
// path.best is the 🏁 speedometer's personal-best ms per word. This used to
// be silently dropped by backupMerge entirely — every import erased it.

describe("backupMerge / best (regression)", () => {
  test("best survives a merge with an empty other side", () => {
    const mine = { progress: {}, path: { units: {}, best: { "กิน": 800 } } };
    const theirs = { progress: {}, path: { units: {} } };
    assert.deepEqual(backupMerge(mine, theirs).path.best, { "กิน": 800 });
  });

  test("keeps the faster (lower ms) time for a shared word", () => {
    const mine = { progress: {}, path: { best: { "กิน": 900 } } };
    const theirs = { progress: {}, path: { best: { "กิน": 650 } } };
    assert.equal(backupMerge(mine, theirs).path.best["กิน"], 650);
  });

  test("keeps mine when mine is faster", () => {
    const mine = { progress: {}, path: { best: { "กิน": 500 } } };
    const theirs = { progress: {}, path: { best: { "กิน": 900 } } };
    assert.equal(backupMerge(mine, theirs).path.best["กิน"], 500);
  });

  test("merges bests for disjoint words from both sides", () => {
    const mine = { progress: {}, path: { best: { "กิน": 800 } } };
    const theirs = { progress: {}, path: { best: { "ไป": 700 } } };
    const merged = backupMerge(mine, theirs).path.best;
    assert.deepEqual(merged, { "กิน": 800, "ไป": 700 });
  });

  test("missing path.best on both sides merges to an empty object, not undefined", () => {
    const merged = backupMerge({ progress: {}, path: {} }, { progress: {}, path: {} });
    assert.deepEqual(merged.path.best, {});
  });
});

// ── _streakMerge ─────────────────────────────────────────────────────────────

describe("_streakMerge", () => {
  test("the more recent 'last' date wins the live streak", () => {
    const mine = { last: "2026-08-10", days: 3 };
    const theirs = { last: "2026-08-14", days: 7 };
    const m = _streakMerge(mine, theirs);
    assert.equal(m.last, "2026-08-14");
    assert.equal(m.days, 7);
  });

  test("maxDays is the max across both sides, regardless of which is newer", () => {
    const mine = { last: "2026-08-10", days: 3, maxDays: 20 };
    const theirs = { last: "2026-08-14", days: 7, maxDays: 5 };
    assert.equal(_streakMerge(mine, theirs).maxDays, 20);
  });

  test("bestDay keeps whichever record has more cards", () => {
    const mine = { last: "2026-08-10", bestDay: { date: "2026-08-01", cards: 40 } };
    const theirs = { last: "2026-08-14", bestDay: { date: "2026-08-12", cards: 55 } };
    assert.deepEqual(_streakMerge(mine, theirs).bestDay, { date: "2026-08-12", cards: 55 });
  });

  test("one side missing entirely is handled", () => {
    const theirs = { last: "2026-08-14", days: 4, maxDays: 4 };
    const expected = { last: "2026-08-14", days: 4, maxDays: 4, bestDay: null, today: undefined };
    assert.deepEqual(_streakMerge(undefined, theirs), expected);
    assert.deepEqual(_streakMerge(theirs, undefined), expected);
  });

  test("both sides empty merges to no crash, no fabricated streak", () => {
    const m = _streakMerge({}, {});
    assert.equal(m.maxDays, 0);
    assert.equal(m.bestDay, null);
    assert.ok(!m.last);
  });
});

// ── backupValid ───────────────────────────────────────────────────────────────

describe("backupValid", () => {
  test("accepts a well-formed backup", () => {
    assert.ok(backupValid({ app: "soisanuk", progress: {} }));
  });
  test("rejects wrong app tag", () => {
    assert.ok(!backupValid({ app: "other", progress: {} }));
  });
  test("rejects missing progress", () => {
    assert.ok(!backupValid({ app: "soisanuk" }));
  });
  test("rejects null", () => {
    assert.ok(!backupValid(null));
  });
});
