// Export the app's native recordings as JSON for trellis: the 42 consonant
// clips and the course-word clips, each with its file
// path and where it came from. The app's own sources stay the truth
// (letter-audio.js, data.js, and the source table in
// cut-word-audio.mjs). Deterministic; --check fails on drift (CI runs it).
// Durations are left to the consumer, which keeps CI free of ffmpeg.
//
//   node scripts/export-audio.mjs           # write export/audio.json
//   node scripts/export-audio.mjs --check
import { g, writeOrCheck } from "./lib/app-data.mjs";
import { CLIPS } from "./cut-word-audio.mjs";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { ROOT } from "./lib/app-data.mjs";

for (const f of ["letter-audio.js"]) vm.runInThisContext(readFileSync(ROOT + "web/js/" + f, "utf8"), { filename: f });
const WORDS = g("WORDS"), CONSONANTS = g("CONSONANTS"), letterSpeechParts = g("letterSpeechParts");
const LETTER_CLIPS = g("LETTER_CLIPS"), WORD_CLIPS = g("WORD_CLIPS");
const letterClipSrc = g("letterClipSrc"), wordClipSrc = g("wordClipSrc");
const course = new Map(WORDS.map(w => [w[0], w]));
const source = new Map(CLIPS.map(([th, guide, file]) => [th, { guide, file }]));
const GUIDE = { bc: "Thai Basic", nv: "Thai Naval" };
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const SOLT = "Thai SOLT I Supplementary Listening Comprehension Workbook, Modules I-III, Track 1 " +
  "(US Army JFK Special Warfare Center and School with the University of Arizona). Public domain in the US " +
  "by the owner's determination of 2026-11-11 (17 U.S.C. § 105; DoD Unlimited Rights; no endorsement). See PROVENANCE.md.";
const LSG = "DLIFLC Thai Language Survival Guides (Basic and Naval), May 2008. The guides state they were produced by " +
  "the Defense Language Institute Foreign Language Center, a US Government work, so public domain in the US " +
  "(17 U.S.C. § 105). No copyright or distribution statement appears in the guides. See PROVENANCE.md.";

const letters = [...LETTER_CLIPS].sort(byCodePoint).map(ch => {
  const row = CONSONANTS.find(r => r[0] === ch);
  return { letter: ch, name: row ? row[3] : null, says: letterSpeechParts(ch).join(", "), file: "web/" + letterClipSrc(letterSpeechParts(ch)) };
});
const words = [...WORD_CLIPS].sort(byCodePoint).map(th => {
  const w = course.get(th), s = source.get(th);
  return { th, roman: w[1], gloss: w[2], file: "web/" + wordClipSrc(th),
    source: { guide: GUIDE[s.guide], file: s.file, part: "first Thai rendition (natural speed)" } };
});

const out = {
  format: "thaicab-audio/1",
  provenance: {
    letters: { producer: SOLT, cut: "scripts/cut-letter-audio.mjs", says: "each letter, then its name (ก … ไก่)" },
    words: { producer: LSG, cut: "scripts/cut-word-audio.mjs", note: "Only entries whose recording is exactly the course word; mismatches found by ear or by the guide's own transliteration are excluded and listed in the script." },
    format: "Mono MP3. Paths relative to the thaicab repo root.",
    reviewedByEar: "The owner listened to every clip in this file before it shipped (words are added as they are cleared).",
  },
  counts: { letters: letters.length, words: words.length },
  letters, words,
};
writeOrCheck("audio.json", out, `${letters.length} letters, ${words.length} words`);
