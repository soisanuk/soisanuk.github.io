// Study sessions: flashcards, quiz, drills, SRS review, tone drill,
// sentence SRS, and the shared rating row.

// ═══════════════════════════════════════════════════════════════════════════
// Flashcards
// ═══════════════════════════════════════════════════════════════════════════
function startVocab(mode) {
  pickCategory(words => _startFlash(mode, words));
}

function _buildVocabDeck(wordList) {
  const keys = wordList.map(w => w[0]);
  const due   = dueCards(progress, keys);
  const fresh = newCards(progress, keys, 10);
  const combined = [...new Set([...due, ...fresh])];
  const deck = combined.length ? combined : keys.slice(0, 20);
  return shuffle(deck);
}

function _startFlash(mode, wordList) {
  const deck = _buildVocabDeck(wordList);
  session = { mode, wordList, deck, idx: 0, correct: 0, type: "vocab" };
  flashShow();
  showScreen("flash-screen", mode === "th2en" ? "1" : "2");
}

let _flashThaiHandler = null;

function _flashThaiMakeClickable(word) {
  const el = document.getElementById("flash-thai");
  if (_flashThaiHandler) el.removeEventListener("click", _flashThaiHandler);
  _flashThaiHandler = () => openWordModal(word);
  el.addEventListener("click", _flashThaiHandler);
  el.style.cursor = "pointer";
  el.title = "Click for details";
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
}

function _flashThaiClearClickable() {
  const el = document.getElementById("flash-thai");
  if (_flashThaiHandler) { el.removeEventListener("click", _flashThaiHandler); _flashThaiHandler = null; }
  el.style.cursor = "";
  el.title = "";
  el.removeAttribute("role");
  el.removeAttribute("tabindex");
}

function flashShow() {
  const { mode, deck, idx, wordList } = session;
  if (idx >= deck.length) { showSessionEnd(); return; }

  const key = deck[idx];
  const wm  = Object.fromEntries(wordList.map(w => [w[0], w]));
  const word = wm[key] || WORD_MAP[key];
  if (!word) { session.idx++; flashShow(); return; }

  const [thai, rtgs, english] = word;
  setProgress("flash-prog", idx, deck.length);
  document.getElementById("flash-counter").textContent =
    `${session.type === "script" ? "Script" : "Vocab"}  ${idx + 1} / ${deck.length}`;

  const isTh2en = (mode === "th2en") || (mode === "consonant") || (mode === "vowel");
  if (isTh2en || mode === "consonant" || mode === "vowel") {
    document.getElementById("flash-thai").textContent = vowelDisp(thai);
    document.getElementById("flash-rtgs").textContent = `(${rtgs})`;
    document.getElementById("flash-prompt").textContent =
      mode === "consonant" ? "What is this consonant?" :
      mode === "vowel"     ? "What is this vowel pattern?" :
      "What does this mean?";
    document.getElementById("flash-answer").textContent =
      session.backText ? session.backText[idx] : english;
    // Script cards speak "letter … letter name" (e.g. ก → "ก", "ก ไก่")
    const spoken = (mode === "consonant" || mode === "vowel") ? letterSpeechParts(thai) : thai;
    _flashSpeakSet(spoken);
    _tts.speak(spoken);
    if (mode === "th2en") _flashThaiMakeClickable(word); else _flashThaiClearClickable();
  } else {
    // en2th: show English, hide Thai until reveal
    document.getElementById("flash-thai").textContent = "?";
    document.getElementById("flash-rtgs").textContent = "";
    document.getElementById("flash-prompt").textContent = english;
    document.getElementById("flash-answer").textContent = `${thai}  (${rtgs})`;
    _flashSpeakSet(null);
    _flashThaiClearClickable();
  }

  const card = peekCard(progress, key);
  document.getElementById("flash-srs-meta").textContent =
    `interval: ${card.interval}d  ·  streak: ${card.correctStreak}`;

  document.getElementById("flash-answer-area").style.display = "none";
  document.getElementById("flash-reveal-area").style.display = "";
  _buildRatingHandler("flash-rating-row", key, flashShow);
}

