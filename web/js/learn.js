// The guided course runner — renders the path, runs units, grades recall.
// DOM only at runtime (vm-safe at load). Data + pure helpers live in
// curriculum.js; SM-2 store is shared with every other mode (same keys:
// the Thai word for vocab, the glyph for script), so the course, the
// flashcards, and the SRS reviews are one memory of one learner.
//
// Session shape per unit (the acquisition loop): warm-up on due reviews →
// new material → active recall (MC / timed speed read / listen-and-pick) →
// summary with mastery gate (COURSE_PASS first-try accuracy to advance).

const LEARN_KEY = "soisanuk_path";

function _pathLoad() {
  try { return JSON.parse(localStorage.getItem(LEARN_KEY) || "{}"); }
  catch { return {}; }
}
function _pathSave(p) { localStorage.setItem(LEARN_KEY, JSON.stringify(p)); }
function _unitId(u) { return u.kind === "letters" ? "L" + u.batch : u.lesson; }
function _unitDone(path, u) { return !!(path.units && path.units[_unitId(u)] && path.units[_unitId(u)].done); }
function _unitUnlocked(path, idx) {
  if (idx === 0) return true;
  return _unitDone(path, COURSE[idx - 1]);
}

// ── The path screen ──────────────────────────────────────────────────────────
function startLearn() {
  const path = _pathLoad();
  const list = document.getElementById("learn-units");
  list.innerHTML = "";
  COURSE.forEach((u, idx) => {
    const li = document.createElement("li");
    const done = _unitDone(path, u);
    const open = _unitUnlocked(path, idx);
    li.className = "learn-unit" + (done ? " done" : open ? " open" : " locked");
    const rec = path.units && path.units[_unitId(u)];
    li.innerHTML = `<span class="learn-badge">${done ? "✓" : open ? "▶" : "🔒"}</span>` +
      `<span class="learn-label">${u.label}</span>` +
      (rec && rec.acc != null ? `<span class="learn-acc">${Math.round(rec.acc * 100)}%${rec.msAvg ? " · " + (rec.msAvg / 1000).toFixed(1) + "s/word" : ""}</span>` : "");
    if (open) li.onclick = () => _unitStart(idx);
    list.appendChild(li);
  });
  const stats = srsStats(loadProgress());
  document.getElementById("learn-intro").textContent =
    stats.totalSeen === 0 ?
      "A guided road from zero: learn to READ Thai fast, pick up the street's " +
      "phrases, and let the app quiz you — you never grade yourself here." :
      `${stats.dueNow} reviews due · ${stats.totalSeen} cards known · ${stats.mature} mature`;
  showScreen("learn-screen", "G");
}

// ── The unit runner ─────────────────────────────────────────────────────────
let _lu = null; // { idx, unit, queue:[items], at, results:[{key,q,first,ms}], t0 }

function _unitStart(idx) {
  const unit = COURSE[idx];
  const queue = [];
  // warm-up: up to 4 due reviews from anything the course has touched
  const prog = loadProgress();
  const due = dueCards(prog, WORDS.map(w => w[0])).slice(0, 4);
  for (const th of due) {
    const w = WORDS.find(x => x[0] === th);
    if (w) queue.push({ kind: "mc", word: w, tag: "review" });
  }
  if (unit.kind === "letters") {
    const batch = LETTER_BATCHES[unit.batch];
    for (const g of batch.glyphs) queue.push({ kind: "glyph", glyph: g });
    const fresh = courseNewWords(unit.batch).slice(0, 8);
    const pool = courseDecodable(unit.batch);
    for (const w of fresh) queue.push({ kind: "mc", word: w, tag: "new" });
    // timed speed reads over everything decodable so far (repeats fine)
    const speed = _shuffle(pool.slice()).slice(0, Math.min(8, pool.length));
    for (const w of speed) queue.push({ kind: "speed", word: w });
    // listening: hear it, pick the SCRIPT — reading through the ears
    const listen = _shuffle(pool.slice()).slice(0, Math.min(5, pool.length));
    for (const w of listen) queue.push({ kind: "listen", word: w, pool });
  } else {
    const lesson = GRAMMAR_LESSONS.find(g => g.id === unit.lesson);
    queue.push({ kind: "chunkIntro", lesson });
    for (const p of lesson.pattern) queue.push({ kind: "chunk", line: p });
    for (const pr of lesson.practice) queue.push({ kind: pr.kind === "cloze" ? "cloze" : "mc2", item: pr });
    // a quick match round over the lesson's chunks
    if (lesson.pattern.length >= 4) queue.push({ kind: "match", pairs: lesson.pattern.slice(0, 4) });
  }
  _lu = { idx, unit, queue, at: 0, results: [] };
  _learnStep();
}

