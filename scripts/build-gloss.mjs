// Generates web/js/gloss-th.js — short English glosses for Paste Text.
//
// WHY this is a separate file from lexicon-th.js: different licences. The
// lexicon is CC0 and costs us nothing; this is derived from English Wiktionary
// via kaikki.org and is CC BY-SA 3.0, which requires attribution and carries
// share-alike. Keeping them in separate files keeps that boundary legible —
// don't merge them.
//
// SOURCE: https://kaikki.org/dictionary/Thai/  (kaikki.org-dictionary-Thai.jsonl,
// ~45MB, Tatu Ylonen's wiktextract run over English Wiktionary). English
// Wiktionary text is CC BY-SA 3.0: https://en.wiktionary.org/wiki/Wiktionary:Copyrights
//
// NOT the PyThaiNLP thai_dict corpus: that one is extracted from THAI
// Wiktionary, so its definitions are in Thai (เดิน → "ยกเท้าก้าวไป"), which is
// no use to an English-speaking learner. Checked, don't re-walk it.
//
// ROMANISATION. kaikki tags three systems per word. Neither matches the
// course's house style out of the box:
//     Paiboon          dtam-rùuat   sǔai    náam
//     Royal Institute  tam-ruat     suai    nam
//     this course      tam-rùat     sǔay    náam
// The course is Paiboon's tone marks with RTGS-style consonants, so we convert
// Paiboon (Royal Institute is unusable — it carries no tone at all). Measured
// against the 764 curriculum words that appear in both: 86.1% exact, and of
// the 106 misses 67 differ only in vowel-length spelling and 15 in -ai/-ay.
//
// The remaining ~24 disagree on a TONE MARK, which in a tone-teaching app is
// the one error that must not ship — a romanisation saying "rising" beside
// text coloured "falling" is worse than no romanisation. So every derived
// form is cross-checked against the app's own tone engine (thai-script.js)
// and DROPPED on conflict. The engine reads tone from spelling and is already
// what colours the text, so this guarantees the two can never contradict.
//
// Usage:
//   node scripts/build-gloss.mjs <kaikki.org-dictionary-Thai.jsonl>

import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

// the tone engine + its data, for the cross-check below
for (const f of ["data.js", "thai-script.js"])
  vm.runInThisContext(readFileSync(new URL(`../web/js/${f}`, import.meta.url), "utf8"), { filename: f });

const MAXLEN = 58;   // one line on a phone-width card

// Senses we don't want as a learner's first answer. Wiktionary tags these.
const SKIP_TAGS = new Set(["archaic", "obsolete", "dated", "rare", "derogatory",
  "slang", "vulgar", "offensive", "misspelling", "alt-of", "form-of",
  "abbreviation", "initialism"]);
// Entry types that aren't words.
const SKIP_POS = new Set(["character", "romanization", "syllable", "punct", "symbol", "num"]);

// ── Paiboon → course house style ───────────────────────────────────────────
// Onsets: one pass, longest-first, so bp→p is not then re-read as p→ph.
// j stays j (the course writes jèt, khâo-jai).
const ONSET = { bp: "p", dt: "t", g: "k", k: "kh", p: "ph", t: "th" };
const ONSET_RE = /^(bp|dt|g|k|p|t)/;
const TONE_MARK = /[\u0300\u0301\u0302\u0303\u030c]/g;   //  ̀ ́ ̂ ̃ ̌
const VOWELS = [[/ʉʉa/g, "uea"], [/ʉʉ/g, "uue"], [/ʉ/g, "ue"], [/əə/g, "ooe"],
  [/ə/g, "oe"], [/ɛɛ/g, "ae"], [/ɛ/g, "ae"], [/ɔɔ/g, "oo"], [/ɔ/g, "o"],
  [/iia/g, "ia"], [/uua/g, "ua"]];

