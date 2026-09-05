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
function _unitId(u) { return u.id || (u.kind === "letters" ? "L" + u.batch : (u.lesson || "review")); }
function _unitDone(path, u) { return !!(path.units && path.units[_unitId(u)] && path.units[_unitId(u)].done); }
function _unitUnlocked(path, idx) {
  if (idx === 0) return true;
  // a completed unit is always re-enterable, regardless of what unlocked it —
  // otherwise inserting a new unit mid-spine locks review of whatever used to
  // sit right after it, for anyone who'd already finished that unit
  if (_unitDone(path, COURSE[idx])) return true;
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
      `<span class="learn-label">${_esc(u.label)}</span>` +
      (rec && rec.acc != null ? `<span class="learn-acc">${Math.round(rec.acc * 100)}%${rec.msAvg ? " · " + (rec.msAvg / 1000).toFixed(1) + "s/word" : ""}</span>` : "");
    if (open) li.onclick = () => _unitStart(idx);
    list.appendChild(li);
  });
  const done = COURSE.filter(u => _unitDone(path, u)).length;
  document.querySelector("#learn-screen .screen-header").textContent =
    "🎓 " + _levelName(done) + (done ? " · " + done + "/" + COURSE.length : "");
  const pl = document.getElementById("learn-placement");
  if (pl) pl.style.display = done === 0 ? "" : "none";
  const stats = srsStats(loadProgress(), allSrsKeys());
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
      `<div class="sidebar-section" style="text-align:center">🏁 Fastest reads` +
      (bests.length > 5 ? ` <span style="opacity:0.6;font-weight:normal">5 of ${bests.length}</span>` : "") +
      `</div>` +
      bests.slice(0, 5).map(([th, ms]) =>
        `<span class="learn-best">${_esc(th)} <b>${(ms / 1000).toFixed(1)}s</b></span>`).join(" ");
  }
  showScreen("learn-screen", "Q");
}

// ── The unit runner ─────────────────────────────────────────────────────────
let _lu = null; // { idx, unit, queue:[items], at, results:[{key,q,first,ms}], t0 }

