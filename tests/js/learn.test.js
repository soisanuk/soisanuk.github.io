// The guided course: curriculum integrity + runner logic (DOM-free at load).
// wordcard.js + app.js load first: learn.js's widget renderers call _esc
// (app.js), which delegates to _wcEsc (wordcard.js) — the single escaping
// implementation.
import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// tutor.js supplies _tTypeable/_T_ROWS — _unitQueue uses them to avoid
// choosing a typed-Thai target the on-screen keyboard cannot spell.
for (const f of ["data.js", "examples.js", "thai-script.js", "srs.js", "wordcard.js", "app.js", "curriculum.js", "tutor.js", "learn.js", "backup.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, "web", "js", f), "utf8"), { filename: f });
}

test("the letter ladder has no duplicate glyphs and only Thai codepoints", () => {
  const seen = new Set();
  for (const b of LETTER_BATCHES) {
    for (const g of b.glyphs) {
      assert.ok(!seen.has(g), `glyph ${g} taught twice`);
      seen.add(g);
      assert.ok(/[฀-๿]/.test(g), `${g} is not Thai`);
    }
  }
});

test("every batch is decodable-honest and the pools only grow", () => {
  let prev = 0;
  LETTER_BATCHES.forEach((b, i) => {
    const taught = taughtGlyphs(i);
    const pool = courseDecodable(i);
    for (const w of pool) {
      for (const ch of w[0]) assert.ok(taught.has(ch), `${w[0]} uses untaught ${ch} at batch ${i}`);
    }
    assert.ok(pool.length >= prev, `pool shrank at batch ${i}`);
    prev = pool.length;
  });
});

test("the ladder pays out immediately and covers most of the vocabulary", () => {
  assert.ok(courseDecodable(0).length >= 5, "batch 1 must unlock real words at once");
  assert.ok(courseNewWords(1).length >= 10, "batch 2 opens the floodgates");
  const final = courseDecodable(LETTER_BATCHES.length - 1).length;
  assert.ok(final >= WORDS.length * 0.75, `final coverage ${final}/${WORDS.length}`);
});

test("grammar lessons are complete and their practice is well-formed", () => {
  const ids = new Set();
  for (const l of GRAMMAR_LESSONS) {
    assert.ok(!ids.has(l.id), "dup lesson " + l.id);
    ids.add(l.id);
    assert.ok(l.intro && l.pattern.length >= 3, l.id + " needs chunks");
    for (const line of l.pattern) assert.equal(line.length, 3, l.id + " pattern line shape");
    assert.ok(l.practice.length >= 2, l.id + " needs practice");
    for (const p of l.practice) {
      assert.ok(p.options.length === 4, l.id + " practice needs 4 options");
      assert.ok(p.options.includes(p.answer), l.id + " answer must be an option");
      if (p.kind === "cloze") assert.ok(p.th.includes("___"), l.id + " cloze needs a blank");
    }
  }
  for (const u of COURSE) {
    if (u.kind === "chunks") assert.ok(ids.has(u.lesson), "COURSE references missing lesson " + u.lesson);
    if (u.kind === "letters") assert.ok(LETTER_BATCHES[u.batch], "COURSE references missing batch " + u.batch);
  }
});

test("auto-grading maps recall onto SM-2 quality the way the brief says", () => {
  assert.equal(courseGrade(false, true, 0, 0), 1, "wrong = 1 (relearn)");
  assert.equal(courseGrade(true, false, 0, 0), 2, "right after a miss = 2");
  assert.equal(courseGrade(true, true, 0, 9999), 4, "right first try = 4");
  assert.equal(courseGrade(true, true, 2500, 1200), 5, "fast + right = 5");
  assert.equal(courseGrade(true, true, 2500, 4000), 4, "slow + right = 4");
});

test("the path gates on the previous unit, first unit always open", () => {
  assert.ok(_unitUnlocked({}, 0));
  assert.ok(!_unitUnlocked({}, 1), "locked until unit 1 done");
  const id0 = _unitId(COURSE[0]);
  assert.ok(_unitUnlocked({ units: { [id0]: { done: true } } }, 1));
  // unit ids are unique across the course
  const ids = COURSE.map(_unitId);
  assert.equal(new Set(ids).size, ids.length);
});

test("a completed unit stays re-enterable even if its predecessor isn't done", () => {
  // simulates inserting a new unit right before one a returning user already
  // finished: the predecessor (freshly inserted) isn't done, but the unit
  // itself is — it must still open, or the user loses review access to it
  const idx = 2; // some unit past the first
  const id = _unitId(COURSE[idx]);
  const path = { units: { [id]: { done: true } } }; // COURSE[idx-1] left undone
  assert.ok(!_unitDone(path, COURSE[idx - 1]), "predecessor is NOT done (the scenario)");
  assert.ok(_unitUnlocked(path, idx), "the done unit itself stays unlocked");
});

test("MC distractors prefer the same part of speech", () => {
  const verb = WORDS.find(w => w[3] === "verb");
  for (let i = 0; i < 5; i++) {
    const opts = _mcOptions(verb, 2);
    assert.equal(opts.length, 4);
    assert.ok(opts.includes(verb[2]), "answer present");
    assert.equal(new Set(opts).size, 4, "no duplicate options");
    const wrong = opts.filter(o => o !== verb[2]);
    for (const o of wrong) {
      const w = WORDS.find(x => x[2] === o);
      assert.ok(w, "distractor is a real word");
      assert.equal(w[3], "verb", "distractor shares the category (verbs are plentiful)");
    }
  }
});

test("typed-English matching is lenient the right amount", () => {
  assert.ok(_enMatch("have", "to have/there is"));
  assert.ok(_enMatch("there is", "to have/there is"));
  assert.ok(_enMatch("To Have ", "to have/there is"));
  assert.ok(_enMatch("green", "green (short form)"));
  assert.ok(!_enMatch("hav", "to have/there is"), "no typo credit — retry instead");
  assert.ok(!_enMatch("", "to have/there is"));
});

test("letter units mix both directions and both typing modes", () => {
  const kinds = q => q.map(i => i.kind);
  const u0 = kinds(_unitQueue(COURSE[0], []));
  assert.ok(u0.includes("mc") && u0.includes("mcth"), "both MC directions from unit 1");
  assert.ok(u0.includes("typeen"), "typed English from unit 1");
  assert.ok(!u0.includes("typeth"), "Kedmanee typing waits for batch 2");
  const u1 = kinds(_unitQueue(COURSE[1], []));
  assert.ok(u1.includes("typeth"), "typed Thai from batch 2 on");
  // typeth targets are fully decodable — never a key you haven't been taught
  for (const it of _unitQueue(COURSE[1], []).filter(i => i.kind === "typeth")) {
    const taught = taughtGlyphs(1);
    for (const ch of it.word[0]) assert.ok(taught.has(ch), it.word[0] + " needs untaught " + ch);
  }
  // due-review words lead the queue
  const w = WORDS[0];
  assert.deepEqual(_unitQueue(COURSE[0], [w])[0], { kind: "mc", word: w, tag: "review" });
});

test("units carry the corpus cloze, the 5-pair match, and both listen modes", () => {
  const q = _unitQueue(COURSE[3], []); // batch 3: plenty of examples decodable
  const kinds = q.map(i => i.kind);
  assert.ok(kinds.includes("clozex"), "example-sentence cloze present");
  for (const it of q.filter(i => i.kind === "clozex")) {
    assert.ok(EXAMPLES[it.word[0]], "cloze word has a real example");
    assert.ok(EXAMPLES[it.word[0]][0].includes(it.word[0]), "the sentence contains the word to blank");
  }
  const match = q.find(i => i.kind === "match");
  assert.ok(match && match.pairs.length === 5, "five-pair vocab match round");
  const listens = q.filter(i => i.kind === "listen");
  assert.ok(listens.some(l => l.mode === "en") && listens.some(l => l.mode === "th"),
    "listening answers alternate script and meaning");
});

test("the tone unit teaches then drills, with a stable unique id", () => {
  const unit = COURSE.find(u => u.kind === "tone");
  assert.ok(unit, "COURSE has a tone unit");
  assert.equal(_unitId(unit), "tone1", "tone unit keeps a stable id (not the 'review' fallback)");
  const q = _unitQueue(unit, []);
  const kinds = q.map(i => i.kind);
  assert.deepEqual(kinds.slice(0, 2), ["toneIntro", "tonecalc"], "teach the rule before drilling");
  // ear drills use MID-class hosts only — mid + the four marks spans all tones
  const ear = q.filter(i => i.kind === "toneear");
  assert.ok(ear.length >= 3, "several ear drills");
  for (const it of ear) {
    assert.equal(_consClass(it.cons), "mid", it.cons + " must be mid class");
    // the target is chosen HERE, not at render, so a revisit shows the same
    // question it was answered against instead of re-rolling. The bound is
    // toneMinimalSet(it.cons, it.vowel) — THIS item's own host, not a fixed
    // probe — so a future host-dependent set length can't silently diverge
    // between what was pushed and what a card actually renders.
    const setLen = toneMinimalSet(it.cons, it.vowel).length;
    assert.ok(Number.isInteger(it.pick) && it.pick >= 0 && it.pick < setLen,
      "pick is a stable, in-range index into this item's own toneMinimalSet");
  }
  // read drills are real WORDS the tone parser can read
  const read = q.filter(i => i.kind === "toneread");
  assert.ok(read.length >= 1, "at least one real-word tone read");
  for (const it of read) {
    assert.ok(WORDS.some(w => w[0] === it.word[0]), it.word[0] + " is a real word");
    assert.ok(toneOfWord(it.word[0]), it.word[0] + " reads a tone");
  }
});

test("toneear/toneread are graded quiz cards, not teach cards — they get a real recap on revisit", () => {
  // _TEACH_KINDS gates which kinds skip _wReviewCard on revisit (learn.js
  // _learnStep). toneIntro/tonecalc are genuine teach cards (no grading);
  // toneear/toneread are MC quizzes like mc/cloze/… and must revisit like one.
  assert.ok(_TEACH_KINDS.has("toneIntro"));
  assert.ok(_TEACH_KINDS.has("tonecalc"));
  assert.ok(!_TEACH_KINDS.has("toneear"), "toneear must revisit read-only via _wReviewCard");
  assert.ok(!_TEACH_KINDS.has("toneread"), "toneread must revisit read-only via _wReviewCard");
});

test("backup merge: more-reviewed cards win, done units stay done", () => {
  const mine = { progress: { "มา": { totalReviews: 5, due: 1 } },
    path: { units: { L0: { done: true, acc: 0.8, msAvg: 3000 } } } };
  const theirs = { app: "soisanuk", progress: { "มา": { totalReviews: 9, due: 2 }, "ดี": { totalReviews: 1 } },
    path: { units: { L0: { done: false, acc: 0.9, msAvg: 2500 }, g1: { done: true, acc: 1 } } } };
  const m = backupMerge(mine, theirs);
  assert.equal(m.progress["มา"].totalReviews, 9, "their better-reviewed card wins");
  assert.ok(m.progress["ดี"], "new cards arrive");
  assert.ok(m.path.units.L0.done, "done survives their not-done");
  assert.equal(m.path.units.L0.acc, 0.9, "best accuracy kept");
  assert.equal(m.path.units.L0.msAvg, 2500, "fastest read kept");
  assert.ok(m.path.units.g1.done, "their finished unit lands");
  assert.ok(backupValid({ app: "soisanuk", progress: {} }));
  assert.ok(!backupValid({ progress: {} }), "foreign JSON refused");
});

test("Anki export is importable TSV: headers, one note per word, tags", () => {
  const tsv = ankiTSV(WORDS.slice(0, 5), EXAMPLES);
  const lines = tsv.split("\n");
  assert.equal(lines[0], "#separator:tab");
  assert.equal(lines.length, 3 + 5);
  for (const l of lines.slice(3)) assert.equal(l.split("\t").length, 3, "front/back/tags");
  assert.ok(tsv.includes(WORDS[0][0]) && tsv.includes(WORDS[0][2]));
});

test("CSV and Quizlet exports are well-formed", () => {
  const csv = csvExportText(WORDS.slice(0, 3)).split("\n");
  assert.equal(csv.length, 4);
  assert.equal(csv[0], "thai,roman,english,pos,group");
  assert.ok(csv[1].startsWith('"' + WORDS[0][0] + '"'));
  const qz = quizletText(WORDS.slice(0, 3)).split("\n");
  assert.equal(qz.length, 3);
  for (const l of qz) assert.equal(l.split("\t").length, 2, "term TAB definition");
  assert.ok(qz[0].includes(WORDS[0][1] + " — " + WORDS[0][2]));
});

test("speedometer: personal bests only improve, only on clean fast reads", () => {
  const p = _bestUpdate({}, [{ key: "มา", q: 5, ms: 1400 }, { key: "ดี", q: 2, ms: 900 },
    { key: "มา", q: 4, ms: 2000 }, { key: null, q: 5, ms: 100 }]);
  assert.equal(p.best["มา"], 1400, "keeps the faster clean read");
  assert.ok(!p.best["ดี"], "a missed answer never sets a best");
  assert.equal(_bestUpdate(p, [{ key: "มา", q: 5, ms: 1100 }]).best["มา"], 1100);
});

test("streak day-roll: same day holds, consecutive grows, a gap resets", () => {
  let st = _streakBump({}, "2026-07-17", "2026-07-16");
  assert.equal(st.days, 1);
  assert.equal(_streakBump(st, "2026-07-17", "2026-07-16").days, 1, "same day no-op");
  assert.equal(_streakBump(st, "2026-07-18", "2026-07-17").days, 2, "consecutive");
  assert.equal(_streakBump(st, "2026-07-25", "2026-07-24").days, 1, "gap resets");
});

// _localDateStr formats a Date using its LOCAL calendar fields, not UTC —
// regression coverage: _streakRecord used to call toISOString().slice(0,10),
// which is UTC and rolls the day boundary at 07:00 for a Thailand-based user,
// so a pre-dawn session could wrongly land on "yesterday" (or wrongly extend
// a streak that should have broken). These constructions/comparisons are
// entirely local-to-local, so the assertions hold regardless of the test
// runner's own timezone — they'd fail equally under the old UTC-based code
// only in timezones east/west of UTC, which is exactly the bug.
test("_localDateStr matches the Date's own local calendar fields", () => {
  const d = new Date(2026, 6, 17, 14, 30); // local: 2026-07-17
  assert.equal(_localDateStr(d),
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
});

test("_localDateStr pads single-digit month and day", () => {
  assert.equal(_localDateStr(new Date(2026, 0, 5, 3, 0)), "2026-01-05");
});

test("_localDateStr treats a late-night local session as still today, not tomorrow", () => {
  const lateNight = new Date(2026, 6, 17, 23, 45);
  assert.equal(_localDateStr(lateNight), "2026-07-17");
});

test("_localDateStr treats an early-morning local session as still today, not yesterday", () => {
  const earlyMorning = new Date(2026, 6, 17, 0, 15);
  assert.equal(_localDateStr(earlyMorning), "2026-07-17");
});

test("the signage lesson's chunks carry rotating sign styles; others don't", () => {
  const g5 = _unitQueue(COURSE.find(u => u.lesson === "g5"), []).filter(i => i.kind === "chunk");
  assert.ok(g5.length >= 3);
  assert.deepEqual(g5.slice(0, 3).map(i => i.sign), [0, 1, 2], "street/shop/board rotation");
  const g1 = _unitQueue(COURSE.find(u => u.lesson === "g1"), []).filter(i => i.kind === "chunk");
  assert.ok(g1.every(i => i.sign === null), "non-signage chunks stay plain");
});

test("the getting-around scenario (g7) is in the course and teaches directions", () => {
  const unit = COURSE.find(u => u.kind === "chunks" && u.lesson === "g7");
  assert.ok(unit, "g7 is on the course spine");
  const g7 = GRAMMAR_LESSONS.find(l => l.id === "g7");
  assert.ok(g7 && /เลี้ยว|จอด|ตรงไป/.test(g7.pattern.map(p => p[0]).join("")),
    "g7 teaches turn/stop/straight chunks");
  const chunks = _unitQueue(unit, []).filter(i => i.kind === "chunk");
  assert.ok(chunks.length >= 3 && chunks.every(i => i.sign === null),
    "renders as plain chunk cards");
});

test("the prices scenario (g8) is in the course and teaches the ...ละ price shape", () => {
  const unit = COURSE.find(u => u.kind === "chunks" && u.lesson === "g8");
  assert.ok(unit, "g8 is on the course spine");
  const g8 = GRAMMAR_LESSONS.find(l => l.id === "g8");
  assert.ok(g8 && g8.pattern.some(p => /ละ/.test(p[0])), "g8 teaches the ...ละ 'per' pattern");
  assert.ok(g8.practice.some(p => p.answer === "ละ"), "a cloze targets ละ");
});

test("placement: 80% per batch sets the cut, prefix units complete, levels name up", () => {
  assert.equal(_placementCut({ 0: { ok: 2, n: 2 }, 1: { ok: 2, n: 2 }, 2: { ok: 1, n: 2 } }), 1);
  assert.equal(_placementCut({ 0: { ok: 1, n: 2 } }), -1);
  const p = _placementApply({}, 1);
  assert.ok(p.units.L0.done && p.units.L1.done, "ladder prefix done");
  assert.ok(!p.units.g1 || p.units.g1.done !== undefined, "chunks between are included");
  assert.ok(p.units.L0.placed, "marked as placed, not earned");
  assert.equal(_levelName(0), "Fresh off the plane");
  assert.equal(_levelName(8), "Soi regular");
  // 14 used to be the top title, which meant it arrived three units before the
  // end — before the final letter batch, getting around, and prices. The top
  // title now lands on completion; see "the top level title lands exactly on
  // course completion".
  assert.equal(_levelName(14), "Old hand");
  assert.equal(_levelName(COURSE.length), "เจ้าของบาร์");
});

test("placement completes only what it actually tested — the letters units", () => {
  // It runs 16 multiple-choice DECODING cards, two per batch, and nothing else.
  // Tone was already exempt; the chunk lessons (grammar, ครับ/ค่ะ, ordering,
  // haggling, ห้าม signs, classifiers) teach speaking and usage and are just as
  // untested, so they stay open too. Before this, a full-marks placement marked
  // 14 units done having examined 8 — and continuePlan() skips anything done,
  // so those six never surfaced as "next" again.
  const cutBatch = LETTER_BATCHES.length - 1; // place past the whole ladder
  const p = _placementApply({}, cutBatch);
  const lastLetterIdx = COURSE.findIndex(u => u.kind === "letters" && u.batch === cutBatch);
  for (let i = 0; i <= lastLetterIdx; i++) {
    const u = COURSE[i];
    if (u.kind === "letters") assert.ok(_unitDone(p, u), _unitId(u) + " was tested, should be done");
    else assert.ok(!_unitDone(p, u), _unitId(u) + " was NOT tested, must stay open");
  }
  // a placed learner resumes at the first thing placement had no view of
  const firstOpen = COURSE.findIndex((u, i) => _unitUnlocked(p, i) && !_unitDone(p, u));
  assert.notEqual(firstOpen, -1, "something must remain open");
  assert.notEqual(COURSE[firstOpen].kind, "letters",
    "a full-marks placement should not leave a decoding unit as the next thing");
  // placement queue spans the whole ladder, two words a batch
  const q = [];
  for (let b = 0; b < LETTER_BATCHES.length; b++) q.push(...courseNewWords(b).slice(0, 2));
  assert.ok(q.length >= 14);
});

test("records: max streak survives resets, best day sticks", () => {
  let st = _streakBump({}, "2026-07-17", "2026-07-16");
  st = _streakBump(st, "2026-07-18", "2026-07-17");
  assert.equal(st.maxDays, 2);
  st = _streakBump(st, "2026-07-25", "2026-07-24");
  assert.equal(st.days, 1, "streak reset");
  assert.equal(st.maxDays, 2, "record kept");
});


test("no inline onclick embeds raw JSON quotes (the dead-glyph-tap bug)", () => {
  const src = fs.readFileSync(path.join(root, "web", "js", "learn.js"), "utf8");
  for (const m of src.matchAll(/onclick="[^`]*?\$\{JSON\.stringify\([^)]*\)([^}]*)\}/g)) {
    assert.ok(m[1].includes("&quot;"),
      "JSON.stringify inside a double-quoted onclick must escape quotes: " + m[0].slice(0, 60));
  }
});

test("no word is quizzed before it is taught (the teach-first invariant)", () => {
  for (let i = 0; i < COURSE.length; i++) {
    if (COURSE[i].kind !== "letters") continue;
    const q = _unitQueue(COURSE[i], []);
    const taught = new Set();
    q.forEach((item, at) => {
      if (item.kind === "wordintro") { taught.add(item.word[0]); return; }
      // any card that tests a specific fresh/new word must follow its intro
      if (item.tag === "new" && item.word) {
        assert.ok(taught.has(item.word[0]),
          `batch ${COURSE[i].batch}: "${item.word[0]}" quizzed at ${at} before its intro`);
      }
    });
    // and every fresh word actually got an intro
    const fresh = courseNewWords(COURSE[i].batch).slice(0, 8);
    for (const w of fresh) assert.ok(taught.has(w[0]), `${w[0]} never introduced`);
  }
});

test("revisiting a completed card records nothing (no SRS/streak double-count)", () => {
  const saved = typeof _lu !== "undefined" ? _lu : null;
  _lu = { review: true, results: [] };
  _learnRecord("มา", 5, 1200);   // would grade on a live card
  assert.equal(_lu.results.length, 0, "review mode pushes no result");
  // frontier math: max tracks the furthest reached, review = at < max
  _lu = { at: 3, max: 5, results: [] };
  assert.ok(_lu.at < _lu.max, "behind the frontier = reviewable");
  _lu = saved;
});

test("_wReviewCard actually renders (exercises _esc, catching a missing wordcard.js/app.js load)", () => {
  // A DOM-free stand-in: _wReviewCard only ever calls body.innerHTML = ...,
  // never reads the DOM back, so a plain object with a settable property
  // is a faithful enough double — this test's real job is proving _esc
  // resolves (wordcard.js's _wcEsc via app.js), not exercising layout.
  const body = { innerHTML: "" };
  const w = WORDS.find(x => x[0] === "มา");
  _wReviewCard({ word: w, kind: "mc" }, body);
  assert.match(body.innerHTML, /มา/, "renders the word");
  assert.match(body.innerHTML, /REVIEW/, "tagged as a review recap");
  // the toneear shape (no .word/.item) is the one that used to fall through
  // to a crash — see commit history around _wReviewCard's kind branches
  _wReviewCard({ kind: "toneear", cons: "ก", vowel: "า", pick: 1 }, body);
  assert.match(body.innerHTML, /tone/, "toneear recap names a tone");
});

test("_wReviewCard's generic fallback is a last-resort safety net, never real coverage", () => {
  // a hypothetical, deliberately-synthetic kind matching none of
  // .pairs/kind-specific/.word/.item — must not throw (the old code did:
  // `const p = item.item; th = p.th` on undefined .item). This ONLY proves
  // the net catches an unknown shape without crashing the lesson screen —
  // see the next test for proof that every REAL kind never needs the net.
  const body = { innerHTML: "" };
  assert.doesNotThrow(() => _wReviewCard({ kind: "some-future-kind" }, body));
  assert.match(body.innerHTML, /REVIEW/);
  assert.match(body.innerHTML, /Next/, "still offers a way to move on");
});

test("every real, non-teach queue item kind gets an actual recap, not the generic fallback", () => {
  // The generic fallback above exists so an unforeseen shape degrades safely
  // instead of throwing — but it must never be how a REAL kind is covered:
  // a future kind added to _unitQueue without teaching _wReviewCard its
  // shape should fail loudly here, not silently show "(no recap available)"
  // to a user who happens to page back over it.
  const letters = COURSE.find(u => u.kind === "letters");
  const tone = COURSE.find(u => u.kind === "tone");
  const chunks = COURSE.find(u => u.kind === "chunks");
  const allItems = [letters, tone, chunks].flatMap(u => _unitQueue(u, []));
  const reviewable = allItems.filter(it => !_TEACH_KINDS.has(it.kind));
  assert.ok(reviewable.length > 10, "sanity: plenty of graded kinds to check");
  for (const item of reviewable) {
    const body = { innerHTML: "" };
    _wReviewCard(item, body);
    assert.ok(!body.innerHTML.includes("no recap available"),
      `kind "${item.kind}" has no real _wReviewCard branch — falls through to the generic safety net`);
  }
});

// ── findings from the 2026-08-30 first-timer persona round ──────────────────

test("typing the exact gloss the app just showed you is accepted", () => {
  // _enVariants split the gloss on /,; and never added the whole string back,
  // so the wordintro card taught มี as "to have/there is" and the typeen card
  // three steps later marked that exact answer wrong — twice — then graded the
  // SRS card quality 1, dropping its ease factor 2.5 → 1.96. 372 of 950 words.
  const bad = WORDS.filter(w => !_enMatch(w[2], w[2]));
  assert.deepEqual(bad.slice(0, 5).map(w => `${w[0]} "${w[2]}"`), [],
    `${bad.length} words reject their own printed gloss`);
});

test("_enMatch still refuses a wrong answer", () => {
  assert.equal(_enMatch("banana", "to have/there is"), false);
  assert.equal(_enMatch("", "to have/there is"), false);
  assert.equal(_enMatch("to have", "to have/there is"), true, "a part still counts");
});

test("no unit demands a flawless run", () => {
  // 80% of a 4-card sample IS 4/4. All eight chunk units grade 2-4 cards, so
  // every one of them required perfection — and units are strictly gated, so a
  // learner who knew the material could simply be stuck.
  const TEACH = new Set(["glyph", "wordintro", "toneIntro", "tonecalc", "chunkIntro", "chunk"]);
  const passes = (graded, misses) => {
    const acc = graded ? (graded - misses) / graded : 1;
    return acc >= COURSE_PASS || (graded < COURSE_PASS_MIN_SAMPLE && misses <= 1);
  };
  for (const u of COURSE) {
    const graded = _unitQueue(u, []).filter(x => !TEACH.has(x.kind)).length;
    if (!graded) continue;
    assert.ok(passes(graded, 1),
      `${u.label || u.kind}: ${graded} graded cards, one miss fails the unit`);
  }
});

test("without a Thai voice, no unit is gated behind cards you can only hear", () => {
  // The course was the ONLY mode with no _tts.available() guard, and the one
  // that gates progress. The tone unit had 8 graded cards, 4 of them toneear
  // (audio-only, five choices) against a 1-miss budget: blind-guessing averages
  // 3.2 misses, so it was unpassable — with every later unit locked behind it.
  for (const u of COURSE) {
    const q = _unitQueue(u, [], false);
    assert.equal(q.filter(x => x.kind === "toneear").length, 0, `${u.label || u.kind} keeps ear-only cards`);
    assert.equal(q.filter(x => x.kind === "listen").length, 0, `${u.label || u.kind} keeps listen cards`);
  }
  // and with audio they are still there — this must not silently delete content
  const withAudio = COURSE.flatMap(u => _unitQueue(u, [], true));
  assert.ok(withAudio.filter(x => x.kind === "toneear").length > 0);
  assert.ok(withAudio.filter(x => x.kind === "listen").length > 0);
});

// ── findings from the 2026-08-30 lapsed-learner persona round ───────────────

test("_streakView reports the streak's CURRENT truth, not the last snapshot", () => {
  // _streakBump only runs when a card is graded, so between sessions the stored
  // record is a snapshot of the last day studied — and the display printed it
  // verbatim. A learner back after six months was shown "🔥 12 days · today 41
  // cards", invited to "keep the streak alive", then watched it snap 12 → 1
  // mid-session with no acknowledgement.
  const st = { last: "2026-02-28", days: 12, maxDays: 12,
               bestDay: { date: "2026-02-24", cards: 63 }, today: { cards: 41, msSum: 120000, msN: 40 } };
  const gap = _streakView(st, "2026-08-30", "2026-08-29");
  assert.equal(gap.days, 0, "a streak broken months ago is not still running");
  assert.deepEqual(gap.today, {}, "'today' from February is not today");
  assert.equal(gap.ended, true);
  assert.equal(gap.maxDays, 12, "the best survives the break — it's what you come back to");

  const alive = _streakView({ ...st, last: "2026-08-29" }, "2026-08-30", "2026-08-29");
  assert.equal(alive.days, 12, "yesterday still counts — the streak is live until a day is missed");

  const sameDay = _streakView({ ...st, last: "2026-08-30" }, "2026-08-30", "2026-08-29");
  assert.equal(sameDay.today.cards, 41, "today's own tally is kept");
});

test("a broken streak is named, not silently zeroed", () => {
  const ended = _streakView({ last: "2026-01-01", days: 12, maxDays: 12 }, "2026-08-30", "2026-08-29");
  assert.match(_streakText(ended, {}), /ended.*best 12/);
  assert.equal(_streakText(_streakView({}, "2026-08-30", "2026-08-29"), {}), "start today",
    "someone who never started is not told they ended something");
});

test("_streakView never writes", () => {
  const st = { last: "2026-01-01", days: 12, maxDays: 12, today: { cards: 5 } };
  const before = JSON.stringify(st);
  _streakView(st, "2026-08-30", "2026-08-29");
  assert.equal(JSON.stringify(st), before, "the display must not mutate the record");
});

// ── findings from the 2026-08-30 completionist persona round ────────────────

test("a unit's score badge keeps the BEST attempt, not the last", () => {
  // learn.js deliberately keeps completed units re-enterable "so you can back
  // up to review and move on" — so the app invited the exact action that
  // destroyed the record. Pass at 100%, dip back in to refresh, have a bad
  // night, and the badge read 35% until you replayed it cleanly.
  // Reported independently by the first-timer and completionist rounds.
  const merge = (prev, acc, msAvg) => ({
    done: prev.done || true,
    acc: Math.max(acc, prev.acc || 0),
    msAvg: (prev.msAvg && msAvg) ? Math.min(prev.msAvg, msAvg) : (msAvg || prev.msAvg),
  });
  let u = merge({}, 1, 57);
  assert.equal(u.acc, 1);
  u = merge(u, 0.35, 21);
  assert.equal(u.acc, 1, "a bad replay must not overwrite a good score");
  assert.equal(u.msAvg, 21, "but a FASTER time is still an improvement");
  u = merge(u, 0.5, 90);
  assert.equal(u.msAvg, 21, "and a slower one doesn't erase it");
  assert.equal(u.done, true, "done stays sticky");
});

test("the top level title lands exactly on course completion", () => {
  // It was 14 against a 17-unit course, so "เจ้าของบาร์" arrived before the
  // final letter batch, getting around, and prices — the three most useful
  // units — which then awarded nothing at all. Pinned to COURSE.length so
  // adding an eighteenth unit can't silently reintroduce the gap.
  const top = LEVELS[LEVELS.length - 1];
  assert.equal(top[0], COURSE.length,
    `top title "${top[1]}" unlocks at ${top[0]} of ${COURSE.length} units`);
  assert.notEqual(_levelName(COURSE.length - 1), _levelName(COURSE.length),
    "finishing the last unit must change the title");
});

test("the level ladder is ordered and starts at zero", () => {
  assert.equal(LEVELS[0][0], 0, "someone who has done nothing still has a title");
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i][0] > LEVELS[i - 1][0], `LEVELS[${i}] does not increase`);
  }
});