function flashReveal() {
  const { mode, deck, idx, wordList } = session;

  if (mode === "script-flash") {
    document.getElementById("flash-answer-area").style.display = "";
    document.getElementById("flash-reveal-area").style.display = "none";
    return;
  }

  const key  = deck[idx];
  const wm   = wordList ? Object.fromEntries(wordList.map(w => [w[0], w])) : {};
  const word = wm[key] || WORD_MAP[key];

  if (mode === "en2th" && word) {
    document.getElementById("flash-thai").textContent = word[0];
    document.getElementById("flash-rtgs").textContent = `(${word[1]})`;
    _flashSpeakSet(word[0]);
    _tts.speak(word[0]);
    _flashThaiMakeClickable(word);
  }
  document.getElementById("flash-answer-area").style.display = "";
  document.getElementById("flash-reveal-area").style.display = "none";

  // Show example sentence if this is a vocab card from a top list
  const vocabKey = word ? word[0] : key;
  showExample("flash-example", vocabKey);
}

// ─── consonant / vowel flashcards ──────────────────────────────────────────
function startConsonantFlash() {
  const keys = CONSONANT_SORTED.map(c => `sc:${c[0]}`);
  const due   = dueCards(progress, keys);
  const fresh = newCards(progress, keys, 10);
  const deck  = shuffle([...new Set([...due, ...fresh])].length ?
    [...new Set([...due, ...fresh])] : keys.slice(0, 15));
  const backMap = {};
  for (const c of CONSONANTS)
    backMap[`sc:${c[0]}`] = `${c[2]} class  ·  ${c[3]}  ·  /${c[4]}/ → /${c[5]}/`;
  session = {
    mode: "consonant", type: "script",
    wordList: CONSONANT_SORTED.map(c => [`sc:${c[0]}`, c[0], c[1], backMap[`sc:${c[0]}`], "script", ""]),
    deck, idx: 0, correct: 0,
    backText: deck.map(k => backMap[k] || ""),
  };
  // Override word lookup to use consonant deck
  session._map = {};
  for (const c of CONSONANTS)
    session._map[`sc:${c[0]}`] = [c[0], c[1], backMap[`sc:${c[0]}`]];

  _startScriptFlash(deck, session._map, "Consonant");
}

function startVowelFlash() {
  const keys = VOWEL_SORTED.map(v => `sv:${v[0]}`);
  const due   = dueCards(progress, keys);
  const fresh = newCards(progress, keys, 10);
  const deck  = shuffle([...new Set([...due, ...fresh])].length ?
    [...new Set([...due, ...fresh])] : keys.slice(0, 10));
  const backMap = {};
  for (const v of VOWELS)
    backMap[`sv:${v[0]}`] = `${v[2]}  ·  e.g. ${v[3]}`;
  const vmap = {};
  for (const v of VOWELS)
    vmap[`sv:${v[0]}`] = [v[0], v[1], backMap[`sv:${v[0]}`]];
  _startScriptFlash(deck, vmap, "Vowel");
}

function _startScriptFlash(deck, map, label) {
  session = { mode: "script-flash", type: "script", deck, idx: 0, correct: 0, map, label };
  _scriptFlashShow();
  showScreen("flash-screen", label === "Consonant" ? "5" : "6");
}

function _scriptFlashShow() {
  const { deck, idx, map, label } = session;
  if (idx >= deck.length) { showSessionEnd(); return; }
  const key  = deck[idx];
  const [thai, rtgs, answer] = map[key] || ["?", "", "?"];

  setProgress("flash-prog", idx, deck.length);
  document.getElementById("flash-counter").textContent = `${label}  ${idx + 1} / ${deck.length}`;
  document.getElementById("flash-thai").textContent  = vowelDisp(thai);
  document.getElementById("flash-rtgs").textContent  = `(${rtgs})`;
  _flashThaiClearClickable();
  document.getElementById("flash-prompt").textContent = `What is this ${label.toLowerCase()}?`;
  document.getElementById("flash-answer").textContent = answer;
  const card = peekCard(progress, key);
  document.getElementById("flash-srs-meta").textContent =
    `interval: ${card.interval}d  ·  streak: ${card.correctStreak}`;
  document.getElementById("flash-answer-area").style.display = "none";
  document.getElementById("flash-reveal-area").style.display = "";
  _buildRatingHandler("flash-rating-row", key, _scriptFlashShow);
}


