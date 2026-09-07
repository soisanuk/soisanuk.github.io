// Pattaya Idioms data — PATTAYA_IDIOMS and _idEsc.
// idioms.js is DOM-free at load (the DOM + openWordModal/_tts are only touched
// inside functions the tests never call), so it vm-loads cleanly. wordcard.js
// loads first: _idEsc delegates to its _wcEsc, the single escaping impl.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";

for (const f of ["data.js", "tokeniser.js", "wordcard.js", "idioms.js"]) {
  runInThisContext(readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"), { filename: f });
}

const THAI = /[฀-๿]/;

describe("PATTAYA_IDIOMS", () => {
  test("is a non-empty list of well-formed groups", () => {
    assert.ok(Array.isArray(PATTAYA_IDIOMS) && PATTAYA_IDIOMS.length >= 3);
    const keys = new Set();
    for (const g of PATTAYA_IDIOMS) {
      assert.ok(typeof g.key === "string" && g.key.length, "group key");
      assert.ok(!keys.has(g.key), `duplicate group key ${g.key}`);
      keys.add(g.key);
      assert.ok(typeof g.label === "string" && g.label.length, "group label");
      assert.ok(Array.isArray(g.items) && g.items.length, `group ${g.key} has items`);
    }
  });

  test("every item has Thai, romanisation and English; note is a string", () => {
    for (const g of PATTAYA_IDIOMS) {
      for (const it of g.items) {
        const [th, rom, en, note] = it;
        assert.ok(th && THAI.test(th), `Thai on ${JSON.stringify(it)}`);
        assert.ok(rom && rom.length > 0, `rom on ${th}`);
        assert.ok(en && en.length > 0, `en on ${th}`);
        assert.equal(typeof (note ?? ""), "string", `note on ${th}`);
      }
    }
  });

  test("the load-bearing obligation concepts are present", () => {
    const all = PATTAYA_IDIOMS.flatMap(g => g.items.map(i => i[0]));
    for (const w of ["บุญคุณ", "เกรงใจ", "น้ำใจ", "เลี้ยงดู", "เท่าไหร่", "เมียน้อย"]) {
      assert.ok(all.includes(w), `${w} present`);
    }
  });
});

describe("_idEsc", () => {
  test("escapes HTML-significant characters", () => {
    assert.equal(_idEsc(`<b>"a"&'x'`), "&lt;b&gt;&quot;a&quot;&amp;&#39;x&#39;");
  });
  test("leaves Thai and plain text alone", () => {
    assert.equal(_idEsc("บุญคุณ ok"), "บุญคุณ ok");
  });
});


// ── findings from the 2026-09-07 reference-screens round ────────────────────

// Nothing checked an idiom's romanisation against the app's own dictionary, so
// เมียน้อย read "mia-nói" where น้อย is "nóoi" everywhere else, and
// ขายตัวไม่ได้ขายใจ read "dâai" where ได้ is "dâi". Both are the ◌อย/ไ◌ vowel
// rules settled on 2026-09-03 and pinned for WORDS and EXAMPLES — this file
// was simply outside the pin.
test("every idiom romanises its curriculum words the way data.js does", () => {
  const map = new Map(WORDS.map(w => [w[0], w[1]]));
  const bad = [];
  for (const { items } of PATTAYA_IDIOMS) {
    for (const [th, rom] of items) {
      for (const t of _tokenise(th).filter(x => x.word).map(x => x.text)) {
        if (!map.has(t)) continue;
        const want = map.get(t).replace(/-/g, "").toLowerCase();
        if (!rom.replace(/[- ]/g, "").toLowerCase().includes(want))
          bad.push(`${th} "${rom}" — ${t} should read "${map.get(t)}"`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