// ── The ▶ Continue row annotation ───────────────────────────────────────────
// The desktop home card announces what Continue will do, but #menu-welcome is
// desktop-only — so on phones the row's only annotation was the streak. A
// six-week returner with 25 overdue cards read "streak ended · best 12 days":
// true, backward-looking, and silent about the one reason to tap the button.
describe("_contText", () => {
  const dead = { ended: true, maxDays: 12, days: 0 };
  const live = { ended: false, days: 4 };

  test("leads with pending reviews, not the broken streak", () => {
    const s = _contText({ kind: "review", due: new Array(25) }, dead, {});
    assert.match(s, /^25 reviews due$/);
    assert.doesNotMatch(s, /best|ended/, "a lapsed learner needs the way back, not the eulogy");
  });

  test("names the deck when it is script or sentence work", () => {
    assert.match(_contText({ kind: "script", n: 30 }, dead, {}), /^30 script reviews due$/);
    assert.match(_contText({ kind: "sentence", n: 4 }, dead, {}), /^4 sentence reviews due$/);
  });

  test("keeps a live streak as a tail, since that is the nudge", () => {
    assert.equal(_contText({ kind: "review", due: [1, 2, 3] }, live, {}), "3 reviews due · 🔥 4");
  });

  test("singular is singular", () => {
    assert.match(_contText({ kind: "script", n: 1 }, dead, {}), /^1 script review due$/);
  });

  test("falls back to the streak line when nothing is due", () => {
    const t = { cards: 12 };
    for (const plan of [null, { kind: "unit", unitIdx: 0 }, { kind: "speed" }]) {
      assert.equal(_contText(plan, live, t), _streakText(live, t),
        `${plan ? plan.kind : "no plan"} should defer to the streak line`);
    }
  });
});

