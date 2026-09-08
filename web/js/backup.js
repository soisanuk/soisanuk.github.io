// Backup / restore — the escape hatch for localStorage's fragility.
// Export packages both stores (SRS cards + course path) into one JSON file,
// preferring the native share sheet on mobile (AirDrop/Files) with download
// and clipboard fallbacks. Import takes a file or pasted JSON and MERGES:
// per SRS card the record with more reviews wins; course units stay done and
// keep their best accuracy. Pure merge logic up top (vm-testable, DOM-free).

function _readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
  catch { return fallback; }
}

function backupSnapshot() {
  return { app: "soisanuk", v: 1, at: new Date().toISOString(),
    progress: loadProgress(),
    path: _readJSON(LEARN_KEY, {}),
    streak: _readJSON(STREAK_KEY, {}) };
}

// Streak state is device/date-local, not additive like SRS cards — merging
// means "which side's streak is still current", not summing anything.
// Whichever side logged a MORE RECENT day wins the live streak; the
// personal-best fields (maxDays/bestDay) are historical records, so those
// carry forward from BOTH sides regardless of which "last" wins.
function _streakMerge(mine, theirs) {
  mine = mine || {}; theirs = theirs || {};
  // On the SAME date, keep the longer streak. Strict > gave the tie to `mine`,
  // so restoring on migration day cut a 214-day streak to 1 if she had
  // answered a single card on the new phone first — and left it at 214 if she
  // had not. The order of two taps decided seven months of history.
  // Found by the 2026-09-09 backup round.
  const mineLast = mine.last || "", theirsLast = theirs.last || "";
  const newer = theirsLast > mineLast ? theirs
    : theirsLast < mineLast ? mine
    : ((theirs.days || 0) > (mine.days || 0) ? theirs : mine);
  const maxDays = Math.max(mine.maxDays || 0, theirs.maxDays || 0, newer.days || 0);
  const bestDay = [mine.bestDay, theirs.bestDay].filter(Boolean)
    .sort((a, b) => b.cards - a.cards)[0] || null;
  if (!newer.last) return { maxDays, bestDay };
  return { last: newer.last, days: newer.days || 0, maxDays, bestDay, today: newer.today };
}

function backupMerge(mine, theirs) {
  const prog = { ...mine.progress };
  // Skip a record that is not a card rather than throwing on it. A single
  // corrupted entry used to throw inside this loop, get swallowed by the
  // blanket catch in _backupRestoreText, and report "That doesn't look like a
  // soisanuk backup" — so 899 good cards were unimportable and the message
  // told her she had picked the wrong file. The count is reported instead.
  let skipped = 0;
  for (const [k, c] of Object.entries(theirs.progress || {})) {
    if (!c || typeof c !== "object" || Array.isArray(c)) { skipped++; continue; }
    if (!prog[k] || (c.totalReviews || 0) > (prog[k].totalReviews || 0)) prog[k] = c;
  }
  const units = { ...((mine.path || {}).units || {}) };
  for (const [id, u] of Object.entries((theirs.path || {}).units || {})) {
    const cur = units[id];
    if (!cur) { units[id] = u; continue; }
    // acc only when a side HAS one. Math.max(cur.acc||0, u.acc||0) invented
    // acc:0 for units that carry none — which _placementApply writes on
    // purpose, {done:true, placed:true} — and startLearn renders a badge
    // whenever acc != null. Placing out of the first four letter units and
    // then restoring told her she had scored zero on them.
    const accs = [cur.acc, u.acc].filter(a => typeof a === "number");
    const msAvgs = [cur.msAvg, u.msAvg].filter(m => typeof m === "number");
    const merged = { done: cur.done || u.done };
    if (accs.length) merged.acc = Math.max(...accs);
    if (msAvgs.length) merged.msAvg = Math.min(...msAvgs);
    // `placed` is written by _placementApply and was dropped by the rebuild.
    if (cur.placed || u.placed) merged.placed = true;
    units[id] = merged;
  }
  // Personal-best read times (ms) — lower is better, so keep the faster side.
  const best = { ...((mine.path || {}).best || {}) };
  for (const [k, ms] of Object.entries((theirs.path || {}).best || {})) {
    if (!best[k] || ms < best[k]) best[k] = ms;
  }
  const out = { progress: prog, path: { units, best },
                streak: _streakMerge(mine.streak, theirs.streak) };
  // Non-enumerable so the shape stays exactly what it was for deepEqual.
  Object.defineProperty(out, "skipped", { value: skipped, enumerable: false });
  return out;
}

// typeof null === "object" and arrays are objects, so the old check waved
// through progress:null and progress:[] — the latter importing a card keyed
// "0" that no screen can reach. Per-record damage is handled in backupMerge,
// which skips and counts it; this only has to reject things that are not a
// backup at all.
function backupValid(d) {
  return !!d && d.app === "soisanuk"
    && !!d.progress && typeof d.progress === "object" && !Array.isArray(d.progress);
}

