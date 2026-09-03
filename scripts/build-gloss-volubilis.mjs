// Build web/js/gloss-vol.js — the gap-filler gloss layer, from Volubilis.
//
//   node scripts/build-gloss-volubilis.mjs <VOLUBILIS Duo Max ENG.xlsx>
//
// SOURCE: Volubilis multilingual Thai dictionary by Francis "Belisan" —
// https://belisan-volubilis.blogspot.com/ — licensed CC BY-SA 4.0. The .xlsx
// is a download, not checked in, exactly like the kaikki dump build-gloss.mjs
// wants. Get "VOLUBILIS Duo Max ENG.xlsx" (Thai-English, ~105k entries) from
// the SourceForge link on that page.
//
// WHY THIS SITS BELOW WIKTIONARY (measured 2026-09-03, docs/chrome-extension-
// handoff.md): Volubilis covers 3,595 of the 4,470 words no layer can gloss —
// 80% of the gap — but its FIRST row for a spelling is often a homograph
// rather than the common word. มา row 0 is "moon", not "come"; เขา is
// "mountain", not "he"; ดี is "gallbladder". Taking row 0 blindly disagreed
// with our existing glosses on 1,460 headwords. So this layer only ever fills
// gaps, and never overwrites a gloss another layer already has.
//
// ROW SELECTION is the real work. A headword can have many rows; which one is
// right is a word-sense problem we cannot solve from spelling alone. Two
// tactics, both honest about their limits:
//   1. If another layer already glosses the word, pick the Volubilis row that
//      OVERLAPS it — that rescues ที่ (best-of-6 "who; which; that"), ของ,
//      มา. But such a word is already glossed, so we write nothing: this only
//      matters for the homograph list below.
//   2. Otherwise take the rows as they come and, when a word has genuinely
//      distinct senses, KEEP MORE THAN ONE and let the reader choose. The card
//      shows "he/she · mountain" rather than silently picking. Same principle
//      as toneOfWord abstaining on multi-syllable words: where the data cannot
//      prove one answer, say so instead of guessing.
//
// The romanisation column is DELIBERATELY DISCARDED. Volubilis uses its own
// macron scheme and 97% of its monosyllabic entries carry no tone mark at all
// (4,814 of 4,941 checked; only 18 of the marked ones agreed with our tone
// engine). Romanisation keeps coming from thai-script.js and the Wiktionary
// Paiboon layer.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-gloss-volubilis.mjs <VOLUBILIS Duo Max ENG.xlsx>");
  process.exit(2);
}
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = ROOT + "web/js/gloss-vol.js";
const MAXLEN = 64;          // a hover card, not a dictionary page
const MAXSENSES = 3;        // homograph disclosure, not a sense dump
const MAXLINE = 90;         // the joined line, so three senses cannot run to 165

// ── what we already know, so we can skip it ────────────────────────────────
for (const f of ["data.js", "tokeniser.js", "lexicon-th.js", "segment.js",
                 "gloss-th.js", "gloss-extra.js", "gloss.js"])
  vm.runInThisContext(readFileSync(ROOT + "web/js/" + f, "utf8"), { filename: f });
globalThis.WORD_MAP = Object.fromEntries(WORDS.map(w => [w[0], w]));
_segLoad(() => {});
_glossLoad(() => {});

