// Words the open-text segmenter needs and lexicon-th.js does not have.
//
// lexicon-th.js is GENERATED from PyThaiNLP's words_th.txt + tnc_freq.txt
// (both CC0) and must not be hand-edited — this file is its supplement, the
// same relationship gloss-extra.js has to gloss-th.js. It is this project's
// own editorial work: every entry is a word any Thai dictionary or speaker
// would confirm, listed here because the generated corpus happens not to
// contain it. Nothing here is copied from, or derived from, any other corpus.
//
// WHY IT MATTERS MORE THAN A MISSING GLOSS. A word the segmenter does not know
// is not skipped — it is CUT UP, and the pieces are usually real words with
// real meanings, so the reader gets a confident wrong answer instead of a
// blank. โอเลี้ยง (Thai iced black coffee) became โอ|เลี้ยง, "a type of
// lacquerware" and "to maintain; to dribble". รีวิว became รี|วิว. That is the
// failure mode this file exists to close.
//
// RANKS ARE DELIBERATELY THE RAREST. Entries are appended after the whole
// frequency-ordered list, so each costs more than any generated word. We are
// asserting only "this is a word", never "this is a common word" — and in this
// cost model one word beats two almost regardless of rank, which is exactly
// the property that made the missing entries so damaging. Assigning them
// frequencies we cannot justify would be inventing data.
var SEG_EXTRA = [
  // Everyday loanwords. Thai writes these constantly and each is in the Royal
  // Institute's transcription conventions for borrowed words.
  "รีวิว",      // review
  "ดราม่า",     // drama
  "ไอดอล",      // idol
  "เมมเบอร์",   // member
  "คอมเมนต์",   // comment
  "แท็ก",       // tag
  "บอท",        // bot
  "ทวิต",       // tweet
  "ไอจี",       // IG, Instagram
  "อัพ",        // up- (upload, update)
  // Food and drink a reader meets on any menu or street sign.
  "โอเลี้ยง",   // Thai iced black coffee (from Teochew 烏涼)
  "ปาท่องโก๋",  // fried dough sticks
  "กาแฟเย็น",   // iced coffee
  "ชาเย็น",     // Thai iced tea
  // Shop names that appear as words in running text.
  "เซเว่น",     // 7-Eleven, as everyone actually writes it
];
