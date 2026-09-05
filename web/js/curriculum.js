// The guided course — pure data + pure helpers, DOM-free at load (vm-testable).
//
// Design (see the learning-redesign brief): READING FIRST. A phonics-style
// ladder introduces Thai letters in frequency batches; every batch immediately
// unlocks REAL words from data.js spelled only with glyphs taught so far
// (decodable vocabulary), drilled by active recall — multiple choice, timed
// speed reads, listen-and-pick-the-script. Grammar arrives as scenario CHUNKS
// (the lexical approach): ordering food, haggling, signage — patterns you say,
// not rules you parse. Everything feeds the one SM-2 store, so the guided
// course and the free-review modes share a single memory of the learner.

// ── The letter ladder ────────────────────────────────────────────────────────
// Each batch: glyphs newly taught (consonants, vowels, tone marks). Order is
// pragmatic frequency — chosen so early batches maximise decodable words from
// WORDS. A word is decodable when every codepoint is taught (see below).
const LETTER_BATCHES = [
  { id: "b1", title: "The first six", glyphs: ["ก", "น", "ม", "า", "ี", "ด"] },
  { id: "b2", title: "Your first tone mark", glyphs: ["อ", "ย", "ู", "เ", "่"],
    note: {
      title: "Where the vowel sits",
      word: "เอา", rom: "ao", en: "to take",
      text: "เ is a vowel, and it is written BEFORE the consonant you say " +
        "first \u2014 เอา is \u201cao\u201d, not \u201ce-ao\u201d. In ดู the vowel hangs " +
        "underneath instead. Thai vowels sit around their consonant: before " +
        "it, after it, above, below, or in several pieces at once, and the " +
        "consonant itself never moves.",
    } },
  { id: "b3", title: "Enough to say no", glyphs: ["ร", "ั", "ว", "ท", "ไ"],
    note: {
      title: "The vowel that is not there",
      word: "อร่อย", rom: "\u00e0-r\u00f2oi", en: "delicious",
      text: "Two syllables, and the first one\u2019s vowel is not written at all. " +
        "Thai leaves a short \u201ca\u201d between two consonants that open a word " +
        "and expects you to put it back \u2014 อร่อย is \u201c\u00e0-r\u00f2oi\u201d, never " +
        "\u201croi\u201d. The same rule gives you ตลาด, \u201ct\u00e0-l\u00e0at\u201d, on half the " +
        "signs in the country.",
    } },
  { id: "b4", title: "Rising and falling", glyphs: ["ส", "ล", "ห", "้", "ะ"] },
  { id: "b5", title: "Shops and streets", glyphs: ["บ", "ป", "ต", "ื", "แ"] },
  { id: "b6", title: "People and things", glyphs: ["ค", "ง", "จ", "ใ", "็", "ิ", "ุ", "ำ"],
    note: {
      title: "When a vowel changes shape",
      word: "\u0e40\u0e1b\u0e47\u0e19", rom: "pen", en: "to be",
      text: "Close a syllable with a final consonant and some vowels change " +
        "shape. เปะ is \u201cp\u00e8\u201d \u2014 put น on the end and the vowel shrinks to " +
        "the small mark you just learned: เป็น, \u201cpen\u201d. ◌ะ does the same, " +
        "becoming ◌ั in มัน and รัก. It is not a different vowel and not a " +
        "different sound. It is the same vowel written smaller, because the " +
        "final consonant needed the room.",
    } },
  { id: "b7", title: "The spice rack", glyphs: ["ช", "ข", "ผ", "ถ", "๊"] },
  { id: "b8", title: "The long tail", glyphs: ["พ", "ฟ", "ซ", "ญ", "ณ", "๋", "ๆ"] },
  // b9/b10 close a hole the ladder shipped with: eighteen glyphs appeared in
  // WORDS and in NO batch, so 188 words (19%) could never become decodable no
  // matter how far you got. The worst of them were not obscure — ์ (47 words),
  // โ (39), ุ (51) — which meant a learner who finished the entire guided
  // course still could not read เบียร์ or โรงแรม. Beer and hotel.
  { id: "b9", title: "The last vowels, and the silent mark", glyphs: ["ึ", "โ", "์"],
    note: {
      title: "Thai points at its silent letters",
      word: "เบียร์", rom: "bia", en: "beer",
      text: "The ร on the end is not pronounced, and the little curl sitting " +
        "above it is what tells you so \u2014 it is called การันต์, and Thai puts " +
        "one over every letter it wants you to skip. English hides its silent " +
        "letters and lets you find out by being laughed at. Also in this " +
        "batch: โ, one more vowel written before its consonant (โรงแรม, " +
        "roong-raem, hotel).",
    } },
  { id: "b10", title: "The borrowed consonants", glyphs: ["ศ", "ษ", "ภ", "ธ", "ฉ", "ฝ", "ฮ", "ฤ"],
    note: {
      title: "Why there are so many letters for one sound",
      word: "ศาลา", rom: "s\u01cea-laa", en: "pavilion/sala",
      text: "ศ, ษ and ส are all just \u201cs\u201d \u2014 ศาลา is \u201cs\u01cea-laa\u201d. Thai " +
        "borrowed heavily from Sanskrit and Pali and kept the original " +
        "spellings, so a word\u2019s letters often record where it came from " +
        "rather than how it sounds. You never have to know which is which to " +
        "read it, and that is the good news.",
    } },
  // The alphabet has 44 consonants and this ladder taught 37 of them. ฌ, ฐ, ฑ
  // and ฬ were in CONSONANTS, in no batch, and — correcting what this comment
  // first claimed — in no WORDS entry either. They earn a rung through the
  // READING corpus, not the course vocabulary: across THAI_LEXICON's 12,241
  // words ฐ appears in 73 (รัฐ, รัฐบาล, เศรษฐกิจ), ฑ in 40 (เกณฑ์,
  // ผลิตภัณฑ์), ฬ in 14 (กีฬา, นาฬิกา — on the front of every watch shop) and
  // ฌ in 5. The graded reader, Paste Text and the extension all work over that
  // corpus, so a learner meets these letters long before the course does.
  { id: "b11", title: "The last eight", glyphs: ["ฆ", "ฏ", "ฒ", "ฎ", "ฌ", "ฐ", "ฑ", "ฬ"] },
];

