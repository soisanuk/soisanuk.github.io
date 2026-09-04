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
      // collect trailing diacritics — but never another leading vowel, which
      // belongs to the syllable after this one (see the consonant branch).
      while (i < chars.length) {
        const cp2 = chars[i].codePointAt(0);
        if (cp2 >= 0x0E40 && cp2 <= 0x0E44) break;
        const k2 = _thaiCharKind(cp2);
        if (k2 === "vowel" || k2 === "tone" || k2 === "diac") { cluster.push(chars[i]); i++; }
        else break;
      }
      clusters.push(cluster);
    } else if (kind === "cons") {
      const cluster = [chars[i]]; i++;
      while (i < chars.length) {
        // A LEADING vowel (เ แ โ ใ ไ) is written before the consonant it is
        // spoken after, so it always opens a new cluster — it can never be a
        // trailing mark on this one. Without this break the greedy loop below
        // swallowed it: อะไร decomposed as "อะไ + ร" instead of "อะ + ไร",
        // and 174 of 973 words displayed a decode that split mid-syllable.
        // The question words were all of them — อะไร ทำไม ที่ไหน เมื่อไร
        // อย่างไร — and the app's own script note tells the learner, in so
        // many words, that this vowel comes first.
        const cp2 = chars[i].codePointAt(0);
        if (cp2 >= 0x0E40 && cp2 <= 0x0E44) break;
        const k2 = _thaiCharKind(cp2);
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
// then its traditional name spelled solid — e.g. ก → "ก, กอไก่". Anything that is not a
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

// Display form of a vowel pattern: the ◌ placeholder becomes a host consonant,
// so combining marks always shape correctly. (U+25CC DOTTED CIRCLE is missing
// from many system fonts; a ◌+mark cluster then renders as a tofu box — Chrome
// must shape the pair with one font.) Defaults to ก (the keyboard tutor's
// convention); pass "อ" where the vowel should read as its pure sound (อา = the
// vowel "aa", not กา), which also matches how vowels are voiced. Identity for
// text without ◌.
// What a consonant's acrophonic name MEANS. Course vocabulary first — 29 of the
// 42 names are words the learner is already being taught, and reading their own
// gloss keeps the chart from ever disagreeing with the vocabulary — then
// CONS_NAME_EN for the thirteen that are not. Null when nothing knows.
function consNameEn(ch) {
  const c = (typeof CONSONANTS !== "undefined") && CONSONANTS.find(x => x[0] === ch);
  if (!c) return null;
  const name = c[3];
  if (typeof WORD_MAP !== "undefined" && WORD_MAP[name]) return WORD_MAP[name][2];
  if (typeof WORDS !== "undefined") {
    const w = WORDS.find(x => x[0] === name);
    if (w) return w[2];
  }
  return (typeof CONS_NAME_EN !== "undefined" && CONS_NAME_EN[name]) || null;
}

function vowelDisp(sym, host = "ก") {
  const out = sym.replace(/◌/g, host);
  if (out !== sym) return out;
  // No ◌ to replace — but the caller may have handed us a BARE combining mark,
  // which is how LETTER_BATCHES stores its vowels and tone marks ("ี", not
  // "◌ี"). The old body returned those untouched, so learn.js's glyph card did
  // `vowelDisp(g)` and rendered a floating accent over whatever U+25CC
  // fallback the font supplied — a dotted circle, or tofu where the font has
  // none. Card 5 of the very first lesson. The call was there; it just did
  // nothing. Host it, which is the whole point of this function.
  const cp = out.codePointAt(0);
  const combining = cp === 0x0E31 || (cp >= 0x0E34 && cp <= 0x0E3A) || (cp >= 0x0E47 && cp <= 0x0E4E);
  return (combining && [...out].length <= 2) ? host + out : out;
}

// Compound vowel patterns (keyed by their canonical ◌ form in VOWELS);
// single marks are handled by _LETTER_SPEECH_EXTRA after ◌-stripping.
const _VOWEL_PATTERN_SPEECH = {
  "เ◌าะ": "เอาะ, สระเอาะ",
  "◌ัว":  "อัว, สระอัว",
  "เ◌ีย": "เอีย, สระเอีย",
  "เ◌ือ": "เอือ, สระเอือ",
  "เ◌า":  "เอา, สระเอา",
  "◌อ":   "ออ, สระออ",
};

function letterSpeech(ch) {
  if (_VOWEL_PATTERN_SPEECH[ch]) return _VOWEL_PATTERN_SPEECH[ch];
  ch = ch.replace(/◌/g, ""); // vowel entries write combining marks as "◌า" etc.
  if ([...ch].length !== 1) return ch;
  if (typeof CONSONANTS !== "undefined") {
    const row = CONSONANTS.find(r => r[0] === ch);
    // The name is spelled solid with the อ vowel written out (ก → กอไก่):
    // "ก ไก่" is read as two clipped tokens, while กอไก่ gets natural word
    // prosody and the correct tone from its spelling.
    if (row) return `${ch}, ${ch}อ${row[3]}`;
  }
  return _LETTER_SPEECH_EXTRA[ch] || ch;
}

// letterSpeech split for _tts.speak: each part becomes its own utterance
// with a pause between (sound … name). Thai TTS voices read a comma inside
// one utterance straight through, so "ก, กอไก่" as a single string comes
// out as three flat syllables. Non-letters pass through as one part.
function letterSpeechParts(ch) {
  return letterSpeech(ch).split(", ");
}

// ── Tone computation ──────────────────────────────────────────────────────
// Standard Thai tone rules: the initial consonant's CLASS (mid/high/low),
// whether the syllable is LIVE (long vowel or sonorant final) or DEAD (short
// vowel with no final / stop final), and any tone MARK together fix the tone.
//
// Two layers, on purpose:
//   • toneFromParts()  — the pure rule table. No parsing at all, so it can
//     never be wrong about a shape it wasn't given; it powers the interactive
//     tone calculator and the minimal-pair drills, which build their inputs
//     from known pieces.
//   • syllableTone()   — a best-effort parser over ONE written syllable that
//     feeds toneFromParts. It returns null whenever it can't confidently read
//     the shape (silent letters, odd vowels), so a caller that colours or
//     labels text never shows a wrong tone — it shows none.
// Tones are named with the same vocabulary as TONES in data.js:
// "mid" · "low" · "falling" · "high" · "rising".

const _TONE_MARKS = { "่": "ek", "้": "tho", "๊": "tri", "๋": "chattawa" };

// initial-consonant class from the data (mid/high/low), or null if unknown
function _consClass(ch) {
  if (typeof CONSONANTS !== "undefined") {
    const row = CONSONANTS.find(r => r[0] === ch);
    if (row) return row[2];
  }
  if (typeof TONE_CLASSES !== "undefined") {
    for (const cls in TONE_CLASSES) if (TONE_CLASSES[cls].includes(ch)) return cls;
  }
  return null;
}

// A final consonant makes the syllable LIVE (sonorant: ง น ม ย ว) or DEAD
// (stop: ก ด บ …). null = this letter never closes a syllable this way.
const _LIVE_FINALS = new Set(["ng", "n", "m", "y", "w"]);
const _DEAD_FINALS = new Set(["k", "p", "t"]);
function _finalKind(ch) {
  if (typeof CONSONANTS === "undefined") return null;
  const row = CONSONANTS.find(r => r[0] === ch);
  if (!row) return null;
  if (_LIVE_FINALS.has(row[5])) return "live";
  if (_DEAD_FINALS.has(row[5])) return "dead";
  return null;
}

function _isCons(ch) { const c = ch.codePointAt(0); return c >= 0x0E01 && c <= 0x0E2E; }
function _isLeadVowel(ch) { const c = ch.codePointAt(0); return c >= 0x0E40 && c <= 0x0E44; }

// The rule table. cls ∈ {mid,high,low}; opts.mark ∈
// {none,ek,tho,tri,chattawa}; opts.live = live syllable?; opts.shortVowel only
// matters for a low-class dead syllable (short → high, long → falling).
function toneFromParts(cls, opts) {
  const { mark = "none", live = true, shortVowel = false } = opts || {};
  if (mark === "ek") return cls === "low" ? "falling" : "low";
  if (mark === "tho") return cls === "low" ? "high" : "falling";
  if (mark === "tri") return "high";
  if (mark === "chattawa") return "rising";
  if (live) return cls === "high" ? "rising" : "mid";      // mid/low live → mid
  if (cls === "high" || cls === "mid") return "low";       // dead, high/mid → low
  return shortVowel ? "high" : "falling";                  // dead, low class
}

// length/liveness of an OPEN syllable's vowel, or null if unrecognised.
// { long } drives the low-class dead split; { live } flags vowels that end in
// a glide/nasal of their own (ำ ไ ใ เ◌า) so they stay live with no written final.
function _vowelLength(leading, trailing, taikhu) {
  if (taikhu) return { long: false };                        // ็ mai taikhu shortens
  if (trailing.indexOf("ะ") >= 0 || trailing.indexOf("ั") >= 0) return { long: false };
  // เ◌ิ is the LONG "oe" (เดิน, เกิด, เลิก) — it is only ever written with a
  // final; the short counterpart is เ◌อะ. Bare ◌ิ stays short (กิน, ผิด).
  if (leading === "เ" && trailing === "ิ") return { long: true };
  if (trailing === "ิ" || trailing === "ึ" || trailing === "ุ") return { long: false };
  if (trailing === "ำ") return { long: false, live: true };
  if (trailing === "า") return leading === "เ" ? { long: true, live: true } : { long: true }; // เ◌า = ao
  if (trailing === "ี" || trailing === "ื" || trailing === "ู") return { long: true };
  if (trailing === "") {
    if (leading === "เ" || leading === "แ" || leading === "โ") return { long: true };
    if (leading === "ไ" || leading === "ใ") return { long: true, live: true };
    if (leading === "") return { long: false };              // inherent vowel (คน, ผม)
  }
  return null;
}

// Initial consonant clusters (ควบกล้ำ). The class comes from the FIRST
// consonant and the ร/ล/ว after it is neither a final nor a vowel carrier, so
// the parser steps over it. The "false" clusters (ทร ศร สร ซร จร — the ร is
// silent, ทร reads /s/) sit in the same table because they behave IDENTICALLY
// for tone; only the pronunciation differs, and nothing here computes that.
// Contrast the ห / อ leaders below, which change the class — a cluster never does.
const _CLUSTER_SECONDS = {
  "ก": "รลว", "ข": "รลว", "ค": "รลว", "ต": "ร", "ป": "รล", "ผ": "ล",
  "พ": "รล", "บ": "รล", "ด": "ร", "ฟ": "รล",
  "ท": "ร", "ศ": "ร", "ส": "ร", "ซ": "ร", "จ": "ร",
};
// Is `second` this head's cluster partner, or is it doing another job? Two
// shapes look like clusters and aren't — `rest` is what follows `second`:
//   • nothing follows it → it's the FINAL, carrying the inherent vowel:
//     พร = /phɔɔn/ (mid), not /phrá/.
//   • C + ว + final with no written vowel at all (ควบ, ขวด, สวย, ควร) → the ว
//     is the reduced ◌ัว vowel, handled below. A real /Cw/ cluster always has a
//     vowel of its own, before (แขวน) or after (กวาด, กว่า) the ว.
function _isClusterPair(head, second, leading, rest) {
  if (!(_CLUSTER_SECONDS[head] || "").includes(second)) return false;
  if (!rest.length) return false;
  if (second !== "ว" || leading) return true;
  return rest.some(ch => { const c = ch.codePointAt(0); return c >= 0x0E30 && c <= 0x0E39; });
}

// Parse one syllable into the parts toneFromParts needs, or null if unsure.
function _analyseSyllable(input) {
  const raw = [...String(input)];
  if (!raw.length) return null;
  if (raw.some(ch => ch.codePointAt(0) === 0x0E4C)) return null; // ์ การันต์: silent letters, out of scope

  let i = 0, leading = "";
  while (i < raw.length && _isLeadVowel(raw[i])) { leading += raw[i]; i++; }
  if (i >= raw.length || !_isCons(raw[i])) return null;
  const head = raw[i];
  let cls = _consClass(head);
  i++;
  let cluster = null;
  // ห / อ leader: silent, promotes a following low-class consonant to its class
  if ((head === "ห" || head === "อ") && i < raw.length &&
      _isCons(raw[i]) && _consClass(raw[i]) === "low") {
    cls = head === "ห" ? "high" : "mid";
    i++;
  } else if (i < raw.length && _isCons(raw[i]) &&
             _isClusterPair(head, raw[i], leading, raw.slice(i + 1))) {
    cluster = raw[i];   // ครับ, ปลวก, กวาด — class already taken from `head`
    i++;
  }
  if (!cls) return null;

  let mark = "none", taikhu = false, trailing = "", tail = [];
  for (; i < raw.length; i++) {
    const ch = raw[i], c = ch.codePointAt(0);
    if (_TONE_MARKS[ch]) mark = _TONE_MARKS[ch];
    else if (c === 0x0E47) taikhu = true;                    // ็
    else if (c === 0x0E33) trailing += ch;                   // ำ
    else if (c >= 0x0E30 && c <= 0x0E39) trailing += ch;     // above/below vowels incl ั ะ
    else if (_isCons(ch)) tail.push(ch);
    else return null;
  }

  // Compound vowels whose last piece is written with a consonant letter
  // (◌อ / เ◌อ, เ◌ือ, ◌ัว, เ◌ีย): the trailing consonant is the vowel, and any
  // consonant after it is the real final.
  let long, vLive = false, finalChar = null;
  const th = s => trailing.indexOf(s) >= 0;
  if (tail[0] === "อ" && trailing === "") { long = true; finalChar = tail[1] || null; if (tail.length > 2) return null; }
  else if (tail[0] === "อ" && leading.includes("เ") && th("ื")) { long = true; vLive = true; finalChar = tail[1] || null; if (tail.length > 2) return null; }
  // bare ◌ือ (no leading เ): the long "ue" vowel written with its อ carrier
  // and NO final (มือ, คือ, ชื่อ) — as opposed to ◌ื alone, used when a real
  // final follows (มืด). Same shape as ◌อ above, keyed off the ื before it.
  else if (tail[0] === "อ" && trailing === "ื") { long = true; finalChar = tail[1] || null; if (tail.length > 2) return null; }
  else if (tail[0] === "ว" && trailing === "ั") { long = true; vLive = true; finalChar = tail[1] || null; if (tail.length > 2) return null; }
  // reduced ◌ัว: the ั is conventionally dropped from the ua vowel when a
  // final consonant follows (สวย, ด้วย, ควร, ขวด, รวย) — cons+ว+final, no
  // vowel mark at all. Long, same as the written-out ◌ัว above. A real
  // /Cw/-cluster-then-vowel word (กวาด, ควาย) always has ANOTHER vowel after
  // the ว (trailing !== ""), so this can't collide with that case.
  else if (tail[0] === "ว" && trailing === "" && tail.length === 2) { long = true; finalChar = tail[1]; }
  else if (tail[0] === "ย" && leading.includes("เ") && th("ี")) { long = true; vLive = true; finalChar = tail[1] || null; if (tail.length > 2) return null; }
  else {
    const vi = _vowelLength(leading, trailing, taikhu);
    if (!vi) return null;
    long = vi.long; vLive = !!vi.live;
    if (tail.length > 1) return null;
    finalChar = tail[0] || null;
  }

  let live;
  if (finalChar) {
    const fk = _finalKind(finalChar);
    if (fk === null) return null;
    live = fk === "live";
  } else {
    live = vLive || long;
  }
  return { cls, mark, live, shortVowel: !long, cluster };
}

// CONTRACT: input is ONE syllable. A multi-syllable string (a whole word or
// phrase) gets silently mis-parsed — e.g. syllableTone("อร่อย") reads only
// the leader+first syllable and returns a confidently WRONG tone, it does
// NOT return null. For any text that isn't already known to be a single
// syllable (a word from data.js, user-facing text, …), call
// toneOfWord(text) (curriculum.js) instead — it checks the word's
// romanisation for a hyphen/space and returns null rather than guess.

// Full reasoning for one syllable (for the tone explainer), or null.
function syllableToneInfo(syllable) {
  const p = _analyseSyllable(syllable);
  if (!p) return null;
  return { ...p, tone: toneFromParts(p.cls, p) };
}

// The tone of one written syllable, or null when the shape can't be read.
function syllableTone(syllable) {
  const info = syllableToneInfo(syllable);
  return info ? info.tone : null;
}

// The engine's tone vocabulary — the exact strings toneFromParts/syllableTone
// return — with a canonical order and display contract. Single source: any
// consumer that needs to enumerate all five tones (drill choices, chart rows,
// legends) uses TONE_ORDER rather than hardcoding its own ["mid","low",…]
// array, so the labels/colours/order can never drift from what the engine
// actually produces. data.js's TONES must stay in this same row order — see
// the comment there and tests/js/tone.test.js.
const TONE_ORDER = ["mid", "low", "falling", "high", "rising"];
const TONE_LABELS = { mid: "Mid", low: "Low", falling: "Falling", high: "High", rising: "Rising" };
const TONE_COLORS = { mid: "#b0b6bd", low: "#4aa3ff", falling: "#ff6b6b", high: "#2fbf71", rising: "#f7b32b" };