// ═══════════════════════════════════════════════════════════════════════════
// Quiz
// ═══════════════════════════════════════════════════════════════════════════
function startQuiz() {
  pickCategory(words => _startQuiz(words));
}

function _startQuiz(wordList) {
  const keys  = wordList.map(w => w[0]);
  const due   = dueCards(progress, keys);
  const fresh = newCards(progress, keys, 10);
  const pool  = shuffle([...new Set([...due, ...fresh])].length ?
    [...new Set([...due, ...fresh])] : keys.slice(0, 20)).slice(0, 20);
  session = { wordList, deck: pool, idx: 0, correct: 0, answered: false };
  quizShow();
  showScreen("quiz-screen", "3");
}

function quizShow() {
  const { deck, idx } = session;
  if (idx >= deck.length) { showSessionEnd(); return; }

  const key  = deck[idx];
  const word = WORD_MAP[key];
  if (!word) { session.idx++; quizShow(); return; }

  const [thai, rtgs, english] = word;

  // 3 distractors from full WORDS pool
  const distractors = shuffle(WORDS.filter(w => w[0] !== key)).slice(0, 3);
  const choices = shuffle([word, ...distractors]);
  session.correctIdx = choices.findIndex(c => c[0] === thai);
  session.choices = choices;
  session.answered = false;

  setProgress("quiz-prog", idx, deck.length);
  document.getElementById("quiz-counter").textContent = `Quiz  ${idx + 1} / ${deck.length}`;
  document.getElementById("quiz-thai").textContent = thai;
  document.getElementById("quiz-rtgs").textContent = `(${rtgs})`;
  _tts.speak(thai);

  const ul = document.getElementById("quiz-choices");
  ul.innerHTML = "";
  choices.forEach((c, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="quiz-num">${i + 1}</span> ${c[2]}`;
    li.onclick = () => quizAnswer(i);
    ul.appendChild(li);
  });

  document.getElementById("quiz-feedback").style.display = "none";
  document.getElementById("quiz-next-row").style.display = "none";
}

function quizAnswer(chosen) {
  if (session.answered) return;
  session.answered = true;
  const correct = chosen === session.correctIdx;
  if (correct) session.correct++;

  const lis = document.querySelectorAll("#quiz-choices li");
  lis[chosen].classList.add(correct ? "correct" : "wrong");
  lis[session.correctIdx].classList.add("correct");

  reviewCard(getCard(progress, session.deck[session.idx]),
    correct ? 4 : 1);
  saveProgress(progress);

  const fb = document.getElementById("quiz-feedback");
  fb.innerHTML = correct
    ? `<div class="result-correct">❀ Correct!</div>`
    : `<div class="result-wrong">✗ Wrong — ${session.choices[session.correctIdx][2]}</div>`;
  fb.style.display = "";
  document.getElementById("quiz-next-row").style.display = "";
}

function quizNext() {
  session.idx++;
  quizShow();
}

// ═══════════════════════════════════════════════════════════════════════════
// Consonant Drill
// ═══════════════════════════════════════════════════════════════════════════
function startConsonantDrill() {
  session = { type: "consonant-drill", deck: CONSONANT_SORTED, idx: 0 };
  drillShowConsonant();
  showScreen("drill-screen", "7");
}

function drillShowConsonant() {
  const { deck, idx } = session;
  if (idx >= deck.length) { showMenu(); return; }
  const [thai, rtgs, cls, name, initial, final] = deck[idx];
  const freq  = CHAR_FREQ[thai] || 0;
  const rank  = idx + 1;
  const total = deck.length;
  const isRare = freq <= RARE_THRESHOLD;

  setProgress("drill-prog", idx, total);
  document.getElementById("drill-section-label").textContent = "Consonant Drill";
  document.getElementById("drill-counter").textContent = `${rank} / ${total}`;
  document.getElementById("drill-thai").textContent = thai;
  document.getElementById("drill-rtgs").textContent = `(${rtgs})`;
  _tts.speak(letterSpeechParts(thai));

  const clsCls = cls === "mid" ? "cls-mid" : cls === "high" ? "cls-high" : "cls-low";
  let freqCls = isRare ? "freq-rare" : rank <= total / 3 ? "freq-common" : "freq-mid";
  const rareBadge = isRare ? `<span class="rare-badge">★ rare</span>` : "";

  document.getElementById("drill-info").innerHTML = `
    <div class="drill-row">
      <span class="drill-label">Class</span>
      <span class="drill-value ${clsCls}">${cls.toUpperCase()}</span>
    </div>
    <div class="drill-row">
      <span class="drill-label">Name (ชื่อ)</span>
      <span class="drill-value">${name}</span>
    </div>
    <div class="drill-row">
      <span class="drill-label">Initial / Final</span>
      <span class="drill-value">/${initial}/ → /${final}/</span>
    </div>
    <div class="drill-row">
      <span class="drill-label">Frequency</span>
      <span class="drill-value ${freqCls}">Rank #${rank}/${total} · ${freq} uses${rareBadge}</span>
    </div>
    ${isRare ? `<div style="color:var(--dim);font-size:0.8rem;padding:0.4rem 0;text-align:center;">low priority — focus on higher-ranked consonants first</div>` : ""}
  `;

  session.drillNext = () => { session.idx++; drillShowConsonant(); };
}

// ═══════════════════════════════════════════════════════════════════════════
// Vowel & Tone Drill
// ═══════════════════════════════════════════════════════════════════════════
function startVowelDrill() {
  // Flatten: sorted vowels then tones
  const items = [
    ...VOWEL_SORTED.map((v, i) => ({ type: "vowel", data: v, rank: i + 1, total: VOWEL_SORTED.length })),
    ...TONES.map((t, i) => ({ type: "tone", data: t, rank: i + 1, total: TONES.length })),
  ];
  session = { type: "vowel-drill", deck: items, idx: 0 };
  drillShowVowelTone();
  showScreen("drill-screen", "8");
}

function drillShowVowelTone() {
  const { deck, idx } = session;
  if (idx >= deck.length) { showMenu(); return; }
  const item = deck[idx];
  const [symbol, rtgs, desc, example] = item.data;
  const isVowel = item.type === "vowel";
  const sectionLabel = isVowel ? "Vowels อักษรสระ" : "Tones วรรณยุกต์";

  setProgress("drill-prog", idx, deck.length);
  document.getElementById("drill-section-label").textContent = sectionLabel;
  document.getElementById("drill-counter").textContent =
    `${item.rank} / ${item.total}  (${idx + 1} / ${deck.length} total)`;
  document.getElementById("drill-thai").textContent = vowelDisp(symbol);
  document.getElementById("drill-rtgs").textContent = `(${rtgs})`;
  // Single marks get the "sound, name" form (e.g. ◌า → "อา, สระอา");
  // compound patterns fall back to speaking the example word.
  const named = letterSpeech(symbol);
  const speakText = named !== symbol.replace(/◌/g, "")
    ? letterSpeechParts(symbol)
    : symbol.includes("◌")
      ? (example.match(/^([^\s(（]+)/) || [])[1] || ""
      : symbol;
  if (speakText) _tts.speak(speakText);

  let freqHtml = "";
  if (isVowel) {
    const freq = Math.max(...[...symbol].map(c => CHAR_FREQ[c] || 0));
    const freqCls = item.rank <= item.total / 2 ? "freq-common" : "freq-rare";
    if (freq > 0)
      freqHtml = `<div class="drill-row">
        <span class="drill-label">Frequency</span>
        <span class="drill-value ${freqCls}">Rank #${item.rank}/${item.total} · ${freq} uses</span>
      </div>`;
  }

  document.getElementById("drill-info").innerHTML = `
    <div class="drill-row">
      <span class="drill-label">Description</span>
      <span class="drill-value">${desc}</span>
    </div>
    <div class="drill-row">
      <span class="drill-label">Example</span>
      <span class="drill-value" style="color:var(--vermilion)">${example}</span>
    </div>
    ${freqHtml}
  `;

  session.drillNext = () => { session.idx++; drillShowVowelTone(); };
}

function drillNext() {
  if (session.drillNext) session.drillNext();
  else showMenu();
}

// ═══════════════════════════════════════════════════════════════════════════
// SRS Reviews
// ═══════════════════════════════════════════════════════════════════════════
function startVocabSRS() {
  pickCategory(words => _startSRS(words.map(w => w[0]), "Vocab SRS"));
}

function startScriptSRS() {
  const consKeys = CONSONANTS.map(c => `sc:${c[0]}`);
  const vowelKeys = VOWELS.map(v => `sv:${v[0]}`);
  const keys = [...consKeys, ...vowelKeys];
  _startSRS(keys, "Script SRS", key => {
    if (key.startsWith("sc:")) {
      const thai = key.slice(3);
      const c = CONSONANTS.find(x => x[0] === thai);
      return c ? [c[0], c[1], `${c[2]} class · ${c[3]} · /${c[4]}/ → /${c[5]}/`] : [thai, "", ""];
    } else {
      const pat = key.slice(3);
      const v = VOWELS.find(x => x[0] === pat);
      return v ? [v[0], v[1], `${v[2]} · e.g. ${v[3]}`] : [pat, "", ""];
    }
  });
}

function _startSRS(keys, title, lookupFn) {
  const due   = dueCards(progress, keys);
  const fresh = newCards(progress, keys, 20);
  const deck  = shuffle(due.length ? due : fresh);
  session = {
    type: "srs", keys, deck, idx: 0, correct: 0, title,
    lookup: lookupFn || (key => {
      const w = WORD_MAP[key];
      return w ? [w[0], w[1], w[2]] : [key, "", key];
    }),
  };
  document.getElementById("srs-header").textContent = title;
  if (!deck.length) {
    showSessionEnd(true);
    return;
  }
  const navKey = title.startsWith("Script") ? "9" : "4";
  srsShow();
  showScreen("srs-screen", navKey);
}

function srsShow() {
  const { deck, idx, lookup } = session;
  if (idx >= deck.length) { showSessionEnd(); return; }
  const key = deck[idx];
  const [thai, rtgs, answer] = lookup(key);

  setProgress("srs-prog", idx, deck.length);
  document.getElementById("srs-counter").textContent = `${session.title}  ${idx + 1} / ${deck.length}`;
  document.getElementById("srs-thai").textContent  = vowelDisp(thai);
  document.getElementById("srs-rtgs").textContent  = `(${rtgs})`;
  document.getElementById("srs-prompt").textContent = "Do you know this?";
  if (!thai.includes("◌")) _tts.speak(letterSpeechParts(thai));

  const card = peekCard(progress, key);
  document.getElementById("srs-meta").textContent =
    `interval: ${card.interval}d  ·  streak: ${card.correctStreak}`;
  document.getElementById("srs-answer").textContent = answer;
  document.getElementById("srs-answer-area").style.display = "none";
  document.getElementById("srs-reveal-area").style.display = "";

  _buildRatingHandler("srs-rating-row", key, srsShow);
}

function srsReveal() {
  document.getElementById("srs-answer-area").style.display = "";
  document.getElementById("srs-reveal-area").style.display = "none";
}

// ═══════════════════════════════════════════════════════════════════════════
// Tone Listening Drill
// ═══════════════════════════════════════════════════════════════════════════
// Pre-compute a pool of words that have a detectable tone mark or known tone
function _toneDrillPool() {
  // We need words that TTS can meaningfully demonstrate — use a broad cross-section
  // Group words by the tone of their first syllable (simplified: detect tone mark)
  const pool = [];
  for (const w of WORDS) {
    const thai = w[0];
    // Skip multi-syllable words that are too complex for a listening drill
    if (thai.length > 5) continue;
    pool.push(w);
  }
  return shuffle(pool).slice(0, 100); // cap at 100 for a session
}

function startToneDrill() {
  if (!_tts.available()) {
    alert("Thai text-to-speech is not available in your browser.\nTone drill requires audio playback.");
    return;
  }
  const pool = _toneDrillPool();
  session = { type: "tone-drill", deck: pool, idx: 0, correct: 0 };
  toneDrillShow();
  showScreen("tone-drill-screen", "T");
}

// Derive the tone of a Thai word (first syllable, simplified rule-based)
function _detectWordTone(thai) {
  const chars = [...thai];
  // Look for explicit tone marks first
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    if (cp === 0x0E48) return 1; // ่ mai ek
    if (cp === 0x0E49) return 2; // ้ mai tho
    if (cp === 0x0E4A) return 3; // ๊ mai tri
    if (cp === 0x0E4B) return 4; // ๋ mai jattawa
  }
  return 0; // no explicit mark → mid/natural tone
}

function toneDrillShow() {
  const { deck, idx } = session;
  if (idx >= deck.length) { showSessionEnd(); return; }

  const word = deck[idx];
  session.currentWord = word;
  session.answered = false;

  setProgress("tone-prog", idx, deck.length);
  document.getElementById("tone-counter").textContent = `Tone Drill  ${idx + 1} / ${deck.length}`;
  document.getElementById("tone-feedback").textContent = "";
  document.getElementById("tone-next-row").style.display = "none";

  // Show word (hidden until answered)
  const wordDisplay = document.getElementById("tone-word-display");
  wordDisplay.textContent = word[0];
  wordDisplay.className = "tone-word-big hidden-word";

  // Build tone choices (all 5 tones)
  const ul = document.getElementById("tone-choices");
  ul.innerHTML = "";
  const correctToneIdx = _detectWordTone(word[0]);
  session.correctToneIdx = correctToneIdx;

  TONES.forEach((tone, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="tc-thai">${_esc(tone[0])}</span><span class="tc-en">${_esc(tone[1])}</span>`;
    li.addEventListener("click", () => toneDrillAnswer(i, li));
    ul.appendChild(li);
  });

  // Auto-play
  _tts.speak(word[0]);
}

