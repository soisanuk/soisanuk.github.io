// Backup / restore — the escape hatch for localStorage's fragility.
// Export packages both stores (SRS cards + course path) into one JSON file,
// preferring the native share sheet on mobile (AirDrop/Files) with download
// and clipboard fallbacks. Import takes a file or pasted JSON and MERGES:
// per SRS card the record with more reviews wins; course units stay done and
// keep their best accuracy. Pure merge logic up top (vm-testable, DOM-free).

function backupSnapshot() {
  return { app: "soisanuk", v: 1, at: new Date().toISOString(),
    progress: loadProgress(), path: (function () {
      try { return JSON.parse(localStorage.getItem(LEARN_KEY) || "{}"); }
      catch { return {}; } })() };
}

function backupMerge(mine, theirs) {
  const prog = { ...mine.progress };
  for (const [k, c] of Object.entries(theirs.progress || {})) {
    if (!prog[k] || (c.totalReviews || 0) > (prog[k].totalReviews || 0)) prog[k] = c;
  }
  const units = { ...((mine.path || {}).units || {}) };
  for (const [id, u] of Object.entries((theirs.path || {}).units || {})) {
    const cur = units[id];
    units[id] = !cur ? u : { done: cur.done || u.done,
      acc: Math.max(cur.acc || 0, u.acc || 0),
      msAvg: Math.min(cur.msAvg || 1e9, u.msAvg || 1e9) === 1e9 ? undefined : Math.min(cur.msAvg || 1e9, u.msAvg || 1e9) };
  }
  return { progress: prog, path: { units } };
}

function backupValid(d) {
  return d && d.app === "soisanuk" && typeof d.progress === "object";
}

function backupApply(theirs) {
  const merged = backupMerge(backupSnapshot(), theirs);
  saveProgress(merged.progress);
  localStorage.setItem(LEARN_KEY, JSON.stringify(merged.path));
  return Object.keys(merged.progress).length;
}

// ── UI (runtime only) ──
async function backupExport() {
  const text = JSON.stringify(backupSnapshot());
  const name = "soisanuk-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  const file = new File([text], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch {}
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
}
function backupCopy() {
  navigator.clipboard.writeText(JSON.stringify(backupSnapshot()))
    .then(() => alert("Backup copied — paste it somewhere safe."));
}
function backupImportFile(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  f.text().then(t => _backupRestoreText(t));
  input.value = "";
}
function backupImportPaste() {
  const t = document.getElementById("backup-paste").value;
  _backupRestoreText(t);
}
function _backupRestoreText(t) {
  try {
    const d = JSON.parse(t);
    if (!backupValid(d)) throw new Error("not a backup");
    const n = backupApply(d);
    alert("Merged — " + n + " cards on this device now. Done stays done; the better record won.");
  } catch (e) { alert("That doesn't look like a soisanuk backup."); }
}

// ask the browser not to evict us (iOS Safari's 7-day sweep, mainly)
function backupPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch {}
}

// Anki export — the standard TSV Anki's importer eats: front(Thai),
// back(roman + meaning + example), tags(pos/group). Whole deck, 900+ notes.
function ankiTSV(words, examples) {
  const esc = t => String(t || "").replace(/\t/g, " ").replace(/\n/g, " ");
  const lines = ["#separator:tab", "#html:true", "#tags column:3"];
  for (const w of (words || WORDS)) {
    const ex = (examples || EXAMPLES)[w[0]];
    const back = esc(w[1]) + "<br>" + esc(w[2]) +
      (ex ? "<br><i>" + esc(ex[0]) + " — " + esc(ex[2]) + "</i>" : "");
    lines.push(esc(w[0]) + "\t" + back + "\t" + esc(w[3]) + " " + esc(w[4]));
  }
  return lines.join("\n");
}
async function ankiExport() {
  const name = "soisanuk-anki.txt";
  const file = new File([ankiTSV()], name, { type: "text/plain" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch {}
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ankiTSV()], { type: "text/plain" }));
  a.download = name;
  a.click();
}
