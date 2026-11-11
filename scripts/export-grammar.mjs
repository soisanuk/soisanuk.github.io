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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = ROOT + "export/grammar.json";

// Load order matters only for the gloss and segmenter tables, which are
// initialised below rather than at load.
for (const f of ["data.js", "examples.js", "thai-script.js", "tokeniser.js", "wordcard.js",
                 "curriculum.js", "lexicon-th.js", "seg-extra.js", "seg-phrases.js", "segment.js",
                 "gloss-extra.js", "gloss.js", "gloss-th.js", "gloss-vol.js", "grammar.js"]) {
  vm.runInThisContext(readFileSync(ROOT + "web/js/" + f, "utf8"), { filename: f });
}
const g = s => vm.runInThisContext(s);
g("_segInit(_segEffective(THAI_LEXICON.split('\\n'))); _glossInit(THAI_GLOSS); _volInit(GLOSS_VOL);");

const WORDS = g("WORDS"), EXAMPLES = g("EXAMPLES"), LESSONS = g("GRAMMAR_LESSONS"), COURSE = g("COURSE");
const segmentThai = g("segmentThai"), thaiGloss = g("thaiGloss"), thaiRoman = g("thaiRoman");
const glossSource = g("glossSource"), exampleReview = g("exampleReview"), exampleSolt = g("exampleSolt");
const grammarPatternsOf = g("grammarPatternsOf"), grammarExamples = g("grammarExamples");
const course = new Map(WORDS.map(w => [w[0], w]));

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function tokens(thai) {
  return segmentThai(thai).filter(t => t.text.trim()).map(t => {
    const key = t.base || t.text;
    const w = course.get(key);
    return {
      text: t.text,
      key,
      course: !!w,
      roman: w ? w[1] : (thaiRoman(key) || null),
      gloss: w ? w[2] : (thaiGloss(key) || null),
      glossSource: glossSource(key),
    };
  });
}

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
    solt: exampleSolt(id) ? { source: "DLI Thai SOLT course (student book unless the cite says Instructor)", cite: exampleSolt(id) } : null,
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
      "Sentences marked `solt` are native-written (DLI Thai SOLT).",
    checks: "Every course romanisation is checked against the tone engine in thai-script.js; " +
      "every sentence contains its headword; AI persona rounds reviewed the content. " +
      "Sentences with `reviewed` set were approved by a fluent native Thai reader in the exact wording shown. " +
      "Sentences with `solt` set are quoted word for word from the DLI Thai SOLT course (believed public domain, " +
      "a US Government work; see PROVENANCE.md): native-written Thai, with our English.",
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

const json = JSON.stringify(out, null, 1) + "\n";

if (process.argv.includes("--check")) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (cur !== json) {
    console.error("export/grammar.json is out of date — run: node scripts/export-grammar.mjs");
    process.exit(1);
  }
  console.log(`export/grammar.json in sync (${sentences.length} sentences, ${lessons.length} lessons)`);
} else {
  mkdirSync(ROOT + "export", { recursive: true });
  writeFileSync(OUT, json);
  console.log(`wrote export/grammar.json — ${JSON.stringify(out.counts)}`);
}