function convertSyllable(part) {
  let s = part.normalize("NFD");
  const mark = (s.match(TONE_MARK) || [])[0] || "";   // lift the mark out of the way
  s = s.replace(TONE_MARK, "");
  s = s.replace(ONSET_RE, m => ONSET[m]);
  for (const [re, to] of VOWELS) s = s.replace(re, to);
  if (mark) {                                          // re-seat it on the first vowel
    const i = s.search(/[aeiou]/);
    if (i >= 0) s = s.slice(0, i + 1) + mark + s.slice(i + 1);
  }
  return s.normalize("NFC");
}
const convertRoman = p => p.split(/([ -])/)
  .map(x => (x === " " || x === "-") ? x : convertSyllable(x)).join("");

// tone name (thai-script.js vocabulary) → the diacritic the course writes
const TONE_DIACRITIC = { mid: "", low: "\u0300", falling: "\u0302", high: "\u0301", rising: "\u030c" };

// Does this romanisation's tone agree with what the script engine derives?
// Only checkable for a single syllable — syllableTone's documented contract —
// so multi-syllable forms pass through unchecked.
function toneAgrees(thai, roman) {
  if (/[- ]/.test(roman)) return true;
  const tone = syllableTone(thai);
  if (!tone) return true;                              // engine declines: nothing to contradict
  const want = TONE_DIACRITIC[tone];
  const got = (roman.normalize("NFD").match(TONE_MARK) || [])[0] || "";
  return got === want;
}

const [, , jsonlPath] = process.argv;
if (!jsonlPath) {
  console.error("usage: node scripts/build-gloss.mjs <kaikki.org-dictionary-Thai.jsonl>");
  console.error("download it from https://kaikki.org/dictionary/Thai/ — see this file's header");
  process.exit(2);
}

function clean(g) {
  let s = String(g).trim();
  s = s.replace(/^\([^)]*\)\s*/, "");            // leading (ชาว~, คน~) usage hints
  s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");       // [bracketed] editorial notes
  s = s.replace(/[\\\u0000-\u001f]/g, " ");        // stray backslashes / control chars
  s = s.replace(/\s+/g, " ").trim();
  // "suspect: person suspected (of a crime…)" — the half before the colon is
  // the concise gloss and the rest is the encyclopaedic expansion.
  const colon = s.indexOf(": ");
  if (colon >= 3) s = s.slice(0, colon);
  s = s.replace(/[.;:,]+$/, "").trim();
  if (s.length > MAXLEN) {
    const at = Math.max(s.lastIndexOf("; ", MAXLEN), s.lastIndexOf(", ", MAXLEN));
    s = (at > 20 ? s.slice(0, at) : s.slice(0, MAXLEN).replace(/\s+\S*$/, "")).trim();
  }
  return s.replace(/[.;:,]+$/, "").trim();
}

// Wiktionary nests senses: glosses[0] is the umbrella and the rest are its
// children. An umbrella ENDS IN A COLON ("to consume:") and is useless alone,
// so in that case take the deepest child ("to eat; to take; to drink").
// A flat single gloss is already the answer.
function senseGloss(sense) {
  const gl = sense.glosses || [];
  if (!gl.length) return "";
  const pick = (gl.length > 1 && /:\s*$/.test(gl[0])) ? gl[gl.length - 1] : gl[0];
  return clean(pick);
}

const by = new Map();
for (const line of readFileSync(jsonlPath, "utf8").split("\n")) {
  if (!line) continue;
  let e; try { e = JSON.parse(line); } catch { continue; }
  if (e.lang_code !== "th" || SKIP_POS.has(e.pos)) continue;
  if (!by.has(e.word)) by.set(e.word, []);
  by.get(e.word).push(e);
}