function toneDrillPlay() {
  if (session.currentWord) _tts.speak(session.currentWord[0]);
}

function toneDrillAnswer(chosen, liEl) {
  if (session.answered) return;
  session.answered = true;

  const correct = chosen === session.correctToneIdx;
  if (correct) session.correct++;

  const lis = document.querySelectorAll("#tone-choices li");
  lis[chosen].classList.add(correct ? "correct" : "wrong");
  lis[session.correctToneIdx].classList.add("correct");

  // Reveal the word
  const wordDisplay = document.getElementById("tone-word-display");
  wordDisplay.className = "tone-word-big";

  const fb = document.getElementById("tone-feedback");
  const word = session.currentWord;
  if (correct) {
    fb.innerHTML = `<span style="color:var(--jade)">❀ Correct! — ${_esc(word[0])} (${_esc(word[1])}) "${_esc(word[2])}"</span>`;
  } else {
    fb.innerHTML = `<span style="color:var(--vermilion)">✗ Wrong — tone is <strong>${_esc(TONES[session.correctToneIdx][0])}</strong> (${_esc(TONES[session.correctToneIdx][1])})</span><br><span style="color:var(--dim)">${_esc(word[0])} = "${_esc(word[2])}"</span>`;
  }

  document.getElementById("tone-next-row").style.display = "";
}

