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
// Romanisation is deliberately NOT extracted even though kaikki carries it:
// Wiktionary's romanisation style differs from the app's RTGS, and showing
// the two side by side on the same card would read as inconsistent.
//
// Usage:
//   node scripts/build-gloss.mjs <kaikki.org-dictionary-Thai.jsonl>

import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const MAXLEN = 58;   // one line on a phone-width card

// Senses we don't want as a learner's first answer. Wiktionary tags these.
const SKIP_TAGS = new Set(["archaic", "obsolete", "dated", "rare", "derogatory",
  "slang", "vulgar", "offensive", "misspelling", "alt-of", "form-of",
  "abbreviation", "initialism"]);
// Entry types that aren't words.
const SKIP_POS = new Set(["character", "romanization", "syllable", "punct", "symbol", "num"]);

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

const rows = [];
for (const w of lex) {
  const g = glossFor(w);
  if (g && !w.includes("\t") && !g.includes("\t")) rows.push(w + "\t" + g);
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
  if (r.split("\t").length !== 2) { console.error(`ESCAPING BUG: malformed row ${JSON.stringify(r)}`); process.exit(1); }
}
console.log(`wrote web/js/gloss-th.js — ${rows.length}/${lex.length} words glossed (${pct}%), round-trip ok`);