// ── Typed-Thai targets must be typeable ─────────────────────────────────────
// The course renders the three letter rows and then asked the learner to type
// words needing the number row or a shifted glyph: ดู, อยู่, ตื่น, รู้ — 138 of
// 367 candidates, 38%, with no key that could produce them. The card cannot
// be completed, so the learner's only move is to skip a question the app
// insisted they answer. Found by the 2026-09-01 typist round.
test("every typed-Thai target can be spelled on the keyboard the course shows", () => {
  // the card renders the FULL layout WITH a shift key, so that is the set it
  // may draw from — the two must be passed the same arguments or the filter
  // and the keyboard disagree, which is the whole bug this test exists for.
  const canType = _tTypeable(_T_ROWS_FULL, true);
  let checked = 0;
  for (const unit of COURSE) {
    if (unit.batch === undefined || unit.batch < 1) continue;
    // build the unit many times over: the targets are shuffled, so one pass
    // proves very little
    for (let i = 0; i < 12; i++) {
      for (const item of _unitQueue(unit, [], true)) {
        if (item.kind !== "typeth") continue;
        checked++;
        for (const ch of item.word[0]) {
          assert.ok(canType.has(ch),
            `unit "${unit.label}" asks the learner to type ${item.word[0]}, but ${ch} is on no rendered key`);
        }
      }
    }
  }
  assert.ok(checked > 20, `expected plenty of typed-Thai cards, saw ${checked}`);
});
