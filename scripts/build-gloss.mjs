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
// against the 739 curriculum words that appear in both: 88.5% exact, and of
// the 85 misses 67 differ only in vowel-length spelling and 13 in -ai/-ay.
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
  "abbreviation", "initialism", "historical"]);
// When every sense of a word is skip-tagged we have to use one anyway — but
// then the tag is the most important thing on the card, not something to
// discard. Stripping it is how กู/มึง ended up reading as neutral pronouns and
// กรุงเทพ as a defunct kingdom with no hint it was the historical sense.
const SHOW_TAGS = ["vulgar", "offensive", "derogatory", "slang", "historical",
  "archaic", "obsolete", "dated", "colloquial", "formal", "poetic"];
// Senses that just point at another Thai word are useless to a learner — they
// redirect to a word they also don't know, often in a romanisation scheme this
// app doesn't use. Better no gloss than a redirect.
const REDIRECT = /^(alternative|archaic|obsolete|dated|nonstandard|informal) (form|spelling) of\b|^abstract noun of\b|^clipping of\b|^initialism of\b|^abbreviation of\b/i;
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

// Thai's final-consonant inventory is closed: -k -t -p -m -n -ng -w -y, or an
// open syllable. A written ส/ซ/ศ/ษ/จ/ช/ด/ต/ธ final is realised [t], ล/ฬ/ร/ญ/ณ
// as [n], ฟ/ภ/พ/ป as [p]. Wiktionary's Paiboon keeps the foreign spelling for
// loanwords, giving โพสต์ "phóos" and อีเมล "ii-meel" — pronunciations no Thai
// speaker produces. The curriculum already writes the Thai realisation
// (เชฟ chêep, เสิร์ฟ sòoep), so map to it rather than drop the romanisation.
const FINAL_FIX = { s: "t", d: "t", j: "t", z: "t", l: "n", r: "n", f: "p", b: "p", v: "p", g: "k", c: "k" };
function legaliseFinals(roman) {
  return roman.split(/([ -])/).map(syl => {
    if (syl === " " || syl === "-") return syl;
    const d = syl.normalize("NFD");
    const m = d.match(/^(.*?)([a-z])(\p{M}*)$/u);
    if (!m) return syl;
    const [, head, last, marks] = m;
    if (/ng$/.test(head + last) || !FINAL_FIX[last]) return syl;
    // a vowel letter before it means this really is a final consonant
    if (!/[aeiou]\p{M}*$/u.test(head)) return syl;
    return (head + FINAL_FIX[last] + marks).normalize("NFC");
  }).join("");
}

// Where English Wiktionary orders senses etymologically, the first sense can be
// a Pali/Sanskrit source meaning or a historical one, and the everyday meaning
// never appears within the two senses we keep. There is no signal in the data
// to fix that generically, so these are stated outright. Every one was checked
// individually — see docs/persona-playtests.md, the 2026-08-30 reader round.
const OVERRIDES = {
  "กรุงเทพ": "Bangkok", "โลก": "world; the earth", "สัญญา": "contract; promise; agreement",
  "วิจัย": "research", "ยก": "to lift; to raise", "บาง": "some; thin",
  "กี่": "how many; how much", "ทฤษฎี": "theory", "พิมพ์": "to print; to type",
  "ภาค": "part; region; sector", "แจ้ง": "to inform; to notify",
  "แต่ง": "to dress; to decorate; to compose", "เมีย": "wife (informal)",
  "เกษตร": "agriculture", "พระเจ้า": "God; king", "นิยม": "to like; to be popular",
  "ปรับ": "to adjust; to fine", "ศูนย์": "zero; centre", "ขาด": "to be torn; to lack; to be absent",
  "จับ": "to catch; to hold; to arrest", "หาก": "if", "รอง": "to support; deputy, vice-",
  "ได้แก่": "namely; that is", "ไอ้": "(familiar) male prefix, rude to a stranger",
  "กู": "(vulgar) I, me", "มึง": "(vulgar) you",
};

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
  // Parenthetical asides carrying Thai script or raw IPA/Paiboon letters:
  // "abstract noun of รู้สึก (rúu-sʉ̀k)". The Thai is unreadable to someone who
  // needed the gloss, and the bp-/dt-/g- spellings are the very scheme the app
  // documents as never appearing in front of a learner.
  s = s.replace(/\s*\([^)]*[฀-๿ɛɔʉə][^)]*\)/g, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[.;:,]+$/, "").trim();
  if (s.length > MAXLEN) {
    // Only NOW is it worth losing information. "suspect: person suspected (of a
    // crime…)" keeps its concise half; but "a first person pronoun: I" is short
    // enough to keep whole, and cutting it there is what left กู glossed as a
    // grammatical category instead of "I".
    const colon = s.indexOf(": ");
    if (colon >= 3 && colon <= MAXLEN) s = s.slice(0, colon);
  }
  if (s.length > MAXLEN) {
    const at = Math.max(s.lastIndexOf("; ", MAXLEN), s.lastIndexOf(", ", MAXLEN));
    s = at > 20 ? s.slice(0, at)
                : s.slice(0, MAXLEN - 1).replace(/\s+\S*$/, "") + "\u2026";  // …
  }
  s = s.replace(/[.;:,]+$/, "").trim();
  // Never end mid-parenthesis: drop the dangling fragment rather than print
  // "public (of, relating to; public".
  if ((s.split("(").length - 1) > (s.split(")").length - 1)) {
    s = s.slice(0, s.lastIndexOf("(")).replace(/[\s.;:,\u2026]+$/, "").trim();
  }
  return s;
}