// every glyph taught up to and including batch index i
function taughtGlyphs(batchIdx) {
  const set = new Set();
  for (let i = 0; i <= batchIdx && i < LETTER_BATCHES.length; i++) {
    for (const g of LETTER_BATCHES[i].glyphs) set.add(g);
  }
  return set;
}

// WORDS entries decodable with the glyphs taught so far. Pure function of the
// data — as vocabulary grows, the ladder's word pools grow with it.
function courseDecodable(batchIdx, words) {
  const taught = new Set(taughtGlyphs(batchIdx));
  return (words || WORDS).filter(w => {
    const th = w[0];
    if (th.length < 1 || /[ .]/.test(th)) return false;
    return [...th].every(ch => taught.has(ch));
  });
}

// words newly decodable AT this batch (not decodable one batch earlier)
function courseNewWords(batchIdx, words) {
  const now = courseDecodable(batchIdx, words);
  if (batchIdx === 0) return now;
  const before = new Set(courseDecodable(batchIdx - 1, words).map(w => w[0]));
  return now.filter(w => !before.has(w[0]));
}

// ── Consonant contrasts and look-alikes ──────────────────────────────────────
// Two drills the ladder never had. It taught every glyph in isolation and then
// only ever asked what a WORD means — so it never once asked "which letter is
// this?", and letter shapes are exactly what beginners confuse. Both gaps were
// found by reading a Thai SOLT I alphabet lesson against this course.

// Sounds English merges. Thai keeps unaspirated ก ต ป apart from aspirated
// ข/ค ท/ถ ผ/พ, and บ ด apart from ป ต. English has no contrast at all in the
// first case, so ปิด and ผิด arrive in the ear as one word.
const CONS_CONTRASTS = [
  ["ก", "ข", "ค"], ["ต", "ท", "ถ"], ["ป", "ผ", "พ"],
  ["บ", "ป"], ["ด", "ต"], ["จ", "ช"], ["ส", "ซ"],
];

