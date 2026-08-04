#!/usr/bin/env node
// Two sync jobs live here, both idempotent and both checkable:
//
// 1. VENDORED FILES — the shared Thai stack (data, examples, tokeniser,
//    thai-script, wordcard) + the wordcard test, copied into The Last Baht
//    Bus (a separate repo) with a banner so a copy can never be mistaken for
//    an editable original. This repo is the source of truth; LBB carries
//    copies.
//
// 2. CAPACITOR NATIVE TREES — android/app/src/main/assets/public and
//    ios/App/App/public are Capacitor's packaged copies of the ENTIRE web/
//    directory (this is the same app, not a fork — no banner, straight
//    mirror). `npx cap copy` regenerates them from web/, but that's a step a
//    native build can forget; syncing them here means `--check` catches a
//    file that's DIFFERENT from web/ before it ships in a build instead of
//    after. Capacitor's own runtime shims (cordova.js, cordova_plugins.js)
//    live only in the target and are never touched — this only ever writes
//    files that exist in web/. Known gap: it's a one-way mirror, so a file
//    DELETED from web/ is never removed from the target and --check won't
//    flag the leftover — `npx cap copy` (which regenerates the whole tree)
//    is the only way to fully prune. Run it occasionally, or after a rename.
//
//   node scripts/sync-vendored.mjs           # write both jobs
//   node scripts/sync-vendored.mjs --check   # verify everything; exit 1 on drift
//
// `--dest <dir>` / LBB_DIR retarget ONLY the LBB job (job 1) — the Capacitor
// mirror (job 2) always writes into this same repo's android/ios trees and
// ignores both. Testing sync-vendored against a scratch LBB checkout with
// --dest still touches your real android/.../public and ios/.../public.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const destArg = args.indexOf("--dest");
const LBB_ROOT = destArg >= 0 ? args[destArg + 1]
  : process.env.LBB_DIR || "/Users/mario/projects/last-baht-bus";

let drift = 0, wrote = 0;

// ── 1. Vendored files → LBB ─────────────────────────────────────────────────
const VENDORED_FILES = [
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

for (const rel of VENDORED_FILES) {
  const want = banner(rel) + readFileSync(join(SRC_ROOT, rel), "utf8");
  const dest = join(LBB_ROOT, rel);
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

// ── 2. web/ → Capacitor native trees (this repo, no banner) ────────────────
const CAP_TARGETS = [
  "android/app/src/main/assets/public",
  "ios/App/App/public",
];

function walkFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, base));
    else out.push(relative(base, full));
  }
  return out;
}

const webRoot = join(SRC_ROOT, "web");
const webFiles = walkFiles(webRoot);

for (const target of CAP_TARGETS) {
  const targetRoot = join(SRC_ROOT, target);
  if (!existsSync(targetRoot)) continue; // native project not checked out here — skip, not an error
  for (const rel of webFiles) {
    const src = join(webRoot, rel);
    const dest = join(targetRoot, rel);
    const label = `${target}/${rel}`;
    if (check) {
      const want = readFileSync(src);
      const have = existsSync(dest) ? readFileSync(dest) : null;
      if (have && have.equals(want)) { console.log(`ok     ${label}`); }
      else { drift++; console.error(`DRIFT  ${label}`); }
    } else {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, readFileSync(src));
      wrote++;
      console.log(`wrote  ${label}`);
    }
  }
}

if (check && drift) {
  console.error(`\n${drift} file(s) out of sync — run: node scripts/sync-vendored.mjs`);
  process.exit(1);
}
console.log(check ? "\nAll vendored/synced files in sync." : `\nSynced ${wrote} file(s).`);