// `audio` false drops the cards that can only be answered by EAR. Every other
// audio feature in the app already refuses to run without a Thai voice
// (startToneDrill alerts and returns; clock.js, baht-bus.js, connect4.js and
// wordcard.js all branch on _tts.available) — the course was the one mode that
// didn't check, and it is the one mode that gates progress.
//
// The tone unit is the sharp case: 8 graded cards, 4 of them toneear ("which
// one did you hear?", five syllables differing only by tone mark, no text
// shown). Blind-guessing four 5-way choices averages 3.2 misses against a
// budget of 1, so on a browser with no Thai voice the unit was unpassable —
// and every later unit is locked behind it. Found by the 2026-08-30
// first-timer round.
function _unitQueue(unit, dueWords, audio = true) {
  const queue = [];
  for (const w of dueWords || []) queue.push({ kind: "mc", word: w, tag: "review" });
  if (unit.kind === "letters") {
    const batch = LETTER_BATCHES[unit.batch];
    // The batch's script note comes FIRST, before its glyphs. The ladder used
    // to introduce เ as one more shape to memorise and never mention that it
    // is written before the consonant you voice first — so the learner met the
    // fact as an inconsistency in the data instead of as the rule it is.
    // Placement before inventory; the ordering is owed to the reading tier in
    // The Last Baht Bus, which teaches where a vowel SITS before teaching how
    // many there are.
    if (batch.note) queue.push({ kind: "scriptnote", note: batch.note });
    for (const g of batch.glyphs) queue.push({ kind: "glyph", glyph: g });
    let fresh = courseUnitWords(unit.batch);
    // Words already met, this rung or any earlier one. The four card kinds
    // below that pick a TARGET rather than a distractor must draw from this,
    // not from every decodable word — see courseTaughtWords.
    const taught = courseTaughtWords(unit.batch);
    // A note's anchor word MUST be one this unit actually teaches — a rule
    // about ตลาด means nothing in a unit that never shows ตลาด. But fresh-8 is
    // just the first eight of an order-dependent list, so adding any word
    // anywhere can silently push an anchor out of it: adding the classifier
    // อัน displaced อร่อย from batch 2 and broke the unwritten-vowel note,
    // which is not a relationship anybody should have to remember. Pull the
    // anchor in explicitly and the coupling is gone.

    const pool = courseDecodable(unit.batch);
    // TEACH before testing: meet each new word — decode it, hear it, learn what
    // it MEANS — before any card asks you to recall it. (This was the hole:
    // words went straight to "what does it mean?" never having been presented.)
    for (const w of fresh) queue.push({ kind: "wordintro", word: w });
    // recall runs BOTH directions: read the Thai, then find the Thai
    fresh.forEach((w, i) => queue.push({ kind: i % 2 ? "mcth" : "mc", word: w, tag: "new", pool }));
    // produce, don't just pick: type the English…
    for (const w of _shuffle(fresh.slice()).slice(0, 2)) queue.push({ kind: "typeen", word: w });
    // …and from batch 2 on, TYPE THE THAI on the Kedmanee keyboard —
    // decodable words only need taught letters, so review teaches typing
    if (unit.batch >= 1) {
      // Only words this screen's keyboard can actually spell. It renders the
      // three letter rows, not the number row, so ค ต จ ข ช ุ ึ are absent —
      // and 138 of the 367 candidate targets needed one of those or a shifted
      // glyph. "Type ดู" with ู on no key is not a hard question, it is an
      // impossible one, and the card cannot be completed. The guard is
      // typeof-ed because _unitQueue is vm-tested without tutor.js loaded.
      const canType = typeof _tTypeable === "function" ? _tTypeable(_T_ROWS_FULL, true) : null;
      const spellable = taught.filter(w =>
        [...w[0]].length <= 4 && (!canType || [...w[0]].every(c => canType.has(c))));
      for (const w of _shuffle(spellable).slice(0, 2)) queue.push({ kind: "typeth", word: w });
    }
    // cloze from the real corpus: the word's own example sentence, blanked
    const withEx = fresh.filter(w => typeof EXAMPLES === "object" && EXAMPLES[w[0]]);
    for (const w of _shuffle(withEx.slice()).slice(0, 2)) queue.push({ kind: "clozex", word: w, pool });
    const speed = _shuffle(taught.slice()).slice(0, Math.min(8, taught.length));
    for (const w of speed) queue.push({ kind: "speed", word: w });
    // a match round as the mid-unit breather: five Thai ↔ five meanings
    if (taught.length >= 5) queue.push({ kind: "match", pairs: _shuffle(taught.slice()).slice(0, 5) });
    // listening: hear it — pick the script, or (every other card) the meaning
    if (audio) {
      const listen = _shuffle(taught.slice()).slice(0, Math.min(5, taught.length));
      listen.forEach((w, i) => queue.push({ kind: "listen", word: w, pool, mode: i % 2 ? "en" : "th" }));
    }
    // WHICH LETTER IS THIS? The unit has just shown each new glyph once, alone,
    // and then spent the rest of itself asking what words mean. Nothing ever
    // asked the learner to tell ก from ถ from ภ — which is the thing they
    // actually get wrong. Options are the look-alikes, so elimination does not
    // work; only knowing the shape does. Two per unit, on newly taught letters.
    if (typeof confusableFor === "function") {
      const pick = batch.glyphs
        .map(g => ({ g, group: confusableFor(g) }))
        .filter(x => x.group && x.group.length >= 2)
        .slice(0, 2);
      for (const { g, group } of pick) {
        const c = CONSONANTS.find(x => x[0] === g);
        if (c) queue.push({ kind: "glyphpick", cons: c, group: group.slice() });
      }
    }
    // ONE LETTER APART. A minimal pair from this batch's own decodable words —
    // taught side by side, then tested with its partner guaranteed among the
    // options. Random distractors would let the learner answer by recognising
    // the shape of a word they know; the partner forces the contrast itself.
    if (typeof consMinimalPairs === "function") {
      const known = new Set(pool.map(w => w[0]));
      // shuffled, not .find() — the first match is the same pair for every
      // batch that can reach it, so three different units were all teaching
      // ปิด/ผิด and the other thirteen pairs were never shown to anybody.
      const pair = _shuffle(consMinimalPairs().filter(p => known.has(p.a[0]) && known.has(p.b[0])))[0];
      if (pair) {
        queue.push({ kind: "conspair", pair });
        const first = Math.random() < 0.5;
        queue.push({ kind: "pairpick", word: first ? pair.a : pair.b,
                     other: first ? pair.b : pair.a, pool });
      }
    }
  } else if (unit.kind === "tone") {
    // the tone unit: teach the rule (intro + interactive calculator), then
    // drill it — hear a tone and pick the script (ear), read a real word and
    // name its tone. Neither drill touches the word's vocab SRS (tone is a
    // separate skill — see _wToneRead); they only gate the tone unit itself.
    // Ear hosts must be MID class: mid + the four marks spans all five tones.
    queue.push({ kind: "toneIntro" });
    queue.push({ kind: "tonecalc" });
    const taught = typeof taughtGlyphs === "function" ? taughtGlyphs(3) : new Set(["ก", "ด"]);
    const hosts = ["ก", "ด", "ต", "บ", "ป"].filter(c =>
      typeof _consClass === "function" && _consClass(c) === "mid" && taught.has(c));
    // pick is chosen NOW, not at render — so revisiting a completed toneear
    // card (paging back) shows the same target it was answered against,
    // instead of re-rolling a fresh random question every time it's viewed.
    // The range comes from toneMinimalSet(cons, vowel) — the SAME call
    // _wToneEar/_wReviewCard make to index it — for THIS item's own host,
    // not a shared probe on a fixed consonant: if the set's length were ever
    // host-dependent, a shared probe could silently disagree with what a
    // given card actually renders, and reintroduce an out-of-range pick.
    for (let i = 0; audio && i < 4; i++) {
      const cons = hosts[i % hosts.length] || "ก";
      const vowel = "า";
      const setLen = toneMinimalSet(cons, vowel).length;
      queue.push({ kind: "toneear", cons, vowel, pick: Math.floor(Math.random() * setLen) });
    }
    const readWords = _shuffle((typeof TONE_READ_WORDS !== "undefined" ? TONE_READ_WORDS : []).slice())
      .map(th => WORDS.find(w => w[0] === th)).filter(Boolean)
      // toneOfWord, not syllableTone directly: syllableTone assumes ONE
      // syllable and misreads a polysyllable with confidence, so any text
      // that isn't already known-monosyllabic must go through toneOfWord
      .filter(w => typeof toneOfWord === "function" && toneOfWord(w[0]))
      .slice(0, 4);
    for (const w of readWords) queue.push({ kind: "toneread", word: w });
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
  // Ask TTS at unit-build time, not at card-render time: a unit whose queue
  // contains cards the learner cannot possibly answer is already unfair by the
  // time one is shown.
  const audio = !(typeof _tts === "object" && _tts && typeof _tts.available === "function") || _tts.available();
  _lu = { idx, unit, queue: _unitQueue(unit, due, audio), at: 0, results: [] };
  _learnStep();
}

// cards you can revisit render read-only; teaching cards teach the same either
// way. toneear/toneread are graded quiz cards (like mc/cloze/…), NOT teach
// cards — they route through _wReviewCard on revisit same as any other quiz,
// which is why their target is chosen at queue-build time (item.pick), not
// per-render: a stable recap needs a stable question.
const _TEACH_KINDS = new Set(["glyph", "wordintro", "chunkIntro", "chunk",
  "toneIntro", "tonecalc", "scriptnote", "conspair"]);

function _learnStep() {
  if (!_lu || _lu.at >= _lu.queue.length) { _unitFinish(); return; }
  const item = _lu.queue[_lu.at];
  // frontier: the furthest card reached. Anything behind it is completed and
  // shown read-only (no re-grading) so you can back up to review and move on.
  const review = _lu.at < (_lu.max || 0);
  _lu.max = Math.max(_lu.max || 0, _lu.at);
  _lu.review = review;
  const body = document.getElementById("lesson-body");
  const prog = document.getElementById("lesson-prog");
  prog.style.width = Math.round((_lu.at / _lu.queue.length) * 100) + "%";
  document.getElementById("lesson-counter").textContent =
    `${_lu.at + 1}/${_lu.queue.length}` +
    (review ? " ↩" : item.tag === "review" ? " · warm-up" : "");
  const back = document.getElementById("lesson-back");
  const fwd = document.getElementById("lesson-fwd");
  if (back) back.style.visibility = _lu.at > 0 ? "visible" : "hidden";
  if (fwd) fwd.style.visibility = _lu.at < _lu.max ? "visible" : "hidden";
  body.innerHTML = "";
  showScreen("lesson-screen", "Q");
  if (review && !_TEACH_KINDS.has(item.kind)) { _wReviewCard(item, body); }
  else {
    ({ glyph: _wGlyph, wordintro: _wWordIntro, scriptnote: _wScriptNote, conspair: _wConsPair,
       pairpick: _wPairPick, glyphpick: _wGlyphPick, mc: _wMC, mc2: _wMC2, speed: _wMC, listen: _wListen,
       mcth: _wMCTH, typeen: _wTypeEN, typeth: _wTypeTH, clozex: _wClozeX,
       cloze: _wCloze, match: _wMatch, chunkIntro: _wChunkIntro, chunk: _wChunk,
       toneIntro: _wToneIntro, tonecalc: _wToneCalc, toneear: _wToneEar, toneread: _wToneRead }[item.kind])(item, body);
  }
  _ensureCardEndVisible(body);
}

// A tall card (decomposition chips, an example sentence, chunk prose) can
// push its closing control below the fold on a phone-height screen, with
// nothing telling the learner a scroll would reveal it — reported as the
// "Got it →" button sitting one pixel below the visible screen, looking
// stuck. scrollIntoView({block:"nearest"}) only moves the minimum distance
// needed, so a card that already fits is untouched; one that doesn't gets
// nudged up just far enough to bring its last element into view. Also called
// after _mcWire appends a miss's "Next →" row, since that can arrive after
// the card's own initial render already settled.
function _ensureCardEndVisible(body) {
  const last = body.lastElementChild;
  const scr = document.getElementById("lesson-screen");
  if (!last || !scr) return;
  if (last.getBoundingClientRect().bottom > scr.getBoundingClientRect().bottom) {
    last.scrollIntoView({ block: "nearest" });
  }
}

function _learnRecord(key, quality, ms) {
  if (_lu && _lu.review) return; // revisiting a completed card never re-grades
  // Placement (idx -2) measures where you should START; it must not schedule
  // reviews as a side effect. It showed sixteen words nobody asked to study and
  // wrote a real SRS record for each — and because a wrong answer resets
  // repetitions, a returner who fumbled one mature word had that word's
  // interval knocked back to a day by a test they took to AVOID redoing work.
  // The streak still counts: the cards were genuinely answered.
  const placing = !!(_lu && _lu.idx === -2);
  if (key && !placing) {
    // Grade into the SHARED `progress` object when it exists, not a private
    // loadProgress() copy. app.js loads that global once at parse time and
    // endSession() -> saveAndRefresh() writes it straight back to localStorage,
    // so a private copy's writes were clobbered the moment the learner tapped
    // "Menu": a whole course unit's grading silently reverted, and ▶ Continue
    // then re-served the identical ten cards. The fallback keeps this file
    // loadable under node:vm, where no such global exists.
    const prog = typeof progress === "object" && progress ? progress : loadProgress();
    reviewCard(getCard(prog, key), quality);
    saveProgress(prog);
  }
  _lu.results.push({ key, q: quality, ms: ms || 0 });
  if (typeof _streakRecord === "function") _streakRecord(ms || 0);
}

function _learnNext() { _lu.at++; _learnStep(); }
function _learnBack() { if (_lu && _lu.at > 0) { _lu.at--; _learnStep(); } }
function _learnFwd() { if (_lu && _lu.at < _lu.max) { _lu.at++; _learnStep(); } }

// read-only recap of an already-completed card: the prompt and its answer,
// nothing to grade — just reinforcement while you page back and forth
function _wReviewCard(item, body) {
  const fwdBtn = `<div class="btn-row"><button class="btn btn-primary" onclick="_learnFwd()">Next →</button></div>`;
  if (item.pairs) {
    body.innerHTML = `<div class="learn-teach-tag">REVIEW</div>` +
      item.pairs.map(p => `<div class="learn-ex-block" onclick="_tts.speak(${_toneSpeak(p[0])})">` +
        `<span style="font-size:1.4em">${_esc(p[0])}</span> — ${_esc((p[2] || "").split(" — ")[0])}</div>`).join("") +
      fwdBtn;
    return;
  }
  // toneear has no .word/.item — its target is the minimal-set entry picked
  // at queue-build time (item.pick), the same one the live card answered
  if (item.kind === "glyphpick") {
    const c = item.cons;
    const en = (typeof consNameEn === "function") ? consNameEn(c[0]) : null;
    body.innerHTML = `<div class="learn-teach-tag">REVIEW</div>
      <div class="thai-big learn-glyph" lang="th">${_esc(c[0])}</div>
      <div class="learn-mean">${_esc(c[3])}${en ? " — " + _esc(en) : ""} · /${_esc(c[4])}/</div>${fwdBtn}`;
    return;
  }
  if (item.kind === "toneear") {
    const target = toneMinimalSet(item.cons, item.vowel)[item.pick || 0];
    body.innerHTML = `<div class="learn-teach-tag">REVIEW</div>
      <div class="thai-big learn-glyph" lang="th" onclick="_tts.speak(${_toneSpeak(target.thai)})">${_esc(target.thai)}</div>
      <div class="learn-mean" style="color:${TONE_COLORS[target.tone]}">${TONE_LABELS[target.tone]} tone</div>${fwdBtn}`;
    return;
  }
  let th, rtgs, mean, speak, toneLine = "";
  if (item.kind === "toneread") {
    [th, rtgs, mean] = item.word; speak = th;
    const tone = toneOfWord(th);
    toneLine = `<div class="learn-mean" style="color:${TONE_COLORS[tone]}">${TONE_LABELS[tone]} tone</div>`;
  } else if (item.word) { [th, rtgs, mean] = item.word; speak = th; }
  else if (item.item) { const p = item.item; th = p.th; rtgs = ""; mean = p.answer; speak = p.th; }
  else {
    // no recognised shape (.pairs / kind-specific / .word / .item) — a future
    // graded kind that never got its own review branch lands here instead of
    // throwing on undefined.item.th and crashing the whole lesson screen.
    body.innerHTML = `<div class="learn-teach-tag">REVIEW</div>
      <div class="card-prompt">(no recap available for this card)</div>${fwdBtn}`;
    return;
  }
  body.innerHTML = `<div class="learn-teach-tag">REVIEW</div>
    <div class="thai-big learn-glyph" lang="th" onclick="_tts.speak(${_toneSpeak(speak)})">${_esc(th)}</div>
    <div class="rtgs">${_esc(rtgs)} ${_speakBtn(speak)}</div>
    <div class="learn-mean">${_esc(mean)}</div>${toneLine}${fwdBtn}`;
}

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
  // 80% of a FOUR-card sample is 4/4 — a flawless run, not a mastery bar. Every
  // one of the eight chunk units grades 2-4 cards, so all eight demanded
  // perfection: a learner who genuinely knows 85% of "Speak: ordering food"
  // failed it about half the time and could not advance, since units are
  // strictly gated. Short units therefore always allow one miss; the letters
  // units (26-28 graded) are unaffected and keep their 5-miss budget.
  // Found by the 2026-08-30 first-timer round, which measured the pass rates.
  const passed = acc >= COURSE_PASS ||
    (scored.length < COURSE_PASS_MIN_SAMPLE && scored.length - firstTry <= 1);
  const path = _bestUpdate(_pathLoad(), _lu.results);
  if (_lu.idx === -2) { _placementFinish(); return; }
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
  // Keep the BEST, not the last. `done` was already sticky, but `acc` and
  // `msAvg` were unconditional overwrites — and learn.js deliberately keeps
  // completed units re-enterable "so you can back up to review and move on",
  // so the app invited the exact action that destroyed the record: pass a unit
  // at 100%, dip back in to refresh it, have a bad night, and the badge reads
  // 35% until you replay it cleanly. Reported independently by the 2026-08-30
  // first-timer and completionist rounds. (_bestUpdate for 🏁 read times was
  // already a true minimum; this brings the unit badge in line with it.)
  path.units[id] = {
    done: prev.done || passed,
    acc: Math.max(acc, prev.acc || 0),
    msAvg: (prev.msAvg && msAvg) ? Math.min(prev.msAvg, msAvg) : (msAvg || prev.msAvg),
  };
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
  const t = _toneSpeak(text);
  // 🔊 learner pace · 🚀 street speed — comprehension of FAST Thai is the wall
  return `<button class="btn btn-small" onclick="_tts.speak(${t})" aria-label="Listen">🔊</button>` +
    `<button class="btn btn-small" onclick="_tts.speak(${t}, null, 1.25)" aria-label="Listen at street speed">🚀</button>`;
}