// Minimal pairs are DERIVED from WORDS, never written down: two course words of
// the same length differing in exactly one consonant, that consonant being a
// contrast above. Fourteen today. The list grows by itself as vocabulary does,
// it can never name a word the course does not teach, and its glosses cannot
// drift from the vocabulary because they ARE the vocabulary.
let _cmpCache = null;
function consMinimalPairs(words) {
  if (!words && _cmpCache) return _cmpCache;
  const src = words || (typeof WORDS !== "undefined" ? WORDS : []);
  const grp = new Map();
  CONS_CONTRASTS.forEach((set, i) => set.forEach(c => {
    if (!grp.has(c)) grp.set(c, []);
    grp.get(c).push(i);
  }));
  const byLen = new Map();
  for (const w of src) {
    if (!byLen.has(w[0].length)) byLen.set(w[0].length, []);
    byLen.get(w[0].length).push(w);
  }
  const out = [];
  for (const list of byLen.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i][0], b = list[j][0];
      let n = 0, at = -1;
      for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) { n++; at = k; }
      if (n !== 1) continue;
      const ga = grp.get(a[at]), gb = grp.get(b[at]);
      if (!ga || !gb || !ga.some(x => gb.includes(x))) continue;
      out.push({ a: list[i], b: list[j], at });
    }
  }
  if (!words) _cmpCache = out;
  return out;
}

// Letters that LOOK alike. Shape confusion is its own skill, separate from
// sound: ก ถ ภ differ by one stroke and mean nothing like each other, and a
// course that shows each once, alone, never makes you tell them apart.
const CONFUSABLE_CONS = [
  ["ก", "ถ", "ภ"], ["ข", "ช", "ซ"], ["ค", "ด", "ต"], ["ท", "ห", "น"],
  ["ผ", "ฝ", "พ", "ฟ"], ["ฎ", "ฏ", "ฐ"], ["บ", "ป", "ษ"], ["ม", "ฆ", "ฒ"],
  ["ร", "ธ"], ["ล", "ส"], ["ง", "จ"], ["อ", "ฮ"], ["ณ", "ญ"],
];
function confusableFor(ch) {
  return CONFUSABLE_CONS.find(g => g.includes(ch)) || null;
}