function toneDrillNext() {
  session.idx++;
  toneDrillShow();
}

// ═══════════════════════════════════════════════════════════════════════════
// Sentence SRS
// ═══════════════════════════════════════════════════════════════════════════
function startSentSRS() {
  // Build deck from words that have example sentences; use SRS key "sent:<word>"
  const wordsWith = WORDS.filter(w => EXAMPLES && EXAMPLES[w[0]]);
  const keys = wordsWith.map(w => `sent:${w[0]}`);
  const due   = dueCards(progress, keys);
  const fresh = newCards(progress, keys, 15);
  const deck  = shuffle(due.length ? due : fresh);
  session = { type: "sent-srs", keys, deck, idx: 0, correct: 0 };
  document.getElementById("sent-counter").textContent = "";
  if (!deck.length) { showSessionEnd(true); return; }
  sentSrsShow();
  showScreen("sent-srs-screen", "S");
}

function sentSrsShow() {
  const { deck, idx } = session;
  if (idx >= deck.length) { showSessionEnd(); return; }

  const key  = deck[idx];
  const word = WORD_MAP[key.slice(5)]; // strip "sent:"
  if (!word) { session.idx++; sentSrsShow(); return; }

  const [thai, rtgs, english] = word;
  const ex = EXAMPLES[thai];
  if (!ex) { session.idx++; sentSrsShow(); return; }

  const [sentThai, sentRtgs, sentEn] = ex;

  setProgress("sent-prog", idx, deck.length);
  document.getElementById("sent-counter").textContent = `Sentence SRS  ${idx + 1} / ${deck.length}`;

  // Build sentence with target word blanked
  const blank = `<span class="sent-blank">${_esc(thai)}</span>`;
  const displaySent = sentThai.replace(thai, blank);
  document.getElementById("sent-sentence").innerHTML = displaySent;

  // Romanisation with blank
  const blankRtgs = `<span style="color:var(--saffron)">___</span>`;
  document.getElementById("sent-rtgs").innerHTML = sentRtgs.replace(rtgs, blankRtgs);
  document.getElementById("sent-en").textContent = sentEn;

  document.getElementById("sent-answer").textContent = `${thai}  (${rtgs})  —  ${english}`;

  const card = peekCard(progress, key);
  document.getElementById("sent-meta").textContent =
    `interval: ${card.interval}d  ·  streak: ${card.correctStreak}`;

  document.getElementById("sent-answer-area").style.display = "none";
  document.getElementById("sent-reveal-area").style.display = "";

  _buildRatingHandler("sent-rating-row", key, sentSrsShow);

  // Speak sentence with a slight delay so user can read first
  setTimeout(() => _tts.speak(sentThai), 600);
}