// a letter/vowel/tone-mark introduction card — tap to hear, then on
// One sentence about what this glyph does, correct for the ones that are not
// consonants and not tone marks either.
const _GLYPH_NOTE = {
  "ฤ": "Neither a consonant nor a vowel: ฤ is a whole syllable in one character, \u201cr\u00fa\u201d or \u201cr\u00ed\u201d, borrowed from Sanskrit. It has no class and no name of its own. You need it for อังกฤษ (English) and พฤหัสบดี (Thursday), and then almost never again.",
  "ๆ": "ไม้ยมก. It sits AFTER a word and repeats it — เด็กๆ is \u201cchildren\u201d, ช้าๆ is \u201cslowly\u201d. It is not a tone mark and it does not ride above anything.",
  "็": "ไม้ไต่คู้. It SHORTENS the vowel beneath it — เป็น, not เปน. Vowel length is half of every tone rule, so this small hook matters twice.",
};
// The SOUND, and what the name means. Both are in CONSONANTS and VOWELS and
// neither reached this card: it printed "ก · กอไก่" and nothing else, so with
// no Thai voice the first six cards of the course carried no information about
// what any letter sounds like. The glyphpick card then asked "ไก่ — chicken ·
// Which letter is it? /k/", introducing the sound AND the meaning on the
// question. Taught one thing, tested another, four cards apart.
function _glyphSound(g) {
  const c = (typeof CONSONANTS !== "undefined") && CONSONANTS.find(x => x[0] === g);
  if (c) {
    const en = (typeof consNameEn === "function") ? consNameEn(g) : null;
    const sound = c[4] === "-" ? "" : `  ·  /${c[4]}/`;
    return `${sound}${en ? "  ·  " + en : ""}`;
  }
  const v = (typeof VOWELS !== "undefined") && VOWELS.find(x => x[0].replace(/◌/g, "") === g);
  return v ? `  ·  /${v[1]}/  ·  ${v[2]}` : "";
}
function _glyphNote(g, isToneMark) {
  if (_GLYPH_NOTE[g]) return _GLYPH_NOTE[g];
  // Stands on its own at rung 2, where this card first appears. It used to end
  // "with the consonant's class and the vowel's length, it is the third thing
  // the rule needs" — class, length and "the rule" all arrive in the tone unit,
  // nine units later, so at first meeting it named three unknowns and defined
  // none of them.
  if (isToneMark) return "A tone mark. It rides above the consonant and changes the syllable's tone, which changes the word: แม่ is \u201cmother\u201d and แม้ is \u201ceven if\u201d. Which tone it makes depends on the consonant underneath as well, and the course comes back to that properly later.";
  return "Tap the glyph to hear it. Say it back. Twice.";
}
function _wGlyph(item, body) {
  const g = item.glyph;
  // What this glyph IS, asked of the app's own data instead of a hand-kept
  // list. The list lumped ๆ and ำ in with the tone marks and told the learner
  // "a mark, not a letter — it rides above and bends the tone", which is false
  // of both: ๆ sits on the baseline AFTER a word and repeats it, and ำ is a
  // VOWEL — VOWELS has it, _thaiCharKind calls it one, letterSpeech names it
  // สระอำ. Three of our own datasets said so while the card said otherwise.
  // It also suppressed the NAME for everything in the list, so the one thing a
  // learner could actually use — ไม้เอก, ไม้ยมก — was the thing withheld.
  const isToneMark = ["่", "้", "๊", "๋"].includes(g);
  const disp = typeof vowelDisp === "function" ? vowelDisp(g) : g;
  const name = typeof letterSpeech === "function" ? letterSpeech(g) : "";
  body.innerHTML = `<div class="thai-big learn-glyph" lang="th" onclick="_tts.speak(letterSpeechParts(${_toneSpeak(g)}))">${_esc(disp)}</div>
    <div class="rtgs">${_esc(name)}${_esc(_glyphSound(g))}</div>
    <div class="card-prompt">${_esc(_glyphNote(g, isToneMark))}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">Got it →</button></div>`;
  if (typeof letterSpeechParts === "function") _tts.speak(letterSpeechParts(g));
}

