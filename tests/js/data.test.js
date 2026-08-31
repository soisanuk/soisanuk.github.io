// Data-integrity tests for web/js/data.js + web/js/examples.js. Catches the
// class of bug that shipped an orphan EXAMPLES key (a doubled-syllable typo
// that silently gave "ความฝัน" no example) — cheap, static checks that would
// have caught it before commit.
// Run with: node --test tests/js/

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}

test("no duplicate WORDS keys", () => {
  const seen = new Map();
  for (const w of WORDS) seen.set(w[0], (seen.get(w[0]) || 0) + 1);
  const dups = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  assert.deepEqual(dups, [], "duplicate WORDS entries (WORD_MAP silently keeps only the last)");
});

test("every EXAMPLES key exists in WORDS", () => {
  const wset = new Set(WORDS.map(w => w[0]));
  const orphans = Object.keys(EXAMPLES).filter(k => !wset.has(k));
  assert.deepEqual(orphans, [], "orphan EXAMPLES keys with no matching WORDS entry");
});

test("every example's Thai sentence contains its own headword", () => {
  // one WORDS entry is a phrase TEMPLATE ("ขอ..." = "please may I have...");
  // its sentence correctly contains the fixed part, not the literal "..." —
  // wordLiteral (data.js) is the shared definition of that rule.
  const missing = Object.entries(EXAMPLES)
    .filter(([key, ex]) => !ex[0].includes(wordLiteral(key)))
    .map(([key]) => key);
  assert.deepEqual(missing, [], "example sentences that don't contain their own headword");
});

test("wordLiteral strips a trailing template ellipsis, leaves ordinary words alone", () => {
  assert.equal(wordLiteral("ขอ..."), "ขอ");
  assert.equal(wordLiteral("khǒo..."), "khǒo");
  assert.equal(wordLiteral("มา"), "มา");        // no ellipsis → unchanged
  assert.equal(wordLiteral("..."), "");          // degenerate
  assert.equal(wordLiteral("a...b"), "a...b");   // only a TRAILING ellipsis
});

test("every WORDS row has non-empty rtgs, english, pos, and category", () => {
  const bad = WORDS.filter(w => !w[1] || !w[2] || !w[3] || !w[4]).map(w => w[0]);
  assert.deepEqual(bad, [], "WORDS rows with an empty required field");
});

// ── Token resolution ─────────────────────────────────────────────────────────
// The stricter bar (every Thai token in every example resolves to a WORDS
// entry — the same contract LBB's printed-Thai guard holds game text to)
// does NOT hold today: 303 of 867 example sentences pull in supporting
// vocabulary (nouns/verbs used to make a natural sentence around the
// headword, e.g. "กางเกง" pants in the example for "สั้น" short) that isn't
// itself a WORDS entry. That's real, but it's a large, separate content pass
// — not something this test should either hide or block on. Instead: a
// regression guard. The current count is the ceiling; a NEW example that
// introduces an unresolved word pushes past it and fails immediately, while
// today's known gap stays visible instead of silently exempted.
const KNOWN_UNRESOLVED_EXAMPLES = 303;

test("no NEW example sentences introduce unresolved (non-vocab) Thai tokens", () => {
  const map = Object.fromEntries(WORDS.map(w => [w[0], w]));
  const tokenize = makeTokeniser(map);
  let unresolved = 0;
  for (const key in EXAMPLES) {
    const toks = tokenize(EXAMPLES[key][0]);
    if (toks.some(t => !t.word && t.text.length >= 2 && !/^[๐-๙]+$/.test(t.text))) unresolved++;
  }
  assert.ok(unresolved <= KNOWN_UNRESOLVED_EXAMPLES,
    `${unresolved} examples have unresolved tokens (known baseline: ${KNOWN_UNRESOLVED_EXAMPLES}) — ` +
    `a new/edited example should only use words already in WORDS, or add the missing word first`);
});

test("words lacking an example entirely (informational — not an error)", () => {
  // tracked as backlog (docs/review-remediation-spec.md), not a failure —
  // this just keeps the number visible so it doesn't silently balloon
  const missing = WORDS.filter(w => !EXAMPLES[w[0]]).length;
  assert.ok(missing < 150, `${missing} words have no example — investigate if this jumps sharply`);
});

