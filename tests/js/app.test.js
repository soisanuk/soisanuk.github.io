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
