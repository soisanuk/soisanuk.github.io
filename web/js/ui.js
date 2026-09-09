// Presentation helpers: vocab list, word modal, tooltips,
// decomposition rendering, example sentences, statistics.

// ═══════════════════════════════════════════════════════════════════════════
// Vocab List
// ═══════════════════════════════════════════════════════════════════════════
let _vocabListAll = null;
let _vocabListFilter = null; // active category filter

function showVocabList() {
  if (!_vocabListAll) {
    _vocabListAll = [...WORDS].sort((a, b) => a[0].localeCompare(b[0], "th"));
  }
  _vocabListFilter = null;
  document.getElementById("vocab-list-search").value = "";
  _renderCategoryChips();
  _renderVocabList(_vocabListAll);
  showScreen("vocab-list-screen", "V");
}

function _renderCategoryChips() {
  const container = document.getElementById("vocab-list-cats");
  container.innerHTML = "";

  const cats = [{ key: null, label: "All" }, ...CATEGORIES.map(c => ({ key: c, label: CAT_LABELS[c] || c }))];
  const now = Date.now() / 1000;

  cats.forEach(({ key, label }) => {
    const words = key ? CAT_WORDS[key] : WORDS;
    const total = words.length;
    const mature = words.filter(w => progress[w[0]] && progress[w[0]].interval >= 21).length;
    const seen   = words.filter(w => progress[w[0]] && progress[w[0]].totalReviews > 0).length;
    const pct = Math.round(mature / total * 100);

    const chip = document.createElement("div");
    chip.className = "cat-progress-chip" + (_vocabListFilter === key ? " active" : "");
    chip.title = `${seen}/${total} seen · ${mature} mature`;

    // SVG ring
    const r = 8, cx = 11, cy = 11, circ = 2 * Math.PI * r;
    const dash = pct / 100 * circ;
    chip.innerHTML = `
      <svg class="cat-ring" viewBox="0 0 22 22">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="2.5"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--jade)" stroke-width="2.5"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
          stroke-dashoffset="${(circ / 4).toFixed(1)}"
          transform="rotate(-90 ${cx} ${cy})"/>
      </svg>
      <span>${_esc(label)}</span>
    `;
    chip.addEventListener("click", () => {
      _vocabListFilter = key;
      document.querySelectorAll(".cat-progress-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      document.getElementById("vocab-list-search").value = "";
      const list = key ? [...CAT_WORDS[key]].sort((a, b) => a[0].localeCompare(b[0], "th")) : _vocabListAll;
      _renderVocabList(list);
    });
    container.appendChild(chip);
  });
}

// 794 of the 978 romanisations carry a combining tone mark, and no Thai or
// English phone keyboard offers ì á ǎ û — so searching for what the app itself
// displays ("sà-baai") was impossible, and plain "sip" found none of สิบ.
// Fold marks and separators off BOTH sides. This does not make the scheme's
// vowel length optional: "sabaai" finds sà-baai, "sabai" still does not.
// Found by the 2026-09-07 reference-screens round.
function _vlFold(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-\s]/g, "").toLowerCase();
}

function filterVocabList(query) {
  const q = query.trim().toLowerCase();
  const f = _vlFold(query);
  const base = _vocabListFilter ? [...CAT_WORDS[_vocabListFilter]].sort((a, b) => a[0].localeCompare(b[0], "th")) : _vocabListAll;
  const filtered = q
    ? base.filter(w =>
        w[0].includes(q) ||
        w[1].toLowerCase().includes(q) || (f && _vlFold(w[1]).includes(f)) ||
        w[2].toLowerCase().includes(q))
    : base;
  _renderVocabList(filtered);
}

function _renderVocabList(list) {
  const grid = document.getElementById("vocab-list-grid");
  const count = document.getElementById("vocab-list-count");
  count.textContent = `${list.length} words`;
  grid.innerHTML = "";
  list.forEach(w => {
    const div = document.createElement("div");
    div.className = "vocab-list-item";
    // `repetitions` is SM-2's CONSECUTIVE-SUCCESS counter and reviewCard resets it
    // to 0 on any miss, so reading it as "have you met this word" made a lapsed
    // card indistinguishable from one never opened. `totalReviews` increments
    // unconditionally and survives a lapse, which is what "seen" actually means.
    //
    // The two definitions were in the same screen: showStats' headline counts
    // records in `progress`, while its own category rows counted repetitions > 0 —
    // so one wrong answer made "55 Cards Seen" sit 200px above rows summing to 40.
    // The Vocab List then marked the lapsed word as never seen, which is exactly
    // backwards: a lapse is the word you most need to find again.
    // Found by the 2026-09-07 reference-screens round.
    const seen = progress[w[0]] && progress[w[0]].totalReviews > 0;
    const mature = progress[w[0]] && progress[w[0]].interval >= 21;
    const dot = mature ? `<span style="color:var(--jade);font-size:0.65rem;margin-left:auto">●</span>`
              : seen   ? `<span style="color:var(--dim);font-size:0.65rem;margin-left:auto">○</span>`
              : "";
    div.innerHTML = `<div class="vli-thai">${_esc(w[0])}</div><div class="vli-en">${_esc(w[2])}${dot}</div>`;
    div.addEventListener("click", () => openWordModal(w));
    grid.appendChild(div);
  });
}