// ── Scenario chunk lessons (grammar-lite) ────────────────────────────────────
// Just enough for everyday needs; advanced concepts deferred by design.
// pattern: the chunks to absorb (tap-to-hear). practice: active recall — cloze
// picks the missing word, mc picks the meaning. `key` words that exist in
// WORDS feed the shared SRS store.
const GRAMMAR_LESSONS = [
  {
    id: "g1", title: "The good news", scenario: "how Thai works",
    intro: "No conjugation. No plurals. No articles. Thai words never change " +
      "shape — you line them up, subject-verb-object, and you're speaking. " +
      "ไม่ (mâi) in front of a verb makes it negative. That's lesson one.",
    pattern: [
      ["ผมกินข้าว", "phǒm kin khâao", "I eat (rice) — subject, verb, object"],
      ["ผมไม่กิน", "phǒm mâi kin", "I don't eat — ไม่ before the verb"],
      ["อร่อย", "à-ròi", "delicious — one word is a full sentence here"],
      ["ไม่อร่อย", "mâi à-ròi", "not delicious — same trick, any verb or adjective"],
    ],
    practice: [
      { kind: "cloze", th: "ผม___กิน", answer: "ไม่", options: ["ไม่", "มี", "มา", "ดี"], en: "I DON'T eat" },
      { kind: "mc", th: "ไม่อร่อย", answer: "not delicious", options: ["not delicious", "very tasty", "too spicy", "no rice"] },
    ],
  },
  {
    id: "g2", title: "Polite armour", scenario: "every sentence, everywhere",
    intro: "ครับ (khráp) if you're a man, ค่ะ (khâ) if you're a woman — ends " +
      "almost any sentence and makes the whole thing polite. One catch for " +
      "women: on a QUESTION the particle is คะ (khá, high tone), not ค่ะ — " +
      "อร่อยไหมคะ, never อร่อยไหมค่ะ. Men say ครับ either way. It is the " +
      "cheapest goodwill in Thailand. สวัสดี + particle = hello; ขอบคุณ + " +
      "particle = thank you.",
    pattern: [
      ["สวัสดีครับ", "sà-wàt-dii khráp", "hello (man speaking)"],
      ["ขอบคุณค่ะ", "khòop-khun khâ", "thank you (woman speaking)"],
      ["อร่อยไหมคะ", "à-ròi mǎi khá", "is it good? (woman asking — คะ on a question)"],
      ["ไม่เป็นไร", "mâi pen rai", "no problem / it's nothing — the national motto"],
    ],
    practice: [
      { kind: "cloze", th: "ขอบคุณ___", answer: "ครับ", options: ["ครับ", "ไม่", "ไหม", "อร่อย"], en: "thank you (as a man)" },
      { kind: "mc", th: "ไม่เป็นไร", answer: "no problem", options: ["no problem", "thank you", "excuse me", "goodbye"] },
    ],
  },
  {
    id: "g3", title: "Ordering food", scenario: "the food stall",
    intro: "เอา (ao) = I'll take. ขอ (khǒo) = may I have (softer). Point, say " +
      "the dish, add หน่อย (nòi — 'a little', softens anything) and your " +
      "particle. ไม่เผ็ด (mâi phèt) = not spicy. You now survive any menu.",
    pattern: [
      ["เอาอันนี้ครับ", "ao an níi khráp", "I'll take this one"],
      ["ขอน้ำหน่อยครับ", "khǒo náam nòi khráp", "some water, please"],
      ["ไม่เผ็ดนะ", "mâi phèt ná", "not spicy, yeah?"],
      ["เช็คบิลครับ", "chék bin khráp", "the bill, please"],
    ],
    practice: [
      { kind: "cloze", th: "___อันนี้ครับ", answer: "เอา", options: ["เอา", "ไป", "มี", "ดี"], en: "I'll TAKE this one" },
      { kind: "cloze", th: "ไม่___นะ", answer: "เผ็ด", options: ["เผ็ด", "แพง", "ดี", "มา"], en: "not SPICY, yeah?" },
      { kind: "mc", th: "ขอน้ำหน่อย", answer: "some water please", options: ["some water please", "the bill please", "no ice", "very delicious"] },
    ],
  },
  {
    id: "g4", title: "Haggling", scenario: "the market",
    intro: "เท่าไหร่ (thâo-rài) = how much. แพง (phaeng) = expensive; แพงไป = " +
      "TOO expensive. ลดหน่อยได้ไหม (lót nòi dâai mǎi) = can you come down a " +
      "little? — ได้ไหม turns anything into a request. Smile the whole time; " +
      "the smile is half the discount.",
    pattern: [
      ["อันนี้เท่าไหร่", "an níi thâo-rài", "how much is this one?"],
      ["แพงไป", "phaeng pai", "too expensive (said fondly)"],
      ["ลดหน่อยได้ไหม", "lót nòi dâi mǎi", "can you drop it a little?"],
      ["สองร้อยได้ไหม", "sǒong rói dâi mǎi", "two hundred, can do?"],
    ],
    practice: [
      { kind: "cloze", th: "อันนี้___", answer: "เท่าไหร่", options: ["เท่าไหร่", "อร่อย", "ไม่ดี", "ขอบคุณ"], en: "how much is THIS?" },
      { kind: "cloze", th: "ลดหน่อย___", answer: "ได้ไหม", options: ["ได้ไหม", "ครับ", "แล้ว", "มาก"], en: "can you drop it a little?" },
      { kind: "mc", th: "แพงไป", answer: "too expensive", options: ["too expensive", "very cheap", "how much", "good price"] },
    ],
  },
  {
    id: "g5", title: "Reading the street", scenario: "signage",
    intro: "The signs that matter, in the order they matter. ห้าม (hâam) in " +
      "front of anything = forbidden — the most useful prefix in the country.",
    pattern: [
      ["ห้องน้ำ", "hông náam", "toilet — the sign you'll hunt most"],
      ["ทางออก", "thaang-òok", "exit"],
      ["เปิด", "pòoet", "open"],
      ["ปิด", "pìt", "closed"],
      ["ห้ามสูบบุหรี่", "hâam sùup bù-rìi", "no smoking — ห้าม + anything = forbidden"],
      ["ลดราคา", "lót raa-khaa", "sale / prices down"],
    ],
    practice: [
      { kind: "mc", th: "ห้องน้ำ", answer: "toilet", options: ["toilet", "exit", "kitchen", "hotel"] },
      { kind: "mc", th: "ปิด", answer: "closed", options: ["closed", "open", "push", "pull"] },
      { kind: "cloze", th: "___สูบบุหรี่", answer: "ห้าม", options: ["ห้าม", "เปิด", "ทาง", "ลด"], en: "NO smoking" },
    ],
  },
  {
    id: "g6", title: "This one, that one", scenario: "pointing at things",
    intro: "นี่ (nîi) this, นั่น (nân) that. อันนี้ = this one — อัน is the " +
      "all-purpose classifier and nobody minds a beginner using it for " +
      "everything. Point + อันนี้ + เท่าไหร่ and you can shop anywhere alive.",
    pattern: [
      ["อันนี้", "an níi", "this one"],
      ["อันนั้น", "an nán", "that one"],
      ["อันนี้อร่อยไหม", "an níi à-ròi mǎi", "is this one tasty? — ไหม makes a question"],
      ["เอาอันนั้นสองอัน", "ao an nán sǒong an", "I'll take two of those"],
    ],
    practice: [
      { kind: "mc", th: "อันนั้น", answer: "that one", options: ["that one", "this one", "which one", "every one"] },
      { kind: "cloze", th: "อันนี้อร่อย___", answer: "ไหม", options: ["ไหม", "ครับ", "ไม่", "ไป"], en: "is this tasty? (question!)" },
    ],
  },
  {
    id: "g7", title: "Getting around", scenario: "the baht bus",
    intro: "You flag a สองแถว (sǒong-thǎeo — 'two rows', the red baht bus). " +
      "Hop in the back; when you want out, press the buzzer or call จอด (jòot, " +
      "stop). ตรงไป is straight, เลี้ยว is turn. Ten baht down Beach Road — no " +
      "haggling, just name where you're going and add your particle.",
    pattern: [
      ["ไปจอมเทียนครับ", "pai jom-tian khráp", "to Jomtien — just name the place"],
      ["ตรงไป", "trong pai", "straight ahead"],
      ["เลี้ยวซ้าย", "líao sáai", "turn left"],
      ["เลี้ยวขวา", "líao khwǎa", "turn right"],
      ["จอดตรงนี้", "jòot trong níi", "stop right here — call it or hit the buzzer"],
    ],
    practice: [
      { kind: "cloze", th: "เลี้ยว___", answer: "ซ้าย", options: ["ซ้าย", "ขวา", "ตรง", "ไป"], en: "turn LEFT" },
      { kind: "cloze", th: "จอด___นี้", answer: "ตรง", options: ["ตรง", "ที่", "ไป", "เลี้ยว"], en: "stop right HERE" },
      { kind: "mc", th: "ตรงไป", answer: "straight ahead", options: ["straight ahead", "turn left", "stop here", "how much"] },
    ],
  },
  {
    id: "g8", title: "Prices and counting", scenario: "the bar tab",
    intro: "Prices run on ...ละ (lá, 'per'): ขวดละร้อย = a hundred a bottle, " +
      "คนละ = per person. Count things with number + classifier — ขวด for " +
      "bottles, อัน for anything else. เท่าไหร่ asks the price; คิดเงิน " +
      "(khít ngoen, 'count the money') calls for the tab. Digits themselves " +
      "are drilled in Baht Bus — here it's the shape of a price.",
    pattern: [
      ["เบียร์ขวดละเท่าไหร่", "bia khùat lá thâo-rài", "how much per bottle of beer?"],
      ["ขวดละแปดสิบ", "khùat lá pàet sìp", "eighty a bottle"],
      ["เอาสองขวด", "ao sǒong khùat", "I'll take two bottles — number + classifier"],
      ["คนละร้อย", "khon lá rói", "a hundred each (per person)"],
      ["คิดเงินด้วยครับ", "khít ngoen dûay khráp", "the bill, please"],
    ],
    practice: [
      { kind: "cloze", th: "เบียร์ขวด___เท่าไหร่", answer: "ละ", options: ["ละ", "ไม่", "มา", "ดี"], en: "how much PER bottle?" },
      { kind: "cloze", th: "เอาสอง___", answer: "ขวด", options: ["ขวด", "บาท", "คน", "อัน"], en: "I'll take two BOTTLES" },
      { kind: "mc", th: "คิดเงินด้วยครับ", answer: "the bill, please", options: ["the bill, please", "two more beers", "how much is this", "not spicy"] },
    ],
  },
];

