// Shared by the export scripts (export-grammar.mjs, export-listening.mjs):
// load the app's classic-script sources into this Node realm, initialise the
// segmenter and gloss tables, and split Thai into tokens the way the graded
// reader does. One copy, so the two exports cannot drift apart in how they
// tokenise, romanise or gloss.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import vm from "node:vm";

export const ROOT = new URL("../..", import.meta.url).pathname;

// Load order matters only for the gloss and segmenter tables, which are
// initialised below rather than at load.
for (const f of ["data.js", "examples.js", "thai-script.js", "tokeniser.js", "wordcard.js",
                 "curriculum.js", "lexicon-th.js", "seg-extra.js", "seg-phrases.js", "segment.js",
                 "gloss-extra.js", "gloss.js", "gloss-th.js", "gloss-vol.js", "grammar.js", "dialogues.js"]) {
  vm.runInThisContext(readFileSync(ROOT + "web/js/" + f, "utf8"), { filename: f });
}
export const g = s => vm.runInThisContext(s);
g("_segInit(_segEffective(THAI_LEXICON.split('\\n'))); _glossInit(THAI_GLOSS); _volInit(GLOSS_VOL);");

const WORDS = g("WORDS"), segmentThai = g("segmentThai");
const thaiGloss = g("thaiGloss"), thaiRoman = g("thaiRoman"), glossSource = g("glossSource");
const course = new Map(WORDS.map(w => [w[0], w]));

export function tokens(thai) {
  return segmentThai(thai).filter(t => t.text.trim()).map(t => {
    const key = t.base || t.text;
    const w = course.get(key);
    return {
      text: t.text,
      key,
      course: !!w,
      roman: w ? w[1] : (thaiRoman(key) || null),
      gloss: w ? w[2] : (thaiGloss(key) || null),
      glossSource: glossSource(key),
    };
  });
}

// Write `out` as JSON to export/<name>, or with --check fail when the file
// on disk differs. Deterministic callers only: no timestamps.
export function writeOrCheck(name, out, summary) {
  const path = ROOT + "export/" + name;
  const json = JSON.stringify(out, null, 1) + "\n";
  if (process.argv.includes("--check")) {
    const cur = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (cur !== json) {
      console.error(`export/${name} is out of date — run: node scripts/${name.replace(".json", "").replace(/^/, "export-")}.mjs`);
      process.exit(1);
    }
    console.log(`export/${name} in sync (${summary})`);
  } else {
    mkdirSync(ROOT + "export", { recursive: true });
    writeFileSync(path, json);
    console.log(`wrote export/${name} — ${summary}`);
  }
}
