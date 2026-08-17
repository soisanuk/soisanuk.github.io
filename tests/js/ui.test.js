// Guards on the first-run tutorial's CONTENT, not just its machinery.
//
// Context: a full code review of this app passed over the tutorial entirely,
// because the tutorial's code was correct — _TUT_TOTAL, _tutRender and
// maybeShowTutorial all worked fine. What was wrong was what the slides SAID:
// they claimed "878 vocabulary words" when the real count had reached 950,
// and the tour described the app as it stood before the Guided Course was
// added (11 days and 63 web/ commits earlier). No test, lint, or type could
// see it, because stale prose is not a code defect.
//
// These tests exist to give that class of drift a mechanical signal.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");

vm.runInThisContext(
  readFileSync(new URL("../../web/js/data.js", import.meta.url), "utf8"),
  { filename: "data.js" }
);

// The tutorial markup, isolated — so assertions about "the tour" don't
// accidentally match the rest of the 2600-line shell.
const tutorialHtml = html.slice(
  html.indexOf('<div id="tutorial-overlay">'),
  html.indexOf('<div class="tutorial-dots">')
);

describe("tutorial content", () => {
  test("the tour markup was actually found (guards the slice above)", () => {
    assert.ok(tutorialHtml.length > 500, "tutorial markup not located in index.html");
    assert.ok(tutorialHtml.includes("tutorial-slide"), "no slides in the sliced markup");
  });

  test("no slide hard-codes a vocabulary count", () => {
    // The exact bug: "878 vocabulary words" / "all 878 words". Any 3+ digit
    // number sitting next to the word "words" is a count that will rot.
    const hardcoded = tutorialHtml.match(/\b\d{3,}\b(?=[^<]{0,40}\bwords?\b)/gi) || [];
    assert.deepEqual(hardcoded, [],
      "hard-coded vocab count in the tutorial — use <span class=\"tut-count\" data-count=\"words\"> instead, which _tutFillCounts() fills from WORDS at open time");
  });

  test("the counts the tour shows are wired to real data", () => {
    assert.ok(tutorialHtml.includes('data-count="words"'), "no live word count in the tour");
    assert.ok(tutorialHtml.includes('data-count="script"'), "no live script-card count in the tour");
  });

  test("the tour names the Guided Course as the starting point", () => {
    // The substantive miss: the tour pointed new users at Flashcards/SRS —
    // self-graded free review — while the app's actual recommended path (a
    // taught, auto-graded course) went unmentioned. If the primary entry
    // point is ever renamed or replaced, this should fail loudly.
    assert.match(tutorialHtml, /Guided Course/,
      "the tour never mentions the Guided Course, the app's recommended entry point");
    assert.match(tutorialHtml, /Start here/i,
      "no slide tells a new user where to start");
  });

  test("slide count matches the dot count and _TUT_TOTAL", () => {
    const slides = (html.match(/class="tutorial-slide"/g) || []).length;
    const dots = (html.match(/class="tutorial-dot"/g) || []).length;
    const ui = readFileSync(new URL("../../web/js/ui.js", import.meta.url), "utf8");
    const total = Number(ui.match(/_TUT_TOTAL\s*=\s*(\d+)/)[1]);
    assert.equal(slides, dots, "slide count and navigation-dot count disagree");
    assert.equal(slides, total,
      `_TUT_TOTAL (${total}) disagrees with the ${slides} slides in index.html — ` +
      "the last slide would be unreachable, or Next would run past the end");
  });
});

describe("_tutFillCounts", () => {
  test("fills every .tut-count span from the real data", () => {
    const filled = {};
    global.document = {
      querySelectorAll: () => [
        { dataset: { count: "words" }, set textContent(v) { filled.words = v; } },
        { dataset: { count: "script" }, set textContent(v) { filled.script = v; } },
      ],
      getElementById: () => null,
    };
    vm.runInThisContext(
      readFileSync(new URL("../../web/js/ui.js", import.meta.url), "utf8"),
      { filename: "ui.js" }
    );
    _tutFillCounts();
    assert.equal(filled.words, WORDS.length);
    assert.equal(filled.script, CONSONANTS.length + VOWELS.length);
    delete global.document;
  });
});
