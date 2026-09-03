// Paste Text — bring your own Thai and pull it apart.
//
// The graded reader (reader.js) only serves sentences built from the
// curriculum, which is the point of it: everything is decodable. This screen
// is the opposite trade — any text at all, segmented by the open-text lexicon
// (segment.js), with the analysis degrading honestly:
//
//   • a word the curriculum teaches  → the full word card, gloss and examples
//   • a word Wiktionary knows         → the card with a short English gloss and
//     a romanisation (gloss.js, ~63% of the lexicon), but no examples
//   • anything else                   → the card with no gloss at all: character
//     decomposition and per-syllable tone reasoning, which the script engine
//     derives from spelling alone and so works on vocabulary we've never seen
//   • a FRAGMENT (segment.js flags these) → letters only, never a meaning. A
//     lexicon word wedged against unmatched Thai is usually a piece of a longer
//     word the list doesn't have: เซเว่น yields เซ, which really does mean
//     "to stagger", and saying so is worse than saying nothing
//   • tone colour                    → only where toneOfWord will vouch for it
//
// The lexicon is ~240KB and loads on first use, so this file never touches it
// at load time.

const PASTE_TEXT_KEY = "soisanuk_pastetext";

// The text currently ON SCREEN — not what's in the textarea. The two diverge
// the moment someone types without pressing Analyse, and 🎨 must re-render
// what they are reading rather than silently swapping in the box's contents.
let _pasteShown = "";
// Bumped by every Analyse and by Clear, so a lexicon load that resolves late
// can tell it has been superseded and drop its render on the floor.
let _pasteRun = 0;
// startPaste() re-analyses the saved text on EVERY visit. On a phone a 300k
// paste blocks the main thread for ~4.5s, every single time, with no way to
// tell why — and it would keep doing it forever until the user pressed Clear.
// Above this, the text is restored into the box but not analysed: one tap gets
// it back, and the cost is opt-in rather than a tax on entering the screen.
const PASTE_AUTO_MAX = 5000;
const PASTE_SAMPLE =
  "รัฐบาลประกาศมาตรการใหม่เพื่อช่วยเหลือประชาชน " +
  "ราคาน้ำมันเพิ่มขึ้นอย่างต่อเนื่องตั้งแต่ต้นปี";

function startPaste() {
  const saved = (() => { try { return localStorage.getItem(PASTE_TEXT_KEY) || ""; } catch (e) { return ""; } })();
  document.getElementById("paste-body").innerHTML = `
    <div class="card-prompt paste-intro">Paste any Thai — a headline, a menu, a LINE message — and it gets
      split into words. Tap any word for its letters and tone rule; most also carry a meaning, and the ones
      the course teaches bring their examples too.</div>
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
  if (saved && saved.length <= PASTE_AUTO_MAX) pasteAnalyse();
  else if (saved) document.getElementById("paste-out").innerHTML =
    `<div class="paste-status">${saved.length.toLocaleString()} characters saved from last time —
      press Analyse when you're ready.</div>`;
}

function pasteSample() {
  document.getElementById("paste-input").value = PASTE_SAMPLE;
  pasteAnalyse();
}

function pasteClear() {
  _pasteRun++;               // cancel any in-flight analyse
  _pasteShown = "";
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

  const run = ++_pasteRun;
  out.innerHTML = `<div class="paste-status">Loading the word list…</div>`;
  _segLoad(ok => {
    if (run !== _pasteRun) return;   // superseded by another Analyse, or by Clear
    if (!ok) {
      out.innerHTML = `<div class="paste-status paste-error">Couldn't load the word list
        (js/lexicon-th.js). Segmentation needs it — everything else in the app still works.</div>`;
      return;
    }
    // Glosses are a bonus layer: render either way, never block on them.
    // The setTimeout matters on a big paste: without it the status message is
    // written and replaced inside one task, so it never paints and the screen
    // just freezes showing the PREVIOUS result.
    _glossLoad(() => {
      if (run !== _pasteRun) return;
      setTimeout(() => { if (run === _pasteRun) _pasteRender(text, out, true); }, 0);
      // and the gap-filler beneath it, which covers 3,595 words Wiktionary
      // does not. Loaded after, not instead: it is consulted last.
      _volLoad(() => {
        if (run !== _pasteRun) return;
        setTimeout(() => { if (run === _pasteRun) _pasteRender(text, out, true); }, 0);
      });
    });
  });
}

