// Export the Listening screen's tracks (web/js/dialogues.js) as JSON, for
// trellis (the Signal learning coach): each recording with its transcript,
// per-word tokens, and the workbook's own comprehension questions.
//
// Sources stay the only truth: dialogues.js for the tracks, data.js and the
// gloss layers for the tokens (shared with export-grammar.mjs through
// lib/app-data.mjs). Deterministic: tracks in the screen's order (level, then
// length), no timestamps. --check fails on drift; CI runs it.
//
//   node scripts/export-listening.mjs           # write export/listening.json
//   node scripts/export-listening.mjs --check   # verify; exit 1 on drift
import { g, tokens, writeOrCheck } from "./lib/app-data.mjs";

const DIALOGUES = g("DIALOGUES"), dialogueAudioSrc = g("dialogueAudioSrc");

const tracks = DIALOGUES.map(d => {
  const lines = d.lines.map(l => {
    const toks = tokens(l.th);
    return { ...(l.scene ? { scene: l.scene } : {}), who: l.who, role: l.role || null, th: l.th, en: l.en, tokens: toks };
  });
  const all = lines.flatMap(l => l.tokens).filter(t => /[฀-๿]/.test(t.text));
  return {
    id: d.id,
    title: d.title,
    scenario: d.scenario,
    level: d.level,
    topic: d.topic,
    source: { course: "Thai SOLT (USAJFKSWCS with the University of Arizona)", workbook: `Supplementary Listening Comprehension Workbook, Module ${d.module} Lesson ${d.lesson}`, track: d.track },
    audio: "web/" + dialogueAudioSrc(d),
    durationSec: d.durationSec,
    provenance: {
      recording: "workbook",
      transcript: "workbook (the instructor workbook's printed audio script; text-extraction damage repaired as listed in `repairs`, wording unchanged)",
      translation: "ours (written for thaicab, not SOLT's)",
      questions: "workbook (verbatim from the instructor workbook, with its answer key)",
      titleAndScenario: "ours",
    },
    repairs: d.repairs || [],
    // share of the transcript's Thai tokens that are course words
    coverage: all.length ? +(all.filter(t => t.course).length / all.length).toFixed(3) : 0,
    lines,
    questions: (d.questions || []).map(q => ({ ...q, authored: "workbook" })),
  };
});

const out = {
  format: "thaicab-listening/1",
  provenance: {
    source: "Thai SOLT (Special Operations Language Training; US Army JFK Special Warfare Center and School " +
      "with the University of Arizona) Supplementary Listening Comprehension " +
      "Workbooks, Modules I-VI: recordings, printed audio scripts, comprehension questions and answer keys.",
    licence: "Public domain in the US by the owner's determination of 2026-11-11 (17 U.S.C. § 105; DoD " +
      "Unlimited Rights; no institutional endorsement). PROVENANCE.md holds the full disclaimer and the " +
      "evidence, including the contractor names in the source documents' metadata.",
    questions: "Every question, option and answer is the workbook's own. None is written by us. Questions the " +
      "workbook prints no key for are omitted; a `note` marks keys that seem not to match the transcript.",
    translation: "The English per line is ours.",
    tokens: "As in grammar.json: the 12k-word segmenter; roman/gloss from the course when `course`, else from the " +
      "gloss layer named in `glossSource` (wiktionary CC BY-SA 3.0, volubilis CC BY-SA 4.0 carry their own terms).",
    audio: "Paths are relative to the thaicab repo root. Mono MP3, 48 kbps, loudness-normalised.",
  },
  counts: {
    tracks: tracks.length,
    byLevel: Object.fromEntries(["1", "1+", "2"].map(lv => [lv, tracks.filter(t => t.level === lv).length])),
    questions: tracks.reduce((n, t) => n + t.questions.length, 0),
    seconds: Math.round(tracks.reduce((n, t) => n + t.durationSec, 0)),
  },
  tracks,
};

writeOrCheck("listening.json", out, `${tracks.length} tracks, ${out.counts.questions} questions`);