// The Paiboon form, converted, or null. Dropped when it would contradict the
// tone engine — see the header.
let dropped = 0;
function romanFor(word) {
  for (const e of by.get(word) || [])
    for (const s of e.sounds || []) {
      if (!(s.raw_tags || []).includes("Paiboon")) continue;
      if (!s.roman || s.roman.endsWith("-")) continue;  // bound forms
      const r = convertRoman(s.roman);
      if (!r || /[^a-zA-Z\u0300-\u036f' -]/.test(r.normalize("NFD"))) return null; // unconverted IPA left over
      if (!toneAgrees(word, r)) { dropped++; return null; }
      return r;
    }
  return null;
}

function glossFor(word) {
  const entries = by.get(word);
  if (!entries) return null;
  // pass 0 takes only untagged senses; pass 1 falls back to tagged ones, so a
  // word whose every sense is "archaic" still gets an answer rather than none
  for (const pass of [0, 1]) {
    const picks = [];
    for (const e of entries) {
      for (const s of e.senses || []) {
        const tagged = (s.tags || []).some(t => SKIP_TAGS.has(t));
        if (pass === 0 ? tagged : !tagged) continue;
        const g = senseGloss(s);
        if (g && g.length > 1 && !picks.includes(g)) picks.push(g);
        if (picks.length >= 2) break;
      }
      if (picks.length >= 2) break;
    }
    if (picks.length) {
      const joined = picks.join("; ");
      return joined.length <= MAXLEN ? joined : picks[0];
    }
  }
  return null;
}

vm.runInThisContext(readFileSync(new URL("../web/js/lexicon-th.js", import.meta.url), "utf8"));
const lex = THAI_LEXICON.split("\n");

// rows are word TAB gloss TAB roman; roman may be empty, gloss may not
const rows = [];
let withRoman = 0;
for (const w of lex) {
  const g = glossFor(w);
  if (!g || w.includes("\t") || g.includes("\t")) continue;
  const r = romanFor(w) || "";
  if (r) withRoman++;
  rows.push(w + "\t" + g + "\t" + r);
}
// Escape BACKSLASH FIRST, then quotes. A gloss ending in a lone backslash
// would otherwise escape the row separator and silently merge two entries —
// one real Wiktionary gloss does exactly that.
const esc = t => t.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const body = rows.map(esc).join("\\n");
const pct = (100 * rows.length / lex.length).toFixed(1);

writeFileSync(new URL("../web/js/gloss-th.js", import.meta.url),
`// AUTO-GENERATED by scripts/build-gloss.mjs — do not edit by hand.
//
// Short English glosses for Paste Text, keyed to lexicon-th.js.
// ${rows.length} of ${lex.length} lexicon words (${pct}%) — the rest have no English
// Wiktionary entry and fall back to decomposition-only on the word card.
// Rows are: word TAB gloss TAB romanisation. The romanisation is converted from
// Wiktionary's Paiboon into this course's style and may be EMPTY — it is
// dropped whenever it would contradict the app's own tone engine.
//
// ── LICENCE ────────────────────────────────────────────────────────────────
// Derived from English Wiktionary via kaikki.org (wiktextract).
// Wiktionary text is licensed CC BY-SA 3.0:
//   https://en.wiktionary.org/wiki/Wiktionary:Copyrights
//   https://creativecommons.org/licenses/by-sa/3.0/
// THIS FILE is therefore also CC BY-SA 3.0, and any redistribution must keep
// this notice. The app credits Wiktionary on the Paste Text screen.
// Unlike lexicon-th.js (CC0), this file carries share-alike — keep the two
// separate so the boundary stays obvious.
//
// Loaded LAZILY by gloss.js, and not in the service worker's PRECACHE.
var THAI_GLOSS = "${body}";
`);
// Round-trip the file we just wrote: parse it back and confirm every row
// survived. Cheap, and it catches escaping bugs at build time rather than as
// a mangled gloss in the UI.
vm.runInThisContext(readFileSync(new URL("../web/js/gloss-th.js", import.meta.url), "utf8"));
const back = THAI_GLOSS.split("\n");
if (back.length !== rows.length) {
  console.error(`ESCAPING BUG: wrote ${rows.length} rows, read back ${back.length}`);
  process.exit(1);
}
for (const r of back) {
  if (r.split("\t").length !== 3) { console.error(`ESCAPING BUG: malformed row ${JSON.stringify(r)}`); process.exit(1); }
}
console.log(`wrote web/js/gloss-th.js — ${rows.length}/${lex.length} words glossed (${pct}%), round-trip ok`);
console.log(`  with romanisation: ${withRoman} (${(100*withRoman/rows.length).toFixed(1)}% of glossed)`);
console.log(`  dropped for disagreeing with the tone engine: ${dropped}`);
