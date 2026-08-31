// Study sessions: flashcards, quiz, drills, SRS review, tone drill,
// sentence SRS, and the shared rating row.

// ═══════════════════════════════════════════════════════════════════════════
// Deck assembly (shared by every mode below)
// ═══════════════════════════════════════════════════════════════════════════
// Every mode used to hand-roll its own due/fresh combination, differing in
// small, unexplained ways that looked like drift rather than decisions. Two
// named policies cover all of them — pick the one that matches what the mode
// IS, not what it happens to do today:
//
//  - "union" (default): due ∪ fresh(freshCap), deduped. Keeps teaching new
//    material even while reviews pile up — an exploratory learn+review
//    hybrid. Used by flashcards, script flashcards, and the quiz.
//  - "due-first": due cards only, when any exist; else fresh(freshCap). A
//    pure spaced-repetition queue that clears everything due before ever
//    introducing new material. Used by SRS Review and Sentence SRS — modes
//    whose whole point is "show me what's due," so silently mixing in new
//    words would undercut that.
//
// `cap` (optional) hard-limits the FINAL deck length after shuffling — the
// quiz wants a short, snappy round even with a huge due pile; ordinary
// flashcard review doesn't cap at all, so a big due pile just means a
// longer session.
// `fallback` (optional) fires ONLY when the policy above produces zero
// cards (nothing due, nothing new): flashcards/quiz fall back to the first
// N keys so a session is never blank; SRS Review/Sentence SRS pass no
// fallback, so a genuinely empty deck correctly triggers "all caught up"
// instead of stuffing in content nobody asked to review yet.
// Progress through a session, counted in DISTINCT cards cleared rather than
// position in the deck array. Only rating-based modes requeue a lapsed card
// (see _buildRatingHandler), and each requeue lengthens the deck — so
// `idx + 1 / deck.length` measures you against a denominator that grows as you
// work. Simulated over a realistic relearning curve, a 600-card session ends
// with the deck at 962: at the halfway point the old counter read "480 / 788"
// where 788 was never the goal and 600 was.
//
// Distinct-cleared is monotone, keeps the denominator the learner was given,
// and reaches 100% exactly when the session ends. `deck.slice(idx)` is every
// card still ahead — anything requeued is in there, anything passed is not.
// Found by the 2026-08-30 lapsed-learner round.
function sessionProgress(deck, idx) {
  const total = new Set(deck).size;
  const left = new Set(deck.slice(idx)).size;
  return { done: total - left, total };
}

function buildDeck(keys, { mode = "union", freshCap = 10, cap = null, fallback = null } = {}) {
  const due = dueCards(progress, keys);
  const fresh = newCards(progress, keys, freshCap);
  let deck = mode === "due-first"
    ? (due.length ? due : fresh)
    : [...new Set([...due, ...fresh])];
  if (!deck.length && fallback) deck = keys.slice(0, fallback);
  deck = shuffle(deck);
  return cap ? deck.slice(0, cap) : deck;
}

// ═══════════════════════════════════════════════════════════════════════════
// Flashcards
// ═══════════════════════════════════════════════════════════════════════════
function startVocab(mode) {
  pickCategory(words => _startFlash(mode, words));
}

function _startFlash(mode, wordList) {
  const deck = buildDeck(wordList.map(w => w[0]), { fallback: 20 });
  session = { mode, wordList, deck, idx: 0, correct: 0, type: "vocab" };
  flashShow();
  showScreen("flash-screen", mode === "th2en" ? "1" : "2");
}

let _flashThaiHandler = null, _flashThaiKeyHandler = null;

function _flashThaiMakeClickable(word) {
  const el = document.getElementById("flash-thai");
  if (_flashThaiHandler) el.removeEventListener("click", _flashThaiHandler);
  if (_flashThaiKeyHandler) el.removeEventListener("keydown", _flashThaiKeyHandler);
  _flashThaiHandler = () => openWordModal(word);
  // role="button"/tabindex make this keyboard-FOCUSABLE, but a <div> doesn't
  // natively respond to Enter/Space the way a real <button> does — without
  // this it's reachable by keyboard but not actually operable by it.
  _flashThaiKeyHandler = e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _flashThaiHandler(); }
  };
  el.addEventListener("click", _flashThaiHandler);
  el.addEventListener("keydown", _flashThaiKeyHandler);
  el.style.cursor = "pointer";
  el.title = "Click for details";
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
}

