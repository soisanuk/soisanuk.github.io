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
//    file that's DIFFERENT from web/ (or present in the target but no longer
//    in web/ — a rename/delete orphan) before it ships in a build instead of
//    after. Capacitor's own runtime shims (cordova.js, cordova_plugins.js)
//    are the only files in the target this never touches; write mode
//    deletes every other orphan, matching what `npx cap copy` would do by
//    regenerating the tree from scratch.
//
//   node scripts/sync-vendored.mjs           # write both jobs
//   node scripts/sync-vendored.mjs --check   # verify everything; exit 1 on drift
//   node scripts/sync-vendored.mjs --no-cap  # skip job 2 (e.g. testing --dest
//                                             # against a scratch LBB checkout,
//                                             # without touching your real
//                                             # android/.../public or ios/.../public)
//
// `--dest <dir>` / LBB_DIR retarget ONLY the LBB job (job 1) — job 2 always
// writes into this same repo's android/ios trees regardless; pass --no-cap
// alongside --dest if you don't want that side effect.

import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const noCap = args.includes("--no-cap");
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

const CORDOVA_SHIMS = new Set(["cordova.js", "cordova_plugins.js"]);
const webRoot = join(SRC_ROOT, "web");
const webFiles = walkFiles(webRoot);

if (!noCap) for (const target of CAP_TARGETS) {
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

  // orphans: files in the target with no web/ source (a rename/delete this
  // mirror wouldn't otherwise catch), minus Capacitor's own runtime shims
  const webSet = new Set(webFiles);
  const orphans = walkFiles(targetRoot).filter(rel => !webSet.has(rel) && !CORDOVA_SHIMS.has(rel));
  for (const rel of orphans) {
    const label = `${target}/${rel}`;
    if (check) { drift++; console.error(`ORPHAN ${label}  (no matching file in web/)`); }
    else { unlinkSync(join(targetRoot, rel)); wrote++; console.log(`removed ${label}`); }
  }
}

if (check && drift) {
  console.error(`\n${drift} file(s) out of sync — run: node scripts/sync-vendored.mjs`);
  process.exit(1);
}
console.log(check ? "\nAll vendored/synced files in sync." : `\nSynced ${wrote} file(s).`);
