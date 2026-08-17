// App state, derived data, navigation, category picker, helpers,
// session end, progress export/import.

// ═══════════════════════════════════════════════════════════════════════════
// App state
// ═══════════════════════════════════════════════════════════════════════════
let progress = loadProgress();
let session = {};   // current mode state

// One-time migration from old thaicab_progress key
{
  try {
    const old = localStorage.getItem("thaicab_progress");
    if (old && !localStorage.getItem("soisanuk_progress")) {
      localStorage.setItem("soisanuk_progress", old);
      localStorage.removeItem("thaicab_progress");
      progress = loadProgress();
    }
  } catch (e) {}
}

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

// Clears every LEARNING-progress store this app owns: SRS reviews, the
// course path (including personal-best read times), and the daily streak.
// Deliberately leaves UI preferences alone (mute, nav-collapse state, chart
// order, "seen the tutorial") — those aren't progress, resetting them would
// just be annoying — and never touches lbb_save, which belongs to a
// different app (The Last Baht Bus) sharing this origin. LEARN_KEY/
// STREAK_KEY are learn.js constants; safe to reference here since this only
// runs later, from a click handler, well after every script has loaded.
function resetAllProgress() {
  localStorage.removeItem(SRS_KEY);
  localStorage.removeItem(LEARN_KEY);
  localStorage.removeItem(STREAK_KEY);
  progress = {};
  if (typeof _streakRender === "function") _streakRender();
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

// ─── collapsible nav sections ──────────────────────────────────────────────
// Each section header toggles the list(s) beneath it; open/closed state
// persists. Secondary sections start collapsed so the whole nav fits a laptop.
const NAV_KEY = "soisanuk_nav";
const NAV_DEFAULT_COLLAPSED = ["Games", "Numbers", "More"];

// Wires one nav container. Shared by the desktop sidebar and the mobile menu
// screen, which are the same list of destinations in two layouts — and the
// menu screen needs it MORE: on a phone it ran 1758px, nearly three screens,
// so everything past Vocabulary was undiscoverable without scrolling. Both
// read/write the same NAV_KEY, so a section you collapse stays collapsed
// whichever layout you meet it in.
function _collapseSections(root, sectionCls, listCls, stopId) {
  if (!root) return;
  let state = {};
  try { state = JSON.parse(localStorage.getItem(NAV_KEY) || "{}"); } catch (e) {}
  for (const sec of root.querySelectorAll("." + sectionCls)) {
    const name = sec.textContent.trim();
    const lists = [];
    for (let el = sec.nextElementSibling;
         el && !el.classList.contains(sectionCls) && el.id !== stopId;
         el = el.nextElementSibling) {
      if (el.classList.contains(listCls)) lists.push(el);
    }
    const apply = c => {
      sec.classList.toggle("collapsed", c);
      lists.forEach(l => l.classList.toggle("nav-hidden", c));
    };
    apply(name in state ? state[name] : NAV_DEFAULT_COLLAPSED.includes(name));
    sec.setAttribute("role", "button");
    sec.setAttribute("tabindex", "0");
    const toggle = () => {
      const c = !sec.classList.contains("collapsed");
      apply(c);
      state[name] = c;
      try { localStorage.setItem(NAV_KEY, JSON.stringify(state)); } catch (e) {}
    };
    sec.addEventListener("click", toggle);
    sec.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  }
}

function _navCollapseInit() {
  _collapseSections(document.getElementById("sidebar"), "sidebar-section", "sidebar-list", "sidebar-footer");
  _collapseSections(document.getElementById("menu-screen"), "menu-section", "menu-list", null);
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
  _audioScreen(id); // start/stop game background music
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

// delegates to _wcEsc (wordcard.js, loaded first) — the single escaping
// implementation; this also gets ' for free (the others didn't escape it)
function _esc(s) {
  return _wcEsc(s);
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

// Progress export/import lives in backup.js (backupExport/backupImportFile/
// backupImportPaste) — merge semantics, covers SRS + course path + streak,
// reachable from the Backup & Restore screen. This file used to carry a
// second, older, REPLACE-semantics exporter/importer (progress only) wired
// to Stats-screen buttons; retired in favour of the one real export format.
