// Round 29 (2026-10-19) — Mei, a product designer running a heuristic review
// of the whole app (lens: UX — every screen's way back, header, primary action
// and Escape, lined up and compared to each other).
//
// Her verdict: "thirty well-made rooms and no corridor". The findings that
// were fixed are pinned here; the ones that were not are recorded at the
// bottom, with the diagnosis, so the next round does not re-find them.
//
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");
globalThis.document = undefined;
// A real in-memory localStorage: the resume tests below write and read it.
// Node 26 defines its own accessor that throws without --localstorage-file.
const _store = {};
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: k => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: k => { delete _store[k]; },
} });
for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js", "srs.js", "wordcard.js", "app.js",
                 "curriculum.js", "tutor.js", "learn.js", "home.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"), { filename: f });

// The menu is `class="screen active"` at rest, so the class may carry more
// than "screen" — the first version of this regex missed exactly that one.
const screens = [...html.matchAll(/<div id="([a-z0-9-]+-screen)" class="screen( [^"]*)?"/g)].map(m => m[1]);

describe("F1 — every screen answers Escape", () => {
  // Escape did nothing on nine screens, and on Android the hardware Back is
  // mapped to Escape, so Back was dead there too. app.js now carries the map;
  // these are the screens that handle Escape in their own keydown branches.
  const OWN_HANDLER = ["flash-screen", "quiz-screen", "srs-screen", "sent-srs-screen", "drill-screen",
                       "tutor-screen", "game-screen", "soi-screen", "c4-screen", "bb-screen", "ck-screen",
                       "num-flash-screen", "tone-drill-screen", "lesson-screen"];

  test("the index.html screen list was actually read", () => {
    assert.ok(screens.length >= 25, `only ${screens.length} screens found — the regex missed them`);
    assert.ok(screens.includes("rst-screen") && screens.includes("menu-screen"));
  });

  test("every screen is the menu, in ESCAPE_TO_MENU, or handles Escape itself", () => {
    const orphans = screens.filter(id => id !== "menu-screen" && !ESCAPE_TO_MENU.includes(id) && !OWN_HANDLER.includes(id));
    assert.deepEqual(orphans, [], "screens on which Escape (and Android Back) would do nothing");
  });

  test("ESCAPE_TO_MENU names only real screens", () => {
    // A typo here would silently cover nothing.
    for (const id of ESCAPE_TO_MENU) assert.ok(screens.includes(id), `${id} is not a screen in index.html`);
  });
});

describe("F5 — the way to the menu has one name", () => {
  // "← Back" meant the menu on four screens and the previous slide in the
  // tutorial; "← Back to Menu", bare "Menu" and "Home" all also meant the
  // menu. One destination, one label: "← Menu".
  test("no screen footer calls the menu anything but ← Menu", () => {
    const footers = [...html.matchAll(/<div class="screen-footer"[^>]*>([\s\S]*?)<\/div>/g)].map(m => m[1]);
    assert.ok(footers.length >= 15, `only ${footers.length} footers parsed`);
    const bad = [];
    for (const f of footers)
      for (const b of f.matchAll(/<button[^>]*onclick="(showMenu|endSession)\(\)"[^>]*>([^<]*)</g)) {
        const label = b[2].trim();
        if (/^(← )?Back( to Menu)?$|^Menu$|^Home$/.test(label)) bad.push(`${b[1]}(): "${label}"`);
      }
    assert.deepEqual(bad, []);
  });

  test("the sidebar's way home is also ← Menu", () => {
    assert.match(html, /<button onclick="showMenu\(\)">← Menu<\/button>/);
    assert.doesNotMatch(html, /<button onclick="showMenu\(\)">Home<\/button>/);
  });

  test("the tutorial's ← Back still means the previous slide", () => {
    // Not a footer, not the menu — this one is correct and must not be
    // swept up by a future "rename every Back" pass.
    assert.match(html, /id="tutorial-prev" onclick="_tutPrev\(\)">← Back</);
  });
});

