// The content script: Thai on any page becomes tappable.
//
// Held to one rule — be a guest. The page's markup is never rewritten (see
// docs/chrome-extension-handoff.md §10: wrapping words in spans reflows Thai
// text, because it is unspaced and inline boxes give the browser new places to
// break). Nothing renders in the page's document; the card lives in a shadow
// root. And nothing happens at all until the reader asks, by holding Alt.
//
// That last part is deliberate. An extension that pops a dictionary on every
// hover, or eats every click, makes the web worse everywhere it is installed.
// Alt is the whole activation surface: hold it to look up, release it to have
// an ordinary browser back.

const TD_MODIFIER = "altKey";
const TD_HL_ID = "td-highlight";

let _tdReady = false;
let _tdLast = "";        // the word currently shown, to avoid redundant work

function _tdInit() {
  const shadow = tdShell(typeof TD_SHELL_CSS === "string" ? TD_SHELL_CSS : "");
  if (!shadow.getElementById(TD_HL_ID)) {
    const hl = document.createElement("div");
    hl.id = TD_HL_ID;
    // Drawn, not inserted: an absolutely positioned box over the word rather
    // than a wrapper around it, so the page's layout never learns we exist.
    hl.style.cssText =
      "position:fixed;pointer-events:none;display:none;border-radius:3px;" +
      "background:rgba(255,20,147,0.18);outline:1px solid rgba(255,20,147,0.55);" +
      "transition:opacity .08s;z-index:1";
    shadow.appendChild(hl);
  }
  _tdCredit(shadow);
  return shadow;
}

// The attribution the glosses are used under.
//
// gloss-th.js is derived from English Wiktionary and carries CC BY-SA 3.0:
// attribution is a condition of use, not a courtesy. The trainer satisfies it
// with a credit line on the Paste Text screen; this is the extension's
// equivalent, and without it the extension is the one place the obligation
// goes unmet the moment it reaches anyone else.
//
// Shown with the card rather than permanently: a credit stapled to every page
// you browse would be its own kind of rude, and the obligation attaches to
// where the glosses are actually displayed.
function _tdCredit(shadow) {
  let el = shadow.getElementById("td-credit");
  if (el) return el;
  el = document.createElement("div");
  el.id = "td-credit";
  el.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;display:none;z-index:2;" +
    "padding:6px 10px;text-align:center;font:11px system-ui,sans-serif;" +
    "color:#a487b8;background:rgba(13,0,21,0.92);border-top:1px solid #43155e";
  el.innerHTML =
    'Meanings from <a href="https://en.wiktionary.org/" target="_blank" rel="noopener noreferrer" ' +
    'style="color:#00cc66">Wiktionary</a>, used under <a ' +
    'href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer" ' +
    'style="color:#00cc66">CC BY-SA 3.0</a>.';
  shadow.appendChild(el);

  // Toggle with the card. The ✕ closes it without going through any of our
  // handlers, so watching the overlay is the only way to stay in step.
  const overlay = shadow.getElementById("wc-overlay");
  if (overlay && typeof MutationObserver === "function") {
    const sync = () => {
      el.style.display = overlay.querySelector(".wc-layer") ? "block" : "none";
    };
    new MutationObserver(sync).observe(overlay, { childList: true, subtree: true });
    sync();
  }
  return el;
}

// The tone a word carries, or null when it cannot be proven. toneOfWord
// (curriculum.js) abstains on anything whose romanisation shows more than one
// syllable, because painting a two-syllable word one colour states something
// false about at least half of it. The app abstains the same way.
function _tdTone(word) {
  return (typeof toneOfWord === "function") ? toneOfWord(word) : null;
}

function _tdHighlight(rect, tone) {
  const hl = _tdInit().getElementById(TD_HL_ID);
  if (!hl) return;
  if (!rect) { hl.style.display = "none"; return; }
  // Tone colour goes on OUR highlight, not on the page's text. Repainting the
  // page would mean wrapping words in spans, which reflows unspaced Thai (§10)
  // — so the tone shows in the box we draw over the word instead.
  const c = (tone && typeof TONE_COLORS === "object" && TONE_COLORS[tone]) || "#ff1493";
  hl.style.background = _tdTint(c, 0.20);
  hl.style.outlineColor = _tdTint(c, 0.70);
  hl.style.display = "block";
  hl.style.left = rect.left + "px";
  hl.style.top = rect.top + "px";
  hl.style.width = rect.width + "px";
  hl.style.height = rect.height + "px";
}

