// The shadow-root shell: where the word card lives on somebody else's page.
//
// A content script that appends its markup and <style> to the host document is
// a bad citizen twice over. Its rules leak out — `.example` and `.rtgs` are
// not exotic class names, and ours would repaint theirs — and the host's rules
// leak in, so the card renders in whatever the page happens to say a div looks
// like. A shadow root closes both directions in one move.
//
// wordcard.js finds its mounts with getElementById, which does not pierce a
// shadow root, so it takes an injectable lookup root (_wcSetRoot). That is the
// only change the two host apps needed, and for them the default is `document`.

const TD_HOST_ID = "soisanuk-reader-root";

// The card's markup, verbatim from web/index.html. Structure only — every
// style comes from shell.css, generated out of the same file.
const TD_SHELL_HTML = `
  <div id="wc-overlay"></div>
  <div id="script-tooltip"></div>
  <div id="word-tooltip">
    <div class="tt-thai" id="tt-thai"></div>
    <div class="tt-rtgs" id="tt-rtgs"></div>
    <div class="tt-en"   id="tt-en"></div>
  </div>
`;

let _tdShadow = null;

/**
 * Build the shell once and hand back its shadow root. Idempotent: a content
 * script can run again on the same page (SPA navigation, bfcache restore) and
 * must not end up with two cards.
 */
function tdShell(cssText) {
  if (_tdShadow) return _tdShadow;
  const existing = document.getElementById(TD_HOST_ID);
  if (existing && existing.shadowRoot) return (_tdShadow = existing.shadowRoot);

  const host = document.createElement("div");
  host.id = TD_HOST_ID;
  // The host element must not participate in the page's layout — no size, no
  // flow, above everything — and must not pass the page's INHERITED
  // properties into the shadow tree.
  //
  // That second part is the subtle one. A shadow root blocks selectors, not
  // inheritance: the host lives in the light DOM, so `* { letter-spacing: 3px
  // !important }` matches IT, and letter-spacing, font-size, color and friends
  // inherit right through the boundary. `all: initial` cuts that off, but it
  // has to be !important to survive a page that shouts — an ordinary inline
  // declaration loses to an author !important rule. Measured: without the
  // !important the card inherited 3px letter-spacing and a 20.8px font from
  // the fixture.
  host.style.cssText =
    "all:initial!important;position:fixed!important;top:0!important;left:0!important;" +
    "width:0!important;height:0!important;z-index:2147483647!important";
  // Some pages style by tag or wildcard; an attribute nobody else uses makes
  // this element identifiable in a bug report.
  host.setAttribute("data-soisanuk", "reader");

  const shadow = host.attachShadow({ mode: "open" });
  if (cssText) {
    const style = document.createElement("style");
    style.textContent = cssText;
    shadow.appendChild(style);
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = TD_SHELL_HTML;
  while (wrap.firstChild) shadow.appendChild(wrap.firstChild);

  // <html>, NOT <body>. A `transform`, `will-change: transform` or
  // `contain: paint` on body makes body the containing block for every
  // position:fixed descendant — including our overlay, highlight and tooltip,
  // which are all fixed. On such a page the card rendered at y=-550 and the
  // user saw a full-viewport scrim and nothing else; the highlight landed a
  // whole scrollY away from the word. Those three properties are ordinary on
  // modern sites (any scroll-animation library sets one). documentElement is
  // the containing block for fixed positioning unless the root itself is
  // transformed, which is far rarer.
  document.documentElement.appendChild(host);
  if (typeof _wcSetRoot === "function") _wcSetRoot(shadow);
  return (_tdShadow = shadow);
}

/** Remove the shell entirely — nothing of ours should survive it. */
function tdShellRemove() {
  const host = document.getElementById(TD_HOST_ID);
  if (host) host.remove();
  _tdShadow = null;
  if (typeof _wcSetRoot === "function") _wcSetRoot(null);
}

if (typeof module === "object" && module.exports) {
  module.exports = { tdShell, tdShellRemove, TD_HOST_ID };
}
