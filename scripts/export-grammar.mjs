// Export the grammar lessons and every example sentence as JSON, for trellis
// (the Signal learning coach) to build its Thai reading pack from.
//
// The .js sources stay the only source of truth: curriculum.js (GRAMMAR_LESSONS),
// examples.js (EXAMPLES), data.js (WORDS) and grammar.js (pattern matching and
// the review record). Nothing in the output is stored anywhere else. Per-word
// segmentation, romanisation and gloss are derived here, with the same
// segmenter the graded reader uses, so they cannot drift from the app.
//
// Deterministic: no timestamps, sentences in code-point order of their
// headword, lessons in course-file order. --check fails on any drift.
//
//   node scripts/export-grammar.mjs           # write export/grammar.json
//   node scripts/export-grammar.mjs --check   # verify; exit 1 on drift
import { g, tokens, writeOrCheck } from "./lib/app-data.mjs";

const EXAMPLES = g("EXAMPLES"), LESSONS = g("GRAMMAR_LESSONS"), COURSE = g("COURSE");
const exampleReview = g("exampleReview"), exampleSolt = g("exampleSolt");
const grammarPatternsOf = g("grammarPatternsOf"), grammarExamples = g("grammarExamples");

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const lessons = LESSONS.map(l => {
  const at = COURSE.findIndex(u => u.kind === "chunks" && u.lesson === l.id);
  return {
    id: l.id,
    title: l.title,
    scenario: l.scenario,
    inCourse: at >= 0,
    courseUnit: at >= 0 ? at : null,
    intro: l.intro,
    markers: l.markers || [],
    pattern: l.pattern.map(([thai, roman, en]) => ({ thai, roman, en, tokens: tokens(thai) })),
    practice: l.practice,
    examples: grammarExamples(l.id),
  };
});

const sentences = Object.keys(EXAMPLES).sort(byCodePoint).map(id => {
  const [thai, roman, en] = EXAMPLES[id];
  const toks = tokens(thai);
  const ref = exampleReview(id);
  return {
    id,
    thai,
    roman,
    en,
    reviewed: ref ? { by: "fluent native Thai reader (not named in the record)", ref } : null,
    solt: exampleSolt(id) ? { source: "Thai SOLT course, USAJFKSWCS with the University of Arizona (student book unless the cite says Instructor)", cite: exampleSolt(id) } : null,
    patterns: grammarPatternsOf(thai),
    allCourseWords: toks.every(t => t.course),
    tokens: toks,
  };
});

const out = {
  format: "thaicab-grammar/1",
  provenance: {
    source: "thaicab (Soi Sanuk) — web/js/curriculum.js, examples.js, data.js, grammar.js",
    origin: "Lessons and example sentences were written for this course with an LLM (Claude), " +
      "starting 2026-07-02, and are not taken from any published source. See PROVENANCE.md.",
    label: "LLM-authored course content, machine-checked, partially native-reviewed. Not verified. " +
      "Sentences marked `solt` are native-written (Thai SOLT).",
    checks: "Every course romanisation is checked against the tone engine in thai-script.js; " +
      "every sentence contains its headword; AI persona rounds reviewed the content. " +
      "Sentences with `reviewed` set were approved by a fluent native Thai reader in the exact wording shown. " +
      "Sentences with `solt` set are quoted word for word from the Thai SOLT course (developed by the US Army " +
      "JFK Special Warfare Center and School with the University of Arizona and its contracted partners): " +
      "native-written Thai, with our English. Public domain in the US by the owner's determination (17 U.S.C. " +
      "§ 105; DoD Unlimited Rights); see PROVENANCE.md, which also records the evidence.",
    licence: "unknown — not yet chosen by the owner for authored thaicab content",
    patterns: "A sentence's `patterns` are found by matching each lesson's `markers` against its tokens. " +
      "That is a pointer to the pattern, not a grammatical parse.",
    tokens: "Split by the 12k-word segmenter (segment.js). `roman` and `gloss` come from the course (WORDS) " +
      "when `course` is true, else from the gloss layers named in `glossSource`: extra (hand-curated, this project), " +
      "wiktionary (English Wiktionary via kaikki.org, CC BY-SA 3.0), volubilis (VOLUBILIS by Belisan, CC BY-SA 4.0). " +
      "Those third-party glosses carry their own licence and attribution duty.",
  },
  counts: {
    lessons: lessons.length,
    sentences: sentences.length,
    reviewed: sentences.filter(s => s.reviewed).length,
    solt: sentences.filter(s => s.solt).length,
    allCourseWords: sentences.filter(s => s.allCourseWords).length,
  },
  lessons,
  sentences,
};

writeOrCheck("grammar.json", out, `${sentences.length} sentences, ${lessons.length} lessons`);