// ── romanisation scheme ─────────────────────────────────────────────────────
// The app writes one hybrid scheme: RTGS-style consonants (ph/th/kh, and k/p/t
// where Paiboon writes g/bp/dt) carrying Paiboon's tone marks and explicit
// vowel length. Neither pure system works here — RTGS drops tone and length
// (เขา/เข่า/ข้าว/ข่าว/เข้า all collapse to "khao"), and Paiboon's g/bp/dt do not
// match the RTGS spellings on every road sign in Thailand. See
// docs/architecture.md, "Romanisation".
//
// This has now drifted twice: the 2026-08 review found curriculum.js using a
// second scheme (P2.3), and a later sweep found 19 Paiboon spellings still in
// data.js and examples.js. It is a data-entry slip, not a design question, so
// pin it rather than re-grep for it.
test("romanisations follow the house scheme, not raw Paiboon", () => {
  const VIOLATIONS = [
    [/(^|[- ])bp/, "bp — write p (ป)"],
    [/(^|[- ])dt/, "dt — write t (ต), or d if the letter is ด"],
    [/(^|[- ])g[aeiou]/, "g- — write k (ก)"],
    [/aaw/, "aaw — write oo"],
    [/[ɛɔʉə]/, "raw IPA vowel — spell it out (ae/oo/uue/oe)"],
  ];
  const bad = [];
  const check = (where, key, roman) => {
    for (const [re, why] of VIOLATIONS) if (re.test(roman)) bad.push(`${where} ${key}: "${roman}" — ${why}`);
  };
  for (const w of WORDS) check("WORDS", w[0], w[1]);
  for (const k of Object.keys(EXAMPLES)) check("EXAMPLES", k, EXAMPLES[k][1]);
  assert.deepEqual(bad, [], `${bad.length} romanisation(s) off-scheme`);
});

// ── romanisation vs the tone engine ─────────────────────────────────────────
// Found by the 2026-08-30 fluent-Thai-reader persona round: 23 curriculum
// romanisations carried a tone the app's own engine contradicts — ศาสนา was
// sǎat- for sàat-, ทิ้ง was thîng for thíng, ปริมาณ was prì-maan for a word
// that is actually three syllables. They surface everywhere (flashcards, SRS,
// reader, tone drill), so this is the highest-reach data invariant here.
//
// Stated as an invariant rather than 23 assertions so it also catches the next
// one. The two exceptions are real and are NOT to be "fixed": in both the data
// is right and the engine is wrong, because the spelling rule does not predict
// the pronunciation.
test("no monosyllabic word's romanisation contradicts the tone engine", () => {
  const MARK = { "̀": "low", "̂": "falling", "́": "high", "̌": "rising" };
  const claimed = r => {
    const marks = [...String(r).normalize("NFD")].filter(c => MARK[c]);
    return marks.length ? MARK[marks[0]] : "mid";
  };
  // แอป "app" and ก็ are genuine exceptions — a loanword whose speech departs
  // from the spelling, and one of Thai's handful of irregular spellings
  // (ไม้ไต่คู้ over an unwritten ออ). _toneDrillPool skips both for this reason.
  const EXCEPTIONS = new Set(["แอป", "ก็"]);
  const bad = [];
  for (const w of WORDS) {
    if (/[-\s]/.test(w[1].trim())) continue;        // multi-syllable: not comparable
    if (EXCEPTIONS.has(w[0])) continue;
    const tone = syllableTone(w[0]);
    if (!tone) continue;                             // engine declines: nothing to check
    if (tone !== claimed(w[1])) bad.push(`${w[0]} "${w[1]}" claims ${claimed(w[1])}, engine reads ${tone}`);
  }
  assert.deepEqual(bad, [], `${bad.length} romanisation(s) contradict the tone engine`);
});

// ◌อ shipped labelled "short o" — it is the LONG open o, and the label
// duplicated เ◌าะ on the very next line, leaving two cards whose backs
// differed only by romanisation. A description is the answer side of a
// flashcard: two cards may not share one.
test("no two vowels carry the same description", () => {
  const seen = new Map();
  for (const [sym, , desc] of VOWELS) {
    assert.ok(!seen.has(desc),
      `"${desc}" describes both ${seen.get(desc)} and ${sym}`);
    seen.set(desc, sym);
  }
});

