// COPIED from spike/thai-dom.js by scripts/build-extension.mjs — do not edit here.
// Edit the source and re-run the build; --check fails on drift.
// SPIKE — step 3 of docs/chrome-extension-handoff.md §4: find Thai runs in
// somebody else's markup and make them tappable, without breaking their page.
//
// This is the one part Paste Text cannot vouch for. Paste Text owns the text,
// controls the markup, and renders once. A content script owns none of that.
// Everything here is about the difference.
//
// Classic script, no modules, no imports — same constraint as web/js/ (see
// CLAUDE.md), so the same file can be a content script or a <script> tag.
// Depends at call time on: segmentThai (segment.js).

// Elements whose text is not prose and must never be rewritten. TEXTAREA and
// INPUT hold user input; SCRIPT/STYLE/NOSCRIPT are code; a rewritten <option>
// changes a form's submitted value.
const TD_SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION",
  "IFRAME", "OBJECT", "SVG", "CANVAS", "MATH",
]);

// U+0E00–U+0E7F. A "Thai run" is a maximal stretch of Thai letters plus the
// marks that belong to them; ASCII and punctuation break it.
const TD_THAI = /[฀-๿]/;
const TD_THAI_RUN = /[฀-๿]+/g;

// Marks that must never begin a run: if a text node starts with one, the
// syllable it belongs to began in the PREVIOUS node and the split is mid-word.
const TD_COMBINING = /^[ัิ-ฺ็-๎]/;

function _tdEsc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Is this node safe to rewrite? Walks ancestors, because contenteditable and
// the skip tags are inherited concerns — a text node three levels inside a
// contenteditable div is still user input.
function tdNodeEditable(node) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (TD_SKIP_TAGS.has(el.tagName)) return true;
    if (el.isContentEditable) return true;
    // our own output — re-running must not wrap a wrapper
    if (el.classList && el.classList.contains("w-token")) return true;
    if (el.dataset && el.dataset.thDone === "1") return true;
  }
  return false;
}

// The interesting failure. A text node is not a word boundary: `<b>ส</b>วัสดี`
// is two nodes, and segmenting each alone cuts สวัสดี in half. Detect it rather
// than pretend it cannot happen — a run that starts with a combining mark, or
// whose neighbour across an INLINE element boundary is also Thai, is a split
// word. Reported, not silently mangled.
function tdSplitRisk(textNode) {
  const t = textNode.nodeValue;
  if (!TD_THAI.test(t)) return null;
  const prev = tdAdjacentText(textNode, -1);
  const next = tdAdjacentText(textNode, 1);
  const startsMid = TD_COMBINING.test(t) || (prev && TD_THAI.test(prev.slice(-1)) && TD_THAI.test(t[0]));
  const endsMid = next && TD_THAI.test(t.slice(-1)) && TD_THAI.test(next[0]);
  return startsMid || endsMid ? { startsMid: !!startsMid, endsMid: !!endsMid } : null;
}

// The text immediately before/after this node in reading order, but only
// across INLINE elements — a block boundary is a real break, so <p>ก</p><p>ข</p>
// is not a split word.
const TD_BLOCKISH = new Set(["P", "DIV", "LI", "TD", "TH", "SECTION", "ARTICLE",
  "H1", "H2", "H3", "H4", "H5", "H6", "BR", "BLOCKQUOTE", "UL", "OL", "TABLE", "TR"]);

function tdAdjacentText(node, dir) {
  let cur = node;
  while (cur) {
    const sib = dir < 0 ? cur.previousSibling : cur.nextSibling;
    if (sib) {
      let n = sib;
      // descend to the nearest text node on that side
      while (n && n.nodeType !== 3) {
        if (n.nodeType === 1 && TD_BLOCKISH.has(n.tagName)) return null;
        n = dir < 0 ? n.lastChild : n.firstChild;
      }
      if (n && n.nodeType === 3) return n.nodeValue;
      return null;
    }
    cur = cur.parentElement;
    if (!cur || TD_BLOCKISH.has(cur.tagName)) return null;
  }
  return null;
}

// Collect the text nodes worth touching. Uses a TreeWalker (cheap, and it does
// not build an array of the whole document) and descends into open shadow
// roots, which a plain walker cannot see.
function tdTextNodes(root = document.body) {
  const out = [];
  const visit = r => {
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 1) {
          if (TD_SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
          if (n.shadowRoot) visit(n.shadowRoot);
          return NodeFilter.FILTER_SKIP;
        }
        if (!TD_THAI.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        return tdNodeEditable(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = w.nextNode())) out.push(n);
  };
  visit(root);
  return out;
}

// Replace one text node with [text, <span class="w-token">, text, ...].
// Only the Thai runs become tokens; everything between them stays a plain text
// node, so spacing, punctuation and Latin are byte-identical to what was there.
function tdWrapNode(textNode, stats) {
  const src = textNode.nodeValue;
  const frag = document.createDocumentFragment();
  let at = 0, made = 0;
  TD_THAI_RUN.lastIndex = 0;
  let m;
  while ((m = TD_THAI_RUN.exec(src))) {
    if (m.index > at) frag.appendChild(document.createTextNode(src.slice(at, m.index)));
    const toks = (typeof segmentThai === "function") ? segmentThai(m[0]) : [{ text: m[0], known: true }];
    for (const t of toks) {
      if (!t.known) { frag.appendChild(document.createTextNode(t.text)); continue; }
      const span = document.createElement("span");
      span.className = "w-token";
      span.dataset.w = t.text;
      if (t.fragment) span.dataset.frag = "1";
      span.textContent = t.text;
      frag.appendChild(span);
      made++;
    }
    at = m.index + m[0].length;
  }
  if (at < src.length) frag.appendChild(document.createTextNode(src.slice(at)));
  if (!made) return 0;
  textNode.parentNode.replaceChild(frag, textNode);
  if (stats) stats.tokens += made;
  return made;
}