// TEACH a new word before any card tests it: hear it, see it broken into its
// readable syllables (reinforcing the letters just learned), and — the piece
// that was missing — learn what it MEANS. Not scored; this is the lesson.
function _wWordIntro(item, body) {
  const w = item.word;
  // syllable clusters render as whole units (no lone-combining-vowel tofu);
  // each chip speaks its letters so the decode connects to the glyph cards
  const clusters = typeof _buildDecomposition === "function" ? _buildDecomposition(w[0]) : [[...w[0]].join("")];
  const chips = clusters.map(c => {
    const txt = Array.isArray(c) ? c.join("") : c;
    const parts = _toneSpeak(Array.isArray(c) ? c.flatMap(ch =>
      typeof letterSpeechParts === "function" ? letterSpeechParts(ch) : [ch]) : [txt]);
    return `<span class="learn-decode-chip" lang="th" onclick="_tts.speak(${parts})">${_esc(txt)}</span>`;
  }).join('<span class="learn-decode-plus">+</span>');
  const wt = _toneSpeak(w[0]);
  body.innerHTML = `<div class="learn-teach-tag">NEW WORD</div>
    <div class="thai-big learn-glyph" lang="th" onclick="_tts.speak(${wt})">${_esc(w[0])}</div>
    <div class="rtgs">${_esc(w[1])} ${_speakBtn(w[0])}</div>
    <div class="learn-mean">${_esc(w[2])}</div>
    ${clusters.length > 1 ? `<div class="learn-decode">${chips}</div>
      <div class="card-prompt" style="font-size:0.9em;opacity:0.8">Tap each piece to hear the letters build the word.</div>` : ""}
    <div id="learn-ex" class="learn-ex-block"></div>
    <div class="card-prompt learn-ex-hint" id="learn-ex-hint" style="font-size:0.85em;opacity:0.75"></div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">Got it →</button></div>`;
  _tts.speak(w[0]);
  // the example sentence, fully decomposable (tap any word) with THIS word
  // highlighted — the same interactive renderer the flashcard modes use
  if (typeof showExample === "function") {
    showExample("learn-ex", w[0]);
    const shown = document.getElementById("learn-ex");
    const hint = document.getElementById("learn-ex-hint");
    if (hint) hint.textContent = shown && shown.style.display !== "none"
      ? "Tap any word in the sentence to break it down." : "";
  }
}

// multiple-choice recall: Thai on top, tap the meaning. speed items get a timer.
function _wMC(item, body) {
  const w = item.word;
  const timed = item.kind === "speed";
  const opts = _mcOptions(w, 2);
  body.innerHTML = `<div class="thai-big" lang="th">${_esc(w[0])}</div><div class="rtgs">${timed ? "" : _esc(w[1])}</div>
    ${timed ? '<div class="learn-timer"><div class="learn-timer-fill" id="learn-timer"></div></div>' : ""}
    <div class="card-prompt">${timed ? "Fast — what does it mean?" : "What does it mean?"}</div>
    <ul class="quiz-choices" id="learn-choices"></ul>`;
  _mcWire(opts, w[2], w[0], timed ? 2500 : 0, () => _tts.speak(w[0]), w);
}
// grammar-practice MC (item carries its own options)
function _wMC2(item, body) {
  const p = item.item;
  body.innerHTML = `<div class="thai-big" lang="th">${_esc(p.th)}</div>
    <div class="card-prompt">What does it mean?</div>
    <ul class="quiz-choices" id="learn-choices"></ul>`;
  _mcWire(_shuffle(p.options.slice()), p.answer, _wordKey(p.th), 0, () => _tts.speak(p.th));
}
function _wordKey(th) { return WORDS.some(w => w[0] === th) ? th : null; }

