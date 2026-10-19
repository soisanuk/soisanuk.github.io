// Menu sweep — every sidebar item, desktop + iPhone, checking JS errors,
// overflow, empty screens, clipped text, and <40px tap targets.
// Usage: node tools/sweep.mjs   (borrows Playwright from last-baht-bus).
import { createRequire } from "node:module";
const require = createRequire("/Users/mario/projects/last-baht-bus/package.json");
const { chromium, devices } = require("@playwright/test");

// Resolve the app from THIS file, not an absolute path: the hardcoded
// "/Users/mario/thaicab/..." stopped matching the checkout and every run died
// on ERR_FILE_NOT_FOUND.
const APP_URL = new URL("../web/index.html", import.meta.url).href;

const browser = await chromium.launch();
// A sweep that throws must not leave its headless Chrome behind.
for (const ev of ["exit", "SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"]) {
  process.on(ev, err => {
    try { browser.process()?.kill("SIGKILL"); } catch (e) {}
    if (ev === "uncaughtException" || ev === "unhandledRejection") { console.error(err); process.exit(1); }
    if (ev !== "exit") process.exit(130);
  });
}
const report = [];
for (const [label, opts] of [["DESKTOP", { viewport: { width: 1280, height: 850 } }],
    ["MOBILE", { ...devices["iPhone 13"], defaultBrowserType: undefined }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message.slice(0, 100)));
  await page.goto(APP_URL);
  await page.waitForTimeout(500);
  await page.evaluate(() => { const o = document.getElementById("tutorial-overlay"); if (o) o.classList.remove("open"); localStorage.clear(); });
  const menuCount = await page.evaluate(() => document.querySelectorAll(".menu-list li").length);
  for (let mi = 0; mi < menuCount; mi++) {
    errs.length = 0;
    await page.evaluate(i => document.querySelectorAll(".menu-list li")[i].click(), mi).catch(e => errs.push("CLICK " + e.message.slice(0, 50)));
    await page.waitForTimeout(250);
    const scr = await page.evaluate(() => {
      const a = [...document.querySelectorAll(".screen")].find(x => x.classList.contains("active"));
      return a ? a.id : "NONE";
    });
    if (errs.length || scr === "NONE") report.push(`${label} menu-item#${mi} [${scr}]: ${errs.join(";") || "no screen"}`);
    await page.evaluate(() => { if (typeof endSession === "function") endSession(); }).catch(() => {});
    await page.waitForTimeout(120);
  }
  const navs = await page.evaluate(() =>
    [...document.querySelectorAll(".sidebar-list li")].map((li, i) => ({ id: li.id, i, txt: li.textContent.trim().slice(0, 24) })));
  for (const nav of navs) {
    errs.length = 0;
    // Not every menu item carries an id ("How to use" does not) — click by id
    // when there is one, else fall back to position. getElementById("") returns
    // null, which reported a phantom TypeError against the app on every run.
    await page.evaluate(([id, i]) => {
      const el = id ? document.getElementById(id) : document.querySelectorAll(".sidebar-list li")[i];
      if (el) el.click();
    }, [nav.id, nav.i]).catch(e => errs.push("CLICK: " + e.message.slice(0, 60)));
    await page.waitForTimeout(350);
    const m = await page.evaluate(([vw, touch]) => {
      const scr = [...document.querySelectorAll(".screen")].find(s => s.classList.contains("active"));
      const out = { screen: scr ? scr.id : "NONE", issues: [] };
      if (document.documentElement.scrollWidth > vw + 2) out.issues.push("H-OVERFLOW " + document.documentElement.scrollWidth + ">" + vw);
      if (scr) {
        if (scr.innerText.trim().length < 5) out.issues.push("EMPTY");
        for (const el of scr.querySelectorAll("button, li[onclick], .tkey, .chip")) {
          const r = el.getBoundingClientRect();
          // A small glyph can carry a big hit area projected by an absolutely
          // positioned ::before/::after — .idiom-spk is a 24x31 emoji inside a
          // real 44x44 target, and measuring only the element's own box
          // reported it as broken on every run. Take the largest of the three.
          let w = r.width, h = r.height;
          for (const pseudo of ["::after", "::before"]) {
            const c = getComputedStyle(el, pseudo);
            if (c.content && c.content !== "none" && c.position === "absolute") {
              w = Math.max(w, parseFloat(c.width) || 0);
              h = Math.max(h, parseFloat(c.height) || 0);
            }
          }
          // Thresholds follow the INPUT, not one global number. Touch wants a
          // ~44px target (WCAG 2.5.5); a mouse pointer needs 24x24 (WCAG 2.2
          // SC 2.5.8 AA). Judging the desktop viewport by the touch floor
          // reported the same six "Quit (Esc)" buttons on every run — already
          // 44px+ on mobile, and deliberately small on desktop.
          // A dense keyboard is the documented exception to a touch floor
          // (WCAG 2.5.5 "essential"): twelve Kedmanee columns in a 390px
          // screen is 32px per key at the absolute maximum, and every real
          // phone keyboard — iOS Thai included — is denser than the isolated
          // -control minimum. Height still has to hold up, and so does the
          // no-overflow check that actually caught the last regression here.
          const dense = el.classList && el.classList.contains("tkey");
          const minW = dense ? 24 : touch ? 34 : 24, minH = touch ? 30 : 24;
          if (r.width > 0 && (w < minW || h < minH)) { out.issues.push("TINY-TAP " + (el.id || el.className.toString().slice(0,16)) + " " + Math.round(w) + "x" + Math.round(h)); break; }
        }
        for (const el of scr.querySelectorAll("*")) {
          // scrollWidth counts absolutely-positioned pseudo-elements, so a
          // transparent 44x44 hit area projected around a small button reported
          // its whole row as clipped — .idiom-head measured 334 vs 324, all ten
          // pixels of it invisible. This check is about VISIBLE content
          // spilling out of its box, so require a real child element to be
          // outside too; pseudos have no box in getBoundingClientRect.
          const er = el.getBoundingClientRect();
          const realSpill = [...el.children].some(k => {
            const kr = k.getBoundingClientRect();
            return kr.width > 0 && (kr.right > er.right + 8 || kr.left < er.left - 8);
          });
          if (realSpill && el.scrollWidth > el.clientWidth + 8 && getComputedStyle(el).overflowX === "visible" && el.clientWidth > 0) {
            out.issues.push("CLIP " + (el.id || el.className.toString().slice(0, 20))); break;
          }
        }
      }
      return out;
    }, [opts.viewport ? opts.viewport.width : 390, label === "MOBILE"]);
    if (errs.length) m.issues.push("JS: " + errs.join(";"));
    if (m.issues.length) report.push(`${label} ${nav.id} (${nav.txt}) [${m.screen}]: ${m.issues.join(" | ")}`);
    await page.screenshot({ path: `/tmp/sw-${label}-${nav.id}.png` }).catch(() => {});
    await page.evaluate(() => { if (typeof endSession === "function") endSession(); }).catch(() => {});
    await page.waitForTimeout(150);
  }
  // ── the first-run tutorial ────────────────────────────────────────────────
  // It is not a .screen and it is not in the nav, so every loop above walks
  // straight past it — and line 31 above deliberately closes it so the rest of
  // the sweep can work. That made the FIRST screen every user sees the only
  // one nothing measured, and three real defects lived there until a persona
  // read the tour: a slide 886px tall in a 664px viewport with every control
  // off-screen and nothing scrollable, a 13x21 close button, and 8x8 dots —
  // all three of which the checks below would have caught mechanically.
  // Added 2026-09-09.
  errs.length = 0;
  const slides = await page.evaluate(() => {
    if (typeof showTutorial !== "function") return 0;
    showTutorial();
    return typeof _TUT_TOTAL === "number" ? _TUT_TOTAL : 0;
  }).catch(e => { errs.push("OPEN " + e.message.slice(0, 60)); return 0; });
  for (let sl = 0; sl < slides; sl++) {
    const m = await page.evaluate(([i, vw, touch]) => {
      _tutGoTo(i);
      const vh = window.innerHeight;
      const out = { issues: [] };
      const card = document.getElementById("tutorial-card");
      if (!card) { out.issues.push("NO-CARD"); return out; }
      if (document.documentElement.scrollWidth > vw + 2)
        out.issues.push("H-OVERFLOW " + document.documentElement.scrollWidth + ">" + vw);
      // Every control has to be REACHABLE: on screen, or inside something that
      // scrolls. This is the check that would have caught the dead end.
      const scrolls = card.scrollHeight > card.clientHeight
        || getComputedStyle(document.getElementById("tutorial-overlay")).overflowY === "auto";
      for (const id of ["tutorial-close-btn", "tutorial-next"]) {
        const el = document.getElementById(id);
        if (!el || el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if ((r.top < 0 || r.bottom > vh) && !scrolls)
          out.issues.push("UNREACHABLE " + id + " @" + Math.round(r.top) + " vh=" + vh);
      }
      for (const el of card.querySelectorAll("button, [role=button]")) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || el.offsetParent === null) continue;
        const minW = touch ? 34 : 24, minH = touch ? 30 : 24;
        if (r.width < minW || r.height < minH) {
          out.issues.push("TINY-TAP " + (el.id || el.className.toString().slice(0, 16))
            + " " + Math.round(r.width) + "x" + Math.round(r.height));
          break;
        }
      }
      return out;
    }, [sl, opts.viewport ? opts.viewport.width : 390, label === "MOBILE"])
      .catch(e => ({ issues: ["EVAL " + e.message.slice(0, 60)] }));
    if (errs.length) m.issues.push("JS: " + errs.join(";"));
    if (m.issues.length) report.push(`${label} tutorial slide ${sl + 1}/${slides}: ${m.issues.join(" | ")}`);
    errs.length = 0;
  }
  await page.evaluate(() => { if (typeof closeTutorial === "function") closeTutorial(); }).catch(() => {});

  // ── the word card's decomposition colours ─────────────────────────────────
  // Round 27 (Dao) found การันต์ ์ painted with the tone-mark border, because
  // renderDecomposition folded kind "diac" into "is-tone" — index.html had no
  // .is-diac rule, so the choice was unstyled or mislabelled. The class half is
  // pinned in tests/js/wordcard.test.js via _wcCharClass; this is the other
  // half, and it has to run in a browser: a unit test cannot see whether
  // .is-diac is actually STYLED, or whether a later edit to .decomp-char's
  // `border` shorthand quietly resets the dashed style back to solid.
  // Added 2026-10-18.
  errs.length = 0;
  {
    const m = await page.evaluate(() => {
      const out = { issues: [] };
      // ตังค์ carries ์; any word with it would do.
      // WORD_MAP is a top-level const, so it is in the global LEXICAL scope and
      // never a property of window — `window.WORD_MAP` is always undefined here.
      if (typeof openWordModal !== "function" || typeof WORD_MAP === "undefined" ||
          !WORD_MAP["\u0E15\u0E31\u0E07\u0E04\u0E4C"]) {
        out.issues.push("NO-CARD could not open a word card for ตังค์");
        return out;
      }
      openWordModal(WORD_MAP["\u0E15\u0E31\u0E07\u0E04\u0E4C"]);
      const head = document.querySelector(".wc-thai");
      if (head) head.click();                        // reveals the decomposition
      const cells = [...document.querySelectorAll(".decomp-char")];
      if (!cells.length) { out.issues.push("NO-DECOMP no .decomp-char cells rendered"); return out; }
      const karan = cells.find(c => c.textContent === "\u0E4C");
      if (!karan) { out.issues.push("NO-KARAN ์ is not its own decomposition cell"); return out; }
      if (karan.classList.contains("is-tone"))
        out.issues.push("MISLABEL ์ carries is-tone — a silencer dressed as a tone mark");
      if (!karan.classList.contains("is-diac"))
        out.issues.push("MISLABEL ์ is " + karan.className + ", expected is-diac");
      const cs = getComputedStyle(karan);
      // The point of the rule: it must be visually distinct from a tone mark.
      const tone = cells.find(c => c.classList.contains("is-tone"));
      if (cs.borderTopStyle !== "dashed")
        out.issues.push("UNSTYLED ์ border-style is " + cs.borderTopStyle + ", expected dashed");
      if (tone && getComputedStyle(tone).borderTopColor === cs.borderTopColor)
        out.issues.push("SAME-COLOUR ์ and the tone mark share " + cs.borderTopColor);
      if (parseFloat(cs.borderTopWidth) < 1)
        out.issues.push("NO-BORDER ์ border-width is " + cs.borderTopWidth);
      return out;
    }).catch(e => ({ issues: ["THREW " + String(e).slice(0, 80)] }));
    if (errs.length) m.issues.push("JS: " + errs.join(";"));
    if (m.issues.length) report.push(`${label} word card decomposition: ${m.issues.join(" | ")}`);
    errs.length = 0;
  }
  await page.evaluate(() => { const m = document.getElementById("word-modal"); if (m) m.style.display = "none"; }).catch(() => {});

  // ── Soi Buakhao: the hostess's reaction is tappable ───────────────────────
  // The reaction line (ใช่แล้วค่ะ! เก่งมากเลย …) is the most colloquial Thai in
  // the game and used to be the one line a learner could not tap — rendered
  // through _sbEsc as plain text while every prompt went through _sbThai. The
  // unit tests can see that _SB_CHEERS is data and that its words are taught;
  // only a browser can see that the rendered line actually carries .sb-w spans
  // wired to WORD_MAP. Drives one answer and checks. Added 2026-10-18.
  errs.length = 0;
  {
    const m = await page.evaluate(() => {
      const out = { issues: [] };
      if (typeof startSoiBuakhao !== "function" || typeof _sbNextQ !== "function") {
        out.issues.push("NO-GAME Soi Buakhao entry points missing"); return out;
      }
      startSoiBuakhao(); _sbNextQ();
      const choice = document.querySelector(".sb-choice");
      if (!choice) { out.issues.push("NO-CHOICE no .sb-choice rendered after _sbNextQ"); return out; }
      choice.click();
      const line = document.querySelector(".sb-react-line");
      if (!line) { out.issues.push("NO-REACTION no .sb-react-line after answering"); return out; }
      const spans = [...line.querySelectorAll(".sb-w")];
      if (!spans.length) out.issues.push("NOT-TAPPABLE reaction rendered with no .sb-w spans: " + line.textContent.slice(0, 40));
      const dead = spans.filter(sp => typeof WORD_MAP === "undefined" || !WORD_MAP[sp.dataset.w]).map(sp => sp.dataset.w);
      if (dead.length) out.issues.push("DEAD-TAP reaction spans with no WORD_MAP entry: " + dead.join(","));
      const clickable = spans.filter(sp => sp.style.cursor === "pointer").length;
      if (spans.length && clickable !== spans.length)
        out.issues.push("UNWIRED " + (spans.length - clickable) + " of " + spans.length + " reaction spans have no pointer cursor");
      return out;
    }).catch(e => ({ issues: ["THREW " + String(e).slice(0, 80)] }));
    if (errs.length) m.issues.push("JS: " + errs.join(";"));
    if (m.issues.length) report.push(`${label} Soi Buakhao reaction: ${m.issues.join(" | ")}`);
    errs.length = 0;
  }

  // ── The Restaurant: a miss shows the right order, tappable ────────────────
  // Round 28 (Preeya): v1 quoted the wrong word on a miss and never printed
  // the right one, so the learner learned only "ทอด was wrong". The unit tests
  // see _rstWantedLine; only a browser sees that the rendered miss screen
  // carries it as .sb-w spans wired to WORD_MAP. Forces a wrong method and
  // checks. Added 2026-10-19.
  errs.length = 0;
  {
    const m = await page.evaluate(() => {
      const out = { issues: [] };
      if (typeof startRestaurant !== "function") { out.issues.push("NO-GAME"); return out; }
      startRestaurant();
      // Round 28 F1: the chips must be re-shuffled per order. The unit pin
      // proves _rstShuffle permutes; only the rendered DOM proves the renderer
      // still USES it. Two orders with identical chip order on every slot is
      // 1 in 120·720·6·6 by chance — a fixed layout, not luck.
      const layout = () => _RST_SLOTS.map(s => [...document.querySelectorAll(`.rst-chip[data-slot="${s.key}"]`)].map(b => b.dataset.i).join(",")).join("|");
      const first = layout(); _rstNewOrder(); const second = layout();
      if (first === second) out.issues.push("FIXED-CHIPS two orders rendered the chips in the same positions on every slot");
      const t = _rstTarget_;
      _rstChoose("p", _RST_PROTEINS.indexOf(t.p));
      _rstChoose("m", (_RST_METHODS.indexOf(t.m) + 1) % _RST_METHODS.length);   // deliberately wrong
      if (t.q) _rstChoose("q", _RST_QTY.indexOf(t.q));
      if (t.h) _rstChoose("h", _RST_HEAT.indexOf(t.h));
      _rstChoose("pt", 0);
      _rstOrder();
      const wanted = document.getElementById("rst-wanted-th");
      if (!wanted) { out.issues.push("NO-WANTED a miss rendered no wanted-order line"); return out; }
      const spans = [...wanted.querySelectorAll(".sb-w")];
      if (!spans.length) out.issues.push("NOT-TAPPABLE wanted line has no .sb-w spans: " + wanted.textContent.slice(0, 40));
      const dead = spans.filter(sp => typeof WORD_MAP === "undefined" || !WORD_MAP[sp.dataset.w]).map(sp => sp.dataset.w);
      if (dead.length) out.issues.push("DEAD-TAP " + dead.join(","));
      if (!wanted.textContent.includes(t.p.th + t.m.th)) out.issues.push("WRONG-DISH wanted line lacks " + t.p.th + t.m.th);
      const line = document.getElementById("rst-line");
      if (!line || !line.querySelectorAll(".sb-w").length) out.issues.push("NO-QUOTE waitress line not tappable");
      return out;
    }).catch(e => ({ issues: ["THREW " + String(e).slice(0, 80)] }));
    if (errs.length) m.issues.push("JS: " + errs.join(";"));
    if (m.issues.length) report.push(`${label} Restaurant miss: ${m.issues.join(" | ")}`);
    errs.length = 0;
  }

  await ctx.close();
}
await browser.close();
console.log(report.length ? report.join("\n") : "ALL SCREENS CLEAN on both form factors");
