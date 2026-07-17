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
function _unitId(u) { return u.kind === "letters" ? "L" + u.batch : (u.lesson || "review"); }
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
  // 🏁 the speedometer: your fastest reads, best-first
  const bests = Object.entries(path.best || {}).sort((a, b) => a[1] - b[1]);
  const sp = document.getElementById("learn-speed");
  if (sp) {
    sp.innerHTML = !bests.length ? "" :
      `<div class="sidebar-section" style="text-align:center">🏁 Fastest reads</div>` +
      bests.slice(0, 5).map(([th, ms]) =>
        `<span class="learn-best">${th} <b>${(ms / 1000).toFixed(1)}s</b></span>`).join(" ");
  }
  showScreen("learn-screen", "G");
}

// ── The unit runner ─────────────────────────────────────────────────────────
let _lu = null; // { idx, unit, queue:[items], at, results:[{key,q,first,ms}], t0 }

function _unitQueue(unit, dueWords) {
  const queue = [];
  for (const w of dueWords || []) queue.push({ kind: "mc", word: w, tag: "review" });
  if (unit.kind === "letters") {
    const batch = LETTER_BATCHES[unit.batch];
    for (const g of batch.glyphs) queue.push({ kind: "glyph", glyph: g });
    const fresh = courseNewWords(unit.batch).slice(0, 8);
    const pool = courseDecodable(unit.batch);
    // recall runs BOTH directions: read the Thai, then find the Thai
    fresh.forEach((w, i) => queue.push({ kind: i % 2 ? "mcth" : "mc", word: w, tag: "new", pool }));
    // produce, don't just pick: type the English…
    for (const w of _shuffle(fresh.slice()).slice(0, 2)) queue.push({ kind: "typeen", word: w });
    // …and from batch 2 on, TYPE THE THAI on the Kedmanee keyboard —
    // decodable words only need taught letters, so review teaches typing
    if (unit.batch >= 1) {
      const short = _shuffle(pool.filter(w => [...w[0]].length <= 4)).slice(0, 2);
      for (const w of short) queue.push({ kind: "typeth", word: w });
    }
    // cloze from the real corpus: the word's own example sentence, blanked
    const withEx = fresh.filter(w => typeof EXAMPLES === "object" && EXAMPLES[w[0]]);
    for (const w of _shuffle(withEx.slice()).slice(0, 2)) queue.push({ kind: "clozex", word: w, pool });
    const speed = _shuffle(pool.slice()).slice(0, Math.min(8, pool.length));
    for (const w of speed) queue.push({ kind: "speed", word: w });
    // a match round as the mid-unit breather: five Thai ↔ five meanings
    if (pool.length >= 5) queue.push({ kind: "match", pairs: _shuffle(pool.slice()).slice(0, 5) });
    // listening: hear it — pick the script, or (every other card) the meaning
    const listen = _shuffle(pool.slice()).slice(0, Math.min(5, pool.length));
    listen.forEach((w, i) => queue.push({ kind: "listen", word: w, pool, mode: i % 2 ? "en" : "th" }));
  } else {
    const lesson = GRAMMAR_LESSONS.find(g => g.id === unit.lesson);
    queue.push({ kind: "chunkIntro", lesson });
    lesson.pattern.forEach((p, i) =>
      queue.push({ kind: "chunk", line: p, sign: lesson.id === "g5" ? i % 3 : null }));
    for (const pr of lesson.practice) queue.push({ kind: pr.kind === "cloze" ? "cloze" : "mc2", item: pr });
    if (lesson.pattern.length >= 4) queue.push({ kind: "match", pairs: lesson.pattern.slice(0, 4) });
  }
  return queue;
}

function _unitStart(idx) {
  const unit = COURSE[idx];
  const prog = loadProgress();
  const due = dueCards(prog, WORDS.map(w => w[0])).slice(0, 4)
    .map(th => WORDS.find(x => x[0] === th)).filter(Boolean);
  _lu = { idx, unit, queue: _unitQueue(unit, due), at: 0, results: [] };
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
     mcth: _wMCTH, typeen: _wTypeEN, typeth: _wTypeTH, clozex: _wClozeX,
     cloze: _wCloze, match: _wMatch, chunkIntro: _wChunkIntro, chunk: _wChunk }[item.kind])(item, body);
}

