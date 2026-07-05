// Tests for the Soi 6 Connect สี่ board logic, AI, and vowel quiz in
// web/js/connect4.js. The file is DOM-free at load time, so it can be
// evaluated via node:vm. data.js provides VOWELS for the quiz.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "connect4.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
// Note: const/let from vm scripts live in the global lexical scope, not on
// globalThis — reference them as bare identifiers, don't destructure.

// helper: build a board from column drop sequences [[col, player], ...]
function play(moves) {
  const b = _c4NewBoard();
  for (const [col, p] of moves) {
    const r = _c4DropRow(b, col);
    b[r][col] = p;
  }
  return b;
}

// ── board mechanics ───────────────────────────────────────────────────────────

describe("board mechanics", () => {
  test("new board is 6x7 and empty", () => {
    const b = _c4NewBoard();
    assert.equal(b.length, 6);
    assert.ok(b.every(row => row.length === 7 && row.every(v => v === 0)));
  });

  test("tokens stack from the bottom", () => {
    const b = play([[3, 1], [3, 2]]);
    assert.equal(b[5][3], 1);
    assert.equal(b[4][3], 2);
  });

  test("full column reports no drop row and is not valid", () => {
    const b = play([[0,1],[0,2],[0,1],[0,2],[0,1],[0,2]]);
    assert.equal(_c4DropRow(b, 0), -1);
    assert.ok(!_c4ValidCols(b).includes(0));
  });
});

// ── win detection ─────────────────────────────────────────────────────────────

describe("win detection", () => {
  test("horizontal", () => {
    const b = play([[0,1],[1,1],[2,1],[3,1]]);
    const w = _c4Winner(b);
    assert.equal(w.p, 1);
    assert.equal(w.cells.length, 4);
  });

  test("vertical", () => {
    const b = play([[2,2],[2,2],[2,2],[2,2]]);
    assert.equal(_c4Winner(b).p, 2);
  });

  test("diagonal down-right", () => {
    const b = _c4NewBoard();
    b[2][1] = b[3][2] = b[4][3] = b[5][4] = 1;
    assert.equal(_c4Winner(b).p, 1);
  });

  test("diagonal down-left", () => {
    const b = _c4NewBoard();
    b[2][4] = b[3][3] = b[4][2] = b[5][1] = 2;
    assert.equal(_c4Winner(b).p, 2);
  });

  test("no false positives on an empty board", () => {
    assert.equal(_c4Winner(_c4NewBoard()), null);
  });

  test("three in a row is not a win", () => {
    const b = play([[0,1],[1,1],[2,1]]);
    assert.equal(_c4Winner(b), null);
  });
});

// ── immediate-win finder ──────────────────────────────────────────────────────

describe("_c4ImmediateWin", () => {
  test("finds the completing column", () => {
    const b = play([[0,2],[1,2],[2,2]]);
    assert.equal(_c4ImmediateWin(b, 2), 3);
  });

  test("returns -1 when no win exists", () => {
    assert.equal(_c4ImmediateWin(_c4NewBoard(), 1), -1);
  });

  test("does not mutate the board", () => {
    const b = play([[0,2],[1,2],[2,2]]);
    const snapshot = JSON.stringify(b);
    _c4ImmediateWin(b, 2);
    assert.equal(JSON.stringify(b), snapshot);
  });
});

// ── AI ────────────────────────────────────────────────────────────────────────

describe("AI", () => {
  test("medium (Pim) takes an immediate win", () => {
    const b = play([[0,2],[1,2],[2,2],[0,1],[1,1]]);
    assert.equal(_c4AiMove(b, 1), 3);
  });

  test("medium (Pim) blocks the player's win", () => {
    const b = play([[0,1],[1,1],[2,1]]);
    assert.equal(_c4AiMove(b, 1), 3);
  });

  test("hard (Madam Oy) takes an immediate win", () => {
    const b = play([[0,2],[1,2],[2,2],[0,1],[1,1]]);
    assert.equal(_c4AiMove(b, 2), 3);
  });

  test("hard (Madam Oy) blocks the player's win", () => {
    // wall-bounded three (0,1,2): the only block is column 3.
    // (An open-ended three like 2,3,4 is a forced loss — negamax would
    // rightly play elsewhere.)
    const b = play([[0,1],[1,1],[2,1]]);
    assert.equal(_c4AiMove(b, 2), 3);
  });

  test("easy (Nong) always returns a legal column", () => {
    const b = play([[0,1],[0,2],[0,1],[0,2],[0,1],[0,2]]); // col 0 full
    for (let i = 0; i < 50; i++) {
      const c = _c4AiMove(b, 0);
      assert.ok(c >= 1 && c <= 6, `illegal column ${c}`);
    }
  });
});

// ── vowel quiz ────────────────────────────────────────────────────────────────

describe("_c4MakeQuiz", () => {
  test("four distinct choices including the answer, unambiguous romanisations", () => {
    for (let i = 0; i < 200; i++) {
      const q = _c4MakeQuiz();
      assert.equal(q.choices.length, 4);
      assert.ok(q.choices.includes(q.answer));
      assert.equal(new Set(q.choices).size, 4);
      // no distractor may share the answer's romanisation (VOWELS has
      // duplicate romans: two "ai", two "oo")
      const sameRom = q.choices.filter(v => v[1] === q.answer[1]);
      assert.equal(sameRom.length, 1, `ambiguous choices for ${q.answer[1]}`);
      for (const v of q.choices) assert.ok(VOWELS.includes(v));
    }
  });
});
