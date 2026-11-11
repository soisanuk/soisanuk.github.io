// Tests for web/js/letter-audio.js: which speak() requests get the native
// consonant recording, and that every recording the app can ask for exists.
// Run with: node --test tests/js/

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "thai-script.js", "letter-audio.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
const WEB = new URL("../../web/", import.meta.url);

test("every consonant in the course has a recording, and there are no strays", () => {
  const cons = CONSONANTS.map(r => r[0]).sort().join("");
  assert.equal([...LETTER_CLIPS].sort().join(""), cons);
  for (const ch of LETTER_CLIPS) {
    const src = letterClipSrc(letterSpeechParts(ch));
    assert.ok(existsSync(new URL(src, WEB)), `${ch}: ${src} is missing`);
  }
  const files = readdirSync(new URL("audio/letters/", WEB)).filter(f => f.endsWith(".mp3"));
  assert.equal(files.length, 42);
});

test("the recording answers exactly a letter's sound and name", () => {
  assert.equal(letterClipSrc(letterSpeechParts("ก")), "audio/letters/0E01.mp3");
  assert.equal(letterClipSrc(letterSpeechParts("ฮ")), "audio/letters/0E2E.mp3");
  // learn.js joins the parts with a space before speaking
  assert.equal(letterClipSrc(letterSpeechParts("ข").join(" ")), "audio/letters/0E02.mp3");
});

test("words, bare letters, vowels and sentences still go to text-to-speech", () => {
  assert.equal(letterClipSrc("ไก่"), null);
  assert.equal(letterClipSrc("ก"), null, "a bare letter is not a request for its name");
  assert.equal(letterClipSrc("ก็"), null);
  assert.equal(letterClipSrc(letterSpeechParts("◌า")), null);
  assert.equal(letterClipSrc(["ก", "ไก่ตัวนี้"]), null);
  assert.equal(letterClipSrc([]), null);
});

test("every recording is in the service worker's precache", () => {
  const sw = readFileSync(new URL("sw.js", WEB), "utf8");
  for (const ch of LETTER_CLIPS) {
    assert.ok(sw.includes(`"./${letterClipSrc(letterSpeechParts(ch))}"`), `${ch} not precached`);
  }
  assert.ok(sw.includes('"./js/letter-audio.js"'));
});
