// Convert the DLI Thai SOLT listening-workbook tracks behind web/js/dialogues.js
// into web/audio/dialogues/<id>.mp3: mono, 48 kbps, loudness-normalised so one
// dialogue is not twice as loud as the next. The tracks are whole recordings,
// so nothing is cut. Each DIALOGUES entry names its source folder and file.
//
//   node scripts/convert-dialogue-audio.mjs "<…/Thai-SOLT>"
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import vm from "node:vm";

const root = process.argv[2];
if (!root) {
  console.error('usage: node scripts/convert-dialogue-audio.mjs "<path to the Thai-SOLT folder>"');
  process.exit(2);
}
const WEB = new URL("../web/", import.meta.url).pathname;
vm.runInThisContext(readFileSync(WEB + "js/dialogues.js", "utf8"));
const DIALOGUES = vm.runInThisContext("DIALOGUES"), dialogueAudioSrc = vm.runInThisContext("dialogueAudioSrc");

mkdirSync(WEB + "audio/dialogues", { recursive: true });
for (const d of DIALOGUES) {
  const src = `${root}/${d.folder}/${d.file}`;
  if (!existsSync(src)) throw new Error(`${d.id}: missing ${src}`);
  // -v fatal: every track ends with a harmless "non monotonically increasing
  // dts" warning from the MP3 muxer (the last packet after resampling)
  execFileSync("ffmpeg", ["-v", "fatal", "-y", "-i", src, "-ac", "1",
    // loudnorm evens out the level between tracks, but on clips this short
    // it does not hold the true-peak target, and peaks hit 0 dBFS after MP3
    // encoding. The limiter caps them at about -3 dBFS. It runs after the
    // resample back from loudnorm's internal 192 kHz, which can itself
    // overshoot.
    "-af", "loudnorm=I=-18:TP=-1.5:LRA=11,aresample=44100,alimiter=limit=0.7:level=false",
    "-codec:a", "libmp3lame", "-b:a", "48k",
    WEB + dialogueAudioSrc(d)]);
}
console.log(`wrote ${DIALOGUES.length} recordings to web/audio/dialogues/`);