// ── read the workbook ──────────────────────────────────────────────────────
// No spreadsheet dependency: .xlsx is a zip of XML, and we need three columns.
const dir = mkdtempSync(join(tmpdir(), "vol-"));
try {
  execFileSync("unzip", ["-o", "-q", src, "-d", dir]);
  const strings = [];
  for (const m of readFileSync(dir + "/xl/sharedStrings.xml", "utf8").matchAll(/<si>(.*?)<\/si>/gs))
    strings.push([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(x => x[1]).join(""));
  const un = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

  // A = romanisation (discarded), D = Thai, E = English, F = part of speech.
  const rows = new Map();          // thai -> [{en, pos}]
  for (const rm of readFileSync(dir + "/xl/worksheets/sheet1.xml", "utf8").matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const c = {};
    for (const m of rm[1].matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>(.*?)<\/v>|<is><t[^>]*>(.*?)<\/t><\/is>)?<\/c>/gs))
      c[m[1]] = un(m[4] != null ? m[4] : (m[2] === "s" && m[3] ? strings[+m[3]] : (m[3] || "")));
    const th = (c.D || "").trim(), en = (c.E || "").trim(), pos = (c.F || "").trim();
    if (!th || !en || !/^[฀-๿\s]+$/.test(th)) continue;   // Thai script only, no romanised headwords
    if (!rows.has(th)) rows.set(th, []);
    rows.get(th).push({ en, pos });
  }

  // ── tidy one sense list ──────────────────────────────────────────────────
  // Volubilis is "; "-separated and often long: 2,947 entries carry more than
  // five senses and the longest is 239 characters.
  const BAD = /^\s*$|^\[?(lat\.|obs\.|arch\.)/i;
  // Two typos in the source itself ("nclude" for "include"), carried through
  // faithfully by everything upstream. Repaired here rather than shipped.
  const SRC_TYPO = [[/^nclude\b/, "include"], [/^ncluding\b/, "including"]];
  function clean(en) {
    let parts = en.split(/\s*;\s*/).map(s => s.trim())
      .filter(s => s && !BAD.test(s))
      .map(s => s.replace(/\s*\((lat\.|pl\.|sg\.)[^)]*\)/gi, "").trim())
      .map(s => { for (const [re, to] of SRC_TYPO) s = s.replace(re, to); return s; })
      .filter(Boolean);
    // de-duplicate case-insensitively, keeping order
    const seen = new Set();
    parts = parts.filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    let out = parts.join("; ");
    if (out.length > MAXLEN) {
      const at = out.lastIndexOf("; ", MAXLEN);
      out = at > 12 ? out.slice(0, at) : out.slice(0, MAXLEN - 1).replace(/\s+\S*$/, "") + "…";
    }
    // never end mid-parenthesis
    if ((out.split("(").length - 1) > (out.split(")").length - 1))
      out = out.slice(0, out.lastIndexOf("(")).replace(/[\s.;:,…]+$/, "").trim();
    return out.replace(/[.;:,]+$/, "").trim();
  }

  // Do two rows mean the same thing? Content-word containment, same measure the
  // cross-reference used — so "buy" and "buy; purchase" are one sense, and
  // "he/she" and "mountain" are two.
  const STOP = new Set("a an the to be of for and or in on at is was that this it its as by with from into sth sb one".split(" "));
  const bag = s => new Set(s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9\s;,/]/g, " ").split(/[;,/\s]+/).filter(w => w && !STOP.has(w) && w.length > 2));
  function same(a, b) {
    const A = bag(a), B = bag(b);
    if (!A.size || !B.size) return false;
    let hit = 0; for (const w of A) if (B.has(w)) hit++;
    return hit / Math.min(A.size, B.size) >= 0.5;
  }

  // ── build ────────────────────────────────────────────────────────────────
  const lex = THAI_LEXICON.split("\n").filter(Boolean);
  const out = [];
  let filled = 0, multi = 0, skippedKnown = 0, noRows = 0;
  for (const w of lex) {
    if (thaiGloss(w)) { skippedKnown++; continue; }        // never overwrite a known gloss
    const rs = rows.get(w);
    if (!rs) { noRows++; continue; }
    // distinct senses, in sheet order, capped — this is the disclosure
    const senses = [];
    for (const r of rs) {
      const c = clean(r.en);
      if (!c) continue;
      if (senses.some(s => same(s.en, c))) continue;
      senses.push({ en: c, pos: r.pos });
      if (senses.length >= MAXSENSES) break;
    }
    if (!senses.length) continue;
    // MAXLEN caps each sense; the joined line needs its own cap or three of
    // them reach 165 characters, which is a paragraph in a hover card. Drop
    // whole senses from the end rather than cutting one mid-phrase — a
    // truncated sense reads as a different meaning.
    while (senses.length > 1 && senses.map(s => s.en).join(" · ").length > MAXLINE) senses.pop();
    filled++;
    if (senses.length > 1) multi++;
    // "en" carries the senses joined by " · ", which the card renders as-is.
    out.push([w, senses.map(s => s.en).join(" · ")]);
  }

  const body = out.map(([w, en]) => `${w}\t${en}`).join("\n");
  writeFileSync(OUT, `// AUTO-GENERATED by scripts/build-gloss-volubilis.mjs — do not edit by hand.
//
// The GAP-FILLER gloss layer: words no other layer can gloss at all. Consulted
// last (gloss.js), so it can never overwrite a gloss we already have — which
// matters because this dictionary's first row for a spelling is often a
// homograph (มา "moon", เขา "mountain", ดี "gallbladder"). See
// docs/chrome-extension-handoff.md for the measurement behind that ordering.
//
// ${out.length} words, ${multi} of them carrying more than one distinct sense,
// separated by " · ". Where a word has genuinely different meanings this
// SHOWS them rather than picking one: the reader has the sentence and can
// choose, and a card that says "he/she · mountain" is honest where one that
// silently picks is not.
//
// Rows are: word TAB gloss. No romanisation — Volubilis uses its own macron
// scheme and 97% of its monosyllabic entries carry no tone mark, so taking it
// would contradict the tone this app derives and displays. Romanisation stays
// with thai-script.js and the Wiktionary layer.
//
// ── LICENCE ────────────────────────────────────────────────────────────────
// Derived from VOLUBILIS Multilingual Thai Dictionary & Database by Belisan,
//   https://belisan-volubilis.blogspot.com/
// licensed CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
// THIS FILE is therefore also CC BY-SA 4.0, and any redistribution must keep
// this notice. The app credits Volubilis wherever these glosses are shown.
// Kept separate from gloss-th.js (Wiktionary, CC BY-SA 3.0) so each notice
// stays exactly true of its own file and the two databases are never merged.
//
// Loaded LAZILY by gloss.js, and not in the service worker's PRECACHE.

var GLOSS_VOL = ${JSON.stringify(body)};
`);
  console.log(`wrote ${OUT}`);
  console.log(`  lexicon ${lex.length} | already glossed ${skippedKnown} | no Volubilis row ${noRows}`);
  console.log(`  filled ${filled} gaps (${multi} with more than one sense shown)`);
  console.log(`  remaining gap: ${lex.length - skippedKnown - filled}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
