// Native-speaker recordings of the 42 consonants, each letter followed by its
// name ("ก … ไก่"). They are cut from the Thai SOLT listening workbook by
// scripts/cut-letter-audio.mjs (see PROVENANCE.md). Device text-to-speech
// reads a letter on its own badly, so _tts.speak (tts.js) plays the recording
// instead, but only when it is asked for exactly that letter's sound and name
// (letterSpeechParts). Words, sentences and vowels still go to TTS.
//
// Course words, too: WORD_CLIPS lists the words with a native recording in
// web/audio/words/, cut from the DLIFLC Thai Language Survival Guides by
// scripts/cut-word-audio.mjs, which also rewrites the list below. A request
// to speak exactly one of those words plays its recording.
// Pure and DOM-free at load (tests/js/letter-audio.test.js).

const LETTER_CLIPS = "กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";
const WORD_CLIPS = new Set(["สอง","สาม","สิบ","สี่","หก","หนึ่ง","ห้า","เก้า","เจ็ด","แปด"]);

// The clip's path for a speak() request, or null when it is not a request
// for a letter. `text` is what _tts.speak was given: a string, or the
// parts array from letterSpeechParts.
function letterClipSrc(text) {
  const parts = (Array.isArray(text) ? text : [text]).filter(Boolean);
  if (!parts.length || typeof letterSpeechParts !== "function") return null;
  const ch = [...parts[0]][0];
  if (!LETTER_CLIPS.includes(ch)) return null;
  // Some callers join the parts with a space (learn.js); either form counts
  if (parts.join(" ") !== letterSpeechParts(ch).join(" ")) return null;
  return "audio/letters/" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0") + ".mp3";
}

// The recording for a request to speak exactly one course word, or null.
function wordClipSrc(text) {
  const parts = (Array.isArray(text) ? text : [text]).filter(Boolean);
  if (parts.length !== 1) return null;
  const w = String(parts[0]).trim();
  if (!WORD_CLIPS.has(w)) return null;
  return "audio/words/" + [...w].map(c => c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join("") + ".mp3";
}
