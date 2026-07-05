// Tests for the Soi Buakhao dialogue data and pure helpers in
// web/js/soi-buakhao.js. The file is DOM-free at load time, so it can be
// evaluated via node:vm like the other sources.
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

vm.runInThisContext(
  readFileSync(new URL("../../web/js/soi-buakhao.js", import.meta.url), "utf8"),
  { filename: "soi-buakhao.js" }
);
// Note: const/let from vm scripts live in the global lexical scope, not on
// globalThis — reference them as bare identifiers, don't destructure.

// ── dialogue pools ────────────────────────────────────────────────────────────

describe("_SB_QS", () => {
  test("three nights with five questions each", () => {
    assert.deepEqual(Object.keys(_SB_QS).sort(), ["1", "2", "3"]);
    for (const night of [1, 2, 3]) {
      assert.equal(_SB_QS[night].length, 5, `night ${night}`);
    }
  });

  test("every question has thai, romanisation, and english", () => {
    for (const night of [1, 2, 3]) {
      for (const q of _SB_QS[night]) {
        assert.ok(q.q.length > 0);
        assert.ok(q.rom.length > 0);
        assert.ok(q.en.length > 0);
      }
    }
  });

  test("every question has four choices with exactly one correct", () => {
    for (const night of [1, 2, 3]) {
      for (const q of _SB_QS[night]) {
        assert.equal(q.choices.length, 4, q.q);
        assert.equal(q.choices.filter(c => c.ok).length, 1, q.q);
        for (const c of q.choices) {
          assert.ok(c.th.length > 0);
          assert.ok(c.rom.length > 0);
          assert.ok(c.en.length > 0);
        }
      }
    }
  });
});

// ── endings ───────────────────────────────────────────────────────────────────

describe("night endings and finales", () => {
  test("one happy and one sad scene per night", () => {
    assert.equal(_SB_ENDS.happy.length, 3);
    assert.equal(_SB_ENDS.sad.length, 3);
  });

  test("every scene references the hostess via {n}", () => {
    for (const scene of [..._SB_ENDS.happy, ..._SB_ENDS.sad]) {
      assert.ok(scene.title.length > 0);
      assert.ok(scene.scene.includes("{n}"), scene.title);
    }
  });

  test("a finale exists for every possible win count", () => {
    for (const key of ["3-0", "2-1", "1-2", "0-3"]) {
      const fin = _SB_FINALE[key];
      assert.ok(fin, `missing finale ${key}`);
      assert.ok(fin.title.length > 0);
      assert.ok(fin.emoji.length > 0);
      assert.ok(fin.text.length > 0);
    }
  });
});

// ── venue data ────────────────────────────────────────────────────────────────

describe("bars and hostesses", () => {
  test("bar names are non-empty and unique", () => {
    assert.ok(_SB_BARS.length > 0);
    assert.equal(new Set(_SB_BARS).size, _SB_BARS.length);
    for (const b of _SB_BARS) assert.ok(b.length > 0);
  });

  test("every hostess has name, thai name, emoji, and description", () => {
    assert.ok(_SB_HOSTESSES.length > 0);
    for (const h of _SB_HOSTESSES) {
      assert.ok(h.name.length > 0);
      assert.ok(h.th.length > 0);
      assert.ok(h.e.length > 0);
      assert.ok(h.desc.length > 0);
    }
  });
});

// ── helpers ───────────────────────────────────────────────────────────────────

describe("_sbEsc", () => {
  test("escapes HTML metacharacters", () => {
    assert.equal(_sbEsc("<b>&\"x\"</b>"), "&lt;b&gt;&amp;\"x\"&lt;/b&gt;");
  });

  test("coerces non-strings", () => {
    assert.equal(_sbEsc(42), "42");
  });
});

describe("_sbSample", () => {
  test("returns n distinct members without mutating the source", () => {
    const src = [1, 2, 3, 4, 5];
    const before = [...src];
    for (let i = 0; i < 20; i++) {
      const out = _sbSample(src, 4);
      assert.equal(out.length, 4);
      assert.equal(new Set(out).size, 4);
      for (const x of out) assert.ok(src.includes(x));
    }
    assert.deepEqual(src, before);
  });

  test("n larger than the pool returns the whole pool", () => {
    assert.equal(_sbSample([1, 2], 5).length, 2);
  });
});