// #rrggbb -> rgba(). The tone palette is hex; the highlight needs alpha.
function _tdTint(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return `rgba(255,20,147,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function _tdHide() {
  _tdLast = "";
  _tdHighlight(null);
  if (typeof _tt === "object" && _tt && typeof _tt.hide === "function") _tt.hide();
}

// What the card should say about a word. Mirrors paste.js's _pasteWireTokens
// rather than wordcard's own _wcWireTokens: that one looks the word up in the
// curriculum map and gives up when it is missing, which on open text is nearly
// always. A fragment gets no gloss and no romanisation — the letters and the
// tone rule still hold, because those come from the spelling.
function _tdEntry(word, fragment) {
  if (fragment) return [word, "", ""];
  const curriculum = (typeof _wcMap === "function") ? _wcMap()[word] : null;
  if (curriculum) return curriculum;
  const roman = (typeof thaiRoman === "function" && thaiRoman(word)) || "";
  const gloss = (typeof thaiGloss === "function" && thaiGloss(word)) || "";
  return [word, roman, gloss];
}

function _tdLook(e) {
  if (!_tdReady || !e[TD_MODIFIER]) { if (_tdLast) _tdHide(); return null; }
  const hit = (typeof tdWordAt === "function") ? tdWordAt(e.clientX, e.clientY) : null;
  if (!hit) { if (_tdLast) _tdHide(); return null; }
  return hit;
}

function _tdOnMove(e) {
  const hit = _tdLook(e);
  if (!hit) return;
  const tone = hit.fragment ? null : _tdTone(hit.word);
  _tdHighlight(hit.rect, tone);
  const key = hit.word + "|" + hit.rect.left + "," + hit.rect.top;
  if (key === _tdLast) return;
  _tdLast = key;
  const [thai, roman, gloss] = _tdEntry(hit.word, hit.fragment);
  if (typeof _tt === "object" && _tt && (roman || gloss)) {
    _tt.show(thai, roman, gloss, e.clientX, e.clientY);
    // Paint the tooltip's headword by tone. It is otherwise always saffron,
    // which says nothing; when the tone cannot be proven it stays saffron,
    // which is the honest answer rather than a guess.
    const th = _tdInit().getElementById("tt-thai");
    if (th) th.style.color = (tone && typeof TONE_COLORS === "object" && TONE_COLORS[tone]) || "";
  }
}

function _tdOnClick(e) {
  const hit = _tdLook(e);
  if (!hit) return;
  // Only when the modifier is down, and only then: a page's own links and
  // buttons must keep working exactly as they do without this installed.
  e.preventDefault();
  e.stopPropagation();
  _tdHide();
  if (typeof openWordModal === "function") openWordModal(_tdEntry(hit.word, hit.fragment));
}

function _tdOnKeyUp(e) {
  if (e.key === "Alt") { _tdHide(); return; }
  if (e.key !== "Escape") return;
  _tdHide();
  // Escape must also close the card. In the trainer main.js owns this; here
  // there is no key handler but ours, so without it the only way out is the ✕
  // — and a modal you cannot dismiss from the keyboard, sitting on top of
  // somebody else's page, is a trap.
  const shadow = _tdInit();
  const layers = shadow.querySelectorAll("#wc-overlay .wc-layer");
  if (layers.length && typeof _wcPop === "function") _wcPop(layers[layers.length - 1]);
}

function tdStart() {
  if (_tdReady) return;
  _tdInit();
  // The lexicon is already present — it is declared as a content script, so
  // _segLoad short-circuits rather than injecting `js/lexicon-th.js`, a path
  // that cannot resolve here.
  if (typeof _segLoad === "function") {
    _segLoad(ok => { _tdReady = !!ok; });
  }
  document.addEventListener("mousemove", _tdOnMove, true);
  document.addEventListener("click", _tdOnClick, true);
  document.addEventListener("keyup", _tdOnKeyUp, true);
  // Scrolling moves the word out from under a highlight drawn in viewport
  // coordinates; cheaper to drop it than to track.
  addEventListener("scroll", _tdHide, { passive: true, capture: true });
}

tdStart();