function _flashThaiClearClickable() {
  const el = document.getElementById("flash-thai");
  if (_flashThaiHandler) { el.removeEventListener("click", _flashThaiHandler); _flashThaiHandler = null; }
  if (_flashThaiKeyHandler) { el.removeEventListener("keydown", _flashThaiKeyHandler); _flashThaiKeyHandler = null; }
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

  // Consonant/vowel cards render via _scriptFlashShow, not here — flashShow
  // only ever sees th2en/en2th.
  if (mode === "th2en") {
    document.getElementById("flash-thai").textContent = vowelDisp(thai);
    document.getElementById("flash-rtgs").textContent = `(${rtgs})`;
    document.getElementById("flash-prompt").textContent = "What does this mean?";
    document.getElementById("flash-answer").textContent = english;
    _flashSpeakSet(thai);
    _tts.speak(thai);
    _flashThaiMakeClickable(word);
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
  const deck = buildDeck(keys, { fallback: 15 });
  const map = {};
  for (const c of CONSONANTS)
    map[`sc:${c[0]}`] = [c[0], c[1], `${c[2]} class  ·  ${c[3]}  ·  /${c[4]}/ → /${c[5]}/`];
  _startScriptFlash(deck, map, "Consonant");
}

function startVowelFlash() {
  const keys = VOWEL_SORTED.map(v => `sv:${v[0]}`);
  const deck = buildDeck(keys, { fallback: 10 });
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
  document.getElementById("flash-thai").textContent  = vowelDisp(thai, "อ"); // อ host: vowels read as their pure sound (no-op for consonants)
  document.getElementById("flash-rtgs").textContent  = `(${rtgs})`;
  _flashThaiClearClickable();
  // Reset shared flash-screen state left over from a vocab session: the 🔊
  // button would otherwise replay the previous session's word, and the
  // revealed example sentence would reappear inside the answer area.
  document.getElementById("flash-example").style.display = "none";
  const spoken = map[key] ? letterSpeechParts(thai) : null;
  _flashSpeakSet(spoken);
  if (spoken) _tts.speak(spoken);
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
  const keys = wordList.map(w => w[0]);
  const pool = buildDeck(keys, { fallback: 20, cap: 20 });
  session = { wordList, deck: pool, idx: 0, correct: 0, answered: false };
  quizShow();
  showScreen("quiz-screen", "3");
}

// 3 distractors from the full WORDS pool: different Thai key AND different
// English gloss. Two WORDS entries can share an identical gloss (ส้ม/สีส้ม
// both "orange", ชำระเงิน/จ่าย both "to pay") — filtering on the Thai key
// alone let a distractor with the SAME displayed answer text appear in the
// choice list, so the quiz could show "orange" twice with only one marked
// correct. Mirrors learn.js's _mcOptions, which already guards on gloss too.
function _quizDistractors(word, pool) {
  return shuffle(pool.filter(w => w[0] !== word[0] && w[2] !== word[2])).slice(0, 3);
}

function quizShow() {
  const { deck, idx } = session;
  if (idx >= deck.length) { showSessionEnd(); return; }

  const key  = deck[idx];
  const word = WORD_MAP[key];
  if (!word) { session.idx++; quizShow(); return; }

  const [thai, rtgs, english] = word;

  const distractors = _quizDistractors(word, WORDS);
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
    : `<div class="result-wrong">✗ Wrong — ${_esc(session.choices[session.correctIdx][2])}</div>`;
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
  // "Browse", not "Drill": this screen has a Next button and nothing to answer.
  // It is a good reference browser — class, name, initial/final, frequency rank
  // per glyph — but it tests nothing, while the two modes that DO test the same
  // 60 cards are called "Cards" and "SRS". A script-purist walkthrough clicked
  // "Drill" expecting to be quizzed and got a slideshow. The function names stay
  // as they are; they are internal, and the keyboard shortcuts (7/8) are muscle
  // memory worth more than the consistency. Not "Chart" either — key A is
  // already "Reference Charts", which shows every glyph at once; this one walks
  // them one at a time, and two things called a chart would be worse than one
  // called a drill.
  document.getElementById("drill-section-label").textContent = "Browse Consonants";
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
      <span class="drill-value">${_esc(name)}</span>
    </div>
    <div class="drill-row">
      <span class="drill-label">Initial / Final</span>
      <span class="drill-value">/${_esc(initial)}/ → /${_esc(final)}/</span>
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
  document.getElementById("drill-thai").textContent = vowelDisp(symbol, "อ"); // อ host: vowels read as their pure sound (no-op for consonants/marks)
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
      <span class="drill-value">${_esc(desc)}</span>
    </div>
    <div class="drill-row">
      <span class="drill-label">Example</span>
      <span class="drill-value" style="color:var(--vermilion)">${_esc(example)}</span>
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
  const deck = buildDeck(keys, { mode: "due-first", freshCap: 20 });
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

  const sp = sessionProgress(deck, idx);
  setProgress("srs-prog", sp.done, sp.total);
  document.getElementById("srs-counter").textContent = `${session.title}  ${sp.done} / ${sp.total}`;
  document.getElementById("srs-thai").textContent  = vowelDisp(thai, "อ"); // อ host: vowels read as their pure sound (no-op for consonants/marks)
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
// The tone a romanisation CLAIMS, read off its diacritic — the app's house
// scheme marks à low, â falling, á high, ǎ rising, and leaves mid unmarked.
// Used to cross-check the tone engine against data.js's own hand-written
// answer before a word is allowed into the drill.
const _RTGS_TONE = { "\u0300": "low", "\u0302": "falling", "\u0301": "high", "\u030c": "rising" };
function _rtgsTone(rtgs) {
  const s = String(rtgs).trim();
  // A multi-syllable romanisation makes no single claim, even when only one of
  // its syllables carries a mark (tam-rùat has exactly one). Same hyphen/space
  // test toneOfWord uses, so the two agree on what "one syllable" means.
  if (/[-\s]/.test(s)) return null;
  const marks = [...s.normalize("NFD")].filter(c => _RTGS_TONE[c]);
  if (marks.length > 1) return null;
  return marks.length ? _RTGS_TONE[marks[0]] : "mid";
}

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
    // Only words the tone engine can actually grade (single, readable
    // syllables) — so the answer key is always right, never a guess.
    const tone = (typeof toneOfWord === "function") ? toneOfWord(thai) : null;
    if (!tone) continue;
    // …and only words where the engine AGREES with the romanisation printed on
    // the reveal card. Where they disagree the drill was scoring one and
    // showing the other: it played a falling ก็ (kôo), marked "falling" wrong,
    // and printed "mid class + no mark → LOW tone" beside the card reading kôo.
    // Either side can be the wrong one — ก็ is an irregular spelling the engine
    // shouldn't read, แอป/เชฟ are loanwords whose speech departs from spelling —
    // so when the two sources disagree we simply don't know, and don't drill it.
    if (_rtgsTone(w[1]) !== tone) continue;
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

// The word's actual tone as an index into TONES, via the tone engine
// (toneOfWord, curriculum.js). TONES[i][1] holds the realised tone name
// ("mid" … "rising"), the same vocabulary toneOfWord returns, so the two line
// up directly. This replaces an older marks-only guess that got every unmarked
// non-mid word wrong (หมา read as mid, not rising; สิบ as mid, not low). Pool
// words are pre-filtered to ones the engine can grade, so 0 is a safe fallback.
function _detectWordTone(thai) {
  const tone = (typeof toneOfWord === "function") ? toneOfWord(thai) : null;
  if (!tone) return 0; // not gradable (shouldn't happen — the pool is pre-filtered) — safe, silent fallback
  const i = TONES.findIndex(t => t[1] === tone);
  if (i < 0) {
    // the engine returned a real tone but no TONES row names it — data.js's
    // TONES and the engine's tone vocabulary have drifted apart. This must
    // never fail silently: it means the drill is about to teach a wrong
    // answer with no signal that anything broke.
    console.warn(`_detectWordTone: "${tone}" (from toneOfWord("${thai}")) matches no TONES row`);
    return 0;
  }
  return i;
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
    // เสียง prefix: สามัญ/เอก/โท/ตรี/จัตวา are ALSO the names of the tone
    // MARKS (ไม้เอก ่, ไม้โท ้, …), and on a low-class consonant the mark
    // named "โท" produces the ตรี tone, not โท — so a bare "โท" choice reads
    // as "the mai-tho mark" to a learner. "เสียงโท" unambiguously names the
    // tone, not the mark.
    li.innerHTML = `<span class="tc-thai">เสียง${_esc(tone[0])}</span><span class="tc-en">${_esc(tone[1])}</span>`;
    li.addEventListener("click", () => toneDrillAnswer(i, li));
    ul.appendChild(li);
  });

  // Auto-play
  _tts.speak(word[0]);
}