function _learnStep() {
  if (!_lu || _lu.at >= _lu.queue.length) { _unitFinish(); return; }
  const item = _lu.queue[_lu.at];
  const body = document.getElementById("lesson-body");
  const prog = document.getElementById("lesson-prog");
  prog.style.width = Math.round((_lu.at / _lu.queue.length) * 100) + "%";
  document.getElementById("lesson-counter").textContent =
    `${_lu.at + 1} / ${_lu.queue.length}` + (item.tag === "review" ? " · review" : "");
  body.innerHTML = "";
  showScreen("lesson-screen", "G");
  ({ glyph: _wGlyph, mc: _wMC, mc2: _wMC2, speed: _wMC, listen: _wListen,
     cloze: _wCloze, match: _wMatch, chunkIntro: _wChunkIntro, chunk: _wChunk }[item.kind])(item, body);
}

function _learnRecord(key, quality, ms) {
  if (key) {
    const prog = loadProgress();
    reviewCard(getCard(prog, key), quality);
    saveProgress(prog);
  }
  _lu.results.push({ key, q: quality, ms: ms || 0 });
}

function _learnNext() { _lu.at++; _learnStep(); }

function _unitFinish() {
  if (!_lu) return;
  const scored = _lu.results.filter(r => r.q > 0);
  const firstTry = scored.filter(r => r.q >= 4).length;
  const acc = scored.length ? firstTry / scored.length : 1;
  const speedMs = _lu.results.filter(r => r.ms > 0).map(r => r.ms);
  const msAvg = speedMs.length ? Math.round(speedMs.reduce((a, b) => a + b, 0) / speedMs.length) : null;
  const passed = acc >= COURSE_PASS;
  const path = _pathLoad();
  const id = _unitId(_lu.unit);
  path.units = path.units || {};
  const prev = path.units[id] || {};
  path.units[id] = { done: prev.done || passed, acc, msAvg: msAvg || prev.msAvg };
  _pathSave(path);
  const body = document.getElementById("lesson-body");
  body.innerHTML = `<div class="thai-big">${passed ? "🎉" : "💪"}</div>
    <div class="card-prompt">${passed ? "Unit passed!" : "Almost — " + Math.round(COURSE_PASS * 100) + "% first-try unlocks the next unit."}</div>
    <div class="learn-summary">${Math.round(acc * 100)}% first-try accuracy` +
    (msAvg ? ` · ${(msAvg / 1000).toFixed(1)}s per word read` : "") + `</div>
    <div class="btn-row">
      ${passed ? "" : `<button class="btn btn-primary" onclick="_unitStart(${_lu.idx})">Try again</button>`}
      <button class="btn ${passed ? "btn-primary" : ""}" onclick="startLearn()">Back to the path</button>
    </div>`;
  document.getElementById("lesson-prog").style.width = "100%";
  _lu = null;
}

// ── Widgets ─────────────────────────────────────────────────────────────────
function _shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function _mcOptions(word, field, pool) {
  const wrong = _shuffle((pool || WORDS).filter(w => w[0] !== word[0] && w[field]))
    .slice(0, 3).map(w => w[field]);
  return _shuffle([word[field], ...wrong]);
}
function _speakBtn(text) {
  return `<button class="btn btn-small" onclick="_tts.speak(${JSON.stringify(text).replace(/"/g, "&quot;")})">🔊</button>`;
}

// a letter/vowel/tone-mark introduction card — tap to hear, then on
function _wGlyph(item, body) {
  const g = item.glyph;
  const isMark = ["่", "้", "๊", "๋", "็", "ๆ", "ำ"].includes(g);
  const disp = typeof vowelDisp === "function" ? vowelDisp(g) : g;
  const name = typeof letterSpeech === "function" && !isMark ? letterSpeech(g) : "";
  body.innerHTML = `<div class="thai-big learn-glyph" onclick="_tts.speak(letterSpeechParts(${JSON.stringify(g)}))">${disp}</div>
    <div class="rtgs">${name}</div>
    <div class="card-prompt">${isMark ? "A mark, not a letter — it rides above and bends the tone. Learn each word's tone with the word." : "Tap the glyph to hear it. Say it back. Twice."}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">Got it →</button></div>`;
  if (typeof letterSpeechParts === "function") _tts.speak(letterSpeechParts(g));
}

// multiple-choice recall: Thai on top, tap the meaning. speed items get a timer.
function _wMC(item, body) {
  const w = item.word;
  const timed = item.kind === "speed";
  const opts = _mcOptions(w, 2);
  body.innerHTML = `<div class="thai-big">${w[0]}</div><div class="rtgs">${timed ? "" : w[1]}</div>
    ${timed ? '<div class="learn-timer"><div class="learn-timer-fill" id="learn-timer"></div></div>' : ""}
    <div class="card-prompt">${timed ? "Fast — what does it mean?" : "What does it mean?"}</div>
    <ul class="quiz-choices" id="learn-choices"></ul>`;
  _mcWire(opts, w[2], w[0], timed ? 2500 : 0, () => _tts.speak(w[0]));
}
// grammar-practice MC (item carries its own options)
function _wMC2(item, body) {
  const p = item.item;
  body.innerHTML = `<div class="thai-big">${p.th}</div>
    <div class="card-prompt">What does it mean?</div>
    <ul class="quiz-choices" id="learn-choices"></ul>`;
  _mcWire(_shuffle(p.options.slice()), p.answer, _wordKey(p.th), 0, () => _tts.speak(p.th));
}
function _wordKey(th) { return WORDS.some(w => w[0] === th) ? th : null; }

