// Native-speaker recordings of the 42 consonants, each letter followed by its
// name ("ก … ไก่"). They are cut from the DLI Thai SOLT listening workbook by
// scripts/cut-letter-audio.mjs (see PROVENANCE.md). Device text-to-speech
// reads a letter on its own badly, so _tts.speak (tts.js) plays the recording
// instead, but only when it is asked for exactly that letter's sound and name
// (letterSpeechParts). Words, sentences and vowels still go to TTS.
// Pure and DOM-free at load (tests/js/letter-audio.test.js).

const LETTER_CLIPS = "กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";

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
