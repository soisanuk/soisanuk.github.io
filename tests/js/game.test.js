// Tests for the Walking Street game data in web/js/game.js.
// The file is DOM-free at load time (canvas access only inside functions), so
// it can be evaluated via node:vm. tutor.js is loaded alongside it to check
// that both agree on the Kedmanee key mapping.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["game.js", "tutor.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
// Note: const/let from vm scripts live in the global lexical scope, not on
// globalThis — reference them as bare identifiers, don't destructure.

// ── GAME_LETTERS ──────────────────────────────────────────────────────────────

describe("game letter pool", () => {
  test("ten defaults plus night-unlocked extras", () => {
    assert.equal(GAME_LETTERS.length, 10);
    assert.ok(_GAME_EXTRA.length >= 1);
    assert.equal(_GAME_ALL.length, GAME_LETTERS.length + _GAME_EXTRA.length);
  });

  test("thai characters and keys are unique across the full pool", () => {
    assert.equal(new Set(_GAME_ALL.map(l => l.thai)).size, _GAME_ALL.length);
    assert.equal(new Set(_GAME_ALL.map(l => l.key)).size, _GAME_ALL.length);
  });

  test("every letter is a Thai consonant", () => {
    for (const l of _GAME_ALL) {
      const c = l.thai.codePointAt(0);
      assert.ok(c >= 0x0e01 && c <= 0x0e2e, `${l.thai} is not a Thai consonant`);
    }
  });

  test("each letter has a neon colour", () => {
    assert.ok(_NEON.length >= _GAME_ALL.length);
  });

  test("key mapping agrees with the keyboard tutor (Kedmanee)", () => {
    for (const l of _GAME_ALL) {
      const t = TUTOR_ALL.find(e => e.thai === l.thai);
      assert.ok(t, `${l.thai} missing from TUTOR_ALL`);
      assert.equal(l.key, t.key, `key mismatch for ${l.thai}`);
    }
  });
});

// ── sprite bitmaps ────────────────────────────────────────────────────────────

function assertSprite(name, rows, palette, extraChars = []) {
  const width = rows[0].length;
  const known = new Set([".", ...Object.keys(palette), ...extraChars]);
  for (const row of rows) {
    assert.equal(row.length, width, `${name}: ragged row "${row}"`);
    for (const ch of row) {
      assert.ok(known.has(ch), `${name}: char "${ch}" has no palette colour`);
    }
  }
}

describe("street sprites", () => {
  test("walk frames are uniform, fully coloured, and same-sized", () => {
    // "B" (shirt) is injected per-pedestrian at draw time, not in _WALK_BASE
    for (const frame of _WALK_FRAMES) {
      assertSprite("walk", frame, _WALK_BASE, ["B"]);
    }
    const [a, b] = _WALK_FRAMES;
    assert.equal(a.length, b.length);
    assert.equal(a[0].length, b[0].length);
  });

  test("motorbike rows are uniform and fully coloured", () => {
    assertSprite("moto", _MOTO_ROWS, _MOTO_COL);
    assertSprite("grab moto", _MOTO_ROWS, _MOTO_GRAB_COL);
  });

  test("baht bus rows are uniform and fully coloured", () => {
    assertSprite("bus", _BUS_ROWS, _BUS_COL);
  });
});

// Found by the 2026-08-30 games look-and-feel round. _gResize sized the backing
// store from the WRAPPER's box in CSS pixels — two bugs at once on a phone:
// no devicePixelRatio (a third of native resolution on dpr 3, visibly soft
// beside Baht Bus's crisp pixel art), and the wrapper is not the canvas
// (measured 390x461 backing against a 390x311 box, squashing the scene to
// 67.5% of its height). baht-bus.js already had the cure.
test("_gResize multiplies by devicePixelRatio and keeps the canvas's own aspect", () => {
  const src = readFileSync(new URL("../../web/js/game.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("function _gResize"), src.indexOf("}", src.indexOf("function _gResize")) + 1);
  assert.match(fn, /devicePixelRatio/, "_gResize ignores devicePixelRatio");
  assert.doesNotMatch(fn, /wrap\.client/, "_gResize sizes from the wrapper, not the canvas");
  // the renderer uses absolute sizes (lineWidth 7, "bold 28px"), so the drawing
  // space must stay in CSS pixels via setTransform rather than scaling coords
  assert.match(src, /setTransform\(/, "_gDraw must set a dpr transform");
});