// One line per source line, so pasted paragraphs keep their shape.
function _pasteRender(text, out, reveal) {
  _pasteShown = text;
  const colorOn = _readerColorOn();
  let known = 0, total = 0, glossed = 0;
  const lines = text.split("\n").map(line => {
    if (!line.trim()) return `<div class="paste-line paste-line-blank"></div>`;
    const html = segmentThai(line).map(t => {
      // an unknown run is punctuation/Latin/whitespace — never a Thai word, so
      // it stays inert text rather than becoming a tappable token
      if (!t.known) return _wcEsc(t.text);
      total++;
      if (typeof WORD_MAP !== "undefined" && WORD_MAP[t.text]) known++;
      if (!t.fragment && thaiGloss(t.text)) glossed++;
      const tone = (typeof toneOfWord === "function") ? toneOfWord(t.text) : null;
      const style = (colorOn && tone) ? ` style="color:${TONE_COLORS[tone]}"` : "";
      const frag = t.fragment ? ` data-frag="1" title="Part of a longer word — meaning not shown"` : "";
      // With colours on, a word whose tone we can't prove is left alone — but
      // mid-tone grey and ordinary text are nearly the same shade, so the
      // abstention read as a claim of "mid" on most of the screen. Mark it.
      const untoned = (colorOn && !tone) ? ` data-notone="1" title="Tone not determined"` : "";
      return `<span class="w-token"${frag}${untoned} data-w="${_wcEsc(t.text)}">${
        `<span${style}>${_wcEsc(t.text)}</span>`}</span>`;
    }).join("");
    return `<div class="paste-line" lang="th">${html}</div>`;
  }).join("");

  out.innerHTML = `
    <div class="paste-topline">
      <span class="paste-count">${total} word${total === 1 ? "" : "s"} · ${known} in the course ·
        ${glossed} with a meaning</span>
      <button class="btn btn-small ${colorOn ? "sel" : ""}" onclick="_pasteToggleColor()"
        aria-label="Toggle tone colours">🎨 tones</button>
    </div>
    <div class="paste-text">${lines}</div>
    ${colorOn ? _readerLegend().replace("</div>",
      `<span class="paste-notone-key">◌ not determined</span></div>`) : ""}
    <div class="paste-credit">Meanings for words outside the course come from
      <a href="https://en.wiktionary.org/" target="_blank" rel="noopener noreferrer">Wiktionary</a>
      (<a href="https://creativecommons.org/licenses/by-sa/3.0/"
      target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>) and
      <a href="https://belisan-volubilis.blogspot.com/" target="_blank" rel="noopener noreferrer">Volubilis</a>
      (<a href="https://creativecommons.org/licenses/by-sa/4.0/"
      target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>).
      A word with more than one meaning shows them separated by \u00b7 — this
      app does not guess which one a sentence means.</div>`;
  _pasteWireTokens(document.getElementById("paste-out"));
  // On a phone with the keyboard up the result lands ~116px below the fold, so
  // tapping Analyse looks like it did nothing and people tap it again. Drop the
  // keyboard and bring the result into view. Only on a fresh Analyse — a 🎨
  // toggle must not yank you away from where you were reading.
  if (reveal) {
    const ta = document.getElementById("paste-input");
    if (ta && IS_MOBILE) ta.blur();
    const top = out.querySelector(".paste-topline");
    if (top && top.scrollIntoView) top.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

function _pasteToggleColor() {
  _readerSetColor(!_readerColorOn());   // shared preference, one 🎨 for both screens
  // Re-render what is on screen. Going through pasteAnalyse() would re-read the
  // textarea, which silently replaced the analysis with un-analysed box contents
  // — and blanked the screen entirely when the box had been cleared.
  if (_pasteShown) _pasteRender(_pasteShown, document.getElementById("paste-out"));
}

// Like _wcWireTokens (wordcard.js), but it does NOT skip words missing from the
// curriculum map — on open text most words are missing, and the script/tone
// analysis is exactly what this screen exists to show. A non-curriculum word
// opens the same card with a Wiktionary gloss when there is one and no gloss
// at all when there isn't; both cases go through openWordModal's blank-rtgs
// handling, which auto-opens the decomposition.
function _pasteWireTokens(container) {
  container.querySelectorAll(".w-token").forEach(span => {
    const thai = span.dataset.w;
    // A fragment gets NO gloss and NO romanisation, whatever the dictionary
    // says about it in isolation — the letters and the tone rule still hold,
    // because those come from the spelling, and they are the useful half.
    const frag = span.dataset.frag === "1";
    const w = frag ? null : ((typeof _wcMap === "function") ? _wcMap()[thai] : null);
    const entry = frag ? [thai, "", ""]
                       : (w || [thai, thaiRoman(thai) || "", thaiGloss(thai) || ""]);
    span.style.cursor = "pointer";
    // Reachable without a pointer: every token is a real control, not decoration.
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    span.setAttribute("aria-label", thai + (entry[2] ? " — " + entry[2] : ""));
    const open = () => openWordModal(entry);
    span.addEventListener("click", open);
    span.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
    if (typeof _tt !== "undefined" && (w || entry[2])) {
      span.addEventListener("mouseenter", e => _tt.show(entry[0], entry[1], entry[2], e.clientX, e.clientY));
      span.addEventListener("mouseleave", () => _tt.hide());
    }
  });
}