function showStats() {
  const s = srsStats(progress, allSrsKeys());
  const vocabKeys = new Set(WORDS.map(w => w[0]));
  const scriptKeys = new Set([
    ...CONSONANTS.map(c => `sc:${c[0]}`),
    ...VOWELS.map(v => `sv:${v[0]}`),
  ]);
  let vocabSeen = 0, scriptSeen = 0;
  for (const k of Object.keys(progress)) {
    if (vocabKeys.has(k)) vocabSeen++;
    else if (scriptKeys.has(k)) scriptSeen++;
  }

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-box"><div class="stat-num">${s.totalSeen}</div><div class="stat-lbl">Cards Seen</div></div>
    <div class="stat-box"><div class="stat-num">${s.dueNow}</div><div class="stat-lbl">Due Now</div></div>
    <div class="stat-box"><div class="stat-num">${s.mature}</div><div class="stat-lbl">Mature (≥21d)</div></div>
  `;

  // Per-category mature counts
  const catRows = CATEGORIES.map(cat => {
    const ws = CAT_WORDS[cat];
    const total = ws.length;
    const matCnt = ws.filter(w => progress[w[0]] && progress[w[0]].interval >= 21).length;
    const seenCnt = ws.filter(w => progress[w[0]] && progress[w[0]].totalReviews > 0).length;
    const pct = Math.round(matCnt / total * 100);
    const label = CAT_LABELS[cat] || cat;
    return `<div class="drill-row">
      <span class="drill-label">${_esc(label)}</span>
      <span class="drill-value"><span style="color:var(--jade)">${matCnt} mature</span> · ${seenCnt}/${total} seen · ${pct}%</span>
    </div>`;
  }).join("");

  // Sentence SRS counts
  const sentKeys = WORDS.filter(w => EXAMPLES && EXAMPLES[w[0]]).map(w => `sent:${w[0]}`);
  const sentSeen = sentKeys.filter(k => progress[k] && progress[k].totalReviews > 0).length;
  const sentMature = sentKeys.filter(k => progress[k] && progress[k].interval >= 21).length;

  // Review forecast: bar per day for the next week
  const forecast = dueForecast(progress, 7, allSrsKeys());
  const maxDue = Math.max(...forecast, 1);
  const forecastBars = forecast.map((n, day) => {
    const h = Math.max(Math.round(n / maxDue * 56), n ? 3 : 1);
    const color = day === 0 ? "var(--deep-saffron)" : "var(--jade)";
    const label = day === 0 ? "now" : `+${day}d`;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.2rem;">
      <span style="font-size:0.7rem;color:var(--text)">${n || ""}</span>
      <div style="width:60%;height:${h}px;background:${color};border-radius:2px 2px 0 0;"></div>
      <span style="font-size:0.68rem;color:var(--dim)">${label}</span>
    </div>`;
  }).join("");

  document.getElementById("stats-body").innerHTML = `
    <div style="padding:0.4rem 0; border-top:1px solid var(--border); margin-top:0.3rem;">
      <div style="color:var(--dim);font-size:0.78rem;padding:0.3rem 0 0.5rem;text-transform:uppercase;letter-spacing:0.07em;">Review Forecast</div>
      <div style="display:flex;align-items:flex-end;gap:0.15rem;border-bottom:1px solid var(--border);padding:0 0.5rem;">${forecastBars}</div>
    </div>` + `
    <div style="padding:0.5rem 0; border-top:1px solid var(--border); margin-top:0.5rem;">
      <div class="drill-row"><span class="drill-label">Vocab words seen</span>
        <span class="drill-value">${vocabSeen} / ${WORDS.length}</span></div>
      <div class="drill-row"><span class="drill-label">Script cards seen</span>
        <span class="drill-value">${scriptSeen} / ${CONSONANTS.length + VOWELS.length}</span></div>
      <div class="drill-row"><span class="drill-label">Sentence SRS seen</span>
        <span class="drill-value">${sentSeen} / ${sentKeys.length} · ${sentMature} mature</span></div>
      <div class="drill-row"><span class="drill-label">Total vocab</span>
        <span class="drill-value">${WORDS.length} words</span></div>
    </div>
    <div style="padding:0.4rem 0; border-top:1px solid var(--border); margin-top:0.3rem;">
      <div style="color:var(--dim);font-size:0.78rem;padding:0.3rem 0 0.5rem;text-transform:uppercase;letter-spacing:0.07em;">By Category</div>
      ${catRows}
    </div>
    <div class="btn-row export-import-row" style="margin-top:1rem;">
      <button class="btn" onclick="showScreen('backup-screen','X')">💾 Backup &amp; Restore</button>
      <button class="btn" onclick="if(confirm('Reset all learning progress? This clears SRS reviews, the guided course path, and your streak. Cannot be undone.')) { resetAllProgress(); showStats(); updateMenuStats(); }">
        Reset
      </button>
    </div>
  `;
  showScreen("stats-screen", "0");
}

