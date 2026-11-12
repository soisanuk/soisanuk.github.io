// Cut native recordings of course words out of the DLIFLC Thai Language
// Survival Guides (Basic and Naval, 2008) into web/audio/words/<codepoints>.mp3.
// Every guide entry is one MP3: the English, a 1 s pause, the Thai, a pause,
// the Thai again more slowly. The pauses are digital silence, so the parts
// split cleanly. We keep the first Thai part, at natural speed.
//
// Only course words whose guide entry is EXACTLY that word are used (the
// table below, made by matching the guides' Thai against WORDS). A file that
// does not split into exactly three parts is skipped and reported, never
// guessed at. The words that got a clip are written into letter-audio.js
// (WORD_CLIPS), which is what the app reads.
//
// SOURCE: DLIFLC "Thai Basic" and "Thai Naval" Language Survival Guides, May
// 2008, and their MP3s (folders th_bc_audio and th_nv_audio). The guides say
// DLIFLC produced them. See PROVENANCE.md.
//
//   node scripts/cut-word-audio.mjs "<dir holding th_bc_audio and th_nv_audio>"
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { checkLevels } from "./lib/audio-check.mjs";

// Imported by export-audio.mjs for CLIPS alone; cut only when run directly.
const MAIN = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
const root = process.argv[2];
if (MAIN && !root) { console.error('usage: node scripts/cut-word-audio.mjs "<…/Downloads>"'); process.exit(2); }
const WEB = new URL("../web/", import.meta.url).pathname;
const OUT = WEB + "audio/words/";
const DIR = { bc: "th_bc_audio", nv: "th_nv_audio" };

// Words the owner has listened to and cleared. Only these are cut and shipped;
// the rest wait for their listen-through. null means every word in CLIPS.
export const CLEARED = new Set(["หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า", "สิบ"]);

