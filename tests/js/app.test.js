// Tests for the pure/stateful (DOM-free) helpers in web/js/app.js.
// resetAllProgress() is the only one exercised here — everything else in
// app.js is a DOM renderer. Regression coverage for a real bug: the Stats
// screen's "Reset ALL progress?" button only ever cleared soisanuk_progress,
// silently leaving the course path (soisanuk_path) and streak
// (soisanuk_streak) behind despite what the button claimed to do.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    _store: store,
  };
}

// app.js's top-level migration/prune blocks and resetAllProgress() itself
// touch localStorage directly — stub it before loading. Leave `document`
// undefined for the load itself (wordcard.js's DOM-guarded init checks
// `typeof document !== "undefined"` and must see it genuinely absent, the
// same as every other test file here); stub it AFTER loading, only for the
// one runtime call this file makes into learn.js's _streakRender().
global.localStorage = makeLocalStorage();

for (const f of ["data.js", "srs.js", "wordcard.js", "app.js", "learn.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
global.document = { getElementById: () => null };

describe("resetAllProgress", () => {
  test("clears the SRS progress store", () => {
    localStorage.setItem(SRS_KEY, JSON.stringify({ "ไป": { totalReviews: 3 } }));
    resetAllProgress();
    assert.equal(localStorage.getItem(SRS_KEY), null);
  });

  test("resets the in-memory progress object", () => {
    globalThis.progress = { "ไป": { totalReviews: 3 } };
    resetAllProgress();
    assert.deepEqual(progress, {});
  });

  test("clears the course path store (the original bug: this used to survive)", () => {
    localStorage.setItem(LEARN_KEY, JSON.stringify({ units: { L0: { done: true } }, best: { "ไป": 900 } }));
    resetAllProgress();
    assert.equal(localStorage.getItem(LEARN_KEY), null);
  });

  test("clears the streak store (also used to survive)", () => {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ days: 12, maxDays: 30 }));
    resetAllProgress();
    assert.equal(localStorage.getItem(STREAK_KEY), null);
  });

  test("does not touch unrelated UI-preference keys or another app's save", () => {
    localStorage.setItem("soisanuk_muted", "1");
    localStorage.setItem("soisanuk_nav", '{"Games":true}');
    localStorage.setItem("soisanuk_tonecolor", "1");
    localStorage.setItem("soisanuk_seen_tutorial", "1");
    localStorage.setItem("lbb_save", '{"thaiSeen":["กิน"]}');
    resetAllProgress();
    assert.equal(localStorage.getItem("soisanuk_muted"), "1");
    assert.equal(localStorage.getItem("soisanuk_nav"), '{"Games":true}');
    assert.equal(localStorage.getItem("soisanuk_tonecolor"), "1");
    assert.equal(localStorage.getItem("soisanuk_seen_tutorial"), "1");
    assert.equal(localStorage.getItem("lbb_save"), '{"thaiSeen":["กิน"]}');
  });
});

// ── The shared progress store ───────────────────────────────────────────────
// learn.js used to grade into its own loadProgress() copy while app.js held a
// `progress` global loaded once at parse time. endSession() -> saveAndRefresh()
// wrote that stale global straight back over localStorage, so finishing a
// course unit and tapping "Menu" reverted every grade in it — and ▶ Continue
// then re-served the identical ten cards. Found by the 2026-09-01 returner round.
test("course grading lands in the SHARED progress store, not a private copy", () => {
  progress = {};
  _lu = { results: [] };
  _learnRecord("ไป", 5, 120);
  assert.ok(progress["ไป"], "grade must be visible in the global app.js saves");
  assert.equal(progress["ไป"].totalReviews, 1);
});

test("a graded card survives the write-back that endSession performs", () => {
  progress = {};
  _lu = { results: [] };
  _learnRecord("ไป", 5, 120);
  saveProgress(progress);            // what saveAndRefresh() does
  assert.ok(loadProgress()["ไป"], "the grade must still be there after write-back");
});

// ── Placement places; it does not schedule ──────────────────────────────────
// Placement showed 16 words and wrote a real SRS record for each, so a test
// taken to avoid redoing work quietly enrolled you in 16 new cards — and,
// since a wrong answer resets repetitions, knocked a fumbled mature word's
// interval back to a day. Found by the 2026-09-01 returner round.
test("placement leaves the review store untouched", () => {
  progress = { "ไป": { interval: 40, repetitions: 6, easeFactor: 2.5, due: 9e9, totalReviews: 9, correctStreak: 6 } };
  const before = JSON.stringify(progress["ไป"]);
  _lu = { idx: -2, results: [] };          // -2 marks placement
  _learnRecord("ไป", 1, 400);              // fumble a mature card
  assert.equal(JSON.stringify(progress["ไป"]), before, "a mature card must not be reset by placement");
  _learnRecord("นอน", 5, 400);             // and an unseen one
  assert.equal(progress["นอน"], undefined, "placement must not enrol new cards");
  assert.equal(_lu.results.length, 2, "but it still records what you answered");
});

test("an ordinary lesson still grades normally", () => {
  progress = {};
  _lu = { idx: 0, results: [] };
  _learnRecord("นอน", 5, 400);
  assert.ok(progress["นอน"], "non-placement lessons must still write");
});