test("vowel length in the description matches the romanisation", () => {
  for (const [sym, rom, desc] of VOWELS) {
    if (!/^(long|short) /.test(desc)) continue;   // ua/ia/am/ai have no length word
    const doubled = /^(aa|ii|uu|ee|oo|uue)$/.test(rom);
    if (doubled) {
      assert.match(desc, /^long /, `${sym} romanises "${rom}" (doubled) but reads "${desc}"`);
    }
  }
});

// ── Example words vs the dictionary we already ship ─────────────────────────
// Three vowel cards shipped with wrong example glosses: เก "old" (it is
// naughty/crooked), กอ "embrace" (that is กอด — กอ is a clump of plants), and
// กัว "to confuse", which is not a Thai word at all. Nobody had to be fluent to
// catch these: gloss-th.js, generated from Wiktionary for Paste Text, is right
// there in the repo. Cross-check against it so the next one cannot ship.
const _GLOSS = (() => {
  vm.runInThisContext(
    readFileSync(new URL("../../web/js/gloss-th.js", import.meta.url), "utf8"),
    { filename: "gloss-th.js" });
  const src = Object.values(globalThis).find(v => typeof v === "string" && v.length > 10000);
  const m = new Map();
  for (const row of (src || "").split("\n")) {
    const [w, g, r] = row.split("\t");
    if (w) m.set(w, { gloss: g || "", roman: r || "" });
  }
  return m;
})();

// Wordings the dictionary states differently but not wrongly — a plain
// substring test cannot see that "island" and "tract of land surrounded by
// water" are the same thing. Each entry is a decision, not a mute button.
const GLOSS_OK = new Set([
  "เกาะ",   // "island" vs "tract of land surrounded by water"
  "เขา",    // "he/she" vs "he; she; they; I; oneself"
]);

// เ◌ือ is "uea" — settled 2026-09-01, and now the only spelling in the data
// (125 lines across data.js, examples.js and soi-buakhao.js said "uuea").
// ◌ื ALONE stays "uue": length is still marked by doubling there, so มือ is
// "muue". Nothing is pinned here any more; the dictionary and the cards agree.
const ROMAN_OK = new Set();

test("every vowel example word exists in the shipped dictionary", () => {
  for (const [sym, , , ex] of VOWELS) {
    const m = /^(\S+)\s*\(([^)]+)\)\s*=\s*(.+)$/.exec(ex || "");
    if (!m) continue;
    assert.ok(_GLOSS.has(m[1]),
      `${sym}: example word ${m[1]} is not a dictionary word — is it a typo?`);
  }
});

test("every vowel example gloss agrees with the dictionary", () => {
  for (const [sym, , , ex] of VOWELS) {
    const m = /^(\S+)\s*\(([^)]+)\)\s*=\s*(.+)$/.exec(ex || "");
    if (!m) continue;
    const [, th, , en] = m;
    if (GLOSS_OK.has(th)) continue;
    const entry = _GLOSS.get(th);
    if (!entry) continue;                       // covered by the test above
    const dict = entry.gloss.toLowerCase();
    const claim = en.toLowerCase().replace(/^to /, "").split(/[;,(]/)[0].trim();
    const agrees = dict.includes(claim) ||
      claim.split(/\s+/).some(w => w.length > 3 && dict.includes(w));
    assert.ok(agrees,
      `${sym}: card says ${th} = "${en}", dictionary says "${entry.gloss}"`);
  }
});

test("every vowel example romanisation matches the dictionary's", () => {
  const strip = r => r.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const [sym, , , ex] of VOWELS) {
    const m = /^(\S+)\s*\(([^)]+)\)\s*=\s*(.+)$/.exec(ex || "");
    if (!m) continue;
    const entry = _GLOSS.get(m[1]);
    if (!entry || !entry.roman || ROMAN_OK.has(m[1])) continue;
    assert.equal(strip(m[2]), strip(entry.roman),
      `${sym}: card romanises ${m[1]} as "${m[2]}", dictionary says "${entry.roman}"`);
  }
});
