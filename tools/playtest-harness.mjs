// Reusable driver for persona playtests — see docs/persona-playtests.md.
//
// WHY THIS EXISTS. Every persona round before this one wrote its own Playwright
// driver from scratch, in a scratchpad file that died with the session. That is
// the expensive part of a round, and one attempt against the Guided Course
// stalled on it entirely: the lesson flow emits at least fourteen distinct step
// SHAPES, and a driver that hunts for a generic "Got it / Next" button
// mishandles most of them — an MC step has no next-button at all, you answer it
// by picking an option.
//
// The fix is not a better selector. It is to stop guessing: the app already
// knows what step it is on (`_lu.queue[_lu.at].kind`), so this asks it, and
// dispatches on the answer. A persona's job shrinks to "call these verbs and
// form judgments" instead of "reverse-engineer the DOM".
//
// USAGE
//   import { openApp } from "./tools/playtest-harness.mjs";
//   const app = await openApp();                    // { mobile: true } for iPhone 13
//   await app.startCourse();
//   const log = await app.runUnit({ steps: 40, accuracy: 0.8 });
//   console.log(app.report());
//   await app.close();
//
// Every verb catches its own failures, screenshots, records, and keeps going.
// A round should end with a partial report, never with a stack trace and
// nothing to show — that is what happened to the attempt this replaces.
//
// AUDIO. An earlier version of this header claimed headless Chromium has no
// Thai voice. MEASURE IT, don't assume: on this machine _tts.available() is
// TRUE and speechSynthesis lists a th-TH voice, so listen/toneear cards DO
// appear and the audio-gated path never runs. It is evidently machine- or
// build-dependent. Pass `{ noAudio: true }` to stub _tts.available() to false
// and exercise the other branch deliberately — that branch is what makes the
// tone unit passable for a learner without a Thai voice, and it deserves
// testing on purpose rather than by accident.
//
// Playwright is borrowed from the sibling last-baht-bus repo, matching the
// tools/sweep.mjs precedent. This repo declares no Playwright dependency of its
// own; if persona rounds become routine that is worth revisiting.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/Users/mario/projects/last-baht-bus/package.json");
const { chromium, devices } = require("@playwright/test");

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_URL = `file://${REPO}/web/index.html`;

// Steps you advance by clicking a button, vs steps you advance by ANSWERING.
// This split is the thing a from-scratch driver gets wrong.
//
// This set is a FALLBACK. It was a hand-kept copy of learn.js's _TEACH_KINDS
// and it drifted the first time the app grew a card kind: `scriptnote` (the
// script notes on the letter ladder) was unknown here, so it fell through to
// the skip branch and advanced correctly by luck — while every round logged it
// as "skip:scriptnote" and no persona ever reported on a teaching card that had
// been added precisely to be read. Silent, and exactly the wrong kind of quiet.
// openApp now asks the page for the real set, which is this module's whole
// stated philosophy: the app already knows what step it is on, so do not guess.
const TEACH_STEPS = new Set(["glyph", "wordintro", "toneIntro", "tonecalc", "chunkIntro", "chunk", "scriptnote"]);
const CHOICE_STEPS = new Set(["mc", "mc2", "speed", "listen", "mcth", "clozex", "cloze", "toneear", "toneread"]);

// Every browser this module launches, so the process cannot exit while one is
// still alive. A round that throws (or is killed) never reaches its
// `await app.close()`, and the headless Chrome it started outlives the node
// process as an orphan — dozens accumulated that way before anyone noticed.
// close() de-registers; the handlers below are the net for every other path.
const _live = new Set();
let _cleanupArmed = false;

function _armCleanup() {
  if (_cleanupArmed) return;
  _cleanupArmed = true;
  // 'exit' cannot await, so kill the child process group synchronously.
  process.on("exit", () => {
    for (const b of _live) { try { b.process()?.kill("SIGKILL"); } catch {} }
  });
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => { process.exit(sig === "SIGINT" ? 130 : 143); });
  }
  for (const ev of ["uncaughtException", "unhandledRejection"]) {
    process.on(ev, err => {
      for (const b of _live) { try { b.process()?.kill("SIGKILL"); } catch {} }
      console.error(`playtest-harness: ${ev} — browsers killed`);
      console.error(err);
      process.exit(1);
    });
  }
}