function sentSrsReveal() {
  document.getElementById("sent-answer-area").style.display = "";
  document.getElementById("sent-reveal-area").style.display = "none";
}

function _buildRatingHandler(rowId, key, nextFn) {
  buildRatingRow(rowId, q => {
    // Snapshot for undo before the rating mutates anything
    session.undo = {
      key,
      prev: progress[key] ? { ...progress[key] } : null,
      idx: session.idx,
      correctBefore: session.correct,
      requeuedAt: -1,
      show: nextFn,
    };
    reviewCard(getCard(progress, key), q);
    if (q >= 3) session.correct++;
    // Lapsed card: relearn it later in this same session
    else session.undo.requeuedAt = requeue(session.deck, session.idx, key);
    saveProgress(progress);
    session.idx++;
    nextFn();
  });
  _updateUndoButtons();
}

function undoLastRating() {
  const u = session.undo;
  if (!u) return;
  if (u.prev) progress[u.key] = u.prev;
  else delete progress[u.key];
  if (u.requeuedAt >= 0) session.deck.splice(u.requeuedAt, 1);
  session.correct = u.correctBefore;
  session.idx = u.idx;
  session.undo = null;
  saveProgress(progress);
  u.show();
}

function _updateUndoButtons() {
  const show = !!session.undo;
  for (const id of ["flash-undo-btn", "srs-undo-btn", "sent-undo-btn"]) {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = show ? "" : "none";
  }
}

function buildRatingRow(rowId, onRate) {
  const ratings = [
    { q: 1, label: "Forgot",  cls: "bad" },
    { q: 2, label: "Hard",    cls: "" },
    { q: 3, label: "OK",      cls: "" },
    { q: 4, label: "Good",    cls: "good" },
    { q: 5, label: "Perfect", cls: "good" },
  ];
  const row = document.getElementById(rowId);
  row.innerHTML = "";
  for (const r of ratings) {
    const btn = document.createElement("button");
    btn.className = `rating-btn ${r.cls}`;
    btn.textContent = r.label;
    btn.onclick = () => onRate(r.q);
    row.appendChild(btn);
  }
}
