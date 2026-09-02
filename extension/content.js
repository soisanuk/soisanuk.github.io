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
  return shadow;
}

function _tdHighlight(rect) {
  const hl = _tdInit().getElementById(TD_HL_ID);
  if (!hl) return;
  if (!rect) { hl.style.display = "none"; return; }
  hl.style.display = "block";
  hl.style.left = rect.left + "px";
  hl.style.top = rect.top + "px";
  hl.style.width = rect.width + "px";
  hl.style.height = rect.height + "px";
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
  _tdHighlight(hit.rect);
  const key = hit.word + "|" + hit.rect.left + "," + hit.rect.top;
  if (key === _tdLast) return;
  _tdLast = key;
  const [thai, roman, gloss] = _tdEntry(hit.word, hit.fragment);
  if (typeof _tt === "object" && _tt && (roman || gloss)) {
    _tt.show(thai, roman, gloss, e.clientX, e.clientY);
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
