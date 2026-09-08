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
    const n = backupApply(theirs);
    assert.equal(n, 2, "the import reports what it merged");
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
});