// The entry point. Returns what it did, so the spike can be measured rather
// than eyeballed.
function tdScan(root = document.body) {
  const stats = { nodes: 0, tokens: 0, splitRisks: 0, skipped: 0 };
  const nodes = tdTextNodes(root);
  // Measure the cross-boundary damage BEFORE mutating: once we start replacing
  // nodes the sibling relationships we would be inspecting no longer exist.
  const risks = nodes.map(n => tdSplitRisk(n));
  nodes.forEach((n, i) => {
    if (!n.parentNode) { stats.skipped++; return; }   // detached by an earlier replace
    if (risks[i]) stats.splitRisks++;
    stats.nodes++;
    tdWrapNode(n, stats);
  });
  return stats;
}

if (typeof module === "object" && module.exports) {
  module.exports = { tdScan, tdTextNodes, tdSplitRisk, tdWrapNode, tdNodeEditable };
}

// Wiring, and the reason it cannot be _wcWireTokens.
//
// Two things break if you reuse the trainer's wiring verbatim:
//
// 1. _wcWireTokens (wordcard.js) looks the word up in _wcMap() and RETURNS if
//    it is missing. On the trainer's own screens every token is a curriculum
//    word; on somebody else's page almost none are, so nearly every token
//    would be inert. paste.js already hit this and grew _pasteWireTokens.
// 2. A token inside an <a> is still inside a link. Measured in the spike: a
//    plain click listener never ran — the browser navigated first and took the
//    handler, the page and the listener with it. Anything wrapping text in the
//    wild MUST swallow the activation.
function tdWire(root, onOpen) {
  (root || document).querySelectorAll(".w-token").forEach(span => {
    if (span.dataset.thWired === "1") return;     // idempotent, like the scan
    span.dataset.thWired = "1";
    span.style.cursor = "pointer";
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    const fire = e => {
      // preventDefault stops the <a> navigating; stopPropagation stops the
      // page's own handlers treating this as a click on their widget. Both are
      // needed: they defend against different things.
      e.preventDefault();
      e.stopPropagation();
      if (typeof onOpen === "function") onOpen(span.dataset.w, span);
    };
    span.addEventListener("click", fire);
    span.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") fire(e);
    });
  });
}

if (typeof module === "object" && module.exports) module.exports.tdWire = tdWire;

// ── The no-mutation path ────────────────────────────────────────────────────
// Wrapping words in spans preserves textContent perfectly but REFLOWS the page:
// Thai is unspaced, so a run the browser could not break mid-word becomes a
// row of inline boxes it can break between. Measured on th.wikipedia.org —
// textContent byte-identical, innerText 7 characters different, "เมนูหลัก"
// rendering as "เมนู / หลัก". Nothing was lost; the layout simply moved, which
// for somebody else's page is its own kind of damage.
//
// So: find the word under the pointer instead of marking every word up front.
// No DOM mutation at all — nothing to reflow, nothing to double-wrap, nothing
// for a re-render to destroy, and contenteditable becomes readable rather than
// off-limits. The cost is that hover/tap must be fast, which is why this
// segments ONE text node on demand rather than the document.
function tdWordAt(x, y) {
  const pos = document.caretPositionFromPoint
    ? document.caretPositionFromPoint(x, y)
    : (() => { const r = document.caretRangeFromPoint(x, y);
               return r && { offsetNode: r.startContainer, offset: r.startOffset }; })();
  if (!pos || !pos.offsetNode || pos.offsetNode.nodeType !== 3) return null;
  const node = pos.offsetNode;
  const text = node.nodeValue;
  if (!TD_THAI.test(text)) return null;

  // the Thai run containing the caret
  let s = pos.offset, e = pos.offset;
  while (s > 0 && TD_THAI.test(text[s - 1])) s--;
  while (e < text.length && TD_THAI.test(text[e])) e++;
  if (e <= s) return null;

  const run = text.slice(s, e);
  const toks = (typeof segmentThai === "function") ? segmentThai(run) : [];
  let at = s;
  for (const t of toks) {
    const start = at, end = at + t.text.length;
    if (pos.offset >= start && pos.offset < end) {
      if (!t.known) return null;
      // A Range gives the on-screen box without touching the document, so a
      // highlight can be drawn as an overlay rather than as markup.
      const r = document.createRange();
      r.setStart(node, start); r.setEnd(node, end);
      return { word: t.text, fragment: !!t.fragment, rect: r.getBoundingClientRect(),
               splitLeft: start === 0 && !!tdAdjacentText(node, -1) && TD_THAI.test((tdAdjacentText(node, -1) || " ").slice(-1)),
               splitRight: end === text.length && !!tdAdjacentText(node, 1) && TD_THAI.test((tdAdjacentText(node, 1) || " ")[0]) };
    }
    at = end;
  }
  return null;
}

if (typeof module === "object" && module.exports) module.exports.tdWordAt = tdWordAt;
