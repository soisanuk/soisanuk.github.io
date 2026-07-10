// Thai sentence tokeniser — greedy longest-match against a word map.
// Pure logic, no DOM access (unit-tested via node:vm).

// Returns a tokenise(sentence) function. Tokens are {text, word} where
// word is the wordMap entry, or null for runs of unmatched characters.
function makeTokeniser(wordMap) {
  // Sort by descending length so longer compounds match before substrings
  const keys = Object.keys(wordMap).sort((a, b) => b.length - a.length);
  return function tokenise(sentence) {
    const tokens = [];
    let i = 0;
    while (i < sentence.length) {
      let matched = false;
      for (const key of keys) {
        if (sentence.startsWith(key, i)) {
          tokens.push({ text: key, word: wordMap[key] });
          i += key.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Unknown character — attach to previous unknown run or start new one
        if (tokens.length && !tokens[tokens.length - 1].word) {
          tokens[tokens.length - 1].text += sentence[i];
        } else {
          tokens.push({ text: sentence[i], word: null });
        }
        i++;
      }
    }
    return tokens;
  };
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
    _appTokenise = makeTokeniser(map);
  }
  return _appTokenise(sentence);
}