// EN→Thai: read the meaning, find the Thai — the other direction of recall
function _wMCTH(item, body) {
  const w = item.word;
  const opts = _mcOptions(w, 0, item.pool);
  body.innerHTML = `<div class="screen-title" style="padding:1rem 0">${_esc(w[2])}</div>
    <div class="card-prompt">Which one says it?</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(opts, w[0], w[0], 0, () => _tts.speak(w[0]), w);
}

// lenient English answer matching: "to have/there is" accepts "have",
// "there is", "to have" — parentheticals dropped, variants split on / and ,
function _enVariants(gloss) {
  const norm = s => s.toLowerCase().replace(/\s+/g, " ").trim();
  const base = gloss.toLowerCase().replace(/\([^)]*\)/g, " ");
  const parts = base.split(/[\/,;]/).map(p => p.trim()).filter(Boolean);
  // The WHOLE gloss, both as printed and with its parenthetical stripped.
  // Without these, splitting on /,; meant the exact string the app had just
  // shown the learner was rejected: the wordintro card teaches มี as
  // "to have/there is", and typing that back scored a 1 and knocked the card's
  // ease factor from 2.5 to 1.96. It affected 372 of 950 words — every gloss
  // with a slash, comma or semicolon. Found by the 2026-08-30 first-timer round.
  const out = new Set([norm(gloss), norm(base)]);
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
  body.innerHTML = `<div class="thai-big" lang="th">${_esc(w[0])}</div><div class="rtgs">${_esc(w[1])}</div>
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
  body.innerHTML = `<div class="screen-title" style="padding:0.5rem 0">${_esc(w[2])}</div>
    <div class="rtgs">${_esc(w[1])}</div>
    <div class="thai-big" id="learn-th-buf" style="min-height:1.4em" lang="th">&nbsp;</div>
    <div class="card-prompt" id="learn-th-fb">Type it in Thai — every key speaks</div>
    <div id="learn-kbd" class="t-kbd"></div>`;

  let buf = [], misses = 0;
  const bufEl = document.getElementById("learn-th-buf");
  const fb = document.getElementById("learn-th-fb");
  // The full four-row layout, number row included. The lesson card has room —
  // 120px of slack below the keyboard on an iPhone 13, and a row costs 51 —
  // and without it ค ต จ ข ช ภ ถ ุ ึ are on no key, which put 96 of the 367
  // candidate targets out of reach for want of a row that fits.
  _tBuildKbdInto(document.getElementById("learn-kbd"), (latin, shift) => {
    const entry = _tEntry(latin, shift);
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
      if (misses === 2) fb.innerHTML = "It looks like: <b>" + _esc(w[0]) + "</b>";
    }
  }, typeof _T_ROWS_FULL !== "undefined" ? _T_ROWS_FULL : undefined, true);
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
  body.innerHTML = `<div class="thai-big" style="font-size:1.6em" lang="th">${_esc(blanked)}</div>
    <div class="card-prompt">${_esc(ex[2])}</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(opts, w[0], w[0], 0, () => _tts.speak(ex[0]), w);
}

// cloze: the chunk with a hole in it
function _wCloze(item, body) {
  const p = item.item;
  body.innerHTML = `<div class="thai-big" lang="th">${_esc(p.th.replace("___", "＿＿"))}</div>
    <div class="card-prompt">${_esc(p.en)}</div>
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
    // Drain over fastMs itself, not an unrelated fixed duration — fastMs IS
    // the cutoff courseGrade rewards with a 5 (see below), so the bar
    // hitting empty must be the same moment the fast bonus stops being
    // available. A bar on its own separate clock just teaches a wrong pace.
    const fill = document.getElementById("learn-timer");
    requestAnimationFrame(function tick() {
      if (!document.getElementById("learn-timer")) return;
      const left = Math.max(0, 1 - (Date.now() - t0) / fastMs);
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
          // appended after the card's own initial-render nudge already ran —
          // check again, since the choice list plus this new row can now
          // overflow a screen the original (shorter, button-less) card fit.
          _ensureCardEndVisible(document.getElementById("lesson-body"));
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
// One thing about HOW THAI IS WRITTEN, hung on a real word from this batch —
// the same shape as a chunk intro, because it teaches rather than tests.
// Note prose may name a vowel in the data's canonical ◌ form (◌ั, เ◌ะ) —
// that is how VOWELS stores them and how the reference chart labels them. It
// must never REACH the page that way: U+25CC is missing from many fonts and a
// ◌+mark cluster renders as tofu, which is the whole reason vowelDisp exists.
// Host it here, so the note can use the notation the rest of the app uses.
function _scriptNoteText(t) {
  return (typeof vowelDisp === "function") ? vowelDisp(String(t)) : String(t);
}
function _wScriptNote(item, body) {
  const n = item.note;
  const w = (typeof WORD_MAP !== "undefined" && WORD_MAP[n.word]) || null;
  body.innerHTML = `<div class="screen-title">${_esc(n.title)}</div>
    <div class="thai-big" lang="th" onclick="_tts.speak(${_toneSpeak(n.word)})">${_esc(n.word)}</div>
    <div class="rtgs">${_esc(n.rom)} \u00b7 ${_esc(n.en)}</div>
    <div class="card-prompt learn-intro-text">${_esc(_scriptNoteText(n.text))}</div>
    <div class="btn-row">${w ? _wordCardBtn(w) : ""}<button class="btn btn-primary" onclick="_learnNext()">Got it \u2192</button></div>`;
  _tts.speak(n.word);
}
// Two words that differ by ONE consonant, side by side. English hears ปิด and
// ผิด as the same word; Thai does not, and the tone usually moves as well
// because the two letters are different classes. Showing them together is the
// whole lesson — the card after this one tests it with the partner as the
// distractor, which is the hardest one there is.
function _wConsPair(item, body) {
  const [a, b] = [item.pair.a, item.pair.b];
  // Side by side, not stacked: the contrast IS the layout, and two full-height
  // example blocks pushed the button off the bottom of an iPhone.
  const row = w => `<div class="learn-ex-block" style="flex:1 1 0;margin:0;padding:0.6rem"
      onclick="_tts.speak(${_toneSpeak(w[0])})">
      <div lang="th" style="font-size:1.9rem;line-height:1.3">${_esc(w[0])}</div>
      <div class="rtgs" style="margin:0.1rem 0">${_esc(w[1])}</div>
      <div class="card-prompt" style="margin:0">${_esc(w[2])}</div></div>`;
  body.innerHTML = `<div class="screen-title">One letter apart</div>
    <div style="display:flex;gap:0.6rem;align-items:stretch">${row(a)}${row(b)}</div>
    <div class="card-prompt learn-intro-text">${_esc(a[0])} and ${_esc(b[0])} differ by a single consonant — ` +
    `${_esc(a[0][item.pair.at])} against ${_esc(b[0][item.pair.at])}. Tap each one and listen for it. ` +
    `English does not make this distinction, so your ear has to be taught it deliberately.</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">Got it →</button></div>`;
  _tts.speak(a[0]);
}

// The pair again, this time as a question, with the partner guaranteed to be
// on the list. A distractor picked at random makes this card easy for the
// wrong reason.
function _wPairPick(item, body) {
  const w = item.word, other = item.other;
  const pool = (item.pool || WORDS).filter(x => x[0] !== w[0] && x[0] !== other[0]);
  const opts = _shuffle([w[0], other[0], ..._shuffle(pool).slice(0, 2).map(x => x[0])]);
  body.innerHTML = `<div class="screen-title" style="padding:1rem 0">${_esc(w[2])}</div>
    <div class="card-prompt">Which one says it?</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(opts, w[0], w[0], 0, () => _tts.speak(w[0]), w);
}

// Which letter is this? Options are the letters it LOOKS like, so the card
// cannot be answered by elimination — only by knowing the shape.
function _wGlyphPick(item, body) {
  const c = item.cons;
  const en = (typeof consNameEn === "function") ? consNameEn(c[0]) : null;
  body.innerHTML = `<div class="screen-title" style="padding:1rem 0">${_esc(c[3])}${en ? " — " + _esc(en) : ""}</div>
    <div class="card-prompt">Which letter is it? /${_esc(c[4])}/</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(_shuffle(item.group.slice()), c[0], "sc:" + c[0], 0,
    () => _tts.speak(letterSpeechParts ? letterSpeechParts(c[0]).join(" ") : c[0]));
}
function _wChunkIntro(item, body) {
  const l = item.lesson;
  body.innerHTML = `<div class="screen-title">${_esc(l.title)}</div>
    <div class="card-prompt learn-intro-text">${_esc(l.intro)}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">Learn the chunks →</button></div>`;
}
function _wChunk(item, body) {
  const [th, rtgs, en] = item.line;
  // the signage lesson renders as street furniture: font-shock is the training
  const signCls = item.sign === null || item.sign === undefined ? "" :
    " learn-sign learn-sign-" + item.sign;
  body.innerHTML = `<div class="thai-big${signCls}" lang="th" onclick="_tts.speak(${_toneSpeak(th)})">${_esc(th)}</div>
    <div class="rtgs">${_esc(rtgs)}</div>
    <div class="card-prompt">${_esc(en)}</div>
    <div class="card-prompt">Tap it. Hear it. Say it out loud — chunks stick by mouth, not by eye. ${_speakBtn(th)}</div>
    <div class="btn-row">${_wordCardBtn([th, rtgs, en])}<button class="btn btn-primary" onclick="_learnNext()">Next →</button></div>`;
  _tts.speak(th);
}

// escapes a JS string literal for embedding inside an HTML onclick="" attribute
// (e.g. onclick="_tts.speak(${_toneSpeak(word)})") — the single implementation;
// every inline JSON.stringify(...).replace(/"/g,"&quot;") in this file used to
// duplicate this. Named for its original tone-widget use; general-purpose now.
function _toneSpeak(t) { return JSON.stringify(t).replace(/"/g, "&quot;"); }

// ── Tone unit widgets ────────────────────────────────────────────────────────

// the rule, then one mid-class syllable shown under all five tones (tap each)
function _wToneIntro(item, body) {
  const set = typeof toneMinimalSet === "function" ? toneMinimalSet("ก", "า") : [];
  const chips = set.map(s =>
    `<span class="tone-chip" style="border-color:${TONE_COLORS[s.tone]};color:${TONE_COLORS[s.tone]}" lang="th" ` +
    `onclick="_tts.speak(${_toneSpeak(s.thai)})">${_esc(s.thai)}<small lang="en">${TONE_LABELS[s.tone].toLowerCase()}</small></span>`).join("");
  body.innerHTML = `<div class="learn-teach-tag">READING THE TONES</div>
    <div class="card-prompt learn-intro-text">Same letters, one small mark, a different word. Three things fix a syllable's tone: the initial consonant's <b>class</b> (mid / high / low), whether the syllable is <b>live</b> (long vowel, or ends in m·n·ng·y·w) or <b>dead</b> (short vowel, or ends in a p·t·k stop), and any <b>tone mark</b>. Here is one mid-class syllable under all five — tap each and hear the pitch move:</div>
    <div class="tone-row">${chips}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">The calculator →</button></div>`;
}

// interactive: pick class + vowel length + mark, watch the tone resolve
function _wToneCalc(item, body) {
  const state = { cls: "mid", vlong: true, mark: "none" };
  const EG = { mid: "ก", high: "ส", low: "ม" };
  body.innerHTML = `<div class="learn-teach-tag">TONE CALCULATOR</div>
    <div class="card-prompt" style="opacity:0.8">Change any dial — the tone follows the rule.</div>
    <div class="tone-calc" id="tone-calc"></div>
    <div class="btn-row"><button class="btn btn-primary" onclick="_learnNext()">Got it →</button></div>`;
  const box = document.getElementById("tone-calc");
  const group = (label, opts, cur, set) => {
    const row = document.createElement("div");
    row.className = "tone-calc-row";
    row.innerHTML = `<span class="tone-calc-label">${label}</span>`;
    const btns = document.createElement("div");
    btns.className = "tone-calc-btns";
    opts.forEach(([val, txt]) => {
      const b = document.createElement("button");
      b.className = "btn btn-small tone-opt" + (val === cur() ? " sel" : "");
      b.textContent = txt;
      b.onclick = () => { set(val); render(); };
      btns.appendChild(b);
    });
    row.appendChild(btns);
    return row;
  };
  function render() {
    box.innerHTML = "";
    box.appendChild(group("Class", [["mid", "Mid"], ["high", "High"], ["low", "Low"]],
      () => state.cls, v => state.cls = v));
    box.appendChild(group("Vowel", [["long", "Long · live"], ["short", "Short · dead"]],
      () => state.vlong ? "long" : "short", v => state.vlong = v === "long"));
    box.appendChild(group("Mark", [["none", "–"], ["ek", "่"], ["tho", "้"], ["tri", "๊"], ["chattawa", "๋"]],
      () => state.mark, v => state.mark = v));
    const tone = toneFromParts(state.cls, { mark: state.mark, live: state.vlong, shortVowel: !state.vlong });
    const syl = EG[state.cls] + _TONE_MARK_BY_KEY[state.mark] + (state.vlong ? "า" : "ะ");
    const out = document.createElement("div");
    out.className = "tone-calc-out";
    out.innerHTML = `<span class="tone-eg" onclick="_tts.speak(${_toneSpeak(syl)})">${_esc(syl)}</span>` +
      `<span class="tone-arrow">→</span>` +
      `<b class="tone-name" style="color:${TONE_COLORS[tone]}">${TONE_LABELS[tone]} tone</b>`;
    box.appendChild(out);
  }
  render();
}

// hear a tone, pick the written syllable — the five differ only by their mark
function _wToneEar(item, body) {
  const set = toneMinimalSet(item.cons, item.vowel);
  const target = set[item.pick || 0]; // chosen at queue-build time — stable across revisits
  body.innerHTML = `<div class="thai-big">👂</div>
    <div class="card-prompt">Which one did you hear? ${_speakBtn(target.thai)}</div>
    <ul class="quiz-choices learn-thai-choices" id="learn-choices"></ul>`;
  _mcWire(_shuffle(set.map(s => s.thai)), target.thai, null, 0, () => _tts.speak(target.thai));
  _tts.speak(target.thai);
}

// read a real word, name its tone — no romanisation shown (that would give it
// away). Naming a word's TONE is a separate skill from knowing the WORD, so
// this deliberately passes a null SRS key: a wrong tone must never knock the
// word's vocabulary review schedule backward. It still counts toward the tone
// unit's own accuracy and feeds the streak (both keyed off the result, not the
// SRS card), and a miss still offers the study word-card via the `w` arg.
function _wToneRead(item, body) {
  const w = item.word;
  const tone = toneOfWord(w[0]); // the queue only ever puts gradable words here, but toneOfWord is the contract for any word-shaped input
  body.innerHTML = `<div class="thai-big learn-glyph" lang="th" onclick="_tts.speak(${_toneSpeak(w[0])})">${_esc(w[0])}</div>
    <div class="learn-mean">${_esc(w[2])}</div>
    <div class="card-prompt">What tone is it? (tap the word to hear it)</div>
    <ul class="quiz-choices" id="learn-choices"></ul>`;
  const labels = TONE_ORDER.map(k => TONE_LABELS[k]);
  _mcWire(labels, TONE_LABELS[tone], null, 0, () => _tts.speak(w[0]), w);
}

// ── Continue + streak (engagement 2/7) ──────────────────────────────────────
const STREAK_KEY = "soisanuk_streak";
function _streakLoad() {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY) || "{}"); } catch { return {}; }
}
// pure day-roll: same day = no-op, consecutive day = +1, a gap resets to 1
function _streakBump(st, today, yesterday) {
  if (st.last === today) return st;
  const days = st.last === yesterday ? (st.days || 0) + 1 : 1;
  return { last: today, days, maxDays: Math.max(st.maxDays || 0, days),
    bestDay: st.bestDay || null, today: { cards: 0, msSum: 0, msN: 0 } };
}
// "Today" in the LEARNER's own clock, not UTC. toISOString() is UTC — for a
// Thailand-based user (UTC+7) that rolls the day boundary at 07:00 local,
// so a session any time before 7am could wrongly count as "yesterday" (or
// wrongly extend a streak that should have broken).
function _localDateStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0");
}
function _streakRecord(ms) {
  const d = new Date(), y = new Date(Date.now() - 864e5);
  let st = _streakBump(_streakLoad(), _localDateStr(d), _localDateStr(y));
  st.today = st.today || { cards: 0, msSum: 0, msN: 0 };
  st.today.cards++;
  if (ms > 0) { st.today.msSum += ms; st.today.msN++; }
  if (!st.bestDay || st.today.cards > st.bestDay.cards) st.bestDay = { date: st.last, cards: st.today.cards };
  st.maxDays = Math.max(st.maxDays || 0, st.days || 0);
  localStorage.setItem(STREAK_KEY, JSON.stringify(st));
  _streakRender();
}
// What the streak IS right now, as opposed to what was last written. _streakBump
// only runs when a card is graded, so between sessions the stored record is a
// snapshot of the last day you studied — and _streakRender printed it verbatim.
// A learner returning after six months was told "🔥 12 days · today 41 cards ·
// 3.0s/word" and invited to "keep the streak alive", on a day they had not
// opened the app, for a streak that had already ended; it then snapped 12 → 1
// mid-session with no acknowledgement. Pure, and read-only on purpose — the
// display must never write. Found by the 2026-08-30 lapsed-learner round.
function _streakView(st, today, yesterday) {
  const alive = st.last === today || st.last === yesterday;
  return {
    days: alive ? (st.days || 0) : 0,
    // "today" only means anything if the record IS today's
    today: st.last === today ? (st.today || {}) : {},
    maxDays: st.maxDays || 0,
    bestDay: st.bestDay || null,
    ended: !alive && !!st.days,          // had a streak, lost it
  };
}
// The one entry point every DISPLAY must use. _streakView alone wasn't enough:
// it was wired into _streakRender only, so the desktop home tile (home.js) and
// the Records screen still printed the raw record — three surfaces, two of them
// stale, and the first two are visible together on the desktop menu 40px apart.
// Found by the 2026-08-30 completionist round, immediately after the
// lapsed-learner round's fix went in half-done.
function _streakNow() {
  const d = new Date(), y = new Date(Date.now() - 864e5);
  return _streakView(_streakLoad(), _localDateStr(d), _localDateStr(y));
}
function _streakRender() {
  const st = _streakNow();
  const t = st.today || {};
  // The desktop home card announces what ▶ Continue will do; the mobile menu
  // never renders that card (#menu-welcome is desktop-only), so on phones the
  // only annotation on the Continue row was the streak — backward-looking, and
  // silent about the reviews waiting behind the button. Say the work first.
  let plan = null;
  try { if (typeof COURSE !== "undefined") plan = continuePlan(); } catch (e) {}
  const txt = _contText(plan, st, t);
  for (const id of ["nav-cont-stats", "nav-cont-stats2"]) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }
}

