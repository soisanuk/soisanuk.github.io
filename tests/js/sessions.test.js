// Tests for the pure, rule-based helpers in web/js/sessions.js — tone
// detection (the tone drill's answer key) and the tone-drill word pool. The
// rest of sessions.js drives the DOM and is exercised in the browser; these
// two are DOM-free and load cleanly under node:vm, so they ship exactly as
// tested. srs.js is loaded because sessions.js references its helpers at
// call time (not needed by the functions under test, but keeps the load honest).
// Run with: node --test tests/js/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// thai-script.js + curriculum.js provide the tone engine (toneOfWord) that the
// drill's answer key now uses; data.js provides TONES it indexes into.
// wordcard.js loads first: curriculum.js's _tcEsc (toneColorHtml) delegates
// to its _wcEsc, and so does app.js's _esc — which sessions.js's own
// renderers (quizAnswer, drillShowConsonant, toneDrillAnswer, sentSrsShow)
// call directly, so app.js has to load too, not just wordcard.js.
for (const f of ["data.js", "examples.js", "thai-script.js", "wordcard.js", "srs.js", "app.js", "curriculum.js", "sessions.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}

// ── _detectWordTone: the tone-drill answer key ──────────────────────────────
// Returns the word's ACTUAL tone as an index into TONES (0 สามัญ/mid …
// 4 จัตวา/rising) via the tone engine — not the tone MARK, which an unmarked
// non-mid word (หมา, สิบ) doesn't have.

test("_detectWordTone returns the realised tone, not the mark", () => {
  assert.equal(_detectWordTone("มา"), 0, "low class, live, no mark → mid");
  assert.equal(_detectWordTone("ข่า"), 1, "high + mai ek → low");
  assert.equal(_detectWordTone("ม้า"), 3, "low + mai tho → high (NOT falling)");
  assert.equal(_detectWordTone("จ๋า"), 4, "mid + mai jattawa → rising");
});

test("_detectWordTone fixes the unmarked non-mid words the old scan missed", () => {
  assert.equal(_detectWordTone("หมา"), 4, "ห-leader → high class, live → rising");
  assert.equal(_detectWordTone("สิบ"), 1, "high class, dead → low");
  assert.equal(_detectWordTone("นก"), 3, "low class, dead short → high");
});

test("_detectWordTone falls back to 0 for words it can't grade", () => {
  assert.equal(_detectWordTone("สวัสดี"), 0, "multi-syllable → ungradable");
  assert.equal(_detectWordTone("hello"), 0);
  assert.equal(_detectWordTone(""), 0);
});

test("_detectWordTone warns (not fails silently) if TONES and the engine's tone vocabulary drift apart", (t) => {
  const warnMock = t.mock.method(console, "warn", () => {});
  const origToneOfWord = globalThis.toneOfWord;
  globalThis.toneOfWord = () => "nonexistent-tone"; // simulates a renamed/drifted tone name
  try {
    assert.equal(_detectWordTone("มา"), 0, "still falls back to 0, but loudly");
    assert.equal(warnMock.mock.calls.length, 1, "warns exactly once");
    assert.match(warnMock.mock.calls[0].arguments[0], /nonexistent-tone/);
  } finally {
    globalThis.toneOfWord = origToneOfWord;
  }
});

// ── _toneRuleLine: the reveal's rule explanation ────────────────────────────
// Spells out WHY a word has the tone it has — cls + mark → REALISED tone —
// so a learner reading the written mark (e.g. ้ mai tho on a low-class
// consonant) isn't contradicted by a bare "โท" choice label that names the
// mark, not the tone (โท the mark produces ตรี the tone on low class).

test("_toneRuleLine states class + mark → the realised tone", () => {
  assert.equal(_toneRuleLine("ม้า"), "low class + ้ mai tho → HIGH tone");
  assert.equal(_toneRuleLine("ข่า"), "high class + ่ mai ek → LOW tone");
  assert.equal(_toneRuleLine("มา"), "low class + no mark → MID tone");
});

test("_toneRuleLine is blank for words the engine can't grade", () => {
  assert.equal(_toneRuleLine("ครับ"), "");
  assert.equal(_toneRuleLine(""), "");
});

// ── _toneDrillPool: filter + cap over WORDS ─────────────────────────────────
// Skips words longer than 5 UTF-16 units and caps the session at 100. shuffle
// lives in the DOM-heavy app.js, so stub it deterministically.

test("_toneDrillPool caps at 100, drops long words, keeps only gradable ones", () => {
  globalThis.shuffle = arr => arr; // identity: deterministic, order-independent asserts
  const pool = _toneDrillPool();
  assert.ok(pool.length <= 100, "capped at 100");
  assert.ok(pool.length > 0, "the corpus yields a real pool");
  assert.ok(pool.every(w => w[0].length <= 5), "no word over 5 chars");
  const wordSet = new Set(WORDS);
  assert.ok(pool.every(w => wordSet.has(w)), "every entry comes straight from WORDS");
  // every pooled word has a gradable answer key (single readable syllable)
  assert.ok(pool.every(w => toneOfWord(w[0])), "only gradable words are pooled");
});

// ── _sentBlankThai / _sentBlankRtgs: sentence-SRS blanking ──────────────────
// Regression coverage for a real leak: String.replace(target, blank) only
// hits the FIRST substring match, so a headword appearing twice in its own
// example sentence (ศาสนา…ศาสนา, วิธี…วิธี, หนาว…หนาว) left the SECOND copy
// visibly readable. The fix blanks EVERY occurrence via split/join instead of
// a single replace — deliberately still substring-based (not token-aware),
// since a token-exact match regressed the common case where the headword is
// itself the leading syllable of a longer compound that's its OWN WORDS entry
// (e.g. "ดี" inside "ดีมาก") — there the substring hit is the correct blank.

test("_sentBlankThai blanks a single occurrence and leaks nothing outside it", () => {
  const out = _sentBlankThai("เขากำลังหากระเป๋าของเขา", "หา");
  assert.equal((out.match(/class="sent-blank"/g) || []).length, 1);
  const stripped = out.replace(/<span class="sent-blank">.*?<\/span>/g, "•");
  assert.ok(!stripped.includes("หา"), "no unblanked copy of the headword remains");
  assert.ok(out.includes(">หา<"), "the blanked span still carries the answer for the reveal to read");
});

test("_sentBlankThai blanks BOTH occurrences when the headword repeats", () => {
  const out = _sentBlankThai("ศาสนาพุทธเป็นศาสนาหลักของไทย", "ศาสนา");
  assert.equal((out.match(/class="sent-blank"/g) || []).length, 2, "both instances blanked");
  // nothing outside the blank spans still reads as the bare headword
  const stripped = out.replace(/<span class="sent-blank">.*?<\/span>/g, "•");
  assert.ok(!stripped.includes("ศาสนา"), "no unblanked copy of the headword leaks through");
});

test("_sentBlankThai blanks a substring occurrence embedded in a longer word too", () => {
  // ดีมาก ("very good") is itself a separate WORDS entry that happens to
  // start with ดี — blanking that occurrence is correct, not a regression:
  // the alternative (a token-exact match) left this sentence entirely
  // unblanked, which is worse than a slightly generous blank.
  const out = _sentBlankThai("อาหารร้านนี้ดีมาก", "ดี");
  assert.equal((out.match(/class="sent-blank"/g) || []).length, 1);
  assert.ok(out.includes("มาก"), "the rest of the compound stays visible");
});

test("_sentBlankThai leaves an escaped sentence when the target never occurs", () => {
  const out = _sentBlankThai("แมวนอนอยู่", "หมา");
  assert.ok(!out.includes("sent-blank"));
  assert.equal(out, "แมวนอนอยู่");
});

test("_sentBlankThai escapes non-Thai/HTML-significant characters in the surrounding text", () => {
  const out = _sentBlankThai('a<b>&"หา', "หา");
  assert.ok(out.includes("&lt;b&gt;"));
  assert.ok(out.includes("&amp;"));
  assert.ok(out.includes("&quot;"));
});

test("_sentBlankRtgs blanks a standalone romanised token", () => {
  const out = _sentBlankRtgs("khǎo kam-lang hǎa krà-pǎo", "hǎa");
  assert.equal((out.match(/___/g) || []).length, 1);
  assert.ok(!out.includes("hǎa"));
});

test("_sentBlankRtgs blanks every standalone occurrence", () => {
  const out = _sentBlankRtgs("dii mâak dii jang", "dii");
  assert.equal((out.match(/___/g) || []).length, 2);
});

// ── Full-corpus sweep: no example ships with a leaked or missing blank ──────
describe("sentence-SRS corpus: no leaks, no missing blanks", () => {
  const cases = WORDS.filter(w => EXAMPLES[w[0]]);
  assert.ok(cases.length > 100, "sanity: the corpus actually loaded");

  test("every example blanks its headword at least once, and nowhere leaks an unblanked copy", () => {
    const failures = [];
    for (const w of cases) {
      const target = wordLiteral(w[0]);
      const ex = EXAMPLES[w[0]];
      const out = _sentBlankThai(ex[0], target);
      const blanks = (out.match(/class="sent-blank"/g) || []).length;
      const stripped = out.replace(/<span class="sent-blank">.*?<\/span>/g, "");
      const leaked = stripped.includes(_wcEsc(target));
      if (blanks === 0 || leaked) failures.push({ word: w[0], blanks, leaked, sentence: ex[0] });
    }
    assert.deepEqual(failures, []);
  });
});

// ── _quizDistractors: no duplicate-looking choice ───────────────────────────
// Regression coverage for a real bug: distractors were filtered only on the
// Thai key, but the quiz DISPLAYS the English gloss — two WORDS entries with
// an identical gloss (ส้ม/สีส้ม both "orange", ชำระเงิน/จ่าย both "to pay")
// could put the same visible answer in the choice list twice with only one
// marked correct.

test("_quizDistractors never includes a different word with the same gloss as the answer", () => {
  globalThis.shuffle = arr => arr; // identity for a deterministic assert
  const som = WORDS.find(w => w[0] === "ส้ม");
  assert.ok(som, "sanity: ส้ม is in WORDS");
  const distractors = _quizDistractors(som, WORDS);
  assert.ok(!distractors.some(d => d[2] === som[2]), "no distractor shares ส้ม's gloss (orange)");
});

test("_quizDistractors excludes the word itself", () => {
  globalThis.shuffle = arr => arr;
  const word = WORDS[0];
  const distractors = _quizDistractors(word, WORDS);
  assert.ok(!distractors.some(d => d[0] === word[0]));
});

test("_quizDistractors returns up to 3 choices", () => {
  globalThis.shuffle = arr => arr;
  const distractors = _quizDistractors(WORDS[0], WORDS);
  assert.ok(distractors.length <= 3);
  assert.ok(distractors.length > 0, "sanity: the real WORDS pool yields distractors");
});

test("corpus sweep: no word's distractor pool is starved by the gloss filter", () => {
  // WORDS is 1000+ entries and only two gloss pairs collide today, so every
  // word should still find 3 distractors comfortably — a future edit that
  // narrows a whole gloss down to a tiny cluster would show up here first.
  globalThis.shuffle = arr => arr;
  const starved = WORDS.filter(w => _quizDistractors(w, WORDS).length < 3);
  assert.deepEqual(starved.map(w => w[0]), []);
});

// ── buildDeck: the shared due/fresh assembly policy ─────────────────────────
// Five call sites (flashcards, script flashcards, quiz, SRS review, sentence
// SRS) used to hand-roll near-identical due/fresh combination logic that
// differed in small, unexplained ways. This is the single implementation
// they all now share; these tests pin the two named policies independently
// of any one caller.

describe("buildDeck", () => {
  const now = () => Date.now() / 1000;
  const dueCard = (over) => ({ interval: 1, repetitions: 1, easeFactor: 2.5, due: now() - 10, totalReviews: 1, correctStreak: 1, ...over });
  const futureCard = (over) => ({ interval: 6, repetitions: 2, easeFactor: 2.5, due: now() + 86400, totalReviews: 2, correctStreak: 2, ...over });

  test("\"union\" mode combines due and fresh, deduped", () => {
    globalThis.shuffle = arr => [...arr].sort();
    progress = { a: dueCard(), b: futureCard() }; // a due, b not due, c/d unseen (fresh)
    const deck = buildDeck(["a", "b", "c", "d"], { mode: "union", freshCap: 10 });
    assert.deepEqual([...deck].sort(), ["a", "c", "d"], "due (a) + fresh (c,d); not-yet-due (b) excluded");
  });

  test("\"union\" mode respects freshCap", () => {
    globalThis.shuffle = arr => arr;
    progress = {};
    const deck = buildDeck(["a", "b", "c", "d", "e"], { mode: "union", freshCap: 2 });
    assert.equal(deck.length, 2);
  });

  test("\"due-first\" mode returns ONLY due cards when any are due, ignoring fresh entirely", () => {
    globalThis.shuffle = arr => arr;
    progress = { a: dueCard() };
    const deck = buildDeck(["a", "b", "c"], { mode: "due-first", freshCap: 10 });
    assert.deepEqual(deck, ["a"], "b/c (fresh) never appear while anything is due");
  });

  test("\"due-first\" mode falls back to fresh only when NOTHING is due", () => {
    globalThis.shuffle = arr => arr;
    progress = {};
    const deck = buildDeck(["a", "b"], { mode: "due-first", freshCap: 10 });
    assert.deepEqual(deck, ["a", "b"]);
  });

  test("fallback fires only when the policy result is empty", () => {
    globalThis.shuffle = arr => arr;
    progress = {}; // no due; a IS fresh, so union already has content
    const deck = buildDeck(["a"], { mode: "union", freshCap: 10, fallback: 5 });
    assert.deepEqual(deck, ["a"], "fallback must not override real content");
  });

  test("fallback supplies the first N keys when there's truly nothing due or fresh", () => {
    globalThis.shuffle = arr => arr;
    // every key already seen and not due — union AND due-first both go empty
    progress = { a: futureCard(), b: futureCard(), c: futureCard() };
    const deck = buildDeck(["a", "b", "c"], { mode: "union", freshCap: 10, fallback: 2 });
    assert.deepEqual(deck, ["a", "b"]);
  });

  test("with no fallback given, an empty policy result stays empty (the \"all caught up\" contract)", () => {
    globalThis.shuffle = arr => arr;
    progress = { a: futureCard() };
    const deck = buildDeck(["a"], { mode: "due-first", freshCap: 10 });
    assert.deepEqual(deck, [], "SRS Review/Sentence SRS rely on this to show 'all caught up' instead of stuffing in content");
  });

  test("cap limits the final deck length, applied AFTER shuffling", () => {
    let shuffleCalledWith = null;
    globalThis.shuffle = arr => { shuffleCalledWith = [...arr]; return [...arr].reverse(); };
    progress = {};
    const deck = buildDeck(["a", "b", "c", "d", "e"], { mode: "union", freshCap: 10, cap: 2 });
    assert.equal(shuffleCalledWith.length, 5, "the full pool is shuffled, not pre-capped");
    assert.deepEqual(deck, ["e", "d"], "cap takes the first N of the SHUFFLED order");
  });

  test("no cap given: deck length is unbounded (a big due pile means a long session)", () => {
    globalThis.shuffle = arr => arr;
    progress = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, dueCard()]));
    const keys = Object.keys(progress);
    assert.equal(buildDeck(keys, { mode: "union" }).length, 30);
  });
});
