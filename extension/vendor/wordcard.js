// COPIED from web/js/wordcard.js by scripts/build-extension.mjs — do not edit here.
// Edit the source and re-run the build; --check fails on drift.
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
  _get() { if (!this.el) this.el = _wcRoot().getElementById("script-tooltip"); return this.el; },
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

// " — a chicken" after the name, when anything knows what the name means.
// Without it the row reads "Name: หีบ" to somebody who cannot read หีบ yet.
function _wcNameEn(ch) {
  const en = (typeof consNameEn === "function") ? consNameEn(ch) : null;
  return en ? ` <span class="st-dim">\u2014 ${_wcEsc(en)}</span>` : "";
}
function _scriptTooltipHtml(ch) {
  const cp = ch.codePointAt(0);
  const kind = _thaiCharKind(cp);

  if (kind === "cons") {
    const c = CONSONANTS.find(x => x[0] === ch);
    if (c) {
      const clsLabel = c[2] === "mid" ? "mid class" : c[2] === "high" ? "high class" : "low class";
      return `<span class="st-char" lang="th">${ch}</span>
        <div class="st-row">Name: <span>${c[3]}</span>${_wcNameEn(ch)}</div>
        <div class="st-row">Romanisation: <span>/${c[1]}/</span></div>
        <div class="st-row">Class: <span>${clsLabel}</span></div>
        <div class="st-row">Initial: <span>/${c[4]}/</span> · Final: <span>/${c[5]}/</span></div>`;
    }
    return `<span class="st-char" lang="th">${ch}</span><div class="st-row">consonant</div>`;
  }

  if (kind === "vowel") {
    // EXACT match on the bare symbol first, substring only as a fallback.
    // A plain `includes` matched the first pattern that merely CONTAINED the
    // character, so hovering ั in ปฏิบัติ reported "◌ัว · ua vowel" and
    // hovering ะ in เกาะ reported "เ◌าะ · short o" — the two commonest short
    // vowels in the language, each identified as something else entirely.
    const _bare = x => x[0].replace(/◌/g, "");
    const v = VOWELS.find(x => _bare(x) === ch) || VOWELS.find(x => _bare(x).includes(ch));
    if (v) {
      // hosted, never raw: v[0] is the canonical ◌ form and U+25CC is missing
      // from many fonts. Every other surface hosts it; this one printed it.
      const shown = (typeof vowelDisp === "function") ? vowelDisp(v[0], "อ") : v[0];
      return `<span class="st-char" lang="th">${ch}</span>
        <div class="st-row">Vowel: <span>${shown}</span></div>
        <div class="st-row">Sound: <span>${v[1]}</span></div>
        <div class="st-row">${_wcEsc(v[2])}</div>`;
    }
    return `<span class="st-char" lang="th">${ch}</span><div class="st-row">vowel marker</div>`;
  }

  if (kind === "tone") {
    // ็ falls in the tone codepoint range but is NOT a tone mark: it is
    // ไม้ไต่คู้, and it shortens the vowel under it. The card said "Tone mark:
    // ็" while the lesson glyph card said the opposite, correctly.
    if (ch === "\u0E47")
      return `<span class="st-char" lang="th">ก็</span>` +
        `<div class="st-row">Mai taikhu <span>ไม้ไต่คู้</span></div>` +
        `<div class="st-row">Shortens the vowel — not a tone mark</div>`;
    const names = { "่": "mai ek ่ — low", "้": "mai tho ้ — falling", "๊": "mai tri ๊ — high", "๋": "mai jattawa ๋ — rising" };
    return `<span class="st-char" lang="th">${vowelDisp(ch)}</span><div class="st-row">Tone mark: <span>${names[ch] || ch}</span></div>`;
  }

  return `<span class="st-char" lang="th">${ch}</span><div class="st-row">U+${cp.toString(16).toUpperCase().padStart(4,"0")}</div>`;
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
// ── Where the mounts live ──────────────────────────────────────────────────
// The card looks its mounts up by id, and document.getElementById does not
// pierce a shadow root. A browser extension has to render inside one — a
// content script that puts its styles in the host page leaks into their CSS
// and inherits theirs — so the lookup root is injectable. Defaults to
// `document`, which is exactly what the two host apps pass implicitly, so
// nothing changes for them.
let _wcRootNode = null;
function _wcSetRoot(node) { _wcRootNode = node || null; }
function _wcRoot() { return _wcRootNode || document; }

const _wcOverlay = () => _wcRoot().getElementById("wc-overlay");

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
        <span class="wc-thai" title="Click to decompose" style="cursor:pointer" lang="th">${_wcEsc(thai)}</span>
        ${_tts.available() ? `<button class="wc-speak example-speak" title="Listen" style="float:none;display:inline-block;vertical-align:middle;margin-left:0.5rem" aria-label="Listen">🔊</button>` : ""}
      </div>
      ${rtgs ? `<div class="wc-rtgs">${_wcEsc(rtgs)}</div>` : ""}
      ${english ? `<div class="wc-en">${_wcEsc(english)}</div>` : ""}
      ${rtgs || english ? "" : `<div class="wc-nogloss">Not in the course — here's how it's written.</div>`}
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
  // Keyed on having no EXAMPLE SENTENCE — the honest test for "this card has
  // nothing else to show". Open text pasted into the trainer (see paste.js)
  // can arrive with a gloss and even a romanisation but never with examples,
  // so the decomposition is the main thing on offer; open it rather than
  // making the reader hunt for it. Curriculum words keep it collapsed.
  if (!(typeof EXAMPLES !== "undefined" && EXAMPLES[thai])) {
    renderDecomposition(decompDiv, thai); decompBuilt = true;
  }
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
    if (!this.el) this.el = _wcRoot().getElementById("word-tooltip");
    _wcRoot().getElementById("tt-thai").textContent = thai;
    _wcRoot().getElementById("tt-rtgs").textContent = rtgs;
    _wcRoot().getElementById("tt-en").textContent   = en;
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
  const el = _wcRoot().getElementById(containerId);
  if (!el) return;
  const ex = (typeof EXAMPLES !== "undefined") && EXAMPLES[vocabWord];
  if (!ex) { el.style.display = "none"; return; }

  const [thai, rtgs, eng] = ex;
  const tokens = _tokenise(thai);

  // A phrase-template headword ("ขอ...") appears in its example sentence as
  // only its fixed part (ขอ), so highlight-match on wordLiteral() — the fixed
  // part — not the raw vocabWord, or neither highlight applies. data.js (also
  // vendored) owns the rule and loads before this file.
  const targetWord = wordLiteral(vocabWord);

  // Build interactive Thai line
  let thaiHtml = "";
  for (const tok of tokens) {
    if (!tok.word) {
      thaiHtml += _wcEsc(tok.text);
    } else {
      const isTarget = tok.text === targetWord;
      const cls = "w-token" + (isTarget ? " highlight" : "");
      thaiHtml += `<span class="${cls}" data-w="${_wcEsc(tok.text)}">${_wcEsc(tok.text)}</span>`;
    }
  }

  // Highlight vocab word's romanisation in the sentence rtgs
  const vocabRtgs = wordLiteral((_wcMap()[vocabWord] || [])[1] || "");
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
    <div class="example-thai" lang="th">${speakBtn}${thaiHtml}</div>
    <div class="example-rtgs">${highlightedRtgs}</div>
    <div class="example-en">${_wcEsc(eng)}</div>
  `;
  el.style.display = "";

  const btn = el.querySelector(".example-speak");
  if (btn) btn.addEventListener("click", () => _tts.speak(thai, btn));

  _wcWireTokens(el);
}

// Wire tap-to-define (click → openWordModal) + hover tooltip onto every
// .w-token span within a container — shared by showExample and the graded
// reader (reader.js _readerShow). data-w must hold the exact WORD_MAP/WORDS
// key for the token; tokens whose key doesn't resolve are left inert.
function _wcWireTokens(container) {
  container.querySelectorAll(".w-token").forEach(span => {
    const w = _wcMap()[span.dataset.w];
    if (!w) return;
    span.style.cursor = "pointer";
    span.addEventListener("click", () => openWordModal(w));
    if (typeof _tt !== "undefined") {
      span.addEventListener("mouseenter", e => _tt.show(w[0], w[1], w[2], e.clientX, e.clientY));
      span.addEventListener("mouseleave", () => _tt.hide());
    }
  });
}