// Wiktionary nests senses: glosses[0] is the umbrella and the rest are its
// children. An umbrella ENDS IN A COLON ("to consume:") and is useless alone,
// so in that case take the deepest child ("to eat; to take; to drink").
// A flat single gloss is already the answer.
// Applied to the FINAL joined gloss. Per-sense filtering is not enough: a
// single Wiktionary sense can read "dragon; alternative form of มกร", and two
// senses joined with "; " can carry a redirect in the second half. Drop the
// offending clause, keep the rest.
const BAD_CLAUSE = /^(alternative|archaic|obsolete|dated|nonstandard|informal) (form|spelling) of\b|^(synonym|variant|clipping|abbreviation|initialism|abstract noun) of\b|^used in\b|^used to (form|precede)\b|[฀-๿]|\b(bp|dt)[aeiouāîí]|\bg[aeiou]{2}/i;
function finalise(text) {
  let out = String(text).split(";").map(c => c.trim()).filter(c => c && !BAD_CLAUSE.test(c)).join("; ");
  out = out.replace(/[.;:,]+$/, "").trim();
  // never end mid-parenthesis
  if ((out.split("(").length - 1) > (out.split(")").length - 1)) {
    out = out.slice(0, out.lastIndexOf("(")).replace(/[\s.;:,\u2026]+$/, "").trim();
  }
  if (out.length > MAXLEN) {
    const at = Math.max(out.lastIndexOf("; ", MAXLEN), out.lastIndexOf(", ", MAXLEN));
    out = at > 20 ? out.slice(0, at)
                  : out.slice(0, MAXLEN - 1).replace(/\s+\S*$/, "") + "\u2026";
    if ((out.split("(").length - 1) > (out.split(")").length - 1)) {
      out = out.slice(0, out.lastIndexOf("(")).replace(/[\s.;:,\u2026]+$/, "").trim();
    }
  }
  return out.replace(/[.;:,]+$/, "").trim();
}

function senseGloss(sense) {
  const gl = sense.glosses || [];
  if (!gl.length) return "";
  const pick = (gl.length > 1 && /:\s*$/.test(gl[0])) ? gl[gl.length - 1] : gl[0];
  if (REDIRECT.test(String(pick).trim())) return "";
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
      const r = legaliseFinals(convertRoman(s.roman));
      if (!r || /[^a-zA-Z\u0300-\u036f' -]/.test(r.normalize("NFD"))) return null; // unconverted IPA left over
      if (!toneAgrees(word, r)) { dropped++; return null; }
      return r;
    }
  return null;
}

function glossFor(word) {
  if (OVERRIDES[word]) return OVERRIDES[word];
  const entries = by.get(word);
  if (!entries) return null;
  // pass 0 takes only untagged senses; pass 1 falls back to tagged ones, so a
  // word whose every sense is "archaic" still gets an answer rather than none
  for (const pass of [0, 1]) {
    const picks = [];
    let tagLabel = "";
    for (const e of entries) {
      for (const s of e.senses || []) {
        const tags = s.tags || [];
        const tagged = tags.some(t => SKIP_TAGS.has(t));
        if (pass === 0 ? tagged : !tagged) continue;
        if (pass === 1 && !tagLabel) tagLabel = SHOW_TAGS.find(t => tags.includes(t)) || "";
        const g = senseGloss(s);
        if (g && g.length > 1 && !picks.includes(g)) picks.push(g);
        if (picks.length >= 2) break;
      }
      if (picks.length >= 2) break;
    }
    if (picks.length) {
      const joined = picks.join("; ");
      const body = finalise(joined.length <= MAXLEN ? joined : picks[0]);
      if (!body || body.length < 2) continue;      // nothing usable survived
      // pass 1 means every sense was skip-tagged; say so rather than present a
      // vulgar or historical sense as if it were the neutral everyday one.
      // Re-finalise so the prefix counts against the card's one-line budget.
      return (pass === 1 && tagLabel) ? finalise(`(${tagLabel}) ${body}`) : body;
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
