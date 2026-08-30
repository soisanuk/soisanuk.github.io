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
const TEACH_STEPS = new Set(["glyph", "wordintro", "toneIntro", "tonecalc", "chunkIntro"]);
const CHOICE_STEPS = new Set(["mc", "mc2", "speed", "listen", "mcth", "clozex", "cloze", "toneear", "toneread"]);

export async function openApp(opts = {}) {
  const browser = await chromium.launch();
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
      const prog = read("thaicab_progress") || {};
      return {
        cardsSeen: Object.keys(prog).length,
        path: read("soisanuk_path"), streak: read("soisanuk_streak"),
        srsDue: (() => {
          try { return dueCards(WORDS.map(w => w[0])).length; } catch (e) { return null; }
        })(),
      };
    }),

    async dismissTutorial() {
      return app.safe("dismissTutorial", () => {
        if (typeof closeTutorial === "function") closeTutorial();
        try { localStorage.setItem("thaicab_tut_seen", "1"); } catch (e) {}
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

      if (TEACH_STEPS.has(kind)) {
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
          if (item.item) answer = item.item.answer;
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
          if (!wantRight) target = lis.find(li => li !== target) || target;
          target.click();
          return { picked: target.textContent.trim(), guessed };
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
          // typeth is the on-screen Kedmanee keyboard; tap the right keys
          const want = [...item.word[0]];
          for (const ch of want) {
            const key = [...document.querySelectorAll("#learn-kbd .t-key")]
              .find(k2 => k2.textContent.trim() === ch);
            if (key) key.click();
          }
          return item.word[0];
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
        if (!r.advanced) {
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
      for (const e of events) if (e.label?.startsWith("advance:") || e.label?.startsWith("choose:") || e.label?.startsWith("type:"))
        kinds[e.label] = (kinds[e.label] || 0) + 1;
      return { actions: events.length, problems: problems.length, byStepKind: kinds, problemList: problems.slice(0, 20) };
    },

    async close() { try { await browser.close(); } catch (e) {} },
  };

  await page.goto(APP_URL);
  await app.dismissTutorial();
  return app;
}
