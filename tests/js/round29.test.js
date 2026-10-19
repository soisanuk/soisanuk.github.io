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
for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js", "srs.js", "wordcard.js", "app.js"])
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

// ── Recorded, not fixed ─────────────────────────────────────────────────────
//
// F2 "Continue does not continue", F3 "a reload drops you on the menu", and
// F10 "leaving is silent everywhere" are one defect: a lesson's state lives
// only in memory. learn.js builds `_lu` = { idx, unit, queue, at, results, t0 }
// with a freshly shuffled queue on every start (lines ~120-150 call _shuffle
// on each kind), and nothing persists it, so Continue, Menu, Back, reload and
// an app switch all restart at 1/40 — while tutorial slide 2 promises that
// Continue "always picks up where you left off". The fix is a feature, not a
// patch: serialise _lu (its items are plain data — word rows, pools, pairs —
// so JSON round-trips), restore it on Continue when `at < queue.length`, and
// SAY so ("resuming 5/40 · start over"). Left for a pass that can read
// learn.js properly rather than done blind here. The tutorial's promise is
// false until then.
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