// [course word, guide, file]
// Left out because the recording does not say the printed word (the
// guide's own transliteration gives it away): กี่ (says กี่อัน, "gee an") and
// เรือ (ranks chapter, says เรือโท, "ruwa taw").
export const CLIPS = [
  ["ไป", "bc", "en_th_bc_01_40.mp3"],
  ["เปิด", "bc", "en_th_bc_01_42.mp3"],
  ["ปิด", "bc", "en_th_bc_01_43.mp3"],
  ["ระวัง", "bc", "en_th_bc_01_44.mp3"],
  ["วาง", "bc", "en_th_bc_01_50.mp3"],
  ["เอา", "bc", "en_th_bc_01_51.mp3"],
  ["กรุณา", "bc", "en_th_bc_02_01.mp3"],
  ["ขอบคุณ", "bc", "en_th_bc_02_02.mp3"],
  ["ครับ", "bc", "en_th_bc_02_06.mp3"],
  ["บางที", "bc", "en_th_bc_02_08.mp3"],
  ["ใคร", "bc", "en_th_bc_02_22.mp3"],
  ["อะไร", "bc", "en_th_bc_02_23.mp3"],
  ["ที่ไหน", "bc", "en_th_bc_02_25.mp3"],
  ["ทำไม", "bc", "en_th_bc_02_26.mp3"],
  ["อย่างไร", "bc", "en_th_bc_02_27.mp3"],
  ["สวัสดี", "bc", "en_th_bc_03_02.mp3"],
  ["หนึ่ง", "bc", "en_th_bc_05_02.mp3"],
  ["สอง", "bc", "en_th_bc_05_03.mp3"],
  ["สาม", "bc", "en_th_bc_05_04.mp3"],
  ["สี่", "bc", "en_th_bc_05_05.mp3"],
  ["ห้า", "bc", "en_th_bc_05_06.mp3"],
  ["หก", "bc", "en_th_bc_05_07.mp3"],
  ["เจ็ด", "bc", "en_th_bc_05_08.mp3"],
  ["แปด", "bc", "en_th_bc_05_09.mp3"],
  ["เก้า", "bc", "en_th_bc_05_10.mp3"],
  ["สิบ", "bc", "en_th_bc_05_11.mp3"],
  ["ประมาณ", "bc", "en_th_bc_05_38.mp3"],
  ["วันอาทิตย์", "bc", "en_th_bc_06_01.mp3"],
  ["วันจันทร์", "bc", "en_th_bc_06_02.mp3"],
  ["วันอังคาร", "bc", "en_th_bc_06_03.mp3"],
  ["วันพุธ", "bc", "en_th_bc_06_04.mp3"],
  ["วันศุกร์", "bc", "en_th_bc_06_06.mp3"],
  ["วันเสาร์", "bc", "en_th_bc_06_07.mp3"],
  ["วันนี้", "bc", "en_th_bc_06_09.mp3"],
  ["กลางวัน", "bc", "en_th_bc_06_11.mp3"],
  ["กลางคืน", "bc", "en_th_bc_06_12.mp3"],
  ["เดือน", "bc", "en_th_bc_06_14.mp3"],
  ["ปี", "bc", "en_th_bc_06_15.mp3"],
  ["ชั่วโมง", "bc", "en_th_bc_06_18.mp3"],
  ["ระหว่าง", "bc", "en_th_bc_07_05.mp3"],
  ["องศา", "bc", "en_th_bc_07_07.mp3"],
  ["ไกล", "bc", "en_th_bc_07_10.mp3"],
  ["ใกล้", "bc", "en_th_bc_07_15.mp3"],
  ["สะพาน", "bc", "en_th_bc_08_03.mp3"],
  ["ป่า", "bc", "en_th_bc_08_06.mp3"],
  ["บ้าน", "bc", "en_th_bc_08_09.mp3"],
  ["ภูเขา", "bc", "en_th_bc_08_12.mp3"],
  ["แม่น้ำ", "bc", "en_th_bc_08_18.mp3"],
  ["ถนน", "bc", "en_th_bc_08_19.mp3"],
  ["ทะเล", "bc", "en_th_bc_08_20.mp3"],
  ["ตลาด", "bc", "en_th_bc_08_21.mp3"],
  ["ต้นไม้", "bc", "en_th_bc_08_22.mp3"],
  ["หมู่บ้าน", "bc", "en_th_bc_08_24.mp3"],
  ["สีดำ", "bc", "en_th_bc_09_01.mp3"],
  ["สีน้ำเงิน", "bc", "en_th_bc_09_02.mp3"],
  ["สีน้ำตาล", "bc", "en_th_bc_09_03.mp3"],
  ["สีเทา", "bc", "en_th_bc_09_04.mp3"],
  ["สีเขียว", "bc", "en_th_bc_09_05.mp3"],
  ["สีส้ม", "bc", "en_th_bc_09_06.mp3"],
  ["สีม่วง", "bc", "en_th_bc_09_07.mp3"],
  ["สีแดง", "bc", "en_th_bc_09_08.mp3"],
  ["สีขาว", "bc", "en_th_bc_09_09.mp3"],
  ["สีเหลือง", "bc", "en_th_bc_09_10.mp3"],
  ["ใหญ่", "bc", "en_th_bc_09_11.mp3"],
  ["ยาว", "bc", "en_th_bc_09_13.mp3"],
  ["เตี้ย", "bc", "en_th_bc_09_15.mp3"],
  ["สั้น", "bc", "en_th_bc_09_16.mp3"],
  ["สูง", "bc", "en_th_bc_09_18.mp3"],
  ["ตรง", "bc", "en_th_bc_09_23.mp3"],
  ["สด", "bc", "en_th_bc_09_27.mp3"],
  ["เค็ม", "bc", "en_th_bc_09_28.mp3"],
  ["เปรี้ยว", "bc", "en_th_bc_09_29.mp3"],
  ["หวาน", "bc", "en_th_bc_09_31.mp3"],
  ["ไม่ดี", "bc", "en_th_bc_09_32.mp3"],
  ["สะอาด", "bc", "en_th_bc_09_33.mp3"],
  ["ยาก", "bc", "en_th_bc_09_35.mp3"],
  ["สกปรก", "bc", "en_th_bc_09_36.mp3"],
  ["ง่าย", "bc", "en_th_bc_09_38.mp3"],
  ["แพง", "bc", "en_th_bc_09_40.mp3"],
  ["เร็ว", "bc", "en_th_bc_09_41.mp3"],
  ["ต่างประเทศ", "bc", "en_th_bc_09_42.mp3"],
  ["เต็ม", "bc", "en_th_bc_09_43.mp3"],
  ["ดี", "bc", "en_th_bc_09_44.mp3"],
  ["หนัก", "bc", "en_th_bc_09_46.mp3"],
  ["แสงสว่าง", "bc", "en_th_bc_09_48.mp3"],
  ["เบา", "bc", "en_th_bc_09_49.mp3"],
  ["ใหม่", "bc", "en_th_bc_09_51.mp3"],
  ["เสียงดัง", "bc", "en_th_bc_09_52.mp3"],
  ["เก่า", "bc", "en_th_bc_09_53.mp3"],
  ["แก่", "bc", "en_th_bc_09_54.mp3"],
  ["เงียบ", "bc", "en_th_bc_09_56.mp3"],
  ["ถูกต้อง", "bc", "en_th_bc_09_57.mp3"],
  ["ช้า", "bc", "en_th_bc_09_58.mp3"],
  ["นุ่ม", "bc", "en_th_bc_09_59.mp3"],
  ["ส่วน", "bc", "en_th_bc_09_67.mp3"],
  ["ทั้งหมด", "bc", "en_th_bc_09_69.mp3"],
  ["อาหาร", "bc", "en_th_bc_11_01.mp3"],
  ["ถ้วย", "bc", "en_th_bc_11_03.mp3"],
  ["จาน", "bc", "en_th_bc_11_06.mp3"],
  ["เบียร์", "bc", "en_th_bc_11_09.mp3"],
  ["ขนมปัง", "bc", "en_th_bc_11_10.mp3"],
  ["กาแฟ", "bc", "en_th_bc_11_13.mp3"],
  ["ปลา", "bc", "en_th_bc_11_14.mp3"],
  ["ผลไม้", "bc", "en_th_bc_11_16.mp3"],
  ["นม", "bc", "en_th_bc_11_18.mp3"],
  ["น้ำมัน", "bc", "en_th_bc_11_19.mp3"],
  ["ข้าว", "bc", "en_th_bc_11_21.mp3"],
  ["ชา", "bc", "en_th_bc_11_25.mp3"],
  ["ผัก", "bc", "en_th_bc_11_26.mp3"],
  ["น้ำ", "bc", "en_th_bc_11_27.mp3"],
  ["เครื่องดื่ม", "bc", "en_th_bc_11_29.mp3"],
  ["กิน", "bc", "en_th_bc_11_30.mp3"],
  ["ผ้าพันแผล", "bc", "en_th_bc_13_02.mp3"],
  ["เลือด", "bc", "en_th_bc_13_03.mp3"],
  ["ตาย", "bc", "en_th_bc_13_06.mp3"],
  ["หมอ", "bc", "en_th_bc_13_07.mp3"],
  ["โรงพยาบาล", "bc", "en_th_bc_13_09.mp3"],
  ["ยา", "bc", "en_th_bc_13_14.mp3"],
  ["พยาบาล", "bc", "en_th_bc_13_15.mp3"],
  ["แขน", "bc", "en_th_bc_14_03.mp3"],
  ["กระดูก", "bc", "en_th_bc_14_04.mp3"],
  ["หน้าอก", "bc", "en_th_bc_14_06.mp3"],
  ["หู", "bc", "en_th_bc_14_07.mp3"],
  ["ตา", "bc", "en_th_bc_14_09.mp3"],
  ["หน้า", "bc", "en_th_bc_14_10.mp3"],
  ["นิ้ว", "bc", "en_th_bc_14_11.mp3"],
  ["เท้า", "bc", "en_th_bc_14_12.mp3"],
  ["ผม", "bc", "en_th_bc_14_13.mp3"],
  ["มือ", "bc", "en_th_bc_14_14.mp3"],
  ["หัว", "bc", "en_th_bc_14_15.mp3"],
  ["หัวใจ", "bc", "en_th_bc_14_16.mp3"],
  ["ขา", "bc", "en_th_bc_14_19.mp3"],
  ["ปาก", "bc", "en_th_bc_14_23.mp3"],
  ["คอ", "bc", "en_th_bc_14_24.mp3"],
  ["จมูก", "bc", "en_th_bc_14_25.mp3"],
  ["ฟัน", "bc", "en_th_bc_14_33.mp3"],
  ["นิ้วเท้า", "bc", "en_th_bc_14_34.mp3"],
  ["ลิ้น", "bc", "en_th_bc_14_35.mp3"],
  ["ทหาร", "bc", "en_th_bc_15_10.mp3"],
  ["หมอฟัน", "bc", "en_th_bc_17_07.mp3"],
  ["ตำรวจ", "bc", "en_th_bc_17_19.mp3"],
  ["นักธุรกิจ", "bc", "en_th_bc_17_21.mp3"],
  ["นักเรียน", "bc", "en_th_bc_17_24.mp3"],
  ["ครู", "bc", "en_th_bc_17_25.mp3"],
  ["แบบฟอร์ม", "bc", "en_th_bc_18_26.mp3"],
  ["ภาษาไทย", "bc", "en_th_bc_18_30.mp3"],
  ["เจ้าของ", "bc", "en_th_bc_18_38.mp3"],
  ["หนังสือเดินทาง", "bc", "en_th_bc_18_40.mp3"],
  ["อัตราแลกเปลี่ยน", "bc", "en_th_bc_18_47.mp3"],
  ["ตอบ", "bc", "en_th_bc_18_56.mp3"],
  ["เด็ก", "bc", "en_th_bc_19_03.mp3"],
  ["ลูกสาว", "bc", "en_th_bc_19_06.mp3"],
  ["ครอบครัว", "bc", "en_th_bc_19_07.mp3"],
  ["พ่อ", "bc", "en_th_bc_19_08.mp3"],
  ["สามี", "bc", "en_th_bc_19_11.mp3"],
  ["ผู้ชาย", "bc", "en_th_bc_19_12.mp3"],
  ["แม่", "bc", "en_th_bc_19_14.mp3"],
  ["ลูกชาย", "bc", "en_th_bc_19_17.mp3"],
  ["ภรรยา", "bc", "en_th_bc_19_19.mp3"],
  ["ผู้หญิง", "bc", "en_th_bc_19_20.mp3"],
  ["หนาว", "bc", "en_th_bc_20_01.mp3"],
  ["ร้อน", "bc", "en_th_bc_20_06.mp3"],
  ["ความชื้น", "bc", "en_th_bc_20_07.mp3"],
  ["น้ำแข็ง", "bc", "en_th_bc_20_08.mp3"],
  ["ฝน", "bc", "en_th_bc_20_10.mp3"],
  ["หิมะ", "bc", "en_th_bc_20_13.mp3"],
  ["พายุ", "bc", "en_th_bc_20_14.mp3"],
  ["อุณหภูมิ", "bc", "en_th_bc_20_15.mp3"],
  ["อากาศ", "bc", "en_th_bc_20_17.mp3"],
  ["รถยนต์", "bc", "en_th_bc_21_09.mp3"],
  ["กิโลเมตร", "bc", "en_th_bc_21_17.mp3"],
  ["เครื่องบิน", "bc", "en_th_bc_21_27.mp3"],
  ["มุม", "bc", "en_th_bc_22_01.mp3"],
  ["พูด", "nv", "en_th_nv_03_05.mp3"],
  ["ดื่ม", "nv", "en_th_nv_03_08.mp3"],
  ["หยุด", "nv", "en_th_nv_03_09.mp3"],
  ["นั่ง", "nv", "en_th_nv_04_48.mp3"],
  ["ยืน", "nv", "en_th_nv_04_49.mp3"],
  ["ตรงไป", "nv", "en_th_nv_12_03.mp3"],
  ["ก่อน", "nv", "en_th_nv_12_19.mp3"],
  ["ลง", "nv", "en_th_nv_12_23.mp3"],
  ["ตะวันออก", "nv", "en_th_nv_12_24.mp3"],
  ["ซ้าย", "nv", "en_th_nv_12_28.mp3"],
  ["เหนือ", "nv", "en_th_nv_12_32.mp3"],
  ["ผ่าน", "nv", "en_th_nv_12_36.mp3"],
  ["ขวา", "nv", "en_th_nv_12_37.mp3"],
  ["ใต้", "nv", "en_th_nv_12_38.mp3"],
  ["ขึ้น", "nv", "en_th_nv_12_43.mp3"],
  ["ตะวันตก", "nv", "en_th_nv_12_44.mp3"],
  ["เมื่อวาน", "nv", "en_th_nv_14_08.mp3"],
  ["วัน", "nv", "en_th_nv_14_11.mp3"],
  ["คืน", "nv", "en_th_nv_14_12.mp3"],
  ["สัปดาห์", "nv", "en_th_nv_14_13.mp3"],
];

