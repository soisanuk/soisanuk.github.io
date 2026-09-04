// COPIED from web/js/tokeniser.js by scripts/build-extension.mjs — do not edit here.
// Edit the source and re-run the build; --check fails on drift.
// Thai sentence tokeniser — greedy longest-match against a word map.
// Pure logic, no DOM access (unit-tested via node:vm).

// A token boundary may never fall inside a Thai character cluster. Two shapes
// are illegal, and greedy longest-match hits both on real sentences:
//   • BEFORE a dependent sign (ั ิ ี ุ ่ ้ ะ า ำ …) — it has no base to hang on.
//     "กระเป๋าใบนี้" cut after บ used to leave the token "ี้", which renders as
//     a broken glyph; "แทนการ" cut after แท left "าร".
//   • AFTER a leading vowel (เ แ โ ใ ไ) — it is written before its consonant but
//     belongs to it, so "เหมาะ" cut after เ stranded the เ on the previous token.
// Self-contained on purpose: tokeniser.js loads before thai-script.js and its
// tests vm-load this file alone, so it can't borrow _thaiCharKind.
function _tkDependent(cp) { return (cp >= 0x0E30 && cp <= 0x0E3A) || (cp >= 0x0E47 && cp <= 0x0E4E); }
function _tkLeadVowel(cp) { return cp >= 0x0E40 && cp <= 0x0E44; }
function _tkLegalBoundary(s, p) {
  if (p <= 0 || p >= s.length) return true;
  return !_tkDependent(s.charCodeAt(p)) && !_tkLeadVowel(s.charCodeAt(p - 1));
}

// Returns a tokenise(sentence) function. Tokens are {text, word} where
// word is the wordMap entry, or null for runs of unmatched characters.
function makeTokeniser(wordMap, isWord) {
  // Sort by descending length so longer compounds match before substrings
  const keys = Object.keys(wordMap).sort((a, b) => b.length - a.length);
  return function tokenise(sentence) {
    const tokens = [];
    let i = 0;
    while (i < sentence.length) {
      let matched = false;
      for (const key of keys) {
        // a match that would end mid-cluster is not a match
        if (sentence.startsWith(key, i) && _tkLegalBoundary(sentence, i + key.length)) {
          tokens.push({ text: key, word: wordMap[key] });
          i += key.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Unknown text — consume the whole cluster, never a lone mark, then
        // attach to the previous unknown run or start a new one.
        let j = i + 1;
        while (j < sentence.length && !_tkLegalBoundary(sentence, j)) j++;
        const chunk = sentence.slice(i, j);
        if (tokens.length && !tokens[tokens.length - 1].word) {
          tokens[tokens.length - 1].text += chunk;
        } else {
          tokens.push({ text: chunk, word: null });
        }
        i = j;
      }
    }
    return isWord ? _tkHeal(tokens, isWord) : tokens;
  };
}

// ── Repair a stranded letter ────────────────────────────────────────────────
// Greedy longest-match over the ~950-word curriculum map goes wrong in one
// specific way: when the map holds a SHORTER word that is a prefix of the real
// one, it takes the short match and leaves the remainder stranded. ซอยบัวขาว
// came out ซอย|บัว|ขา|ว — "soi, lotus, leg" and a loose ว — because the
// curriculum stores colours as compounds (สีขาว) and has no bare ขาว, while it
// does have ขา "leg". Reported from The Last Baht Bus, which shows Thai place
// names on this card.
//
// A lone Thai letter is never a word, so it is always a tokenisation failure.
// It is repaired by joining it to whichever neighbour makes a real word —
// which requires a real word list, so `isWord` is injected rather than assumed:
// with no predicate the tokeniser behaves exactly as it always has.
//
// Backward first, because that is where the stranding comes from. Merging
// blind, without checking the result is a word, is wrong 17 times in the
// corpus — ไปอ|ย่าง, ให้พ|นัก|งาน, จนก|รอบ — where the letter belongs to the
// NEXT word instead. Measured on all 941 example sentences: 27 improved,
// 0 headword highlights lost or gained.
function _tkHeal(tokens, isWord) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i], prev = out[out.length - 1], next = tokens[i + 1];
    const lone = !t.word && [...t.text].length === 1 && /[ก-ฮ]/.test(t.text);
    if (lone && prev && isWord(prev.text + t.text)) {
      out[out.length - 1] = { text: prev.text + t.text, word: null };
      continue;
    }
    if (lone && next && !next.word && isWord(t.text + next.text)) {
      out.push({ text: t.text + next.text, word: null });
      i++;
      continue;
    }
    out.push(t);
  }
  return out;
}

// App-wide tokeniser, built lazily on first use so load order doesn't
// matter. Uses the host app's WORD_MAP when it built one (the trainer
// does); otherwise derives a map from WORDS (The Last Baht Bus vendors
// this file without app.js).
let _appTokenise = null;
function _tokenise(sentence) {
  if (!_appTokenise) {
    const map = typeof WORD_MAP !== "undefined"
      ? WORD_MAP
      : Object.fromEntries(WORDS.map(w => [w[0], w]));
    // The word list for repairing stranded letters: the curriculum map, plus
    // the 12k-word segmentation lexicon when it happens to be loaded. Both are
    // optional — without either, tokenising is unchanged.
    _appTokenise = makeTokeniser(map, w =>
      !!map[w] || (typeof _segWords !== "undefined" && _segWords !== null && _segWords.has(w)));
  }
  return _appTokenise(sentence);
}
