// Data-integrity tests for web/js/data.js + web/js/examples.js. Catches the
// class of bug that shipped an orphan EXAMPLES key (a doubled-syllable typo
// that silently gave "ความฝัน" no example) — cheap, static checks that would
// have caught it before commit.
// Run with: node --test tests/js/

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "tokeniser.js"]) {
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