// What the ▶ Continue row says. Pending reviews outrank the streak: they are
// the reason to tap, and a lapsed learner reading "streak ended · best 12
// days" was told only what they had lost. The streak survives as a tail when
// it is alive, because that IS the nudge once nothing is due.
function _contText(plan, st, t) {
  const kinds = { review: "review", script: "script review", sentence: "sentence review" };
  const what = plan && kinds[plan.kind];
  const n = !what ? 0 : plan.n != null ? plan.n : plan.due.length;
  if (!n) return _streakText(st, t);
  const head = `${n} ${what}${n === 1 ? "" : "s"} due`;
  return st.ended || !st.days ? head : `${head} · 🔥 ${st.days}`;
}
function _streakText(st, t) {
  // A broken streak is named rather than silently zeroed — the best is the
  // thing worth coming back to, and it survives the break.
  if (st.ended) return `streak ended · best ${st.maxDays} day${st.maxDays > 1 ? "s" : ""}`;
  return !st.days ? "start today" :
    `🔥 ${st.days} day${st.days > 1 ? "s" : ""}` +
    (t.cards ? ` · today ${t.cards} cards` : "") +
    (t.msN ? ` · ${(t.msSum / t.msN / 1000).toFixed(1)}s/word` : "");
}
// What ▶ Continue would do right now: due reviews first, else the next open
// unit, else a speed round. Split out from startContinue so the desktop home
// card can ANNOUNCE the same decision the button will act on — if the two
// computed it separately they'd drift, and the card would promise one thing
// and the click deliver another. Read-only: safe to call while rendering.
// Reviews outrank new material — the rule this function already applied to
// vocabulary, now applied to all three card types. Before, a learner with
// thirty overdue SCRIPT cards was offered the next course lesson and told "0
// due now", because Continue could only see vocabulary; the script-only path
// had no way to be resumed at all. Vocabulary keeps first claim, since it is
// what the course itself teaches.
function continuePlan() {
  const prog = loadProgress();
  const sets = srsKeySets();
  // `due` is the BATCH (ten at a time — a backlog of eighty should not be
  // dumped on someone in one sitting); `n` is the true backlog, which is what
  // the row and the home card report. Reporting the batch size made a learner
  // with twenty-five overdue cards read "10 reviews due".
  const dueAll = dueCards(prog, sets.vocab);
  const due = dueAll.slice(0, 10)
    .map(th => WORDS.find(x => x[0] === th)).filter(Boolean);
  if (due.length >= 3) return { kind: "review", due, n: dueAll.length };
  const scriptDue = dueCards(prog, sets.script);
  if (scriptDue.length >= 3) return { kind: "script", n: scriptDue.length };
  const sentDue = dueCards(prog, sets.sentence);
  if (sentDue.length >= 3) return { kind: "sentence", n: sentDue.length };
  const path = _pathLoad();
  const next = COURSE.findIndex((u, i) => _unitUnlocked(path, i) && !_unitDone(path, u));
  if (next >= 0) return { kind: "unit", unitIdx: next, unit: COURSE[next] };
  return { kind: "speed" };
}

