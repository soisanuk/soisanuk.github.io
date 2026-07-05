// Pure Thai-script analysis: character classification and
// cluster decomposition. No DOM access (unit-tested via node:vm).

// ── word decomposition ────────────────────────────────────────────────────
function _thaiCharKind(cp) {
  if (cp >= 0x0E01 && cp <= 0x0E2E) return "cons";
  if (cp === 0x0E40 || cp === 0x0E41 || cp === 0x0E42 || cp === 0x0E43 || cp === 0x0E44) return "vowel"; // leading
  if (cp >= 0x0E30 && cp <= 0x0E3A) return "vowel";
  if (cp >= 0x0E47 && cp <= 0x0E4B) return "tone";
  if (cp >= 0x0E4C && cp <= 0x0E4E) return "diac";
  return "other";
}

function _buildDecomposition(word) {
  // Split word into clusters: (optional leading vowel) + consonant + (diacritics/vowels/tone marks)
  const chars = [...word];
  const clusters = [];
  let i = 0;
  while (i < chars.length) {
    const cp = chars[i].codePointAt(0);
    const kind = _thaiCharKind(cp);
    if (kind === "vowel" && (cp >= 0x0E40 && cp <= 0x0E44)) {
      // leading vowel — attach to next consonant if there is one
      const cluster = [chars[i]];
      i++;
      if (i < chars.length && _thaiCharKind(chars[i].codePointAt(0)) === "cons") {
        cluster.push(chars[i]); i++;
      }
      // collect trailing diacritics
      while (i < chars.length) {
        const k2 = _thaiCharKind(chars[i].codePointAt(0));
        if (k2 === "vowel" || k2 === "tone" || k2 === "diac") { cluster.push(chars[i]); i++; }
        else break;
      }
      clusters.push(cluster);
    } else if (kind === "cons") {
      const cluster = [chars[i]]; i++;
      while (i < chars.length) {
        const k2 = _thaiCharKind(chars[i].codePointAt(0));
        if (k2 === "vowel" || k2 === "tone" || k2 === "diac") { cluster.push(chars[i]); i++; }
        else break;
      }
      clusters.push(cluster);
    } else {
      clusters.push([chars[i]]); i++;
    }
  }
  return clusters;
}

// ── letter pronunciation ──────────────────────────────────────────────────
// Spoken form of a single Thai letter: its sound, a slight pause (comma),
// then its traditional name — e.g. ก → "ก, ก ไก่". Anything that is not a
// single known letter is returned unchanged, so callers can wrap all speech
// through this unconditionally.

// Vowels are recited with the อ carrier ("อา, สระอา"); bare tone marks and
// signs have no sound of their own, so only the name is spoken.
const _LETTER_SPEECH_EXTRA = {
  "ะ": "อะ, สระอะ",
  "ั": "อะ, ไม้หันอากาศ",
  "า": "อา, สระอา",
  "ำ": "อำ, สระอำ",
  "ิ": "อิ, สระอิ",
  "ี": "อี, สระอี",
  "ึ": "อึ, สระอึ",
  "ื": "อือ, สระอือ",
  "ุ": "อุ, สระอุ",
  "ู": "อู, สระอู",
  "เ": "เอ, สระเอ",
  "แ": "แอ, สระแอ",
  "โ": "โอ, สระโอ",
  "ไ": "ไอ, สระไอไม้มลาย",
  "ใ": "ใอ, สระใอไม้ม้วน",
  "่": "ไม้เอก",
  "้": "ไม้โท",
  "๊": "ไม้ตรี",
  "๋": "ไม้จัตวา",
  "็": "ไม้ไต่คู้",
  "์": "การันต์",
  "ๆ": "ไม้ยมก",
};

function letterSpeech(ch) {
  ch = ch.replace(/◌/g, ""); // vowel entries write combining marks as "◌า" etc.
  if ([...ch].length !== 1) return ch;
  if (typeof CONSONANTS !== "undefined") {
    const row = CONSONANTS.find(r => r[0] === ch);
    if (row) return `${ch}, ${ch} ${row[3]}`;
  }
  return _LETTER_SPEECH_EXTRA[ch] || ch;
}
