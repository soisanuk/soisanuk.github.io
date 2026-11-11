// Tests for web/js/dialogues.js: the Dialogues reader's data. The Thai and
// recordings are DLI Thai SOLT's; these checks keep the data well-formed and
// every recording present. Run with: node --test tests/js/

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import vm from "node:vm";

vm.runInThisContext(readFileSync(new URL("../../web/js/dialogues.js", import.meta.url), "utf8"), { filename: "dialogues.js" });
const WEB = new URL("../../web/", import.meta.url);

test("every dialogue is complete and its recording is shipped", () => {
  const ids = new Set();
  for (const d of DIALOGUES) {
    assert.ok(!ids.has(d.id), "duplicate id " + d.id); ids.add(d.id);
    for (const k of ["title", "scenario", "folder", "file"]) assert.ok(d[k], `${d.id}: no ${k}`);
    assert.ok(d.module >= 1 && d.module <= 6 && d.track > 0, d.id);
    assert.ok(d.lines.length >= 1, d.id);
    for (const l of d.lines) {
      assert.ok(l.who && l.th && l.en, `${d.id}: incomplete line`);
      assert.match(l.th, /[฀-๿]/, `${d.id}: line has no Thai`);
    }
    const f = new URL(dialogueAudioSrc(d), WEB);
    assert.ok(existsSync(f), `${d.id}: no recording`);
    assert.ok(statSync(f).size > 20000, `${d.id}: recording looks empty`);
  }
});

test("no text-extraction damage survived in the Thai", () => {
  for (const d of DIALOGUES) for (const l of d.lines) {
    assert.ok(!/ํ[่-๋]?า/.test(l.th), `${d.id}: decomposed sara am in ${l.th}`);
    assert.ok(!/[่-๋][ิ-ืั็]/.test(l.th), `${d.id}: tone mark before a vowel in ${l.th}`);
    assert.ok(!/([ัิ-ฺ็-๎])\1/.test(l.th), `${d.id}: doubled mark in ${l.th}`);
  }
});

test("the reader is not in the precache: recordings stream and cache on first play", () => {
  const sw = readFileSync(new URL("sw.js", WEB), "utf8");
  assert.ok(sw.includes('"./js/dialogues.js"'));
  assert.ok(!sw.includes("audio/dialogues/"), "3 MB of dialogue audio must not block install");
});

test("every track has a level, and the list covers all three", () => {
  for (const d of DIALOGUES) assert.ok(["1", "1+", "2"].includes(d.level), `${d.id}: level ${d.level}`);
  assert.deepEqual(DIALOGUE_LEVELS.map(([lv]) => lv), ["1", "1+", "2"]);
  for (const [lv] of DIALOGUE_LEVELS) assert.ok(DIALOGUES.some(d => d.level === lv), "no track at level " + lv);
});

test("the workbook's questions are well formed and every key is gradable", () => {
  let n = 0;
  for (const d of DIALOGUES) for (const q of d.questions || []) {
    n++;
    assert.ok(q.prompt && q.answer != null && q.answer !== "", `${d.id} Q${q.n}: incomplete`);
    if (q.type === "mc") {
      const keys = q.options.map(([k]) => k);
      assert.ok(keys.length >= 2 && keys.every(Boolean), `${d.id} Q${q.n}: options`);
      assert.ok(keys.some(k => dialogueGrade(q, k)), `${d.id} Q${q.n}: key ${q.answer} is not an option`);
      assert.equal(keys.filter(k => dialogueGrade(q, k)).length, 1, `${d.id} Q${q.n}: more than one option matches`);
    }
    if (q.type === "tf") assert.match(q.answer, /^[TF]$/, `${d.id} Q${q.n}`);
    if (q.note) assert.match(q.note, /^The workbook's key may not match/, `${d.id} Q${q.n}: only key doubts reach learners`);
  }
  assert.ok(n > 200, "the question set went missing: " + n);
});

test("grading compares the learner's choice with the workbook key, and abstains without one", () => {
  const mc = { type: "mc", answer: "b", options: [["a", "x"], ["b", "y"]] };
  assert.equal(dialogueGrade(mc, "b"), true);
  assert.equal(dialogueGrade(mc, "B"), true);
  assert.equal(dialogueGrade(mc, "a"), false);
  assert.equal(dialogueGrade({ type: "tf", answer: "F" }, "F"), true);
  assert.equal(dialogueGrade({ type: "mc", answer: null }, "a"), null);
  assert.equal(dialogueGrade(mc, null), null);
});

test("military and operational tracks stay out", () => {
  for (const id of ["wb2-t7", "wb2-t51", "wb1-t42", "wb1-t20"]) {
    assert.ok(!DIALOGUES.some(d => d.id === id), id + " should be excluded");
  }
});
