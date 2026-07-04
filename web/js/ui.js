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

// ── script tooltip ────────────────────────────────────────────────────────
const _stt = {
  el: null,
  _get() { if (!this.el) this.el = document.getElementById("script-tooltip"); return this.el; },
  show(html, x, y) {
    const el = this._get();
    el.innerHTML = html;
    el.style.display = "block";
    el.style.left = "-9999px"; el.style.top = "-9999px";
    // position after layout so we know the real size
    requestAnimationFrame(() => {
      const w = el.offsetWidth, h = el.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      el.style.left = (x + 14 + w > vw ? x - w - 10 : x + 14) + "px";
      el.style.top  = (y + 14 + h > vh ? y - h - 10 : y + 14) + "px";
    });
  },
  hide() { this._get().style.display = "none"; },
};

function _scriptTooltipHtml(ch) {
  const cp = ch.codePointAt(0);
  const kind = _thaiCharKind(cp);

  if (kind === "cons") {
    const c = CONSONANTS.find(x => x[0] === ch);
    if (c) {
      const clsLabel = c[2] === "mid" ? "mid class" : c[2] === "high" ? "high class" : "low class";
      return `<span class="st-char">${ch}</span>
        <div class="st-row">Name: <span>${c[3]}</span></div>
        <div class="st-row">Romanisation: <span>/${c[1]}/</span></div>
        <div class="st-row">Class: <span>${clsLabel}</span></div>
        <div class="st-row">Initial: <span>/${c[4]}/</span> · Final: <span>/${c[5]}/</span></div>`;
    }
    return `<span class="st-char">${ch}</span><div class="st-row">consonant</div>`;
  }

  if (kind === "vowel") {
    // find matching VOWELS entry by char
    const v = VOWELS.find(x => x[0].replace(/◌/g, "").includes(ch));
    if (v) {
      return `<span class="st-char">${ch}</span>
        <div class="st-row">Vowel: <span>${v[0]}</span></div>
        <div class="st-row">Sound: <span>${v[1]}</span></div>
        <div class="st-row">${_esc(v[2])}</div>`;
    }
    return `<span class="st-char">${ch}</span><div class="st-row">vowel marker</div>`;
  }

  if (kind === "tone") {
    const names = { "่": "mai ek ่ — low/falling", "้": "mai tho ้ — falling", "๊": "mai tri ๊ — high", "๋": "mai jattawa ๋ — rising" };
    return `<span class="st-char">${ch}</span><div class="st-row">Tone mark: <span>${names[ch] || ch}</span></div>`;
  }

  return `<span class="st-char">${ch}</span><div class="st-row">U+${cp.toString(16).toUpperCase().padStart(4,"0")}</div>`;
}

function renderDecomposition(container, word) {
  const clusters = _buildDecomposition(word);
  const wrap = document.createElement("div");
  wrap.className = "wc-decomp";

  clusters.forEach(cluster => {
    const clusterDiv = document.createElement("div");
    clusterDiv.className = "decomp-cluster";

    // Render the cluster as one visual unit showing constituent chars
    cluster.forEach(ch => {
      const cp = ch.codePointAt(0);
      const kind = _thaiCharKind(cp);
      const span = document.createElement("span");
      span.className = "decomp-char is-" + (kind === "diac" ? "tone" : kind);
      span.textContent = ch;

      const tipHtml = _scriptTooltipHtml(ch);
      span.addEventListener("mouseenter", e => _stt.show(tipHtml, e.clientX, e.clientY));
      span.addEventListener("mousemove",  e => _stt.show(tipHtml, e.clientX, e.clientY));
      span.addEventListener("mouseleave", () => _stt.hide());

      clusterDiv.appendChild(span);
    });

    wrap.appendChild(clusterDiv);
  });

  container.appendChild(wrap);
  container.style.display = "";
}

// ── word card stack ───────────────────────────────────────────────────────
const _wcOverlay = () => document.getElementById("wc-overlay");

function openWordModal(word) {
  const overlay = _wcOverlay();
  const isNested = overlay.classList.contains("open");

  const [thai, rtgs, english] = word;

  // Build a new layer div
  const layer = document.createElement("div");
  layer.className = "wc-layer";

  const exId    = "wc-ex-"    + Date.now();
  const decompId = "wc-dc-"   + Date.now();
  layer.innerHTML = `
    <div class="wc-card">
      <button class="wc-close" title="Close">✕</button>
      ${isNested ? `<button class="wc-back">← Back</button>` : ""}
      <div style="text-align:center">
        <span class="wc-thai" title="Click to decompose" style="cursor:pointer">${_esc(thai)}</span>
        ${_tts.available() ? `<button class="wc-speak example-speak" title="Listen" style="float:none;display:inline-block;vertical-align:middle;margin-left:0.5rem">🔊</button>` : ""}
      </div>
      <div class="wc-rtgs">${_esc(rtgs)}</div>
      <div class="wc-en">${_esc(english)}</div>
      <div id="${decompId}" style="display:none"></div>
      <hr class="divider-accent">
      <div id="${exId}" class="wc-example example-block" style="display:none"></div>
    </div>`;

  // Close button: pop this layer (or close all if it's the root)
  layer.querySelector(".wc-close").onclick = () => _wcPop(layer);
  const backBtn = layer.querySelector(".wc-back");
  if (backBtn) backBtn.style.display = ""; backBtn && (backBtn.onclick = () => _wcPop(layer));

  // Click backdrop of THIS layer closes it
  layer.addEventListener("click", e => { if (e.target === layer) _wcPop(layer); });

  const speakBtn = layer.querySelector(".wc-speak");
  if (speakBtn) {
    speakBtn.onclick = () => _tts.speak(thai, speakBtn);
    _tts.speak(thai);
  }

  // Thai word click → toggle decomposition
  const thaiSpan  = layer.querySelector(".wc-thai");
  const decompDiv = layer.querySelector(`#${decompId}`);
  let decompBuilt = false;
  thaiSpan.addEventListener("click", () => {
    if (!decompBuilt) {
      renderDecomposition(decompDiv, thai);
      decompBuilt = true;
      // renderDecomposition already shows it — don't toggle
      return;
    }
    decompDiv.style.display = decompDiv.style.display === "none" ? "" : "none";
  });

  overlay.appendChild(layer);
  overlay.classList.add("open");

  // Render example — tokens will call openWordModal again, pushing another layer
  showExample(exId, thai);
}