// ▶ Continue: act on the plan above.
function startContinue() {
  const plan = continuePlan();
  if (plan.kind === "review") {
    _lu = { idx: -1, unit: { kind: "review", label: "Review" },
      queue: plan.due.map(w => ({ kind: "mc", word: w, tag: "review" })), at: 0, results: [] };
    _learnStep();
    return;
  }
  // Script and sentence reviews are whole modes of their own, not card kinds
  // the lesson runner can queue — hand off rather than rebuild them here.
  if (plan.kind === "script") { startScriptSRS(); return; }
  if (plan.kind === "sentence") { startSentSRS(); return; }
  if (plan.kind === "unit") { _unitStart(plan.unitIdx); return; }
  const pool = _shuffle(courseDecodable(LETTER_BATCHES.length - 1)).slice(0, 10);
  _lu = { idx: -1, unit: { kind: "review", label: "Speed round" },
    queue: pool.map(w => ({ kind: "speed", word: w })), at: 0, results: [] };
  _learnStep();
}
if (typeof document !== "undefined") setTimeout(_streakRender, 0);

// ── Placement test + levels (engagement 5/7) ────────────────────────────────
// Titles by units completed. The top one must land ON completion, not before
// it: the last three units are the FINAL letter batch (which completes the
// reading ladder the whole course is built around), getting around, and prices
// — the three most useful units in the spine. The threshold was 14 against a
// 17-unit course, so the app crowned you "bar owner" before you could read the
// last eight letters, ask directions, or handle money, and those three units
// then passed in silence. Four thresholds spaced 3/4/4/3 fit a 14-unit spine;
// three units were added later and this table wasn't revisited.
// A test pins the last threshold to COURSE.length so it can't drift again.
// Thresholds are unit counts, and the course grew from 17 units to 19 when the
// ladder gained the two rungs that teach ์ and โ. The top MUST equal
// COURSE.length or the final units award nothing; a test pins that. "Old hand"
// moved 11 -> 12 to keep the run-in to the title from stretching to eight
// units, which is longer than any earlier gap.
const LEVELS = [[0, "Fresh off the plane"], [3, "Soi tourist"], [7, "Soi regular"],
  [12, "Old hand"], [20, "เจ้าของบาร์"]];
