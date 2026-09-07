// Round 17 (2026-09-07) — Bee, a commuter who reads LINE Thai (lens: chat-Thai,
// aimed at an hour-old commit). All five fixes in 1584446 held; the finding was
// beside them. segmentThai's fall-through advances one CODE UNIT, and an astral
// character is one character in two, so every emoji in a pasted message became
// two tokens holding a lone surrogate each. It rendered correctly only because
// both consumers concatenate unknown tokens into one HTML string and the parser
// rejoins the halves — live and invisible at the same time.
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["lexicon-th.js", "seg-extra.js", "seg-phrases.js", "tokeniser.js", "segment.js"])
  vm.runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f });

describe("round 17 — emoji in pasted text", () => {
  before(() => { _segWords = null; _segLoad(() => {}); });

  // Assert the PROPERTY (no token is an invalid string, and the tokens rejoin
  // to the input), not a token count, so a future merge rule that splits them
  // some other way still fails this.
  test("an emoji is never cut in half", () => {
    const lone = t => [...t].some(c => {
      const cp = c.codePointAt(0); return cp >= 0xD800 && cp <= 0xDFFF;
    });
    for (const s of ["ดีมาก 😭", "ขอบคุณ🙏ครับ", "โอเค👍", "ไป 🇹🇭 กัน", "ก👨‍👩‍👧‍👦ข"]) {
      const toks = segmentThai(s).map(t => t.text);
      assert.equal(toks.join(""), s, `${s} must round-trip`);
      for (const t of toks) assert.ok(!lone(t), `${s} → token ${JSON.stringify(t)} is half a character`);
    }
    assert.deepEqual(segmentThai("ขอบคุณ🙏ครับ").map(t => t.text), ["ขอบคุณ", "🙏", "ครับ"]);
  });
});
