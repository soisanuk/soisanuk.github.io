// Word card: the shared Thai vocab modal — decomposition, translation,
// example sentences, script/word tooltips. SOURCE OF TRUTH lives in the
// Soi Sanuk trainer repo (soisanuk.github.io, web/js/wordcard.js); The Last
// Baht Bus vendors an identical copy. Keep edits here and re-copy.
//
// Self-contained: depends only on globals both apps provide — WORDS,
// EXAMPLES, CONSONANTS, VOWELS (data.js/examples.js), _buildDecomposition/
// _thaiCharKind (thai-script.js), _tokenise (tokeniser.js), _tts (tts.js) —
// plus #wc-overlay, #script-tooltip, #word-tooltip elements and the wc-/
// decomp-/example-/st-/tt- CSS. openWordModal(word) is the public entry;
// word is a [thai, rtgs, english] triple.

function _wcEsc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// WORD_MAP if the host app built one (the trainer does), else a lazy map
// over WORDS — so the same file drops into both apps unchanged.
let _wcMapCache = null;
function _wcMap() {
  if (typeof WORD_MAP !== "undefined") return WORD_MAP;
  if (!_wcMapCache) _wcMapCache = Object.fromEntries(WORDS.map(w => [w[0], w]));
  return _wcMapCache;
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
        <div class="st-row">${_wcEsc(v[2])}</div>`;
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
        <span class="wc-thai" title="Click to decompose" style="cursor:pointer">${_wcEsc(thai)}</span>
        ${_tts.available() ? `<button class="wc-speak example-speak" title="Listen" style="float:none;display:inline-block;vertical-align:middle;margin-left:0.5rem">🔊</button>` : ""}
      </div>
      <div class="wc-rtgs">${_wcEsc(rtgs)}</div>
      <div class="wc-en">${_wcEsc(english)}</div>
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
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }
}

function closeWordModal() {
  const overlay = _wcOverlay();
  overlay.innerHTML = "";
  overlay.classList.remove("open");
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
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

if (typeof document !== "undefined") {
  document.addEventListener("mousemove", e => _tt.move(e.clientX, e.clientY));
}

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
      thaiHtml += _wcEsc(tok.text);
    } else {
      const isTarget = tok.text === vocabWord;
      const cls = "w-token" + (isTarget ? " highlight" : "");
      thaiHtml += `<span class="${cls}" data-w="${_wcEsc(tok.text)}">${_wcEsc(tok.text)}</span>`;
    }
  }

  // Highlight vocab word's romanisation in the sentence rtgs
  const vocabRtgs = (_wcMap()[vocabWord] || [])[1] || "";
  let highlightedRtgs = _wcEsc(rtgs);
  if (vocabRtgs) {
    const escaped = vocabRtgs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    highlightedRtgs = highlightedRtgs.replace(
      new RegExp(escaped, "g"),
      `<span class="highlight">${_wcEsc(vocabRtgs)}</span>`
    );
  }

  const speakBtn = _tts.available()
    ? `<button class="example-speak" title="Listen" aria-label="Speak sentence">🔊</button>`
    : "";

  el.innerHTML = `
    <div class="example-thai">${speakBtn}${thaiHtml}</div>
    <div class="example-rtgs">${highlightedRtgs}</div>
    <div class="example-en">${_wcEsc(eng)}</div>
  `;
  el.style.display = "";

  const btn = el.querySelector(".example-speak");
  if (btn) btn.addEventListener("click", () => _tts.speak(thai, btn));

  // Attach tooltip + click-to-speak events to every token span
  el.querySelectorAll(".w-token").forEach(span => {
    const w = _wcMap()[span.dataset.w];
    if (!w) return;
    span.addEventListener("mouseenter", e => _tt.show(w[0], w[1], w[2], e.clientX, e.clientY));
    span.addEventListener("mouseleave", () => _tt.hide());
    span.style.cursor = "pointer";
    span.addEventListener("click", () => openWordModal(w));
  });
}
