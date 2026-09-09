// Round 24 (2026-09-09) — Tomás, a week in Bangkok, no Thai, follows
// instructions literally (lens: are the first-run tutorial's PROMISES true,
// reachable and in the right order). On a phone, slide 4 was a dead end: every
// control it had shown him was off-screen and nothing scrolled.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HTML = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");

describe("round 24 — the tour a beginner follows", () => {
  // An 886px slide in a 664px viewport was centred and clipped at BOTH ends:
  // ✕ at -98, Next at 720, page and card both unscrollable. First run, with
  // the seen-flag still unset, so a reload returned to slide 1 and re-armed
  // it. Escape still worked, which is why no keyboard-driven check saw it —
  // and tools/sweep.mjs removes .open from the overlay before it sweeps and
  // only inspects elements inside .screen, so it cannot see the tutorial at
  // all. Asserted on the CSS because that is where the containment lives.
  test("a slide taller than the viewport is still escapable", () => {
    const overlay = /#tutorial-overlay\s*\{([^}]*)\}/.exec(HTML);
    const card = /#tutorial-card\s*\{([^}]*)\}/.exec(HTML);
    // every #tutorial-nav rule, not the first — the id is styled twice
    const nav = [...HTML.matchAll(/#tutorial-nav\s*\{([^}]*)\}/g)].map(m => m[1]).join("\n");
    assert.ok(overlay && card && nav, "overlay, card and nav rules should exist");
    assert.match(overlay[1], /overflow-y:\s*auto/,
      "the overlay must scroll when the card cannot fit");
    assert.match(card[1], /max-height:\s*calc\(100vh/,
      "the card must never exceed the viewport");
    assert.match(card[1], /overflow-y:\s*auto/,
      "and must scroll its own content when it would");
    assert.match(nav, /position:\s*sticky/,
      "Next/Back must stay on screen even while the slide scrolls");
  });

  // "Find the full tour again under Other → How to use" named a section that
  // does not exist — it is called More — and More starts collapsed
  // (NAV_DEFAULT_COLLAPSED), so the item was offsetParent === null on both
  // layouts. The one sentence telling him how to recover pointed nowhere.
  test("the recovery route names a section that exists", () => {
    const slide = /Find the full tour again[^<]*(?:<[^>]*>[^<]*)*?\./.exec(HTML);
    assert.ok(slide, "the recovery sentence should still be there");
    assert.ok(!/Other\s*→/.test(HTML), 'no slide may point at an "Other" section');
    const collapsed = readFileSync(new URL("../../web/js/app.js", import.meta.url), "utf8");
    const names = /NAV_DEFAULT_COLLAPSED = \[([^\]]*)\]/.exec(collapsed);
    assert.ok(names, "NAV_DEFAULT_COLLAPSED should exist");
    // If the route names a collapsed section, it has to say the section is shut.
    if (/More\s*→/.test(slide[0]) && /"More"/.test(names[1]))
      assert.match(slide[0], /starts closed|tap <strong>More<\/strong> first/,
        "a collapsed section must be described as one, or he cannot follow the route");
  });

  // Every other named screen in the tour carries a key hint wrapped in
  // .kb-hint, which body.mobile hides. The recovery sentence gained one, and a
  // phone must not be shown a keyboard shortcut it cannot type.
  test("no keyboard hint is shown on a device without a keyboard", () => {
    const bare = HTML.replace(/<span class="kb-hint">[\s\S]*?<\/span>/g, "");
    const stray = [...bare.matchAll(/<kbd class="tut-key">([^<]*)<\/kbd>/g)].map(m => m[1]);
    assert.deepEqual(stray, [],
      "a tut-key outside .kb-hint is visible on mobile, where there is no keyboard");
  });

  // Slide 5 promises "every character is labelled and hoverable". On
  // 2026-09-08 the script tooltip's listeners were gated on (hover: hover) to
  // stop it parking over the text after a tap — which left the decomposition
  // glyphs completely inert on a phone: no title, no listener, no label, and
  // no other route to what any of them is. Removing a broken affordance is
  // half the job when it was the only one. Touch gets a tap now.
  test("the decomposition is reachable without a mouse", () => {
    const src = readFileSync(new URL("../../web/js/wordcard.js", import.meta.url), "utf8");
    const fn = /_scriptTooltipHtml\(ch\)[\s\S]*?clusterDiv\.appendChild/.exec(src);
    assert.ok(fn, "the decomposition wiring should still be there");
    assert.match(fn[0], /if \(_WC_HOVER\)[\s\S]*\belse\b/,
      "there must be a non-hover branch, not just an early-out");
    assert.match(fn[0], /addEventListener\("click"/,
      "touch needs a tap to open the glyph's entry");
    assert.match(fn[0], /tabIndex\s*=\s*0/, "and it must be focusable");
    assert.match(fn[0], /aria-label/, "and named for a screen reader");
    // something has to close it again
    assert.match(src, /!_WC_HOVER[\s\S]*?_stt\.hide\(\)/,
      "a tap elsewhere must dismiss the tooltip a tap opened");
  });
});