// ── Tones (the tone-engine course unit) ──────────────────────────────────────
// The reading wall isn't the letters — it's getting the TONE off the page.
// Pure data + the minimal-set generator live here; the interactive calculator
// and the ear drills are in learn.js. The actual computation — and the
// TONE_ORDER/TONE_LABELS/TONE_COLORS vocabulary — is in thai-script.js
// (vendored, so LBB gets the full contract too; tests/js/tone.test.js).
const _TONE_MARK_BY_KEY = { none: "", ek: "่", tho: "้", tri: "๊", chattawa: "๋" };

// The canonical minimal set: one mid-class consonant + a long vowel, once per
// tone mark, spans all five tones (mid · low · falling · high · rising) — the
// clearest possible demonstration that the mark alone flips the word. The mark
// rides on the consonant, so it sits between consonant and vowel.
function toneMinimalSet(cons, vowel) {
  const cls = typeof _consClass === "function" ? _consClass(cons) : "mid";
  return ["none", "ek", "tho", "tri", "chattawa"].map(mk => ({
    thai: cons + _TONE_MARK_BY_KEY[mk] + vowel,
    mark: mk,
    tone: toneFromParts(cls, { mark: mk, live: true, shortVowel: false }),
  }));
}

// Real single-syllable words for "what tone is this?" — each is in WORDS (a
// correct read also feeds that word's SRS card) and reads cleanly via
// syllableTone. The runner filters to the ones actually present and readable.
const TONE_READ_WORDS = ["ห้า", "สาม", "สี่", "สอง", "หก", "ไม่", "มา", "คุณ", "ผม", "น้ำ", "ดี", "นี้"];