// A restore has to update the RUNNING app, not just localStorage.
//
// app.js holds `let progress = loadProgress()` and every mode grades into that
// one object; saveAndRefresh() writes it back. So an import that only wrote
// storage was undone by the very next thing the learner touched — and the
// Backup screen's own "← Menu" button is endSession(), which is
// saveAndRefresh(). Import 900 cards, tap the only navigation control on the
// screen, and all 900 are gone. Re-importing does not help: the stale global
// is still stale. Only a full page reload recovers, which on an installed PWA
// means force-quitting the app, and nothing said so.
//
// Cruellest part: restoring onto the device that ALREADY has the data cannot
// fail, because memory is a superset of storage there. The rehearsal always
// works and the real migration always loses. Found by the 2026-09-09
// backup round.
//
// docs/architecture.md already records this exact failure for _learnRecord —
// "a private copy's grades were silently reverted the moment the learner
// tapped Menu". Same global, same trigger, a different writer.
//
// path and streak need no equivalent: _pathLoad and _streakLoad read
// localStorage fresh on every call.
function backupApply(theirs) {
  const merged = backupMerge(backupSnapshot(), theirs);
  saveProgress(merged.progress);
  localStorage.setItem(LEARN_KEY, JSON.stringify(merged.path));
  localStorage.setItem(STREAK_KEY, JSON.stringify(merged.streak));
  if (typeof progress !== "undefined") progress = merged.progress;
  if (typeof updateMenuStats === "function") updateMenuStats();
  return { cards: Object.keys(merged.progress).length, skipped: merged.skipped || 0 };
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
// writeText rejects on an unfocused tab and on any non-secure origin — a LAN
// http:// server, which is how this app is often opened. Without a catch the
// button did nothing at all, silently, on the route offered as the
// belt-and-braces backup. Found by the 2026-09-09 backup round.
function backupCopy() {
  navigator.clipboard.writeText(JSON.stringify(backupSnapshot()))
    .then(() => alert("Backup copied — paste it somewhere safe."))
    .catch(() => alert("Couldn't reach the clipboard — this needs a focused tab on "
      + "an https:// or localhost page. Use Export backup instead; it saves a file."));
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
    const r = backupApply(d);
    // Say what was skipped. A damaged file used to be rejected wholesale with
    // "that doesn't look like a backup"; now the good records import and the
    // count of unreadable ones is stated rather than hidden.
    alert("Merged — " + r.cards + " cards on this device now. "
      + "Done stays done; the more-reviewed record won."
      + (r.skipped ? "\n\n" + r.skipped + " record(s) in that file were unreadable and were skipped."
                   : ""));
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

// ── More export formats: CSV, Quizlet, printable list ──
function csvExportText(words) {
  const esc = t => '"' + String(t || "").replace(/"/g, '""') + '"';
  const rows = [["thai", "roman", "english", "pos", "group"].join(",")];
  for (const w of (words || WORDS)) rows.push([esc(w[0]), esc(w[1]), esc(w[2]), esc(w[3]), esc(w[4])].join(","));
  return rows.join("\n");
}
function quizletText(words) {
  // Quizlet import: term TAB definition, newline between cards — no headers
  const esc = t => String(t || "").replace(/\t/g, " ").replace(/\n/g, " ");
  return (words || WORDS).map(w => esc(w[0]) + "\t" + esc(w[1]) + " — " + esc(w[2])).join("\n");
}
async function _shareOrDownload(text, name, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch {}
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}
function csvExport() { _shareOrDownload(csvExportText(), "soisanuk-words.csv", "text/csv"); }
function quizletExport() { _shareOrDownload(quizletText(), "soisanuk-quizlet.txt", "text/plain"); }
function printList() {
  // print-styled window: Thai / roman / meaning; the browser's Print → PDF does the rest
  const w = window.open("", "_blank");
  w.document.write("<html><head><title>Soi Sanuk — Thai word list</title><style>" +
    "body{font-family:system-ui;margin:2rem}h1{font-size:1.2rem}table{border-collapse:collapse;width:100%}" +
    "td,th{border-bottom:1px solid #ccc;padding:4px 8px;text-align:left}td.th{font-size:1.3em}" +
    "@media print{h1{margin:0 0 8px}}</style></head><body><h1>Soi Sanuk — " + WORDS.length +
    " Thai words</h1><table><tr><th>Thai</th><th>Roman</th><th>Meaning</th></tr>" +
    WORDS.map(x => "<tr><td class=th>" + x[0] + "</td><td>" + x[1] + "</td><td>" + x[2] + "</td></tr>").join("") +
    "</table></body></html>");
  w.document.close();
  w.print();
}
