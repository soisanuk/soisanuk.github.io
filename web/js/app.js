// App state, derived data, navigation, category picker, helpers,
// session end, progress export/import.

// ═══════════════════════════════════════════════════════════════════════════
// App state
// ═══════════════════════════════════════════════════════════════════════════
let progress = loadProgress();
let session = {};   // current mode state

// One-time cleanup: a former dueCards() bug persisted empty default records
// for every key it merely looked at, inflating "seen" stats. Drop records
// that were never actually reviewed.
{
  let _pruned = false;
  for (const [k, c] of Object.entries(progress)) {
    if (!c || !c.totalReviews) { delete progress[k]; _pruned = true; }
  }
  if (_pruned) saveProgress(progress);
}

function saveAndRefresh() {
  saveProgress(progress);
  updateMenuStats();
}

function updateMenuStats() {
  const s = srsStats(progress);
  const txt = `vocab seen: ${s.totalSeen}  ·  due: ${s.dueNow}  ·  mature: ${s.mature}`;
  document.getElementById("menu-stats").textContent = txt;
  document.getElementById("sidebar-stats").innerHTML =
    `<span style="color:var(--text)">${s.totalSeen}</span> seen &nbsp;·&nbsp; ` +
    `<span style="color:var(--deep-saffron)">${s.dueNow}</span> due &nbsp;·&nbsp; ` +
    `<span style="color:var(--jade)">${s.mature}</span> mature`;
}

// ─── character frequency (built once from WORDS) ───────────────────────────
const CHAR_FREQ = (() => {
  const freq = {};
  for (const [word] of WORDS) {
    for (const ch of word) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x0E00 && cp <= 0x0E7F) freq[ch] = (freq[ch] || 0) + 1;
    }
  }
  return freq;
})();

const CONSONANT_SORTED = [...CONSONANTS].sort((a, b) =>
  (CHAR_FREQ[b[0]] || 0) - (CHAR_FREQ[a[0]] || 0));

const VOWEL_SORTED = [...VOWELS].sort((a, b) => {
  const fa = Math.max(...[...a[0]].map(c => CHAR_FREQ[c] || 0));
  const fb = Math.max(...[...b[0]].map(c => CHAR_FREQ[c] || 0));
  return fb - fa;
});

const RARE_THRESHOLD = 3;

// ─── category index ────────────────────────────────────────────────────────
const CAT_WORDS = {};
for (const w of WORDS) {
  if (!CAT_WORDS[w[4]]) CAT_WORDS[w[4]] = [];
  CAT_WORDS[w[4]].push(w);
}
const CATEGORIES = Object.keys(CAT_WORDS).sort();

// ─── word map ──────────────────────────────────────────────────────────────
const WORD_MAP = Object.fromEntries(WORDS.map(w => [w[0], w]));
const TOP100_WORDS = TOP_100.map(k => WORD_MAP[k]).filter(Boolean);
const TOP50_WORDS  = TOP100_WORDS.slice(0, 50);
const TOP20_WORDS  = TOP100_WORDS.slice(0, 20);

// ═══════════════════════════════════════════════════════════════════════════
// Screen management
// ═══════════════════════════════════════════════════════════════════════════
function showScreen(id, navKey) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  // Highlight active sidebar item
  document.querySelectorAll(".sidebar-list li").forEach(li => li.classList.remove("active"));
  if (navKey) {
    const el = document.getElementById("nav-" + navKey);
    if (el) el.classList.add("active");
  }
  window.scrollTo(0, 0);
  // On mobile, the screen itself scrolls (not the page), so reset it too.
  const screen = document.getElementById(id);
  if (screen) screen.scrollTop = 0;
}

function showMenu() {
  updateMenuStats();
  showScreen("menu-screen");
}

function endSession() {
  saveAndRefresh();
  showMenu();
}

// ═══════════════════════════════════════════════════════════════════════════
// Category picker
// ═══════════════════════════════════════════════════════════════════════════
function pickCategory(onPick) {
  const list = document.getElementById("cat-list");
  list.innerHTML = "";

  const options = [
    { sep: true, label: "── By frequency ───────────────────" },
    { label: "Top 20 most common", count: TOP20_WORDS.length, words: TOP20_WORDS },
    { label: "Top 50 most common", count: TOP50_WORDS.length, words: TOP50_WORDS },
    { label: "Top 100 most common", count: TOP100_WORDS.length, words: TOP100_WORDS },
    { sep: true, label: "── By category ────────────────────" },
    { label: "All categories", count: WORDS.length, words: WORDS },
    ...CATEGORIES.map(cat => ({
      label: CAT_LABELS[cat] || cat,
      count: CAT_WORDS[cat].length,
      words: CAT_WORDS[cat],
    })),
  ];

  for (const opt of options) {
    const li = document.createElement("li");
    if (opt.sep) {
      li.className = "separator";
      li.textContent = opt.label;
    } else {
      li.className = "selectable";
      const span1 = document.createElement("span");
      span1.textContent = opt.label;
      const span2 = document.createElement("span");
      span2.className = "cat-count";
      span2.textContent = `${opt.count}`;
      li.appendChild(span1);
      li.appendChild(span2);
      li.onclick = () => onPick(opt.words);
    }
    list.appendChild(li);
  }
  showScreen("cat-screen");
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setProgress(id, idx, total) {
  document.getElementById(id).style.width = total ? `${Math.round(idx / total * 100)}%` : "0%";
}

function _esc(s) {
  return s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

// ═══════════════════════════════════════════════════════════════════════════
// Session end
// ═══════════════════════════════════════════════════════════════════════════
function showSessionEnd(allCaughtUp) {
  saveAndRefresh();
  if (allCaughtUp) {
    document.getElementById("end-body").innerHTML = `
      <div class="big-msg">❀ All caught up! ❀</div>
      <div class="sub-msg">No cards due. Come back later or try a different mode.</div>
    `;
  } else {
    const { deck, correct } = session;
    const total = deck ? deck.length : 0;
    const pct   = total ? Math.round(correct / total * 100) : 0;
    document.getElementById("end-body").innerHTML = `
      <div class="big-msg">❀ Session Complete! ❀</div>
      <div class="sub-msg" style="margin-top:0.5rem;">
        Reviewed: ${total} &nbsp;·&nbsp; Rated ≥ OK: ${correct} &nbsp;·&nbsp; ${pct}%
      </div>
    `;
  }
  showScreen("end-screen");
}

// ═══════════════════════════════════════════════════════════════════════════
// Progress Export / Import
// ═══════════════════════════════════════════════════════════════════════════
function exportProgress() {
  const data = { version: 1, exported: new Date().toISOString(), progress };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "thaicab-progress.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importProgress(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      const imported = data.progress || data;
      if (typeof imported !== "object") throw new Error("invalid");
      if (!confirm(`Import ${Object.keys(imported).length} card records? This will REPLACE your current progress.`)) return;
      progress = imported;
      saveProgress(progress);
      updateMenuStats();
      alert("Progress imported successfully!");
    } catch {
      alert("Could not read that file. Make sure it's a valid thaicab progress export.");
    }
    event.target.value = ""; // reset so same file can be re-imported
  };
  reader.readAsText(file);
}
