// Tests for web/js/grammar.js (Grammar & Examples) and the bonus lesson it
// serves. Evaluated via node:vm as classic browser scripts; only the pure
// helpers are called, never the screen.
// Run with: node --test tests/js/

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "thai-script.js", "tokeniser.js", "wordcard.js",
                 "curriculum.js", "lexicon-th.js", "seg-extra.js", "seg-phrases.js", "segment.js", "grammar.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
_segInit(_segEffective(THAI_LEXICON.split("\n")));

test("every recorded review still matches its sentence word for word", () => {
  // If this fails, a reviewed sentence was edited. Either get the new wording
  // reviewed, or drop it from EXAMPLE_REVIEWS: the mark must not outlive the
  // wording it was given for.
  const stale = Object.entries(EXAMPLE_REVIEWS)
    .filter(([k, [s]]) => !EXAMPLES[k] || EXAMPLES[k][0] !== s).map(([k]) => k);
  assert.deepEqual(stale, []);
  assert.equal(Object.keys(EXAMPLES).filter(k => exampleReview(k)).length, 25);
});

test("every SOLT quotation still matches its sentence word for word", () => {
  const stale = Object.entries(EXAMPLE_SOLT)
    .filter(([k, [s]]) => !EXAMPLES[k] || EXAMPLES[k][0] !== s).map(([k]) => k);
  assert.deepEqual(stale, []);
  assert.equal(Object.keys(EXAMPLES).filter(k => exampleSolt(k)).length, 56);
  for (const [, cite] of Object.values(EXAMPLE_SOLT)) assert.match(cite, /^(Instructor book )?M[1-5]L\d/);
});

test("an edited sentence loses its review mark", () => {
  const saved = EXAMPLES["รูป"];
  try {
    EXAMPLES["รูป"] = ["รูปนั้นสวยมาก", saved[1], saved[2]];
    assert.equal(exampleReview("รูป"), null);
  } finally { EXAMPLES["รูป"] = saved; }
  assert.equal(exampleReview("รูป"), "fbd2933");
});

test("markers: whole token, … prefix, and space-separated sequence", () => {
  assert.ok(grammarPatternsOf("รูปนี้สวยมาก").includes("g6"));
  assert.ok(grammarPatternsOf("อาหารนี้ไม่ดีเลย").includes("g1"), "ไม่ดี counts as negation");
  assert.ok(grammarPatternsOf("เพื่อนของฉันร้องเพลงเพราะมาก").includes("g9"));
  // ของ alone is "thing" as often as "of": no owner after it, no match
  assert.ok(!grammarPatternsOf("ฉันไปซื้อของ").includes("g9"));
  // นี้ inside วันนี้ is part of a word the learner meets whole
  assert.ok(!grammarPatternsOf("วันนี้ร้อน").includes("g6"));
});

test("every lesson has markers, and every marker token is a course word", () => {
  const words = new Set(WORDS.map(w => w[0]));
  for (const l of GRAMMAR_LESSONS) {
    assert.ok(Array.isArray(l.markers) && l.markers.length, l.id + " needs markers");
    for (const m of l.markers) {
      if (m.endsWith("…")) {
        const stem = m.slice(0, -1);
        assert.ok([...words].some(w => w.startsWith(stem)), `${l.id}: no course word starts with ${stem}`);
        continue;
      }
      for (const t of m.split(" ")) assert.ok(words.has(t), `${l.id} marker ${t} not in WORDS`);
    }
    assert.ok(grammarExamples(l.id).length >= 1, l.id + " finds no examples");
  }
});

test("examples come back native first, then shortest, in a stable order", () => {
  const ks = grammarExamples("g6");
  assert.deepEqual(ks, grammarExamples("g6"));
  const native = k => !!(exampleReview(k) || exampleSolt(k));
  const rev = ks.map(native);
  assert.equal(rev.indexOf(false), rev.filter(Boolean).length, "reviewed and SOLT sentences lead");
  const tail = ks.filter(k => !native(k)).map(k => [...EXAMPLES[k][0]].length);
  assert.deepEqual(tail, [...tail].sort((a, b) => a - b));
});

test("bonus lessons are off the course spine", () => {
  for (const id of ["g9", "g10", "g11"]) {
    const g = GRAMMAR_LESSONS.find(l => l.id === id);
    assert.equal(g.bonus, true, id);
    assert.ok(!COURSE.some(u => u.kind === "chunks" && u.lesson === id), id);
  }
  for (const l of GRAMMAR_LESSONS.filter(l => !l.bonus)) {
    assert.ok(COURSE.some(u => u.kind === "chunks" && u.lesson === l.id), l.id + " should be on the spine");
  }
});

test("every bonus lesson uses only course words, romanised as the course has them", () => {
  const map = Object.fromEntries(WORDS.map(w => [w[0], w]));
  for (const g9 of GRAMMAR_LESSONS.filter(l => l.bonus)) {
  for (const [th, rom] of g9.pattern) {
    const toks = segmentThai(th).map(t => t.base || t.text).filter(t => t.trim());
    for (const t of toks) assert.ok(map[t], `${th}: ${t} is not a course word`);
    assert.equal(rom.replace(/\s+/g, " "), toks.map(t => map[t][1]).join(" "), th);
  }
  for (const p of g9.practice) {
    assert.ok(p.options.includes(p.answer));
    if (p.kind === "cloze") for (const o of p.options) assert.ok(map[o], `${o} is not a course word`);
  }
  }
});