function toneDrillPlay() {
  if (session.currentWord) _tts.speak(session.currentWord[0]);
}

// The rule that produced the tone, spelled out for the reveal — e.g.
// "low class + ้ mai tho → HIGH tone". Uses syllableToneInfo AND
// TONE_LABELS, both in thai-script.js, which loads before sessions.js — but
// this only runs at click time regardless (same pattern baht-bus.js uses
// for game.js: reference across files inside functions, never at load).
const _TONE_MARK_DESC = { none: "no mark", ek: "่ mai ek", tho: "้ mai tho", tri: "๊ mai tri", chattawa: "๋ mai chattawa" };
function _toneRuleLine(thai) {
  const info = (typeof syllableToneInfo === "function") ? syllableToneInfo(thai) : null;
  if (!info) return "";
  const label = (typeof TONE_LABELS !== "undefined" && TONE_LABELS[info.tone]) || info.tone;
  return `${info.cls} class + ${_TONE_MARK_DESC[info.mark]} → ${label.toUpperCase()} tone`;
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
  const rule = _toneRuleLine(word[0]);
  const ruleLine = rule ? `<br><span style="color:var(--dim);font-size:0.85em">${_esc(rule)}</span>` : "";
  if (correct) {
    fb.innerHTML = `<span style="color:var(--jade)">❀ Correct! — ${_esc(word[0])} (${_esc(word[1])}) "${_esc(word[2])}"</span>${ruleLine}`;
  } else {
    fb.innerHTML = `<span style="color:var(--vermilion)">✗ Wrong — tone is <strong>เสียง${_esc(TONES[session.correctToneIdx][0])}</strong> (${_esc(TONES[session.correctToneIdx][1])})</span><br><span style="color:var(--dim)">${_esc(word[0])} = "${_esc(word[2])}"</span>${ruleLine}`;
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
  const deck = buildDeck(keys, { mode: "due-first", freshCap: 15 });
  // due-first falls through to fifteen NEVER-SEEN sentences when nothing is
  // due, and the counter called them "Sentence SRS" either way — so a learner
  // opening this to clear a backlog was handed a fifteen-card lesson wearing
  // the word "SRS". Name which deck this is.
  const allNew = !dueCards(progress, keys).length;
  session = { type: "sent-srs", keys, deck, idx: 0, correct: 0, allNew };
  document.getElementById("sent-counter").textContent = "";
  if (!deck.length) { showSessionEnd(true); return; }
  sentSrsShow();
  showScreen("sent-srs-screen", "S");
}

// Blank EVERY occurrence of `target` in `sentThai`, not just the first. The
// original code used a single String.replace(), which leaked the answer
// whenever the headword appears twice in its own example sentence (ศาสนา…
// ศาสนา, วิธี…วิธี, หนาว…หนาว) — only the first copy got blanked, the second
// stayed readable. Escape the WHOLE sentence first (the surrounding text is
// EXAMPLES data too), then split/join on the escaped target — Thai text never
// contains &<>"', so the escaped target still matches inside the escaped
// sentence, exactly as the original single-replace version relied on.
function _sentBlankThai(sentThai, target) {
  const escSent = _esc(sentThai), escTarget = _esc(target);
  if (!escTarget) return escSent;
  const blank = `<span class="sent-blank">${escTarget}</span>`;
  return escSent.split(escTarget).join(blank);
}

// Same fix for the romanisation: split on whitespace/hyphen (RTGS compounds
// are hyphenated, e.g. "khǎai-dii") so a hit inside a longer romanised word
// is never blanked — only a standalone occurrence of the target.
function _sentBlankRtgs(sentRtgs, targetRtgs) {
  const blank = `<span style="color:var(--saffron)">___</span>`;
  return sentRtgs.split(/(\s+|-)/).map(tok => tok === targetRtgs ? blank : _esc(tok)).join("");
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

  const sp = sessionProgress(deck, idx);
  setProgress("sent-prog", sp.done, sp.total);
  document.getElementById("sent-counter").textContent =
    `${session.allNew ? "New sentences" : "Sentence SRS"}  ${sp.done} / ${sp.total}`;

  // Build sentence with target word blanked. A phrase-template headword
  // ("ขอ...") appears in its example sentence as only its fixed part (ขอ),
  // so match on wordLiteral() — the fixed part — not the raw word, or the
  // card ships unblanked. (data.js owns the rule.)
  const target = wordLiteral(thai);
  const targetRtgs = wordLiteral(rtgs);
  document.getElementById("sent-sentence").innerHTML = _sentBlankThai(sentThai, target);
  document.getElementById("sent-rtgs").innerHTML = _sentBlankRtgs(sentRtgs, targetRtgs);
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
    // Feed the streak. _streakRecord had exactly one caller — _learnRecord in
    // learn.js — so the Guided Course was the only mode that counted. A learner
    // coming back to a backlog does the obviously-right thing, opens SRS
    // Review, grinds 900 cards, and the engagement layer registers nothing.
    // Every mode routed through this handler now counts. (learn.js records
    // separately and does not come through here, so nothing double-counts.)
    // Found by the 2026-08-30 lapsed-learner round.
    if (typeof _streakRecord === "function") _streakRecord(0);
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
