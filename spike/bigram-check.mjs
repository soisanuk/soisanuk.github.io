// Measure a bigram term in segmentThai against a hand-segmented corpus.
//
//   node spike/bigram-check.mjs <train.txt> <test.txt>
//
// Takes VISTEC-TP-TH-2021's train and test splits (CC BY-SA 3.0, a download,
// not checked in — see scripts/build-seg-phrases.mjs for where). Builds bigram
// counts from TRAIN, sets segment.js's _segBigram hook, and scores the REAL
// segmentThai on TEST at a sweep of weights. Nothing is copied: the hook is
// the whole point, because a copied DP measured against the wrong baseline
// once already (84.33 where the real function scores 93.75).
//
// Result as of 2026-09-06: +0.09 F1 at best, for a 2.4 MB table. Not shipped.
// The numbers are in web/js/segment.js above _segBigram and in
// docs/segmentation.md. Re-run this if a larger or broader corpus turns up.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const [train, test] = process.argv.slice(2);
if (!train || !test) { console.error("usage: node spike/bigram-check.mjs <train.txt> <test.txt>"); process.exit(2); }
const ROOT = new URL("..", import.meta.url).pathname;
for (const f of ["data.js", "thai-script.js", "tokeniser.js", "lexicon-th.js", "seg-extra.js", "seg-phrases.js", "segment.js"])
  vm.runInThisContext(readFileSync(ROOT + "web/js/" + f, "utf8"), { filename: f });
_segLoad(() => {});

const clean = s => s.replace(/<msp value="[^"]*">(.*?)<\/msp>/g, "$1").replace(/<\/?ne>/g, "").replace(/<\/?compound>/g, "");
const THAI = /^[฀-๿]+$/;
const UNI = new Map(), BI = new Map();
for (const line of readFileSync(train, "utf8").split("\n")) {
  if (!line) continue;
  let prev = null;
  for (const t of clean(line).split("|").filter(Boolean)) {
    if (!THAI.test(t)) { prev = null; continue; }
    UNI.set(t, (UNI.get(t) || 0) + 1);
    if (prev) { const k = prev + "\t" + t; BI.set(k, (BI.get(k) || 0) + 1); }
    prev = t;
  }
}
const bset = t => { const s = new Set(); let p = 0; for (const x of t) { p += x.length; s.add(p); } s.delete(p); return s; };
const gold = readFileSync(test, "utf8").split("\n").filter(Boolean).map(l => clean(l).split("|").filter(t => t !== ""));
function score() {
  let tp = 0, fp = 0, fn = 0, ex = 0;
  for (const g of gold) {
    const text = g.join(""); if (!text) continue;
    const pred = segmentThai(text).map(t => t.text); if (pred.join("") !== text) continue;
    const G = bset(g), P = bset(pred);
    for (const b of P) (G.has(b) ? tp++ : fp++); for (const b of G) if (!P.has(b)) fn++;
    if (G.size === P.size && [...G].every(b => P.has(b))) ex++;
  }
  const pr = tp / (tp + fp), rc = tp / (tp + fn); return { pr, rc, f1: 2 * pr * rc / (pr + rc), ex };
}
const hook = (gamma, delta, T, min) => ({ gamma: 1, count: (a, b) => {
  const k = BI.get(a + "\t" + b) || 0;
  if (k >= min) return Math.exp(gamma * Math.log(1 + k)) - 1;
  const ca = UNI.get(a) || 0;
  return (delta && ca >= T) ? Math.exp(-delta * Math.log(1 + ca)) - 1 : 0;
} });
const row = (label, r) => console.log(`  ${label.padEnd(26)} P ${(r.pr*100).toFixed(2)}  R ${(r.rc*100).toFixed(2)}  F1 ${(r.f1*100).toFixed(2)}  exact ${r.ex}`);
console.log(`bigrams from train: ${BI.size} distinct over ${[...BI.values()].reduce((a, b) => a + b, 0)} pairs`);
_segBigram = null; row("unigram (today)", score());
for (const [g, d, T] of [[0.5, 0, 0], [1, 0, 0], [0.5, 0.5, 200], [0.5, 1, 200], [0, 0.5, 200]]) {
  _segBigram = hook(g, d, T, 3); row(`bonus ${g} penalty ${d} T ${T}`, score());
}
_segBigram = null;