function _levelName(done) {
  let name = LEVELS[0][1];
  for (const [n, l] of LEVELS) if (done >= n) name = l;
  return name;
}
// per-batch accuracy → the highest ladder prefix passed (80%), -1 = none
function _placementCut(byBatch) {
  let cut = -1;
  for (let b = 0; b < LETTER_BATCHES.length; b++) {
    const r = byBatch[b];
    if (!r || !r.n || r.ok / r.n < 0.8) break;
    cut = b;
  }
  return cut;
}
// mark every COURSE unit up to (and incl.) the cut batch's unit as done
// What placement ACTUALLY marked, said out loud. It only ever tests letter
// DECODING — 16 multiple-choice cards, two per batch — but _placementApply
// marks every COURSE index up to the cut, which sweeps in the "Speak:" chunk
// lessons too. The old line read "Placed past 8 reading units" while marking
// 14 units, six of them scenario lessons placement never showed a card from.
// Naming them is the honest minimum; whether they should be marked at all is a
// separate product question. Found by the 2026-08-30 completionist round.
function _placementSummary(cut) {
  const last = COURSE.findIndex(u => u.kind === "letters" && u.batch === cut);
  let reading = 0, left = 0;
  for (let i = 0; i <= last; i++) {
    if (COURSE[i].kind === "letters") reading++; else left++;
  }
  const r = `Placed past ${reading} reading unit${reading === 1 ? "" : "s"}`;
  // Say what is still waiting rather than what was skipped — those units are
  // now genuinely open, and the learner should know they are next.
  return left
    ? `${r}. The ${left} speaking and tone lesson${left === 1 ? " is" : "s are"} still open — placement doesn't test those.`
    : `${r}.`;
}

function _placementApply(path, cut) {
  if (cut < 0) return path;
  path.units = path.units || {};
  const last = COURSE.findIndex(u => u.kind === "letters" && u.batch === cut);
  for (let i = 0; i <= last; i++) {
    // Placement only tests letter DECODING — 16 multiple-choice cards, two per
    // batch. Anything it did not measure stays open, so a placed learner
    // resumes at the skills placement had no view of instead of having them
    // silently marked done unseen. That was already true for tone; the same
    // reasoning applies word for word to the chunk lessons, which teach
    // speaking and usage (no-conjugation grammar, ครับ/ค่ะ, ordering, haggling,
    // ห้าม signs, classifiers) and are entirely orthogonal to decoding. A
    // heritage speaker who reads but was never taught politeness registers
    // sails through 16 decoding cards and used to be told they already knew
    // how to haggle. Six short units, ~10 minutes — and it matters because
    // continuePlan() skips anything done, so they never surfaced as "next"
    // again. Found by the 2026-08-30 completionist round.
    if (COURSE[i].kind !== "letters") continue;
    const id = _unitId(COURSE[i]);
    path.units[id] = { ...(path.units[id] || {}), done: true, placed: true };
  }
  return path;
}
function startPlacement() {
  const queue = [];
  for (let b = 0; b < LETTER_BATCHES.length; b++) {
    for (const w of _shuffle(courseNewWords(b).slice()).slice(0, 2)) {
      queue.push({ kind: "mc", word: w, batch: b });
    }
  }
  _lu = { idx: -2, unit: { kind: "review", label: "Placement" }, queue, at: 0, results: [] };
  _learnStep();
}
function _placementFinish() {
  const byBatch = {};
  _lu.queue.forEach((it, i) => {
    const r = _lu.results[i];
    if (!r) return;
    const b = (byBatch[it.batch] = byBatch[it.batch] || { ok: 0, n: 0 });
    b.n++;
    if (r.q >= 4) b.ok++;
  });
  const cut = _placementCut(byBatch);
  _pathSave(_placementApply(_bestUpdate(_pathLoad(), _lu.results), cut));
  const body = document.getElementById("lesson-body");
  body.innerHTML = `<div class="thai-big">📍</div>
    <div class="card-prompt">${cut < 0 ? "Starting from the very first letters — the right place to start." :
      _placementSummary(cut)}</div>
    <div class="btn-row"><button class="btn btn-primary" onclick="startLearn()">To the path</button></div>`;
  _lu = null;
}

// ── 🏆 Records (engagement 6/7) — the local best-night board ────────────────
function showRecords() {
  const st = _streakNow(), path = _pathLoad();
  // path.best is uncapped and can hold every word ever hit in a speed card (up
  // to 764). Both views truncate; neither used to admit it.
  const allBests = Object.entries(path.best || {}).sort((a, b) => a[1] - b[1]);
  const bests = allBests.slice(0, 8);
  const done = COURSE.filter(u => _unitDone(path, u)).length;
  document.getElementById("records-body").innerHTML =
    `<div class="learn-summary">Level: <b>${_levelName(done)}</b> · ${done}/${COURSE.length} units</div>
     <div class="learn-summary">🔥 Streak: <b>${st.days || 0}</b> ${st.ended ? "(ended)" : "now"} · best <b>${st.maxDays || 0}</b> days</div>
     <div class="learn-summary">📅 Biggest day: <b>${st.bestDay ? st.bestDay.cards + " cards (" + st.bestDay.date + ")" : "—"}</b></div>
     <div class="sidebar-section" style="text-align:center">🏁 Fastest reads${
       allBests.length > bests.length ? ` <span style="opacity:0.6;font-weight:normal">${bests.length} of ${allBests.length}</span>` : ""}</div>
     <div style="text-align:center">${bests.length ? bests.map(([th, ms]) =>
       `<span class="learn-best">${_esc(th)} <b>${(ms / 1000).toFixed(1)}s</b></span>`).join(" ") : "run some speed reads"}</div>`;
  showScreen("records-screen", "Y");
}

