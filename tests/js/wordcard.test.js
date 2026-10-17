// Tests for the shared word-card modal's pure helpers in web/js/wordcard.js —
// the HTML escaper, the lazy WORD_MAP fallback, and the script-tooltip HTML
// builder. wordcard.js is the SOURCE OF TRUTH vendored into The Last Baht Bus,
// so these guard the contract both apps rely on. The DOM-driven entry points
// (openWordModal/showExample/renderDecomposition) aren't exercised here; they
// need a live document. The file is DOM-guarded at load, so node:vm can
// evaluate it exactly as it ships.
// Run with: node --test tests/js/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// data.js gives WORDS/CONSONANTS/VOWELS; thai-script.js gives _thaiCharKind,
// which the tooltip builder classifies characters with.
for (const f of ["data.js", "thai-script.js", "wordcard.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}

test("_wcEsc escapes every HTML-significant character", () => {
  assert.equal(_wcEsc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(_wcEsc("plain"), "plain");
  assert.equal(_wcEsc(42), "42", "coerces non-strings");
});

test("_wcMap falls back to a WORDS index when the host has no WORD_MAP", () => {
  // In the vm there is no WORD_MAP global, so _wcMap builds one over WORDS.
  const map = _wcMap();
  const first = WORDS[0];
  assert.deepEqual(map[first[0]], first, "keyed by the Thai headword");
  assert.equal(map[WORDS[0][0]], _wcMap()[WORDS[0][0]], "cached across calls");
});

test("_scriptTooltipHtml describes a consonant with name, class and romanisation", () => {
  const html = _scriptTooltipHtml("ก");
  assert.match(html, /ไก่/, "consonant name");
  assert.match(html, /mid class/, "consonant class label");
  assert.match(html, /\/k\//, "romanisation");
});

test("_scriptTooltipHtml describes a vowel with its sound", () => {
  const html = _scriptTooltipHtml("า");
  assert.match(html, /Vowel:/);
  assert.match(html, /Sound:.*aa/s);
});

test("_scriptTooltipHtml names tone marks", () => {
  assert.match(_scriptTooltipHtml("่"), /mai ek/, "mai ek");
  assert.match(_scriptTooltipHtml("๋"), /mai jattawa/, "mai jattawa");
});

test("_scriptTooltipHtml falls back to a codepoint for non-Thai input", () => {
  assert.match(_scriptTooltipHtml("A"), /U\+0041/);
});

// Round 27 (Dao): การันต์ was painted with the tone-mark border. renderDecomposition
// built the class inline as `"decomp-char is-" + (kind === "diac" ? "tone" : kind)`,
// because index.html defined no .is-diac rule and the alternative was an unstyled
// span — so a mark whose whole job is to SILENCE the letter beneath it was dressed
// as a tone. The tooltip was always correct ("Silences the letter beneath it"); only
// the border lied.
//
// _wcCharClass exists so this is checkable at all: renderDecomposition needs a live
// document, which this file deliberately does not have.
test("_wcCharClass gives each mark its own kind, and never calls a silencer a tone", () => {
  assert.equal(_wcCharClass("์"), "decomp-char is-diac", "การันต์ ์");
  assert.equal(_wcCharClass("ํ"), "decomp-char is-diac", "นิคหิต ํ");
  assert.equal(_wcCharClass("่"), "decomp-char is-tone", "ไม้เอก ่");
  assert.equal(_wcCharClass("ก"), "decomp-char is-cons", "ก");
  assert.equal(_wcCharClass("เ"), "decomp-char is-vowel", "เ");
  assert.equal(_wcCharClass("ิ"), "decomp-char is-vowel", "ิ");
  assert.equal(_wcCharClass("A"), "decomp-char is-other", "non-Thai");
});

// Guards the test above: every assertion there would also pass if _wcCharClass
// returned a constant per call site, or if _thaiCharKind collapsed its buckets.
test("the five kinds are actually distinct", () => {
  const kinds = new Set(["ก", "เ", "่", "์", "A"].map(_wcCharClass));
  assert.equal(kinds.size, 5, `expected five distinct classes, got ${[...kinds].join(", ")}`);
});