export const clipName = th => [...th].map(c => c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join("") + ".mp3";

// The speech parts of a file, [[start, end], …], from ffmpeg silencedetect.
// The guides' pauses are digital silence of about 1 s, so -40 dB / 0.5 s
// finds exactly the gaps between English, Thai and slow Thai.
function parts(path) {
  const log = spawnSync("ffmpeg", ["-hide_banner", "-i", path, "-af", "silencedetect=noise=-40dB:d=0.5", "-f", "null", "-"],
    { encoding: "utf8" }).stderr;
  const dur = +(/Duration: (\d+):(\d+):([\d.]+)/.exec(log) || []).slice(1).reduce((t, v, i) => t + v * [3600, 60, 1][i], 0);
  const out = []; let cur = 0;
  for (const m of log.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === "start") { if (+m[2] - cur > 0.05) out.push([cur, +m[2]]); }
    else cur = +m[2];
  }
  if (dur - cur > 0.05 && !/silence_start: [\d.]+\s*$/.test(log.trim())) out.push([cur, dur]);
  return out;
}

if (MAIN) {
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".mp3")) rmSync(OUT + f);
const done = [], skipped = [];
for (const [th, src, file] of CLIPS) {
  if (CLEARED && !CLEARED.has(th)) continue;
  const path = `${root}/${DIR[src]}/${file}`;
  if (!existsSync(path)) { skipped.push(`${th} (${file}: missing)`); continue; }
  const r = parts(path);
  if (r.length !== 3) { skipped.push(`${th} (${file}: ${r.length} parts)`); continue; }
  const [a, b] = r[1];
  const ss = Math.max(0, a - 0.06), to = b + 0.12;
  execFileSync("ffmpeg", ["-v", "fatal", "-y", "-i", path, "-ac", "1",
    "-af", `atrim=start=${ss.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,` +
      `afade=t=in:d=0.015,afade=t=out:st=${(to - ss - 0.03).toFixed(3)}:d=0.03`,
    "-codec:a", "libmp3lame", "-b:a", "40k", OUT + clipName(th)]);
  done.push(th);
}

// keep the app's list in step with what was actually cut
const LA = WEB + "js/letter-audio.js";
const src = readFileSync(LA, "utf8").replace(/const WORD_CLIPS = [^\n]*\n/, `const WORD_CLIPS = new Set(${JSON.stringify(done.sort())});\n`);
writeFileSync(LA, src);
const bad = checkLevels(done.map(th => [th, OUT + clipName(th)]));
if (bad.length) { console.error("LEVEL CHECK:\n  " + bad.join("\n  ")); process.exitCode = 1; }
console.log(`wrote ${done.length} word clips to web/audio/words/; skipped ${skipped.length}: ${skipped.join(", ")}`);
}
