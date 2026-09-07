// Does everything the app says about ONE Thai word agree?
//
// Borrowed from The Last Baht Bus's docs/prose-review-method.md, whose second
// pass exists for the defect class "an assertion that is fine on its own page
// and false about the world". A contradiction needs co-location, and writing
// never co-locates — so the pivot supplies it: group every claim the corpus
// makes about a word and read them together.
//
// The existing scheme pin in data.test.js reads ONE string at a time. It
// catches a Paiboon spelling; it cannot catch a sentence that romanises ตลาด
// as "ta-làat" while WORDS says "tà-làat", because that needs two records at
// once. 112 such disagreements were live across 960 example sentences when
// this pivot was first run (2026-09-07) — 50 distinct words, including a wrong
// TONE on อร่อย (rôoi for ròoi, 17 sentences) and a missing tone mark on ตลาด,
// the very word the rung-3 script note is built around.
//
// It also caught data.js disagreeing with ITSELF twice, which is why the check
// is symmetrical in spirit: กิโลเมตร was "kì-loo-mêet" while
// กิโลเมตรต่อชั่วโมง was "ki-loo-meet-…", and ถาม was "thǎam" while
// ถามได้เลย was "tǎam-…".
//
// Segmented with segmentThai, not the curriculum tokeniser: the greedy matcher
// finds รอ inside กรอบ and reported 35 disagreements that were not there.
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js",
                 "lexicon-th.js", "seg-extra.js", "seg-phrases.js", "segment.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

describe("corpus agreement", () => {
  before(() => { _segWords = null; _segLoad(() => {}); });

  test("every example sentence romanises its words the way data.js does", () => {
    const map = new Map(WORDS.map(w => [w[0], w[1]]));
    const norm = s => s.replace(/[- ]/g, "").toLowerCase();
    const bad = [];
    for (const key of Object.keys(EXAMPLES)) {
      const [th, rom] = EXAMPLES[key];
      for (const tok of segmentThai(th)) {
        const t = tok.base || tok.text;
        if (!tok.known || tok.fragment || !map.has(t)) continue;
        if (norm(rom).includes(norm(map.get(t)))) continue;
        bad.push(`${key}: "${rom}" — ${t} should read "${map.get(t)}"`);
      }
    }
    assert.deepEqual(bad, []);
  });
});
