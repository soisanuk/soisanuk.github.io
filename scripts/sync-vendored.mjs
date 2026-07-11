#!/usr/bin/env node
// Sync the files The Last Baht Bus vendors from this trainer.
//
// This repo is the source of truth for the shared Thai stack (data, examples,
// tokeniser, thai-script, wordcard) and the wordcard test. LBB carries copies.
// Before, the copies were kept in sync by hand — one stale file could ship
// silently, and the "VENDORED" banner was on some copies but not others. This
// script is the single, idempotent sync: it writes each copy with the banner,
// so an LBB copy can never be mistaken for an editable original.
//
//   node scripts/sync-vendored.mjs           # write the copies into LBB
//   node scripts/sync-vendored.mjs --check   # verify they match; exit 1 on drift
//
// Point at a different LBB checkout with `--dest <dir>` or `LBB_DIR=<dir>`.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const destArg = args.indexOf("--dest");
const DEST_ROOT = destArg >= 0 ? args[destArg + 1]
  : process.env.LBB_DIR || "/Users/mario/last-baht-bus";

// Path is relative to both repo roots; each copy is banner + source, verbatim.
const FILES = [
  "web/js/data.js",
  "web/js/examples.js",
  "web/js/tokeniser.js",
  "web/js/thai-script.js",
  "web/js/wordcard.js",
  "tests/js/wordcard.test.js",
];

const banner = rel =>
  `// VENDORED from the Soi Sanuk trainer (soisanuk.github.io ${rel}) —\n` +
  `// source of truth lives there; edit there and re-copy. Do not fork.\n`;

let drift = 0, wrote = 0;
for (const rel of FILES) {
  const want = banner(rel) + readFileSync(join(SRC_ROOT, rel), "utf8");
  const dest = join(DEST_ROOT, rel);
  if (check) {
    const have = existsSync(dest) ? readFileSync(dest, "utf8") : "";
    if (have === want) { console.log(`ok     ${rel}`); }
    else { drift++; console.error(`DRIFT  ${rel}`); }
  } else {
    writeFileSync(dest, want);
    wrote++;
    console.log(`wrote  ${rel}`);
  }
}

if (check && drift) {
  console.error(`\n${drift} vendored file(s) out of sync — run: node scripts/sync-vendored.mjs`);
  process.exit(1);
}
console.log(check ? "\nAll vendored files in sync." : `\nSynced ${wrote} file(s) → ${DEST_ROOT}`);
