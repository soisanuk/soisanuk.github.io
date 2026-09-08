// Round 22 (2026-09-09) — Priya, fourteen months in, has lost progress before
// (lens: can a restore lose data — Backup & Restore). It could lose all of it:
// the import wrote localStorage and never told the running app, so the next
// thing she touched wrote the pre-import store back over it.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// A localStorage shim, so backupApply can be driven end to end. app.js is not
// loaded (it touches the DOM at parse time), so `progress` is declared here to
// stand in for the global it owns — which is the whole point of the test.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
};
globalThis.progress = {};
for (const f of ["srs.js", "learn.js", "backup.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

describe("round 22 — a restore must reach the running app", () => {
  // app.js holds `let progress = loadProgress()` and every mode grades into
  // that one object; saveAndRefresh() writes it back. backupApply wrote only
  // localStorage, so importing 900 cards and then tapping the Backup screen's
  // own "← Menu" button — which is endSession(), which is saveAndRefresh() —
  // wrote the empty pre-import store straight back over all 900.
  //
  // Re-importing did not help; only a full page reload did, which on an
  // installed PWA means force-quitting. And restoring onto a device that
  // ALREADY had the data could not fail, because memory was a superset there:
  // the rehearsal always worked and the real migration always lost.
  //
  // docs/architecture.md records this exact failure for _learnRecord already —
  // same global, same trigger, a different writer.
  test("backupApply refreshes the in-memory store, not just localStorage", () => {
    store.clear();
    globalThis.progress = {};                       // a fresh device
    const theirs = {
      app: "soisanuk", progress: { "ไป": { totalReviews: 7, interval: 30 },
                                   "มา": { totalReviews: 3, interval: 6 } },
      path: {}, streak: {},
    };
    const r = backupApply(theirs);
    assert.equal(r.cards, 2, "the import reports what it merged");
    assert.equal(r.skipped, 0, "nothing in this file was unreadable");
    assert.equal(Object.keys(progress).length, 2,
      "the running app must see the restored cards, or the next save reverts them");
    assert.equal(progress["ไป"].totalReviews, 7);

    // the actual loss path: what saveAndRefresh would now write back
    saveProgress(progress);
    assert.equal(Object.keys(JSON.parse(localStorage.getItem(SRS_KEY))).length, 2,
      "tapping Menu after an import must not empty the store");
  });

  // The merge itself was sound — 5,000 randomised pairs found nothing — so this
  // guards the property the merge promises, through the apply path.
  test("an import onto a device with its own cards keeps both sides", () => {
    store.clear();
    globalThis.progress = { "กิน": { totalReviews: 2, interval: 1 } };
    saveProgress(progress);
    backupApply({ app: "soisanuk", progress: { "ไป": { totalReviews: 7 } }, path: {}, streak: {} });
    saveProgress(progress);                          // the Menu tap
    const stored = JSON.parse(localStorage.getItem(SRS_KEY));
    assert.deepEqual(Object.keys(stored).sort(), ["กิน", "ไป"],
      "the local card and the imported one both survive");
  });

  // On the SAME date, a strict > gave the tie to the local device — so
  // restoring on migration day cut a 214-day streak to 1 if she had answered
  // one card on the new phone first, and left it at 214 if she had not. The
  // order of two taps decided seven months of history.
  test("restoring on the same day keeps the longer streak", () => {
    const today = "2026-09-09";
    const fresh = { last: today, days: 1, maxDays: 1, today: { cards: 1 } };
    const long  = { last: today, days: 214, maxDays: 214, today: { cards: 38 } };
    assert.equal(_streakMerge(fresh, long).days, 214, "importing onto a fresh device");
    assert.equal(_streakMerge(long, fresh).days, 214, "and the other way round");
    // a genuinely newer date still wins on its own merits
    assert.equal(_streakMerge(long, { last: "2026-09-10", days: 2, maxDays: 2 }).days, 2);
  });

  // _placementApply writes {done:true, placed:true} with no acc, on purpose.
  // The merge rebuilt the unit as {done, acc: Math.max(0,0), msAvg} — dropping
  // `placed` and inventing acc:0 — and startLearn renders a badge whenever
  // acc != null. Placing out of four units and restoring said she scored zero.
  test("a placed unit keeps its flag and grows no score", () => {
    const path = { units: { b1: { done: true, placed: true } } };
    const u = backupMerge({ progress: {}, path }, { progress: {}, path }).path.units.b1;
    assert.equal(u.acc, undefined, "a unit with no accuracy must not acquire one");
    assert.equal(u.placed, true, "placed survives the merge");
    assert.equal(u.done, true);
    // a real score still merges, highest wins
    const a = { units: { b2: { done: true, acc: 0.8 } } };
    const b = { units: { b2: { done: true, acc: 0.95 } } };
    assert.equal(backupMerge({ progress: {}, path: a }, { progress: {}, path: b }).path.units.b2.acc, 0.95);
  });

  // One corrupted record used to throw inside backupMerge, be swallowed by the
  // blanket catch, and report "That doesn't look like a soisanuk backup" — so
  // 899 good cards were unimportable and the message blamed her file choice.
  test("one damaged record does not reject the whole backup", () => {
    const mine = { progress: {} }, theirs = { progress: {} };
    for (let i = 0; i < 900; i++) {
      mine.progress["w" + i] = { totalReviews: 3 };
      theirs.progress["w" + i] = { totalReviews: 5 };
    }
    theirs.progress["w7"] = null;
    const m = backupMerge(mine, theirs);
    assert.equal(Object.keys(m.progress).length, 900, "the good records still merge");
    assert.equal(m.skipped, 1, "and the unreadable one is counted, not hidden");
    assert.equal(m.progress["w7"].totalReviews, 3, "the local copy of the damaged card survives");
  });

  // typeof null === "object" and arrays are objects, so progress:[] imported a
  // card keyed "0" that no screen can reach.
  test("backupValid rejects a top level that is not a backup", () => {
    assert.ok(backupValid({ app: "soisanuk", progress: { "ไป": {} } }));
    for (const bad of [null, {}, { app: "other", progress: {} },
                       { app: "soisanuk" }, { app: "soisanuk", progress: null },
                       { app: "soisanuk", progress: [] }])
      assert.ok(!backupValid(bad), `should reject ${JSON.stringify(bad)}`);
  });
});