// delegates to _wcEsc (wordcard.js, loaded first) — the single escaping
// implementation
function _tcEsc(s) {
  return _wcEsc(s);
}
// The tone of a Thai WORD, but only when it's safe to colour it one colour:
// syllableTone reads a single syllable, so a multi-syllable word (its RTGS has
// a hyphen/space, e.g. "à-ròi") returns null rather than a wrong single tone.
// Unknown long tokens are skipped too; short unknown tokens fall through to the
// parser. This is the guard both the reader and toneColorHtml share.
function _wordRtgs(text) {
  // prefer the app's WORD_MAP (what the tokeniser matches against, so every
  // reader token is covered), then the WORDS array
  if (typeof WORD_MAP !== "undefined" && WORD_MAP[text]) return WORD_MAP[text][1];
  if (typeof WORDS !== "undefined") { const w = WORDS.find(x => x[0] === text); if (w) return w[1]; }
  return null;
}
function toneOfWord(text) {
  if (typeof syllableTone !== "function") return null;
  const rtgs = _wordRtgs(text);
  if (rtgs && /[-\s]/.test(rtgs.trim())) return null;   // multi-syllable romanisation
  // The >3-character guard alone is far too weak: a THREE-character Thai string
  // is very often two syllables (คณะ khá-ná, ขยะ khà-yà), and those were being
  // painted one colour that contradicted even their first syllable. The gloss
  // layer now knows a romanisation for ~7,700 more words, so ask it — it is the
  // same "does the romanisation have a hyphen" test, just with better data.
  // Guarded because gloss.js loads after this file and its data is lazy: when
  // it has nothing, behaviour falls back to exactly what it was before.
  if (!rtgs && typeof thaiRoman === "function") {
    const derived = thaiRoman(text);
    if (derived && /[-\s]/.test(derived.trim())) return null;
  }
  if (!rtgs && [...String(text)].length > 3) return null; // unknown longish token: don't guess a tone
  return syllableTone(text);
}
// Colour each token of a Thai string by its tone (multi-syllable / unreadable
// tokens stay plain — a colour is never wrong). Uses the app tokeniser for
// sentences when present, else treats the whole input as one word.
//
// `decorate(escapedText, tone, token)` renders one token's html; the default
// wraps a colour span whenever a tone is known. Callers that need extra
// per-token structure (tap-to-define spans, colouring only KNOWN words) pass
// their own decorator instead of duplicating the tokenise+escape loop — the
// reader (reader.js _readerThaiHtml) does this.
function toneColorHtml(thai, decorate) {
  const toks = (typeof _tokenise === "function")
    ? _tokenise(thai)
    : [{ text: String(thai), word: null }];
  const deco = decorate || ((escaped, tone) =>
    tone ? `<span style="color:${TONE_COLORS[tone]}">${escaped}</span>` : escaped);
  return toks.map(t => deco(_tcEsc(t.text), toneOfWord(t.text), t)).join("");
}

