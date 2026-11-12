// Level check for cut clips. A recording can be correct and still useless in
// practice: a Lingua Libre take of ห้า at -28 dB mean played back on a phone
// speaker as "hmm" (2026-11-12). Every clip the cut scripts write passes
// through here; anything softer than MIN_MEAN, or peaking above MAX_PEAK, is
// reported so it is fixed or dropped before the owner's listen-through.
// Uses volumedetect, not EBU R128 integrated loudness: that needs 400 ms of
// audio and reports -70 for a short word like ปิด.
import { spawnSync } from "node:child_process";

export const MIN_MEAN = -26, MAX_PEAK = -0.3;

export function levels(path) {
  const log = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" }).stderr;
  const num = re => { const m = re.exec(log); return m ? +m[1] : null; };
  return { mean: num(/mean_volume: (-?[\d.]+) dB/), peak: num(/max_volume: (-?[\d.]+) dB/) };
}

// Returns a list of "<label>: <problem>" strings; empty means every clip is fine.
export function checkLevels(clips) {
  const out = [];
  for (const [label, path] of clips) {
    const { mean, peak } = levels(path);
    if (mean == null) out.push(`${label}: could not measure`);
    else if (mean < MIN_MEAN) out.push(`${label}: too soft (mean ${mean} dB, floor ${MIN_MEAN})`);
    else if (peak > MAX_PEAK) out.push(`${label}: clips (peak ${peak} dB)`);
  }
  return out;
}