// hear it first, pick the SCRIPT you heard — listening that trains reading
function _wListen(item, body) {
  const w = item.word;
  const opts = _shuffle([w[0], ..._shuffle(item.pool.filter(x => x[0] !== w[0])).slice(0, 3).map(x => x[0])]);
  body.innerHTML = `<div class="thai-big">👂</div>
    <div class="card-prompt">Which word did you hear? ${_speakBtn(w[0])}</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(opts, w[0], w[0], 0, () => {});
  _tts.speak(w[0]);
}

// cloze: the chunk with a hole in it
function _wCloze(item, body) {
  const p = item.item;
  body.innerHTML = `<div class="thai-big">${p.th.replace("___", "＿＿")}</div>
    <div class="card-prompt">${p.en}</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(_shuffle(p.options.slice()), p.answer, _wordKey(p.answer), 0,
    () => _tts.speak(p.th.replace("___", p.answer)));
}

function _mcWire(options, answer, key, fastMs, onRight) {
  const ul = document.getElementById("learn-choices");
  const t0 = Date.now();
  let missed = false;
  if (fastMs) {
    const fill = document.getElementById("learn-timer");
    requestAnimationFrame(function tick() {
      if (!document.getElementById("learn-timer")) return;
      const left = Math.max(0, 1 - (Date.now() - t0) / 5000);
      fill.style.width = (left * 100) + "%";
      if (left > 0) requestAnimationFrame(tick);
    });
  }
  options.forEach(opt => {
    const li = document.createElement("li");
    li.textContent = opt;
    li.onclick = () => {
      if (opt === answer) {
        const ms = Date.now() - t0;
        li.classList.add("correct");
        onRight();
        _learnRecord(key, courseGrade(true, !missed, fastMs, ms), fastMs ? ms : 0);
        setTimeout(_learnNext, missed ? 900 : 550);
      } else {
        missed = true;
        li.classList.add("wrong");
        li.onclick = null;
      }
    };
    ul.appendChild(li);
  });
}

// match: tap a Thai chip, tap its English — clear the board
function _wMatch(item, body) {
  const pairs = item.pairs;
  body.innerHTML = `<div class="card-prompt">Match them up</div>
    <div class="learn-match" id="learn-match"></div>`;
  const box = document.getElementById("learn-match");
  const chips = [];
  pairs.forEach((p, i) => { chips.push({ side: "th", i, text: p[0] }, { side: "en", i, text: p[2].split(" — ")[0] }); });
  let sel = null, wrongs = 0, left = pairs.length;
  for (const c of _shuffle(chips)) {
    const b = document.createElement("button");
    b.className = "btn learn-chip" + (c.side === "th" ? " learn-chip-th" : "");
    b.textContent = c.text;
    b.onclick = () => {
      if (b.classList.contains("matched")) return;
      if (!sel) { sel = { c, b }; b.classList.add("picked"); if (c.side === "th") _tts.speak(c.text); return; }
      if (sel.b === b) { b.classList.remove("picked"); sel = null; return; }
      if (sel.c.i === c.i && sel.c.side !== c.side) {
        for (const el of [b, sel.b]) { el.classList.remove("picked"); el.classList.add("matched"); }
        left--;
        if (left === 0) {
          _learnRecord(null, wrongs === 0 ? 4 : 2, 0);
          setTimeout(_learnNext, 600);
        }
      } else {
        wrongs++;
        b.classList.add("wrong"); sel.b.classList.remove("picked");
        setTimeout(() => b.classList.remove("wrong"), 350);
      }
      sel = null;
    };
    box.appendChild(b);
  }
}

// chunk lesson intro + per-chunk absorb cards
function _wChunkIntro(item, body) {
  const l = item.lesson;
  body.innerHTML = `<div class="screen-title">${l.title}</div>
    <div class="card-prompt learn-intro-text">${l.intro}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">Learn the chunks →</button></div>`;
}
function _wChunk(item, body) {
  const [th, rtgs, en] = item.line;
  body.innerHTML = `<div class="thai-big" onclick="_tts.speak(${JSON.stringify(th).replace(/"/g, "&quot;")})">${th}</div>
    <div class="rtgs">${rtgs}</div>
    <div class="card-prompt">${en}</div>
    <div class="card-prompt">Tap it. Hear it. Say it out loud — chunks stick by mouth, not by eye.</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">Next →</button></div>`;
  _tts.speak(th);
}
