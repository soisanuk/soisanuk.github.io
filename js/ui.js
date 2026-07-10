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
    const seen   = words.filter(w => progress[w[0]] && progress[w[0]].repetitions > 0).length;
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

function filterVocabList(query) {
  const q = query.trim().toLowerCase();
  const base = _vocabListFilter ? [...CAT_WORDS[_vocabListFilter]].sort((a, b) => a[0].localeCompare(b[0], "th")) : _vocabListAll;
  const filtered = q
    ? base.filter(w =>
        w[0].includes(query) ||
        w[1].toLowerCase().includes(q) ||
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
    const seen = progress[w[0]] && progress[w[0]].repetitions > 0;
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
  const s = srsStats(progress);
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
    const seenCnt = ws.filter(w => progress[w[0]] && progress[w[0]].repetitions > 0).length;
    const pct = Math.round(matCnt / total * 100);
    const label = CAT_LABELS[cat] || cat;
    return `<div class="drill-row">
      <span class="drill-label">${_esc(label)}</span>
      <span class="drill-value"><span style="color:var(--jade)">${matCnt} mature</span> · ${seenCnt}/${total} seen · ${pct}%</span>
    </div>`;
  }).join("");

  // Sentence SRS counts
  const sentKeys = WORDS.filter(w => EXAMPLES && EXAMPLES[w[0]]).map(w => `sent:${w[0]}`);
  const sentSeen = sentKeys.filter(k => progress[k] && progress[k].repetitions > 0).length;
  const sentMature = sentKeys.filter(k => progress[k] && progress[k].interval >= 21).length;

  // Review forecast: bar per day for the next week
  const forecast = dueForecast(progress, 7);
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
        <span class="drill-value">${sentSeen} seen · ${sentMature} mature</span></div>
      <div class="drill-row"><span class="drill-label">Total vocab</span>
        <span class="drill-value">${WORDS.length} words</span></div>
    </div>
    <div style="padding:0.4rem 0; border-top:1px solid var(--border); margin-top:0.3rem;">
      <div style="color:var(--dim);font-size:0.78rem;padding:0.3rem 0 0.5rem;text-transform:uppercase;letter-spacing:0.07em;">By Category</div>
      ${catRows}
    </div>
    <div class="btn-row export-import-row" style="margin-top:1rem;">
      <button class="btn" onclick="exportProgress()">⬇ Export Progress</button>
      <button class="btn" onclick="document.getElementById('import-file-input').click()">⬆ Import Progress</button>
      <button class="btn" onclick="if(confirm('Reset ALL progress?')) { localStorage.removeItem('soisanuk_progress'); progress={}; showStats(); updateMenuStats(); }">
        Reset
      </button>
    </div>
  `;
  showScreen("stats-screen", "0");
}

// ─── tutorial ────────────────────────────────────────────────────────────────
const _TUT_KEY = "soisanuk_seen_tutorial";
const _TUT_TOTAL = 4;
let _tutStep = 0;

function showTutorial() {
  _tutStep = 0;
  _tutRender();
  document.getElementById("tutorial-overlay").classList.add("open");
}

function closeTutorial() {
  document.getElementById("tutorial-overlay").classList.remove("open");
  localStorage.setItem(_TUT_KEY, "1");
}

function _tutRender() {
  document.querySelectorAll(".tutorial-slide").forEach((s, i) =>
    s.classList.toggle("active", i === _tutStep));
  document.querySelectorAll(".tutorial-dot").forEach((d, i) =>
    d.classList.toggle("active", i === _tutStep));
  document.getElementById("tutorial-prev").style.visibility = _tutStep === 0 ? "hidden" : "";
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