describe("F4 / F9 — a way out is always on screen", () => {
  test("the Restaurant has a footer with a Quit, like every other game", () => {
    const rst = html.slice(html.indexOf('<div id="rst-screen"'), html.indexOf('<div id="soi-screen"'));
    assert.match(rst, /<div class="screen-footer" id="rst-footer">[\s\S]*?Quit/);
  });

  test("the two tall screens carry a ← Menu at the top as well as the bottom", () => {
    for (const id of ["learn-screen", "stats-screen"]) {
      const i = html.indexOf(`<div id="${id}"`);
      const head = html.slice(i, i + 600);
      assert.match(head, /class="top-back"[\s\S]*?← Menu/, `${id} has no top ← Menu`);
    }
  });
});

describe("F6 — the category picker names its mode", () => {
  test("pickCategory takes a title and the three callers pass one", () => {
    const sessions = readFileSync(new URL("../../web/js/sessions.js", import.meta.url), "utf8");
    const calls = [...sessions.matchAll(/pickCategory\(([^;]*)\);/g)].map(m => m[1]);
    assert.equal(calls.length, 3);
    for (const c of calls) assert.match(c, /,\s*("|mode ===)/, `pickCategory called without a title: ${c.slice(0, 60)}`);
  });
});

describe("F8 — counters start at 1", () => {
  test("no counter writes the card in hand as 0", () => {
    const sessions = readFileSync(new URL("../../web/js/sessions.js", import.meta.url), "utf8");
    const counters = [...sessions.matchAll(/getElementById\("[a-z-]+-counter"\)\.textContent =\s*`[^`]*`/g)].map(m => m[0]);
    assert.ok(counters.length >= 4, `only ${counters.length} counter writes parsed`);
    for (const c of counters)
      assert.doesNotMatch(c, /\$\{[a-z.]+done\}\s*\//, `a counter writes the 0-based done count: ${c.slice(-60)}`);
  });
});

describe("F2 / F3 / F10 — Continue continues", () => {
  // A course unit lived only in memory and _unitStart reshuffled a fresh queue
  // every time, so ← Menu, Escape, Back, a reload or an app switch restarted
  // it at 1/40 — while tutorial slide 2 promised Continue "always picks up
  // where you left off". Mei: 5/40, Menu, Continue, 1/40. The browser half of
  // this (the counter, the hint, the path row, a real reload) is in
  // tools/sweep.mjs; these pin the pure layer underneath it.
  const KEY = "soisanuk_lesson";
  const reset = () => { localStorage.removeItem(KEY); _lu = null; };
  const unit = (i, at = 4) => ({ idx: i, unit: COURSE[i], queue: _unitQueue(COURSE[i], [], true), at, max: at, results: [] });

  test("every unit's queue survives the save unchanged, and the save stays small", () => {
    // Unit 20's thirteen fill-the-gap cards share one 1,068-word pool; written
    // raw, the save was 867 KB per tap. Word references cut it to 243 KB;
    // writing the shared pool once cut it to under 19 KB.
    let largest = 0;
    COURSE.forEach((_, i) => {
      reset(); _lu = unit(i, 3); const q = _lu.queue;
      _luSave();
      largest = Math.max(largest, localStorage.getItem(KEY).length);
      assert.deepEqual(_luLoad().queue, q, `unit ${i + 1}'s queue changed on the way through storage`);
    });
    assert.ok(largest < 40 * 1024, `largest save is ${(largest / 1024).toFixed(1)} KB — the shared pool is being written per card again`);
  });

  test("Continue resumes the SAME queue at the same card — not a reshuffled one", () => {
    reset(); _lu = unit(0, 4); const q = _lu.queue; _luSave(); _lu = null;
    const plan = continuePlan();
    assert.equal(plan.kind, "resume");
    assert.equal(plan.unitIdx, 0);
    assert.equal(plan.at, 4);
    const r = _luRestore(plan.saved);
    assert.equal(r.at, 4);
    assert.deepEqual(r.queue, q);
    // Evidence the equality above is resuming and not luck: a rebuild of the
    // same unit is a different queue, because _unitQueue shuffles every time.
    const rebuilds = [0, 1, 2].map(() => _unitQueue(COURSE[0], [], true));
    assert.ok(rebuilds.some(b => JSON.stringify(b) !== JSON.stringify(q)), "unit 1 rebuilds identically — this test cannot tell resume from rebuild");
  });

  test("a card answered just before leaving is not served again", () => {
    // _learnRecord writes the SRS at grade time; showing the card again
    // would grade the same answer twice.
    reset(); _lu = unit(0, 6); _lu.answered = 6; _luSave();
    const r = _luRestore(_luLoad());
    assert.equal(r.at, 7, "should resume on the card AFTER the answered one");
    assert.ok(!(r.at < r.max), "the resumed card must be live, not a read-only review");
  });

  test("a pool shared by many cards comes back shared", () => {
    const last = COURSE.length - 1;
    reset(); _lu = unit(last, 0); _luSave();
    const pools = _luLoad().queue.filter(it => it.pool).map(it => it.pool);
    assert.ok(pools.length > 1, "expected several cards carrying a pool");
    assert.ok(pools.every(p => p === pools[0]), "the shared pool was restored as separate copies");
  });

  test("a save that cannot be trusted is discarded, not resumed into a hole", () => {
    reset(); _lu = unit(0); _luSave();
    const good = JSON.parse(localStorage.getItem(KEY));
    const tamper = f => { const s = JSON.parse(JSON.stringify(good)); f(s); localStorage.setItem(KEY, JSON.stringify(s)); return _luLoad(); };
    assert.equal(tamper(s => { s.course = 999; }), null, "a different course");
    assert.equal(tamper(s => { s.idx = 999; }), null, "an unknown unit");
    assert.equal(tamper(s => { s.at = s.queue.length + 1; }), null, "a position past the end");
    assert.equal(tamper(s => { const w = JSON.stringify(s).match(/"~w":"([^"]+)"/)[1];
      Object.assign(s, JSON.parse(JSON.stringify(s).split(`"~w":"${w}"`).join(`"~w":"ไม่มีคำนี้"`))); }), null, "a word gone from WORDS");
    localStorage.setItem(KEY, "{not json"); assert.equal(_luLoad(), null, "garbage");
    assert.ok(tamper(() => {}), "…and the untampered save still loads");
  });

  test("only course units are saved — review rounds and placement are not", () => {
    for (const idx of [-1, -2]) {
      reset(); _lu = { idx, unit: { kind: "review" }, queue: [{ kind: "mc", word: WORDS[0] }], at: 0, results: [] };
      _luSave();
      assert.equal(localStorage.getItem(KEY), null, `idx ${idx} was saved`);
    }
  });

  test("the Continue row and the home card say they will resume", () => {
    reset(); _lu = unit(2, 4); _luSave(); _lu = null;
    const plan = continuePlan();
    assert.match(_contText(plan, { days: 3 }, {}), /^resume unit 3 · 5\//);
    assert.match(homeCta(plan, null).title, /^Resume: /);
    reset();
  });
});

// ── Recorded, not fixed ─────────────────────────────────────────────────────
//
// F2/F3/F10 — fixed 2026-10-26, pinned in the describe block below, which
// sits above this list. Kept here as a pointer so the next round finds it.
//
// F1b: the browser's Back leaves the app from every screen because nothing
// calls pushState. Escape now works everywhere, and the Capacitor build maps
// hardware Back to Escape, so the native app is covered; the web app on a
// phone browser is not. A pushState on showScreen with popstate → showMenu is
// ~15 lines, but it interacts with the Capacitor back mapping and the word-
// card overlay; needs its own pass.
//
// F7: menu label ≠ screen header for ten screens, and the sidebar is a third
// vocabulary (eleven labels differ). The course header now says "Guided Course
// · <level>" and the Restaurant's menu label matches its sidebar label; the
// rest — "SRS Review" vs "Vocab SRS", "Flashcards — Consonants" vs "Consonant
// cards", the tutorial's "Script cards" and "Tone Drill" — is a naming pass
// across index.html, the tutorial slides and every screen's JS header. Her
// table in the round report is the spec.
//
// F12: "Tone Listening Drill" is a live menu row that fires a native alert
// when there is no Thai voice. Real iPhones ship one. Low; not touched.
