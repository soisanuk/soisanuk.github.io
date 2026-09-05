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

  // ── The top of the remaining gap (2026-09-03) ──────────────────────────
  // After Volubilis, 875 lexicon words have no gloss from any dictionary.
  // Only 31 of them fall in the top 3,000 by frequency — the band a reader
  // actually meets — and most of THOSE are name fragments (ดิ, นิ, ลิ, เม,
  // นุ, ซู, ทะ, เพ, ทร) or Sanskrit name elements (สุร, วร, สงค์), which are
  // not words and get no entry: the card's "no meaning on file · Alt-click
  // for letters and tone" is the honest answer for a syllable.
  //
  // These are the ones that ARE words. Compound romanisations are built from
  // the app's own entries for their parts (โดย dooi + ที่ thîi), not written
  // from memory; single syllables were checked against syllableToneInfo
  // before being typed, and the test below re-checks them.
  "โดยที่":    ["dooi-thîi",   "in that; whereas; given that"],
  "มิใช่":     ["mí-châi",     "is not; not (formal)"],
  "เพียงใด":   ["phiang-dai",  "how much; to what extent; however much"],
  "มายัง":     ["maa-yang",    "to; towards (formal, as in a letter)"],
  "พร้อมทั้ง": ["phróom-tháng", "together with; along with"],
  "เป็นอัน":   ["pen-an",      "to be settled; to count as"],
  "เป็นต้นมา": ["pen-tôn-maa", "since then; from that time on"],
  "ดังเช่น":   ["dang-chên",   "such as; for example"],
  "เอาแต่":    ["ao-tàe",      "to do nothing but; to insist on only"],
  "ทีนี้":     ["thii-níi",    "now; now then"],
  "วิกฤติ":    ["wí-krìt",     "crisis; critical (variant of วิกฤต)"],
  "โอ๊ย":      ["óoi",         "ouch!; oh! (cry of pain or surprise)"],
  "แหง":       ["ngǎe",        "certainly; for sure (colloquial)"],
  "เถิด":      ["thòoet",      "let's; do (hortative particle; formal เถอะ)"],
  "มัง":       ["mang",        "probably; I suppose (colloquial; = มั้ง)"],
  "ดิ":        ["dì",          "go on; do (colloquial urging particle)"],
  // Names. Worth glossing because a reader hovering one in running text
  // wants to know it IS a name rather than a word they failed to learn.
  "คึกฤทธิ์":  ["khúek-rít",   "Kukrit (personal name)"],
  "พงษ์":      ["",            "-phong (element in personal names: lineage)"],
  "แอน":       ["aen",         "Ann (name)"],

  // ── From The Last Baht Bus (2026-09-04) ────────────────────────────────
  // Sent by the game, which meets colloquial Thai the course does not teach.
  // Five words came over; three were already glossed by Wiktionary (ขาว, อย่า,
  // มารยาท) and are not repeated here. These two are genuinely new.
  //
  // หวัดดี and หรอ were here until 2026-09-05 and are now course words in
  // data.js — which is the vendored file, so The Last Baht Bus gets them too;
  // this file is not vendored. WORD_MAP outranks this layer anyway, so keeping
  // them here as well would have been two sources of truth for one word.

  // ── The days of the week, bare (2026-09-05) ────────────────────────────
  // The course teaches วันจันทร์ and Wiktionary knows the bare forms — but its
  // first sense is the Sanskrit ETYMOLOGY, so a fluent reader pasting ordinary
  // Thai got จันทร์ "Candra, the moon god", ศุกร์ "Venus: god of love" and
  // อาทิตย์ "Surya (the first of the nine influential stars navagraha)". Thais
  // write these bare constantly — จันทร์นี้, ศุกร์หน้า — and none of them is
  // discussing a deity. The planet senses are real and stay, after the day,
  // which is what a reader actually meets. Romanisations are the course's own
  // วัน- compounds with the วัน taken off.
  "จันทร์":   ["jan",          "Monday; the moon"],
  "อังคาร":   ["ang-khaan",    "Tuesday; Mars"],
  "พุธ":      ["phút",         "Wednesday; Mercury"],
  "พฤหัส":    ["phá-rúe-hàt",  "Thursday (short for พฤหัสบดี)"],
  "พฤหัสบดี": ["phá-rúe-hàt-sà-boo-dii", "Thursday; Jupiter"],
  "ศุกร์":    ["sùk",          "Friday; Venus"],
  "เสาร์":    ["sǎo",          "Saturday; Saturn"],
  "อาทิตย์":  ["aa-thít",      "Sunday; a week; the sun"],
};
