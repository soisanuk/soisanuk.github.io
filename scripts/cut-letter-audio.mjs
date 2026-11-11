// Cut the 42 consonant clips (each letter, then its name: "ก … ไก่") out of
// the DLI Thai SOLT I listening workbook, Module 1 Lesson 1, Track 1.
// Native-speaker audio for the one thing device text-to-speech does worst:
// a single letter read on its own.
//
// SOURCE: "Thai L Workbook 2 Audio M1-6/01 Track 1.wma" from the DLI Thai
// SOLT course (the folder named Workbook 2 holds Modules 1-3). Its script is
// in "Audio WB 1-3_Instr_Feb03Final.pdf", p.2: the letters are read by class,
// high, mid, then low, and each class is announced first. See PROVENANCE.md.
//
// The boundaries below were found with ffmpeg silencedetect (-40 dB, 0.12 s),
// with the pauses inside an item merged. They split the track into 45 items:
// 3 class announcements, then the 10 + 9 + 23 letters in the script's order.
// The longer gaps sit exactly where the announcements are, so the count and
// the structure confirm each other. They are kept as data so a rebuild cannot
// drift with a different silence threshold.
//
//   node scripts/cut-letter-audio.mjs "<path to 01 Track 1.wma>"   # → web/audio/letters/
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/cut-letter-audio.mjs "<…/Thai L Workbook 2 Audio M1-6/01 Track 1.wma>"');
  process.exit(2);
}
const OUT = new URL("../web/audio/letters/", import.meta.url).pathname;

// [start, end] of each speech item, in seconds.
const HIGH = "ขฉฐถผฝศษสห", MID = "กจฎฏดตบปอ", LOW = "คฆงชซฌญฑฒณทธนพฟภมยรลวฬฮ";
const ITEMS = [
  ["(อักษรสูง)", 0.00, 1.65],
  ["ข", 2.55, 3.64], ["ฉ", 4.61, 5.92], ["ฐ", 7.00, 8.26], ["ถ", 9.30, 10.34],
  ["ผ", 11.50, 12.62], ["ฝ", 13.61, 14.97], ["ศ", 15.88, 17.22], ["ษ", 18.07, 19.38],
  ["ส", 20.31, 21.65], ["ห", 22.66, 23.82],
  ["(อักษรกลาง)", 25.29, 26.68],
  ["ก", 28.00, 29.04], ["จ", 30.03, 31.27], ["ฎ", 32.20, 33.41], ["ฏ", 34.21, 35.09],
  ["ด", 36.29, 37.02], ["ต", 38.30, 39.26], ["บ", 40.11, 41.32], ["ป", 42.19, 43.26],
  ["อ", 44.13, 45.14],
  ["(อักษรต่ำ)", 46.50, 47.57],
  ["ค", 48.93, 50.13], ["ฆ", 50.83, 52.09], ["ง", 53.10, 54.34], ["ช", 55.25, 56.52],
  ["ซ", 57.41, 58.61], ["ฌ", 59.60, 60.88], ["ญ", 61.74, 62.96], ["ฑ", 63.84, 65.12],
  ["ฒ", 66.05, 67.35], ["ณ", 68.21, 69.43], ["ท", 70.43, 71.69], ["ธ", 72.65, 73.80],
  ["น", 74.72, 75.89], ["พ", 76.75, 78.07], ["ฟ", 78.98, 80.27], ["ภ", 81.16, 82.46],
  ["ม", 83.36, 84.63], ["ย", 85.23, 86.17], ["ร", 87.33, 88.53], ["ล", 89.27, 90.60],
  ["ว", 91.32, 92.71], ["ฬ", 93.30, 94.65], ["ฮ", 95.19, 96.11],
];

const letters = ITEMS.filter(([k]) => !k.startsWith("("));
const order = letters.map(([k]) => k).join("");
if (order !== HIGH + MID + LOW) throw new Error("item order no longer matches the audio script: " + order);

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".mp3")) rmSync(OUT + f);

for (const [ch, a, b] of letters) {
  // 80 ms lead-in, 150 ms tail: never into the neighbouring item, whose gap is ≥ 0.5 s.
  const ss = Math.max(0, a - 0.08), to = b + 0.15;
  const name = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0") + ".mp3";
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "44100",
    // The cut happens INSIDE the filter chain (atrim, then asetpts to restart
    // the clock at 0). With -ss/-to as output options, ffmpeg filters the
    // whole track and trims afterwards, so the fade-out lands 1 s into the
    // track and every clip comes out silent.
    // The track peaks at 0 dBFS, which clips after MP3 encoding, so take 3 dB
    // off. The fades stop edge clicks.
    "-af", `atrim=start=${ss.toFixed(2)}:end=${to.toFixed(2)},asetpts=PTS-STARTPTS,volume=-3dB,` +
      `afade=t=in:d=0.02,afade=t=out:st=${(to - ss - 0.04).toFixed(2)}:d=0.04`,
    "-codec:a", "libmp3lame", "-b:a", "64k", OUT + name]);
}
console.log(`wrote ${letters.length} clips to web/audio/letters/`);
