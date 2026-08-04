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
  { id: "b2", title: "Your first tone mark", glyphs: ["อ", "ย", "ู", "เ", "่"] },
  { id: "b3", title: "Enough to say no", glyphs: ["ร", "ั", "ว", "ท", "ไ"] },
  { id: "b4", title: "Rising and falling", glyphs: ["ส", "ล", "ห", "้", "ะ"] },
  { id: "b5", title: "Shops and streets", glyphs: ["บ", "ป", "ต", "ื", "แ"] },
  { id: "b6", title: "People and things", glyphs: ["ค", "ง", "จ", "ใ", "็"] },
  { id: "b7", title: "The spice rack", glyphs: ["ช", "ข", "ผ", "ถ", "ๆ", "๊"] },
  { id: "b8", title: "The long tail", glyphs: ["พ", "ฟ", "ซ", "ญ", "ณ", "๋", "ำ", "ิ"] },
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
      "almost any sentence and makes the whole thing polite. It is the " +
      "cheapest goodwill in Thailand. สวัสดี + particle = hello; ขอบคุณ + " +
      "particle = thank you.",
    pattern: [
      ["สวัสดีครับ", "sà-wàt-dii khráp", "hello (man speaking)"],
      ["ขอบคุณค่ะ", "khòop-khun khâ", "thank you (woman speaking)"],
      ["ไม่เป็นไร", "mâi pen rai", "no problem / it's nothing — the national motto"],
    ],
    practice: [
      { kind: "cloze", th: "ขอบคุณ___", answer: "ครับ", options: ["ครับ", "ไม่", "ไหม", "อร่อย"], en: "thank you (as a man)" },
      { kind: "mc", th: "ไม่เป็นไร", answer: "no problem", options: ["no problem", "thank you", "excuse me", "goodbye"] },
    ],
  },
  {
    id: "g3", title: "Ordering food", scenario: "the food stall",
    intro: "เอา (ao) = I'll take. ขอ (khǎaw) = may I have (softer). Point, say " +
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
    intro: "เท่าไหร่ (thâo-rài) = how much. แพง (phaaeng) = expensive; แพงไป = " +
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
    intro: "You flag a สองแถว (sǎawng-thǎaew — 'two rows', the red baht bus). " +
      "Hop in the back; when you want out, press the buzzer or call จอด (jàawt, " +
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
// and the ear drills are in learn.js. The actual computation is
// toneFromParts/syllableTone in thai-script.js (tests/js/tone.test.js).
const TONE_LABELS = { mid: "Mid", low: "Low", falling: "Falling", high: "High", rising: "Rising" };
const TONE_COLORS = { mid: "#b0b6bd", low: "#4aa3ff", falling: "#ff6b6b", high: "#2fbf71", rising: "#f7b32b" };
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
  if (!rtgs && [...String(text)].length > 3) return null; // unknown longish token: don't guess a tone
  return syllableTone(text);
}
// Colour each token of a Thai string by its tone (multi-syllable / unreadable
// tokens stay plain — a colour is never wrong). Uses the app tokeniser for
// sentences when present, else treats the whole input as one word.
function toneColorHtml(thai) {
  const toks = (typeof _tokenise === "function")
    ? _tokenise(thai).map(t => t.text)
    : [String(thai)];
  return toks.map(t => {
    const tone = toneOfWord(t);
    return tone ? `<span style="color:${TONE_COLORS[tone]}">${_tcEsc(t)}</span>` : _tcEsc(t);
  }).join("");
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
  { kind: "chunks", lesson: "g8", label: "Speak: prices and counting" },
];

// mastery gate: a unit passes at 80% first-try accuracy
const COURSE_PASS = 0.8;

// auto-grading map for active recall → SM-2 quality (see srs.js):
// right first try, fast → 5 · right first try → 4 · right after a miss → 2 ·
// wrong → 1. The app grades the learner now; nobody self-rates a guess "good".
function courseGrade(correct, firstTry, fastMs, elapsedMs) {
  if (!correct) return 1;
  if (!firstTry) return 2;
  return (fastMs && elapsedMs <= fastMs) ? 5 : 4;
}