// ─── tutorial ────────────────────────────────────────────────────────────────
const _TUT_KEY = "soisanuk_seen_tutorial";
const _TUT_TOTAL = 6;
let _tutStep = 0;

// The tour used to hard-code its own counts ("878 vocabulary words"), which
// silently went stale the moment vocabulary was added — it was 72 words out
// of date, and describing a version of the app from before the Guided Course
// existed, when nobody noticed. Counts are now filled from the data at open
// time, so they cannot drift; tests/js/ui.test.js guards against a future
// edit re-hardcoding one.
function _tutFillCounts() {
  const counts = {
    words: (typeof WORDS !== "undefined") ? WORDS.length : 0,
    script: ((typeof CONSONANTS !== "undefined") ? CONSONANTS.length : 0) +
            ((typeof VOWELS !== "undefined") ? VOWELS.length : 0),
  };
  document.querySelectorAll(".tut-count").forEach(el => {
    const n = counts[el.dataset.count];
    if (n) el.textContent = n;
  });
}

// Focusable things inside the card, in DOM order.
function _tutFocusables() {
  const card = document.getElementById("tutorial-card");
  return card ? [...card.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(e => e.offsetParent !== null || e === document.activeElement) : [];
}

// Tab used to walk straight out of the modal into the nav behind it: two
// presses reached "▶ Continue" and Enter started a lesson UNDER the still-open
// tour, with the seen-flag unset. The overlay's own buttons come after the
// whole sidebar and menu in DOM order, so they were effectively unreachable by
// Tab. Found by the 2026-09-09 beginner round.
function _tutTrapTab(e) {
  if (e.key !== "Tab") return;
  const f = _tutFocusables();
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  else if (!document.getElementById("tutorial-card").contains(document.activeElement)) {
    e.preventDefault(); first.focus();
  }
}

function showTutorial() {
  _tutStep = 0;
  _tutFillCounts();
  _tutRender();
  const overlay = document.getElementById("tutorial-overlay");
  overlay.classList.add("open");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  document.addEventListener("keydown", _tutTrapTab, true);
  // Land inside the card, so the first Tab moves within it rather than out.
  const next = document.getElementById("tutorial-next");
  if (next) next.focus();
}

function closeTutorial() {
  document.removeEventListener("keydown", _tutTrapTab, true);
  document.getElementById("tutorial-overlay").classList.remove("open");
  localStorage.setItem(_TUT_KEY, "1");
}

function _tutRender() {
  document.querySelectorAll(".tutorial-slide").forEach((s, i) =>
    s.classList.toggle("active", i === _tutStep));
  document.querySelectorAll(".tutorial-dot").forEach((d, i) =>
    d.classList.toggle("active", i === _tutStep));
  // "visible", not "" — index.html defaults #tutorial-prev to visibility:hidden
  // so it isn't there before this ever runs, and clearing the inline style just
  // falls back to that rule, which left Back invisible on every slide.
  document.getElementById("tutorial-prev").style.visibility = _tutStep === 0 ? "hidden" : "visible";
  document.getElementById("tutorial-next").textContent =
    _tutStep === _TUT_TOTAL - 1 ? "Done ✓" : "Next →";
}

function _tutNext() {
  if (_tutStep < _TUT_TOTAL - 1) { _tutStep++; _tutRender(); }
  else closeTutorial();
}

function _tutPrev() {
  if (_tutStep > 0) { _tutStep--; _tutRender(); }
}

function _tutGoTo(i) { _tutStep = i; _tutRender(); }

function maybeShowTutorial() {
  if (!localStorage.getItem(_TUT_KEY)) showTutorial();
}
