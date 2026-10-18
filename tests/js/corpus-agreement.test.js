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

globalThis.document = undefined;   // soi-buakhao.js touches the DOM only inside functions
for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js",
                 "lexicon-th.js", "seg-extra.js", "seg-phrases.js", "segment.js",
                 "soi-buakhao.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

describe("corpus agreement", () => {
  before(() => { _segWords = null; _segLoad(() => {}); });

  test("every example sentence romanises its words the way data.js does", () => {
    const map = new Map(WORDS.map(w => [w[0], w[1]]));
    const norm = s => s.replace(/[- ]/g, "").toLowerCase();
    // Containment alone lets a LONGER wrong spelling through: three sentences
    // read เพราะ as "phrór" while data.js says "phró", and "phror" contains
    // "phro", so the check passed on all three. Match on syllable boundaries
    // too — a hyphen, a space or an edge — which is the same rule
    // _sentBlankRtgs had to learn. Found while vendoring the first one out.
    const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bounded = (rom, want) =>
      new RegExp("(^|[\\s-])" + esc(want).replace(/[-\s]+/g, "[\\s-]") +
                 "(?=[\\s-]|[.,!?;:]|$)", "i").test(rom);
    const bad = [];
    for (const key of Object.keys(EXAMPLES)) {
      const [th, rom] = EXAMPLES[key];
      for (const tok of segmentThai(th)) {
        const t = tok.base || tok.text;
        if (!tok.known || tok.fragment || !map.has(t)) continue;
        if (bounded(rom, map.get(t))) continue;
        bad.push(`${key}: "${rom}" — ${t} should read "${map.get(t)}"`);
      }
    }
    assert.deepEqual(bad, []);
  });

  // ── Soi Buakhao ───────────────────────────────────────────────────────────
  // The same pivot over the bar game's 75 prompt/choice lines and 499
  // romanised syllables, which had NO agreement check of any kind. That gap is
  // how "Àwt-sà-tree-lia" survived: round 26 flagged it, nothing failed, and it
  // sat in the file for weeks until it was found by hand while adding
  // ออสเตรเลีย to data.js. Mutation-tested both ways — reinstating that exact
  // drift fails this test, as does flattening Sà-wàt-dii to Sa-wat-dii.
  //
  // 415 of the game's 466 Thai tokens are covered. The 51 skipped are the 14
  // words below, which are not in WORDS, so there is nothing to disagree with.
  const _SB_NOT_COURSE = {
    // Proper nouns and deliberately out of scope.
    "เดฟ": "Dave — a character name",
    "แอลกอฮอล์": "alcohol — the course teaches เหล้า",
    "สุนัข": "dog (formal) — the course teaches หมา",
    // A SEGMENTER artefact, not a word the game prints. The only line it
    // appears in is ผมต้องการเงินคืนครับ, which segmentThai splits as
    // ต้อง|การเงิน|คืน — two commoner lexicon entries (ranks 27 and 988)
    // outbidding ต้องการ|เงิน (ต้องการ is rank 248). The curriculum tokeniser
    // the game actually uses gets it right by longest match. Adding การเงิน to
    // WORDS to silence this would make a tap on it show "finance" inside a
    // sentence about wanting money back. The real fix is in segment.js's cost
    // model; until then this entry names the defect rather than hiding it.
    "การเงิน": "segmenter mis-split of ต้องการเงิน — see above",
  };
  // 2026-10-18: eleven ordinary words came OFF this list and into WORDS —
  // เปล่า โสด แน่ใจ สาว ใจดี ที่สุด เดียว ด้าน โดยเฉพาะ — plus ไอที, which was
  // what "ที" actually was (half of ไอที, now in SEG_EXTRA so the segmenter
  // keeps it whole), and ดูแล, which the curriculum tokeniser was carving ดู
  // out of. The "exception list must not rot" test is what forces this: the
  // moment a listed word is taught, it fails until the entry is removed.


  test("Soi Buakhao romanises its words the way data.js does", () => {
    const map = new Map(WORDS.map(w => [w[0], w[1]]));
    const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bounded = (rom, want) =>
      new RegExp("(^|[\\s-])" + esc(want).replace(/[-\s]+/g, "[\\s-]") +
                 "(?=[\\s-]|[.,!?;:]|$)", "i").test(rom);
    const bad = [];
    for (const night of Object.keys(_SB_QS)) for (const q of _SB_QS[night]) {
      const lines = [[`night ${night} prompt`, q.q, q.rom]];
      q.choices.forEach((c, i) => lines.push([`night ${night} choice ${i + 1}`, c.th, c.rom]));
      for (const [label, th, rom] of lines)
        for (const tok of segmentThai(th)) {
          const t = tok.base || tok.text;
          if (!tok.known || tok.fragment || !map.has(t)) continue;
          if (bounded(rom, map.get(t))) continue;
          bad.push(`${label}: "${rom}" — ${t} should read "${map.get(t)}"`);
        }
    }
    assert.deepEqual(bad, []);
  });

  // Guards the test above: if segmentThai stopped resolving the game's Thai, or
  // the load order left _SB_QS empty, the check would pass by examining nothing.
  // 415 was the count when this was written; it only ever rises.
  test("…and that check actually examined the game's Thai", () => {
    const map = new Map(WORDS.map(w => [w[0], w[1]]));
    let checked = 0;
    for (const night of Object.keys(_SB_QS)) for (const q of _SB_QS[night])
      for (const th of [q.q].concat(q.choices.map(c => c.th)))
        for (const tok of segmentThai(th))
          if (tok.known && !tok.fragment && map.has(tok.base || tok.text)) checked++;
    assert.ok(checked >= 415, `only ${checked} tokens were compared, expected at least 415`);
  });

  // The defect class The Last Baht Bus guards with "every Thai word the game
  // prints resolves in the vendored vocab" — applied to this repo's OWN game,
  // which had no equivalent. A learner tapping a word the course does not teach
  // gets nothing back.
  test("every Thai word Soi Buakhao prints is a course word, or a known exception", () => {
    const have = new Set(WORDS.map(w => w[0]));
    const untaught = new Set();
    for (const night of Object.keys(_SB_QS)) for (const q of _SB_QS[night])
      for (const th of [q.q].concat(q.choices.map(c => c.th)))
        for (const tok of segmentThai(th)) {
          const t = tok.base || tok.text;
          if (!/[\u0E01-\u0E4E]/.test(t)) continue;
          if (!have.has(t) && !(t in _SB_NOT_COURSE)) untaught.add(t);
        }
    assert.deepEqual([...untaught], [],
      "Soi Buakhao prints Thai the course cannot gloss — teach it, or add it to _SB_NOT_COURSE with a reason");
  });

  // And the exception list must not rot: a word that HAS since been taught
  // should come off it, or it silently excuses a real check.
  test("nothing on the Soi Buakhao exception list is a course word now", () => {
    const have = new Set(WORDS.map(w => w[0]));
    const stale = Object.keys(_SB_NOT_COURSE).filter(t => have.has(t));
    assert.deepEqual(stale, [],
      "these are taught now — remove them from _SB_NOT_COURSE");
  });
});
