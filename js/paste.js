// Paste Text — bring your own Thai and pull it apart.
//
// The graded reader (reader.js) only serves sentences built from the
// curriculum, which is the point of it: everything is decodable. This screen
// is the opposite trade — any text at all, segmented by the open-text lexicon
// (segment.js), with the analysis degrading honestly:
//
//   • a word the curriculum teaches  → the full word card, gloss and examples
//   • any other word                 → the card without a gloss: character
//     decomposition and per-syllable tone reasoning, which the script engine
//     derives from spelling alone and so works on vocabulary we've never seen
//   • tone colour                    → only where toneOfWord will vouch for it
//
// The lexicon is ~240KB and loads on first use, so this file never touches it
// at load time.

const PASTE_TEXT_KEY = "soisanuk_pastetext";
const PASTE_SAMPLE =
  "รัฐบาลประกาศมาตรการใหม่เพื่อช่วยเหลือประชาชน " +
  "ราคาน้ำมันเพิ่มขึ้นอย่างต่อเนื่องตั้งแต่ต้นปี";

function startPaste() {
  const saved = (() => { try { return localStorage.getItem(PASTE_TEXT_KEY) || ""; } catch (e) { return ""; } })();
  document.getElementById("paste-body").innerHTML = `
    <div class="card-prompt paste-intro">Paste any Thai — a headline, a menu, a LINE message — and it gets
      split into words. Tap a word for its letters and tone rule; words the course teaches also get their
      meaning and examples.</div>
    <textarea id="paste-input" class="paste-input" lang="th" rows="5"
      placeholder="วางข้อความภาษาไทยที่นี่…" aria-label="Thai text to analyse">${_wcEsc(saved)}</textarea>
    <div class="btn-row paste-controls">
      <button class="btn btn-primary" onclick="pasteAnalyse()">Analyse</button>
      <button class="btn btn-small" onclick="pasteSample()">Try a sample</button>
      <button class="btn btn-small" onclick="pasteClear()">Clear</button>
    </div>
    <div id="paste-out" class="paste-out"></div>`;
  showScreen("paste-screen", "P");
  const ta = document.getElementById("paste-input");
  if (ta && !saved) ta.focus();
  if (saved) pasteAnalyse();
}

function pasteSample() {
  document.getElementById("paste-input").value = PASTE_SAMPLE;
  pasteAnalyse();
}

function pasteClear() {
  document.getElementById("paste-input").value = "";
  document.getElementById("paste-out").innerHTML = "";
  try { localStorage.removeItem(PASTE_TEXT_KEY); } catch (e) { /* private mode */ }
  document.getElementById("paste-input").focus();
}

function pasteAnalyse() {
  const text = (document.getElementById("paste-input").value || "").trim();
  const out = document.getElementById("paste-out");
  if (!text) { out.innerHTML = ""; return; }
  try { localStorage.setItem(PASTE_TEXT_KEY, text); } catch (e) { /* private mode / quota */ }

  out.innerHTML = `<div class="paste-status">Loading the word list…</div>`;
  _segLoad(ok => {
    if (!ok) {
      out.innerHTML = `<div class="paste-status paste-error">Couldn't load the word list
        (js/lexicon-th.js). Segmentation needs it — everything else in the app still works.</div>`;
      return;
    }
    _pasteRender(text, out);
  });
}

// One line per source line, so pasted paragraphs keep their shape.
function _pasteRender(text, out) {
  const colorOn = _readerColorOn();
  let known = 0, total = 0;
  const lines = text.split("\n").map(line => {
    if (!line.trim()) return `<div class="paste-line paste-line-blank"></div>`;
    const html = segmentThai(line).map(t => {
      // an unknown run is punctuation/Latin/whitespace — never a Thai word, so
      // it stays inert text rather than becoming a tappable token
      if (!t.known) return _wcEsc(t.text);
      total++;
      if (typeof WORD_MAP !== "undefined" && WORD_MAP[t.text]) known++;
      const tone = (typeof toneOfWord === "function") ? toneOfWord(t.text) : null;
      const style = (colorOn && tone) ? ` style="color:${TONE_COLORS[tone]}"` : "";
      return `<span class="w-token" data-w="${_wcEsc(t.text)}">${
        `<span${style}>${_wcEsc(t.text)}</span>`}</span>`;
    }).join("");
    return `<div class="paste-line" lang="th">${html}</div>`;
  }).join("");

  out.innerHTML = `
    <div class="paste-topline">
      <span class="paste-count">${total} word${total === 1 ? "" : "s"} · ${known} in the course</span>
      <button class="btn btn-small ${colorOn ? "sel" : ""}" onclick="_pasteToggleColor()"
        aria-label="Toggle tone colours">🎨 tones</button>
    </div>
    <div class="paste-text">${lines}</div>
    ${colorOn ? _readerLegend() : ""}`;
  _pasteWireTokens(document.getElementById("paste-out"));
}

function _pasteToggleColor() {
  _readerSetColor(!_readerColorOn());   // shared preference, one 🎨 for both screens
  pasteAnalyse();
}

// Like _wcWireTokens (wordcard.js), but it does NOT skip words missing from the
// curriculum map — on open text most words are missing, and the script/tone
// analysis is exactly what this screen exists to show. Unknown words open the
// same card with no gloss; see openWordModal's handling of a blank rtgs.
function _pasteWireTokens(container) {
  container.querySelectorAll(".w-token").forEach(span => {
    const thai = span.dataset.w;
    const w = (typeof _wcMap === "function") ? _wcMap()[thai] : null;
    span.style.cursor = "pointer";
    span.addEventListener("click", () => openWordModal(w || [thai, "", ""]));
    if (w && typeof _tt !== "undefined") {
      span.addEventListener("mouseenter", e => _tt.show(w[0], w[1], w[2], e.clientX, e.clientY));
      span.addEventListener("mouseleave", () => _tt.hide());
    }
  });
}