function _wcPop(layer) {
  const overlay = _wcOverlay();
  layer.remove();
  if (!overlay.querySelector(".wc-layer")) {
    overlay.classList.remove("open");
    speechSynthesis.cancel();
  }
}

function closeWordModal() {
  const overlay = _wcOverlay();
  overlay.innerHTML = "";
  overlay.classList.remove("open");
  speechSynthesis.cancel();
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
      <button class="btn" onclick="if(confirm('Reset ALL progress?')) { localStorage.removeItem('thaicab_progress'); progress={}; showStats(); updateMenuStats(); }">
        Reset
      </button>
    </div>
  `;
  showScreen("stats-screen", "0");
}

// ─── tooltip wiring ───────────────────────────────────────────────────────────
const _tt = {
  el: null,
  show(thai, rtgs, en, x, y) {
    if (!this.el) this.el = document.getElementById("word-tooltip");
    document.getElementById("tt-thai").textContent = thai;
    document.getElementById("tt-rtgs").textContent = rtgs;
    document.getElementById("tt-en").textContent   = en;
    this.el.style.display = "block";
    this._move(x, y);
  },
  move(x, y) { if (this.el) this._move(x, y); },
  _move(x, y) {
    const tw = this.el.offsetWidth, th = this.el.offsetHeight;
    const vw = window.innerWidth,   vh = window.innerHeight;
    let left = x + 14, top = y + 14;
    if (left + tw > vw - 8) left = x - tw - 10;
    if (top  + th > vh - 8) top  = y - th - 10;
    this.el.style.left = left + "px";
    this.el.style.top  = top  + "px";
  },
  hide() { if (this.el) this.el.style.display = "none"; },
};

document.addEventListener("mousemove", e => _tt.move(e.clientX, e.clientY));

// ─── example sentence display ─────────────────────────────────────────────────
function showExample(containerId, vocabWord) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const ex = (typeof EXAMPLES !== "undefined") && EXAMPLES[vocabWord];
  if (!ex) { el.style.display = "none"; return; }

  const [thai, rtgs, eng] = ex;
  const tokens = _tokenise(thai);

  // Build interactive Thai line
  let thaiHtml = "";
  for (const tok of tokens) {
    if (!tok.word) {
      thaiHtml += _esc(tok.text);
    } else {
      const isTarget = tok.text === vocabWord;
      const cls = "w-token" + (isTarget ? " highlight" : "");
      thaiHtml += `<span class="${cls}" data-w="${_esc(tok.text)}">${_esc(tok.text)}</span>`;
    }
  }

  // Highlight vocab word's romanisation in the sentence rtgs
  const vocabRtgs = (WORD_MAP[vocabWord] || [])[1] || "";
  let highlightedRtgs = _esc(rtgs);
  if (vocabRtgs) {
    const escaped = vocabRtgs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    highlightedRtgs = highlightedRtgs.replace(
      new RegExp(escaped, "g"),
      `<span class="highlight">${_esc(vocabRtgs)}</span>`
    );
  }

  const speakBtn = _tts.available()
    ? `<button class="example-speak" title="Listen" aria-label="Speak sentence">🔊</button>`
    : "";

  el.innerHTML = `
    <div class="example-thai">${speakBtn}${thaiHtml}</div>
    <div class="example-rtgs">${highlightedRtgs}</div>
    <div class="example-en">${_esc(eng)}</div>
  `;
  el.style.display = "";

  const btn = el.querySelector(".example-speak");
  if (btn) btn.addEventListener("click", () => _tts.speak(thai, btn));

  // Attach tooltip + click-to-speak events to every token span
  el.querySelectorAll(".w-token").forEach(span => {
    const w = WORD_MAP[span.dataset.w];
    if (!w) return;
    span.addEventListener("mouseenter", e => _tt.show(w[0], w[1], w[2], e.clientX, e.clientY));
    span.addEventListener("mouseleave", () => _tt.hide());
    span.style.cursor = "pointer";
    span.addEventListener("click", () => openWordModal(w));
  });
}
