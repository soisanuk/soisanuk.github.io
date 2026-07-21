// Pattaya Idioms data — PATTAYA_IDIOMS and _idEsc.
// idioms.js is DOM-free at load (the DOM + openWordModal/_tts are only touched
// inside functions the tests never call), so it vm-loads cleanly.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";

runInThisContext(readFileSync(new URL("../../web/js/idioms.js", import.meta.url), "utf8"), { filename: "idioms.js" });

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