// ── The course spine ─────────────────────────────────────────────────────────
// Reading units and scenario lessons interleaved: letters → decode → speed →
// listen, with a chunk lesson after every couple of ladder rungs. `letters`
// units index into LETTER_BATCHES; `chunks` into GRAMMAR_LESSONS.
const COURSE = [
  { kind: "letters", batch: 0, label: "Read: the first six letters" },
  { kind: "letters", batch: 1, label: "Read: อ, ย and your first tone mark" },
  { kind: "chunks", lesson: "g1", label: "Speak: how Thai works" },
  { kind: "letters", batch: 2, label: "Read: enough to say ไม่" },
  { kind: "chunks", lesson: "g2", label: "Speak: polite armour" },
  { kind: "letters", batch: 3, label: "Read: rising and falling" },
  { kind: "tone", id: "tone1", label: "Tones: read the marks" },
  { kind: "chunks", lesson: "g3", label: "Speak: ordering food" },
  { kind: "letters", batch: 4, label: "Read: shops and streets" },
  { kind: "chunks", lesson: "g4", label: "Speak: haggling" },
  { kind: "letters", batch: 5, label: "Read: people and things" },
  { kind: "chunks", lesson: "g5", label: "Read: the street's signs" },
  { kind: "letters", batch: 6, label: "Read: the spice rack" },
  { kind: "chunks", lesson: "g6", label: "Speak: this one, that one" },
  { kind: "letters", batch: 7, label: "Read: the long tail" },
  { kind: "chunks", lesson: "g7", label: "Speak: getting around" },
  { kind: "letters", batch: 8, label: "Read: beer, hotel, and the silent mark" },
  { kind: "chunks", lesson: "g8", label: "Speak: prices and counting" },
  { kind: "letters", batch: 9, label: "Read: the borrowed consonants" },
  { kind: "letters", batch: 10, label: "Read: the last eight letters" },
];

// mastery gate: a unit passes at 80% first-try accuracy
const COURSE_PASS = 0.8;
// Below this many graded cards, a percentage bar stops measuring mastery and
// starts measuring luck: 80% of 4 is 4/4. Units this short pass on at most one
// miss instead. 8 is the smallest sample where 80% still permits a miss
// (ceil(8*0.8) = 7), so the two rules meet without a discontinuity.
const COURSE_PASS_MIN_SAMPLE = 8;

// auto-grading map for active recall → SM-2 quality (see srs.js):
// right first try, fast → 5 · right first try → 4 · right after a miss → 2 ·
// wrong → 1. The app grades the learner now; nobody self-rates a guess "good".
function courseGrade(correct, firstTry, fastMs, elapsedMs) {
  if (!correct) return 1;
  if (!firstTry) return 2;
  return (fastMs && elapsedMs <= fastMs) ? 5 : 4;
}
