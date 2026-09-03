// Hand-curated glosses for words the Wiktionary layer does not cover — or
// covers badly.
//
// gloss-th.js is generated from a Wiktionary dump and glosses 62% of the
// lexicon. The other 38% are known to the segmenter and unknown to the
// dictionary: บทสนทนา segments cleanly as one token and then has nothing to
// say for itself, and neither does บท (chapter) nor สนทนา (converse) — ordinary
// words, absent from English Wiktionary. This file is where such words go once
// somebody has actually hit them.
//
// It is NOT a generated file and NOT part of the CC BY-SA derivative — that is
// the point of keeping it separate. Entries here are this project's own, so
// the licence notice on gloss-th.js stays exactly true of gloss-th.js and of
// nothing else.
//
// Precedence (gloss.js): course WORD_MAP → this file → Wiktionary. Sitting
// above Wiktionary is deliberate: a checked entry beats a crowd-sourced one,
// and it is the only way to override a wrong Wiktionary gloss without editing
// generated output.
//
// Shape: thai → [romanisation, gloss]. Romanisation in the app's own scheme
// (RTGS consonants, Paiboon tone marks, long vowels doubled), and every tone
// mark below was checked against syllableToneInfo before it went in — the
// same bar the generator holds Wiktionary's romanisations to. Use "" for the
// romanisation rather than guessing; an empty string means "unknown", and the
// card then shows the letters and the tone rule instead.
//
// Adding a word: put it here, run `node --test` (tests/js/gloss.test.js checks
// each entry's tone marks against the engine), then `node
// scripts/build-extension.mjs` so the extension picks it up.

var GLOSS_EXTRA = {
  "บทสนทนา": ["bòt-sǒn-thá-naa", "conversation, dialogue"],
  "สนทนา":   ["sǒn-thá-naa",     "to converse, to chat"],
  "บท":      ["bòt",             "chapter, verse; a passage of text"],
};