export async function openApp(opts = {}) {
  _armCleanup();
  const browser = await chromium.launch();
  _live.add(browser);
  const ctx = await browser.newContext(opts.mobile
    ? { ...devices["iPhone 13"], defaultBrowserType: undefined }
    : { viewport: { width: 1280, height: 850 } });
  const page = await ctx.newPage();

  const events = [];                       // everything that happened, in order
  const problems = [];                     // page errors + failed actions
  page.on("pageerror", e => problems.push({ type: "pageerror", message: e.message.slice(0, 300) }));
  page.on("console", m => { if (m.type() === "error") problems.push({ type: "console", message: m.text().slice(0, 300) }); });

  const shotDir = opts.shotDir || `${REPO}/shots/playtest`;
  try { mkdirSync(shotDir, { recursive: true }); } catch (e) { /* exists */ }
  let shotN = 0;

  const app = {
    page, events, problems,

    /** Screenshot into shots/playtest/. Returns the path. */
    async shot(name = "step") {
      const file = `${shotDir}/${String(++shotN).padStart(3, "0")}-${name.replace(/[^\w.-]/g, "_")}.png`;
      try { await page.screenshot({ path: file }); } catch (e) { return null; }
      return file;
    },

    /** Run any in-page function, but never throw out of the harness. */
    async safe(label, fn, arg) {
      try {
        const out = await page.evaluate(fn, arg);
        events.push({ label, ok: true, out });
        return out;
      } catch (e) {
        const shot = await app.shot("FAIL-" + label);
        const rec = { label, ok: false, error: String(e).slice(0, 200), shot };
        events.push(rec); problems.push(rec);
        return null;
      }
    },

    /** id of the visible screen, e.g. "menu-screen", "lesson-screen". */
    screen: () => app.safe("screen", () => document.querySelector(".screen.active")?.id || null),

    /** What the app is showing RIGHT NOW, asked of the app rather than guessed. */
    step: () => app.safe("step", () => {
      if (typeof _lu === "undefined" || !_lu) return null;
      const item = _lu.queue[_lu.at];
      const body = document.getElementById("lesson-body");
      return {
        kind: item?.kind || null,
        at: _lu.at, total: _lu.queue.length,
        unit: _lu.unit?.label || _lu.unit?.kind || null,
        word: item?.word ? { thai: item.word[0], rtgs: item.word[1], en: item.word[2] } : null,
        prompt: body?.querySelector(".card-prompt")?.textContent?.trim() || null,
        choices: [...(body?.querySelectorAll("#learn-choices li") || [])].map(li => li.textContent.trim()),
        buttons: [...(body?.querySelectorAll("button") || [])].map(b => b.textContent.trim()),
        text: body?.textContent?.replace(/\s+/g, " ").trim().slice(0, 400) || null,
      };
    }),

    /** localStorage-backed progress, for before/after judgments. */
    state: () => app.safe("state", () => {
      const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return localStorage.getItem(k); } };
      // SRS_KEY is "soisanuk_progress" (srs.js:4). docs/architecture.md said
      // "thaicab_progress" and this read it straight out of the doc, so
      // cardsSeen was always 0.
      const prog = read("soisanuk_progress") || {};
      return {
        cardsSeen: Object.keys(prog).length,
        path: read("soisanuk_path"), streak: read("soisanuk_streak"),
        // dueCards(progress, keys) — two arguments, not one
        srsDue: (() => {
          try { return dueCards(prog, WORDS.map(w => w[0])).length; } catch (e) { return null; }
        })(),
      };
    }),

    async dismissTutorial() {
      return app.safe("dismissTutorial", () => {
        if (typeof closeTutorial === "function") closeTutorial();
        // _TUT_KEY (ui.js) — "thaicab_tut_seen" was wrong and only worked by
        // accident, because closeTutorial() sets the real key as a side effect.
        // Any round that seeds state and reloads got the overlay back each time.
        try { localStorage.setItem("soisanuk_seen_tutorial", "1"); } catch (e) {}
        if (typeof closeWordModal === "function") closeWordModal();
        return true;
      });
    },

    // ── entry points ────────────────────────────────────────────────────────
    startCourse:  () => app.safe("startCourse",  () => { startLearn(); return document.querySelector(".screen.active")?.id; }),
    startUnit:    i  => app.safe("startUnit",    n => { _unitStart(n); return _lu ? _lu.queue.length : null; }, i),
    startSRS:     () => app.safe("startSRS",     () => { startVocabSRS(); return document.querySelector(".screen.active")?.id; }),
    openReader:   l  => app.safe("openReader",   n => { startReader(); readerOpen(n); return document.getElementById("reader-thai")?.textContent; }, l),
    menu:         () => app.safe("menu",         () => { showMenu(); return document.querySelector(".screen.active")?.id; }),

    async pasteText(str) {
      const r = await app.safe("pasteText", async s => {
        startPaste();
        document.getElementById("paste-input").value = s;
        pasteAnalyse();
        await new Promise(r => setTimeout(r, 1800));   // both data files load lazily
        return {
          count: document.querySelector(".paste-count")?.textContent.replace(/\s+/g, " ").trim(),
          tokens: [...document.querySelectorAll(".w-token")].map(t => ({
            text: t.dataset.w, fragment: t.dataset.frag === "1", untoned: t.dataset.notone === "1" })),
        };
      }, str);
      return r;
    },

    /**
     * startSRS() lands on the CATEGORY PICKER, not a review session. Both
     * rounds so far hand-rolled this click. Pass a label prefix, default "All".
     */
    pickCategory: (label = "All categories") => app.safe("pickCategory", l => {
      const li = [...document.querySelectorAll("#cat-list li")]
        .find(x => x.textContent.trim().startsWith(l));
      if (!li) return null;
      li.click();
      return document.querySelector(".screen.active")?.id;
    }, label),

    /**
     * Rate the SRS card on screen (q 0-5) and advance. The review screens use a
     * reveal-then-rate idiom, not the lesson runner's, so driveLessonStep does
     * not cover them — and SRS is the surface any returning-learner or
     * scheduling persona spends all its time on.
     */
    rateCard: q => app.safe("rateCard", quality => {
      const reveal = [...document.querySelectorAll(".screen.active button")]
        .find(b => /show|reveal|answer/i.test(b.textContent));
      if (reveal) reveal.click();
      // MUST be scoped to the active screen. index.html has THREE .rating-row
      // divs (#flash-rating-row, #srs-rating-row, #sent-rating-row) and a
      // document-wide querySelector always returns the first in document
      // order — the flash one — whatever screen you are on. That row is empty
      // until a flashcard session fills it, so this failed loudly (null) in
      // rounds that skipped flashcards and failed SILENTLY, clicking stale
      // buttons bound to a finished session, in rounds that ran flashcards
      // first. Found by the 2026-09-01 script-purist round.
      const sc = document.querySelector(".screen.active");
      const row = sc && sc.querySelector(".rating-row, #srs-rating, .btn-row");
      const btns = row ? [...row.querySelectorAll("button")] : [];
      // buttons are q = 1..5 (Forgot, Hard, OK, Good, Perfect), so index = q-1.
      // Indexing by q directly made rateCard(4) click "Perfect" — a silent
      // one-grade overstatement in every SRS-driving round.
      const btn = btns[Math.min(Math.max(quality, 1) - 1, btns.length - 1)];
      if (!btn) return null;
      btn.click();
      return btn.textContent.trim();
    }, q),

    /**
     * Click an option on the ACTIVE screen — the Tone Drill and the quiz use a
     * `.quiz-choices li` list outside the lesson runner, so driveLessonStep
     * does not reach them. Pass exact text, a substring, or an index.
     */
    choose: want => app.safe("choose", w => {
      const sc = document.querySelector(".screen.active");
      const opts = [...sc.querySelectorAll(
        ".quiz-choices li, #tone-choices li, #learn-choices li, .drill-opt, #cat-list li.selectable")];
      if (!opts.length) return null;
      const el = typeof w === "number" ? opts[w]
        : opts.find(o => o.textContent.trim() === String(w))
          || opts.find(o => o.textContent.includes(String(w)));
      if (!el) return { missed: String(w), available: opts.map(o => o.textContent.trim().slice(0, 20)) };
      el.click();
      return el.textContent.trim();
    }, want),

    /**
     * Advance the ACTIVE screen by its primary control. The consonant and vowel
     * "drills" are reference browsers — a single "Next →" and nothing to answer
     * — so paging is the only interaction they have.
     */
    next: () => app.safe("next", () => {
      const sc = document.querySelector(".screen.active");
      const b = [...sc.querySelectorAll("button")]
        .find(x => /next|got it|continue|reveal|→/i.test(x.textContent) && !/menu|quit/i.test(x.textContent));
      if (!b) return null;
      b.click();
      return b.textContent.trim();
    }),

    /**
     * Press a real physical key. The Kedmanee tutor and several games listen
     * on document keydown rather than an input, so a synthetic click cannot
     * reach them.
     */
    press: async key => { await page.keyboard.press(key); await page.waitForTimeout(60); },

    /**
     * Answer the keyboard tutor's current prompt by TAPPING the on-screen key
     * — `correct` picks the right one, false picks a deliberate miss. The
     * tutor locks input for 700ms after each answer to flash the result
     * (_tFlashId), so this waits that out; driving it faster silently drops
     * answers and every count comes back wrong.
     */
    tutorAnswer: async (correct = true) => {
      const r = await app.safe("tutorAnswer", ok => {
        if (typeof _tCurrent === "undefined" || !_tCurrent) return null;
        const want = _tCurrent.key;
        const keys = [...document.querySelectorAll("#tutor-screen .tkey")];
        const el = ok ? keys.find(k => k.dataset.key === want)
                      : keys.find(k => k.dataset.key !== want && k.querySelector(".tkey-th").textContent.trim());
        if (!el) return null;
        el.click();
        return { pressed: el.dataset.key, wanted: want, correct: ok };
      }, correct);
      await page.waitForTimeout(760);          // outlast the 700ms flash
      return r;
    },

    /** The tutor's live scoreboard, straight from its own globals. */
    tutorState: () => app.safe("tutorState", () => ({
      mode: typeof _tMode !== "undefined" ? _tMode : null,
      target: typeof _tCurrent !== "undefined" && _tCurrent ? _tCurrent.thai : null,
      targetKey: typeof _tCurrent !== "undefined" && _tCurrent ? _tCurrent.key : null,
      correct: typeof _tCorrect !== "undefined" ? _tCorrect : null,
      total: typeof _tTotal !== "undefined" ? _tTotal : null,
      streak: typeof _tStreak !== "undefined" ? _tStreak : null,
      active: typeof _tActive !== "undefined" ? _tActive : null,
    })),

    /** Open the word card for a token and read it back. */
    tapWord: thai => app.safe("tapWord", w => {
      const el = document.querySelector(`.w-token[data-w="${CSS.escape(w)}"]`);
      if (!el) return null;
      el.click();
      const c = document.querySelector(".wc-layer .wc-card");
      const out = { thai: c?.querySelector(".wc-thai")?.textContent || null,
                    rtgs: c?.querySelector(".wc-rtgs")?.textContent || null,
                    en:   c?.querySelector(".wc-en")?.textContent || null,
                    noGloss: !!c?.querySelector(".wc-nogloss") };
      if (typeof closeWordModal === "function") closeWordModal();
      return out;
    }, thai),

    // ── the important one ───────────────────────────────────────────────────
    /**
     * Wait until the lesson index moves off `fromAt`, the lesson ends, or we
     * give up. Returns true if it moved. Polling, not sleeping: the app's
     * advance delays are its business, not something a driver should encode.
     */
    async waitForAdvance(fromAt, timeoutMs = 3000) {
      try {
        await page.waitForFunction(
          from => typeof _lu === "undefined" || !_lu || _lu.at !== from ||
                  document.querySelector(".screen.active")?.id !== "lesson-screen",
          fromAt, { timeout: timeoutMs, polling: 60 });
        return true;
      } catch (e) { return false; }
    },

    /**
     * Advance ONE lesson step, whatever shape it is. Returns
     * {kind, action, correct, before, after} or {kind:null} when the lesson is
     * over. `accuracy` (0..1) is the chance of answering a choice step
     * correctly — set it below 1 to exercise the miss path, which is where the
     * study-the-word pause lives.
     */
    async driveLessonStep(accuracy = 1) {
      const before = await app.step();
      if (!before || !before.kind) return { kind: null, action: "not-in-a-lesson" };

      const kind = before.kind;
      let action = "unknown";
      let forced = false;

      if ((app.teachKinds || TEACH_STEPS).has(kind)) {
        action = "advance";
        await app.safe("advance:" + kind, () => {
          const b = [...document.querySelectorAll("#lesson-body button")]
            .find(x => /got it|next|continue|→/i.test(x.textContent));
          if (b) { b.click(); return "button"; }
          if (typeof _learnNext === "function") { _learnNext(); return "_learnNext"; }
          return "none";
        });
      } else if (CHOICE_STEPS.has(kind)) {
        action = "choose";
        // NOTE: page.evaluate runs in the BROWSER — it closes over nothing from
        // here, so every value the handler needs is passed in explicitly.
        await app.safe("choose:" + kind, ({ kind, wantRight }) => {
          const item = _lu.queue[_lu.at];
          // Work out the right answer from the ITEM, the way the app does —
          // don't brute-force by clicking, which would record a miss every time
          // and quietly skew the very pacing a persona is trying to judge.
          // Which half of the word is the answer differs by step, and getting
          // it wrong looks exactly like a hang: the card sits there while the
          // driver clicks a distractor forever.
          //   mc / speed        → the ENGLISH   (word[2])
          //   mcth / clozex     → the THAI      (word[0])
          //   listen mode "en"  → the ENGLISH; any other mode → the THAI
          //   mc2 / cloze       → the item carries its own answer
          let answer = null;
          // Tone cards carry their target nowhere near item.word. toneear has
          // neither item.item.answer nor item.word, and toneread HAS item.word
          // but its options are tone LABELS, so reading word[2] silently picked
          // a distractor every time — the tone unit scored ~2 of 8 cards with
          // the rest force-advanced unscored, reporting "100% first-try".
          if (item.kind === "toneear" && typeof toneMinimalSet === "function") {
            const set = toneMinimalSet(item.cons, item.vowel);
            answer = set[item.pick || 0]?.thai ?? null;
          } else if (item.kind === "toneread" && typeof toneOfWord === "function") {
            answer = TONE_LABELS[toneOfWord(item.word[0])] ?? null;
          } else if (item.item) answer = item.item.answer;
          else if (item.word) {
            const wantThai = kind === "mcth" || kind === "clozex" ||
                             (kind === "listen" && item.mode !== "en");
            answer = wantThai ? item.word[0] : item.word[2];
          }
          const lis = [...document.querySelectorAll("#learn-choices li")];
          if (!lis.length) return "no-choices";
          let target = answer == null ? null
            : lis.find(li => li.textContent.trim() === String(answer).trim());
          // Tone steps (toneear/toneread) carry their target elsewhere; falling
          // back to the first option still ANSWERS rather than stalling, and
          // the result is recorded as a possible miss, which is honest.
          const guessed = !target;
          if (!target) target = lis[0];
          if (wantRight) { target.click(); return { picked: target.textContent.trim(), guessed, missed: false }; }
          // A deliberate miss must be FOLLOWED by the right answer. An MC card
          // has no next-button until it is answered correctly, so clicking only
          // a wrong tile leaves the card stuck — and the harness would then
          // force past it via _learnNext(), skipping it UNSCORED and reporting
          // a perfect run. That silently invalidated every accuracy < 1 round.
          const wrong = lis.find(li => li !== target);
          if (wrong) wrong.click();
          target.click();
          return { picked: target.textContent.trim(), guessed, missed: !!wrong };
        }, { kind, wantRight: Math.random() < accuracy });
      } else if (kind === "typeen" || kind === "typeth") {
        action = "type";
        await app.safe("type:" + kind, k => {
          const item = _lu.queue[_lu.at];
          if (k === "typeen") {
            const inp = document.getElementById("learn-type-in");
            if (!inp) return "no-input";
            inp.value = item.word[2];
            document.getElementById("learn-type-go")?.click();
            return item.word[2];
          }
          // typeth is the on-screen Kedmanee keyboard; tap the right keys.
          //
          // This branch never typed a single character. It looked for
          // "#learn-kbd .t-key" and the class is .tkey — zero matches, every
          // time — and even with that fixed, matching a key's textContent
          // against a Thai character cannot work: a key renders its Latin
          // label AND its Thai face ("1ๅ"), and the face runs through _tDisp,
          // which HOSTS a combining vowel on a dotted circle so it is not the
          // bare character either. So every typeth card stalled and was
          // force-advanced unscored, in every round, silently.
          //
          // Ask the app instead of scraping it: _tEntry(latinKey, shift) is
          // what the keyboard itself uses to decide a key's Thai character.
          // Shift matters — 38 of the 81 entries are on the shifted layer.
          const want = [...item.word[0]];
          const keys = [...document.querySelectorAll("#learn-kbd .tkey")]
            .filter(k2 => k2.dataset.key);
          const shiftBtn = document.querySelector("#learn-kbd .tkey-shift");
          let typed = 0;
          for (const ch of want) {
            let hit = null, needShift = false;
            for (const k2 of keys) {
              const e0 = _tEntry(k2.dataset.key, false);
              if (e0 && e0.thai === ch) { hit = k2; break; }
              const e1 = _tEntry(k2.dataset.key, true);
              if (e1 && e1.thai === ch) { hit = k2; needShift = true; break; }
            }
            if (!hit) continue;
            const shiftOn = shiftBtn && shiftBtn.getAttribute("aria-pressed") === "true";
            if (needShift !== shiftOn && shiftBtn) shiftBtn.click();
            hit.click();
            typed++;
          }
          return { word: item.word[0], typed, of: want.length };
        }, kind);
      } else if (kind === "match") {
        action = "match";
        await app.safe("match", () => {
          // The widget pairs by INDEX, and the English chip is the gloss cut at
          // " — " then at "/" (see _wMatch). Clicking tiles blindly just racks
          // up wrong-pair penalties and never finishes the card, which reads as
          // a hang. Pick each Thai chip and then its own partner.
          const pairs = _lu.queue[_lu.at].pairs;
          const chips = () => [...document.querySelectorAll("#learn-match button")];
          const find = t => chips().find(b => b.textContent.trim() === t && !b.classList.contains("matched"));
          let made = 0;
          for (const p of pairs) {
            const th = find(p[0]);
            const en = find(p[2].split(" — ")[0].split("/")[0]);
            if (th && en) { th.click(); en.click(); made++; }
          }
          return { pairs: pairs.length, matched: made };
        });
      } else {
        action = "skip";
        await app.safe("skip:" + kind, () => { if (typeof _learnNext === "function") _learnNext(); return true; });
      }

      // POLL for the advance; never sleep a fixed amount. The app moves on via
      // setTimeout(_learnNext, 550) after a correct answer and 900 after a
      // miss, and a missed card holds itself open on a study-the-word row that
      // waits for a click. Guessing a duration is how the previous attempt at
      // this ended up bumping timeouts 60→220 across three re-runs without ever
      // discovering that 550 was the number.
      if (!await app.waitForAdvance(before.at, 3000)) {
        await app.safe("clearPause", () => {
          if (typeof closeWordModal === "function") closeWordModal();
          // A missed card offers TWO buttons: "study this word" and "Next →".
          // Clicking the wrong one opens the word card and goes nowhere, which
          // is indistinguishable from a hang. Take the one that advances.
          const btns = [...document.querySelectorAll("#lesson-body button")];
          const next = btns.find(b => /next|got it|continue|→/i.test(b.textContent));
          if (next) { next.click(); return "clicked:" + next.textContent.trim(); }
          return "nothing-to-clear";
        });
        if (!await app.waitForAdvance(before.at, 1500)) {
          // Last resort: advance through the app's own API. The UI offered no
          // path, which is itself worth reporting — so the step is marked
          // `forced` rather than quietly papered over. A round that dies here
          // produces nothing; a round that notes it and continues produces a
          // finding AND the rest of the session.
          forced = true;
          await app.safe("forceNext", () => { if (typeof _learnNext === "function") _learnNext(); return true; });
          await app.waitForAdvance(before.at, 1200);
        }
      }
      const after = await app.step();
      return { kind, action, forced, before, after, advanced: !!after && after.at !== before.at };
    },

    /** Drive a whole unit. Stops on completion, on `steps`, or if it stalls. */
    async runUnit({ steps = 60, accuracy = 1 } = {}) {
      const log = [];
      let stalls = 0;
      for (let i = 0; i < steps; i++) {
        const r = await app.driveLessonStep(accuracy);
        if (!r.kind) { log.push({ done: true, reason: r.action }); break; }
        log.push({ i, kind: r.kind, action: r.action, at: r.after?.at ?? null, advanced: r.advanced, forced: r.forced });
        // The card after the last one is the unit summary — a non-advance there
        // is the lesson ENDING, not a hang. Every unit was reporting stall=1.
        if (!r.advanced && (await app.screen()) === "lesson-screen" &&
            await page.evaluate(() => !!_lu && _lu.at < _lu.queue.length - 1)) {
          stalls++;
          if (stalls === 1) await app.shot("stall-" + r.kind);
          // a stalled step is a FINDING, not a reason to die — note it and move on
          if (stalls >= 3) { log.push({ stalled: true, kind: r.kind, at: r.after?.at ?? null }); break; }
        } else stalls = 0;
        if ((await app.screen()) !== "lesson-screen") { log.push({ leftLesson: true, screen: await app.screen() }); break; }
      }
      return log;
    },

    /** Machine-readable summary: what ran, what broke. */
    report() {
      const kinds = {};
      for (const e of events) if (/^(advance|choose|type|match|skip)[:.]?/.test(e.label || ""))
        kinds[e.label] = (kinds[e.label] || 0) + 1;
      return { actions: events.length, problems: problems.length, byStepKind: kinds, problemList: problems.slice(0, 20) };
    },

    async close() {
      _live.delete(browser);
      try { await browser.close(); } catch (e) {}
      // browser.close() can leave the child alive if the connection is already
      // broken; make sure nothing survives this call.
      try { browser.process()?.kill("SIGKILL"); } catch (e) {}
    },
  };

  if (opts.noAudio) {
    // before any script runs, so _unitStart sees it at unit-build time
    await page.addInitScript(() => {
      window.addEventListener("DOMContentLoaded", () => {
        try { if (window._tts) window._tts.available = () => false; } catch (e) {}
      });
    });
  }
  await page.goto(APP_URL);
  if (opts.noAudio) await page.evaluate(() => { try { _tts.available = () => false; } catch (e) {} });
  if (opts.fresh !== false) {
    // Every round so far had to clear + reload + dismiss by hand, and one of
    // them carried a previous fabricated state into a run by forgetting the
    // reload. Fresh by default; pass { fresh: false } to keep a seeded store.
    await app.safe("reset", () => { try { localStorage.clear(); } catch (e) {} return true; });
    await page.reload();
    if (opts.noAudio) await page.evaluate(() => { try { _tts.available = () => false; } catch (e) {} });
  }
  await app.dismissTutorial();
  // Ask the app for its own teach-vs-answer split rather than trusting the
  // copy at the top of this file. A card kind added to learn.js is then driven
  // correctly by every round from that moment, with nothing to remember here.
  const kinds = await page.evaluate(() =>
    (typeof _TEACH_KINDS !== "undefined" && _TEACH_KINDS.size) ? [..._TEACH_KINDS] : null);
  if (kinds) app.teachKinds = new Set(kinds);
  return app;
}