function _learnRecord(key, quality, ms) {
  if (key) {
    const prog = loadProgress();
    reviewCard(getCard(prog, key), quality);
    saveProgress(prog);
  }
  _lu.results.push({ key, q: quality, ms: ms || 0 });
  if (typeof _streakRecord === "function") _streakRecord(ms || 0);
}

function _learnNext() { _lu.at++; _learnStep(); }

// personal-best read times per word (ms) — the speedometer's data
function _bestUpdate(path, results) {
  path.best = path.best || {};
  for (const r of results) {
    if (r.key && r.ms > 0 && r.q >= 4 && (!path.best[r.key] || r.ms < path.best[r.key])) {
      path.best[r.key] = r.ms;
    }
  }
  return path;
}

function _unitFinish() {
  if (!_lu) return;
  const scored = _lu.results.filter(r => r.q > 0);
  const firstTry = scored.filter(r => r.q >= 4).length;
  const acc = scored.length ? firstTry / scored.length : 1;
  const speedMs = _lu.results.filter(r => r.ms > 0).map(r => r.ms);
  const msAvg = speedMs.length ? Math.round(speedMs.reduce((a, b) => a + b, 0) / speedMs.length) : null;
  const passed = acc >= COURSE_PASS;
  const path = _bestUpdate(_pathLoad(), _lu.results);
  if (_lu.idx < 0) { // Continue sessions: record bests, no unit bookkeeping
    _pathSave(path);
    const body = document.getElementById("lesson-body");
    body.innerHTML = `<div class="thai-big">🔥</div><div class="card-prompt">Session done — streak fed.</div>
      <div class="btn-row"><button class="btn btn-primary" onclick="startLearn()">The path</button>
      <button class="btn" onclick="endSession()">Menu</button></div>`;
    _lu = null;
    return;
  }
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
  // distractors from the same part of speech first (a verb hides among verbs),
  // topped up from the wider pool when the category runs thin
  const src = (pool || WORDS).filter(w => w[0] !== word[0] && w[field] && w[field] !== word[field]);
  const same = _shuffle(src.filter(w => w[3] === word[3]));
  const rest = _shuffle(src.filter(w => w[3] !== word[3]));
  const wrong = [...same, ...rest].slice(0, 3).map(w => w[field]);
  return _shuffle([word[field], ...wrong]);
}
function _speakBtn(text) {
  const t = JSON.stringify(text).replace(/"/g, "&quot;");
  // 🔊 learner pace · 🚀 street speed — comprehension of FAST Thai is the wall
  return `<button class="btn btn-small" onclick="_tts.speak(${t})">🔊</button>` +
    `<button class="btn btn-small" onclick="_tts.speak(${t}, null, 1.25)">🚀</button>`;
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
  _mcWire(opts, w[2], w[0], timed ? 2500 : 0, () => _tts.speak(w[0]), w);
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

// EN→Thai: read the meaning, find the Thai — the other direction of recall
function _wMCTH(item, body) {
  const w = item.word;
  const opts = _mcOptions(w, 0, item.pool);
  body.innerHTML = `<div class="screen-title" style="padding:1rem 0">${w[2]}</div>
    <div class="card-prompt">Which one says it?</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(opts, w[0], w[0], 0, () => _tts.speak(w[0]), w);
}

// lenient English answer matching: "to have/there is" accepts "have",
// "there is", "to have" — parentheticals dropped, variants split on / and ,
function _enVariants(gloss) {
  const base = gloss.toLowerCase().replace(/\([^)]*\)/g, " ");
  const parts = base.split(/[\/,;]/).map(p => p.trim()).filter(Boolean);
  const out = new Set();
  for (const p of parts) {
    out.add(p);
    if (p.startsWith("to ")) out.add(p.slice(3));
    if (p.startsWith("a ")) out.add(p.slice(2));
    if (p.startsWith("the ")) out.add(p.slice(4));
  }
  return [...out];
}
function _enMatch(typed, gloss) {
  const t = typed.toLowerCase().trim().replace(/\s+/g, " ");
  return t.length > 0 && _enVariants(gloss).includes(t);
}

// type the English for the Thai — production, not recognition
function _wTypeEN(item, body) {
  const w = item.word;
  body.innerHTML = `<div class="thai-big">${w[0]}</div><div class="rtgs">${w[1]}</div>
    <div class="card-prompt">Type the meaning in English</div>
    <div class="learn-type-row">
      <input id="learn-type-in" class="learn-type-in" type="text" autocomplete="off"
        autocapitalize="off" autocorrect="off" spellcheck="false">
      <button class="btn btn-primary" id="learn-type-go">Check</button>
    </div>
    <div class="card-prompt" id="learn-type-fb"></div>`;
  const input = document.getElementById("learn-type-in");
  const fb = document.getElementById("learn-type-fb");
  let missed = false;
  const check = () => {
    if (_enMatch(input.value, w[2])) {
      fb.textContent = "✓ " + w[2];
      _tts.speak(w[0]);
      _learnRecord(w[0], courseGrade(true, !missed, 0, 0), 0);
      setTimeout(_learnNext, 700);
    } else if (!missed) {
      missed = true;
      fb.textContent = "Not quite — once more.";
      input.select();
    } else {
      fb.textContent = "It means: " + w[2];
      _learnRecord(w[0], 1, 0);
      setTimeout(_learnNext, 1400);
    }
  };
  document.getElementById("learn-type-go").onclick = check;
  input.onkeydown = e => { if (e.key === "Enter") check(); };
  input.focus();
}

// TYPE THE THAI on the Kedmanee keyboard (tutor.js builds it) — vocabulary
// review that secretly teaches typing. Every keystroke is spoken, wrong keys
// bounce off, and a decodable word never needs a letter you haven't met.
function _wTypeTH(item, body) {
  const w = item.word;
  const target = [...w[0]];
  body.innerHTML = `<div class="screen-title" style="padding:0.5rem 0">${w[2]}</div>
    <div class="rtgs">${w[1]}</div>
    <div class="thai-big" id="learn-th-buf" style="min-height:1.4em">&nbsp;</div>
    <div class="card-prompt" id="learn-th-fb">Type it in Thai — every key speaks</div>
    <div id="learn-kbd" class="t-kbd"></div>`;
  const byKey = Object.fromEntries(TUTOR_ALL.map(k => [k.key, k]));
  let buf = [], misses = 0;
  const bufEl = document.getElementById("learn-th-buf");
  const fb = document.getElementById("learn-th-fb");
  _tBuildKbdInto(document.getElementById("learn-kbd"), latin => {
    const entry = byKey[latin];
    if (!entry) return;
    const ch = entry.thai;
    _tts.speak(letterSpeechParts(ch));
    if (ch === target[buf.length]) {
      buf.push(ch);
      bufEl.textContent = buf.join("");
      if (buf.length === target.length) {
        fb.textContent = "✓ " + w[0] + " — " + w[2];
        _tts.speak(w[0]);
        _learnRecord(w[0], misses === 0 ? 5 : misses === 1 ? 4 : 2, 0);
        setTimeout(_learnNext, 900);
      }
    } else {
      misses++;
      bufEl.classList.add("learn-buf-wrong");
      setTimeout(() => bufEl.classList.remove("learn-buf-wrong"), 250);
      if (misses === 2) fb.innerHTML = "It looks like: <b>" + w[0] + "</b>";
    }
  });
}

// hear it first, pick the SCRIPT you heard — listening that trains reading
function _wListen(item, body) {
  const w = item.word;
  const enMode = item.mode === "en"; // answer with the MEANING, script never shown
  const opts = enMode ? _mcOptions(w, 2, item.pool)
    : _shuffle([w[0], ..._shuffle(item.pool.filter(x => x[0] !== w[0])).slice(0, 3).map(x => x[0])]);
  body.innerHTML = `<div class="thai-big">👂</div>
    <div class="card-prompt">${enMode ? "What does the word you hear MEAN?" : "Which word did you hear?"} ${_speakBtn(w[0])}</div>
    <ul class="quiz-choices${enMode ? "" : " learn-thai-choices"}" id="learn-choices"></ul>`;
  _mcWire(opts, enMode ? w[2] : w[0], w[0], 0, () => {}, w);
  _tts.speak(w[0]);
}

// the corpus cloze: her own example sentence with the word missing
function _wClozeX(item, body) {
  const w = item.word;
  const ex = EXAMPLES[w[0]];
  const blanked = ex[0].split(w[0]).join("＿＿");
  const opts = _mcOptions(w, 0, item.pool);
  body.innerHTML = `<div class="thai-big" style="font-size:1.6em">${blanked}</div>
    <div class="card-prompt">${ex[2]}</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(opts, w[0], w[0], 0, () => _tts.speak(ex[0]), w);
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

function _wordCardBtn(w) {
  if (!w || typeof openWordModal !== "function") return "";
  return `<button class="btn btn-small" onclick='openWordModal(${JSON.stringify([w[0], w[1], w[2]]).replace(/'/g, "&#39;")})'>🔍 word card</button>`;
}
function _mcWire(options, answer, key, fastMs, onRight, word) {
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
        if (missed && word) {
          // a miss earns a pause: study the word before moving on
          const row = document.createElement("div");
          row.className = "btn-row";
          row.innerHTML = `${_wordCardBtn(word)} <button class="btn btn-primary" onclick="_learnNext()">Next →</button>`;
          ul.parentElement.appendChild(row);
        } else {
          setTimeout(_learnNext, missed ? 900 : 550);
        }
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
  pairs.forEach((p, i) => { chips.push({ side: "th", i, text: p[0] }, { side: "en", i, text: p[2].split(" — ")[0].split("/")[0] }); });
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
  // the signage lesson renders as street furniture: font-shock is the training
  const signCls = item.sign === null || item.sign === undefined ? "" :
    " learn-sign learn-sign-" + item.sign;
  body.innerHTML = `<div class="thai-big${signCls}" onclick="_tts.speak(${JSON.stringify(th).replace(/"/g, "&quot;")})">${th}</div>
    <div class="rtgs">${rtgs}</div>
    <div class="card-prompt">${en}</div>
    <div class="card-prompt">Tap it. Hear it. Say it out loud — chunks stick by mouth, not by eye. ${_speakBtn(th)}</div>
    <div class="btn-row">${_wordCardBtn([th, rtgs, en])}<button class="btn btn-primary" onclick="_learnNext()">Next →</button></div>`;
  _tts.speak(th);
}

// ── Continue + streak (engagement 2/7) ──────────────────────────────────────
const STREAK_KEY = "soisanuk_streak";
function _streakLoad() {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY) || "{}"); } catch { return {}; }
}
// pure day-roll: same day = no-op, consecutive day = +1, a gap resets to 1
function _streakBump(st, today, yesterday) {
  if (st.last === today) return st;
  return { last: today, days: st.last === yesterday ? (st.days || 0) + 1 : 1,
    today: { cards: 0, msSum: 0, msN: 0 } };
}
function _streakRecord(ms) {
  const d = new Date(), y = new Date(Date.now() - 864e5);
  const iso = x => x.toISOString().slice(0, 10);
  let st = _streakBump(_streakLoad(), iso(d), iso(y));
  st.today = st.today || { cards: 0, msSum: 0, msN: 0 };
  st.today.cards++;
  if (ms > 0) { st.today.msSum += ms; st.today.msN++; }
  localStorage.setItem(STREAK_KEY, JSON.stringify(st));
  _streakRender();
}
function _streakRender() {
  const el = document.getElementById("nav-cont-stats");
  if (!el) return;
  const st = _streakLoad();
  const t = st.today || {};
  el.textContent = !st.days ? "start today" :
    `🔥 ${st.days} day${st.days > 1 ? "s" : ""}` +
    (t.cards ? ` · today ${t.cards} cards` : "") +
    (t.msN ? ` · ${(t.msSum / t.msN / 1000).toFixed(1)}s/word` : "");
}
// ▶ Continue: due reviews first, else the next open unit, else a speed round
function startContinue() {
  const prog = loadProgress();
  const due = dueCards(prog, WORDS.map(w => w[0])).slice(0, 10)
    .map(th => WORDS.find(x => x[0] === th)).filter(Boolean);
  if (due.length >= 3) {
    _lu = { idx: -1, unit: { kind: "review", label: "Review" },
      queue: due.map(w => ({ kind: "mc", word: w, tag: "review" })), at: 0, results: [] };
    _learnStep();
    return;
  }
  const path = _pathLoad();
  const next = COURSE.findIndex((u, i) => _unitUnlocked(path, i) && !_unitDone(path, u));
  if (next >= 0) { _unitStart(next); return; }
  const pool = _shuffle(courseDecodable(LETTER_BATCHES.length - 1)).slice(0, 10);
  _lu = { idx: -1, unit: { kind: "review", label: "Speed round" },
    queue: pool.map(w => ({ kind: "speed", word: w })), at: 0, results: [] };
  _learnStep();
}
if (typeof document !== "undefined") setTimeout(_streakRender, 0);
