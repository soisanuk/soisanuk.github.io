// The guided course: curriculum integrity + runner logic (DOM-free at load).
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const f of ["data.js", "examples.js", "thai-script.js", "srs.js", "curriculum.js", "learn.js", "backup.js"]) {
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
