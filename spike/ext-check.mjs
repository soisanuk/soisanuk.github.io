// Load extension/ as a real unpacked extension and drive it.
// Run: node spike/ext-check.mjs
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire("/Users/mario/projects/last-baht-bus/package.json");
const { chromium } = require("@playwright/test");

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const EXT = `${REPO}/extension`;

const server = createServer((req, res) => {
  try {
    const body = readFileSync(`${REPO}/spike/fixtures/thai-page.html`);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  } catch { res.writeHead(500); res.end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "td-")), {
  headless: true,
  acceptDownloads: true,   // or a download started by Alt+click cannot be observed
  channel: "chromium",
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const kill = () => { try { ctx.close(); } catch {} try { server.close(); } catch {} };
for (const ev of ["exit", "SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"]) {
  process.on(ev, err => { kill(); if (err && err.stack) console.error(err); if (ev !== "exit") process.exit(1); });
}

const results = [];
const check = (n, p, d = "") => results.push({ n, p: !!p, d: String(d).slice(0, 72) });

try {
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message.slice(0, 90)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);   // content scripts + lexicon init

  const before = await page.evaluate(() => ({ text: document.body.innerText, html: document.body.innerHTML.length }));

  const shell = await page.evaluate(() => {
    const host = document.getElementById("soisanuk-reader-root");
    return { present: !!host, shadow: !!(host && host.shadowRoot),
             mounts: host && host.shadowRoot
               ? ["wc-overlay", "script-tooltip", "word-tooltip", "td-highlight"].map(i => !!host.shadowRoot.getElementById(i))
               : [] };
  });
  check("extension loaded and built its shell", shell.present && shell.shadow, JSON.stringify(shell.mounts));

  // hover WITHOUT the modifier — nothing should happen
  const box = await page.locator("#prose").boundingBox();
  await page.mouse.move(box.x + 30, box.y + 10);
  await page.waitForTimeout(200);
  const idle = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    return getComputedStyle(sh.getElementById("td-highlight")).display;
  });
  check("does nothing without the modifier", idle === "none", `highlight display: ${idle}`);

  // hold Alt and hover
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + 32, box.y + 12);
  await page.waitForTimeout(250);
  const active = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    const hl = sh.getElementById("td-highlight");
    const tt = sh.getElementById("word-tooltip");
    return { hl: getComputedStyle(hl).display, w: hl.style.width,
             tip: (tt.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) };
  });
  check("Alt+hover highlights a word", active.hl === "block" && parseFloat(active.w) > 0, `${active.hl}, w=${active.w}`);
  check("tooltip says something about it", active.tip.length > 0, active.tip);

  // Tone colour. The page's own text is never repainted — that would mean
  // wrapping words in spans, which reflows unspaced Thai — so the tone shows
  // in the highlight we draw and in the tooltip's headword. Multi-syllable
  // words abstain, exactly as the app does, because painting two syllables one
  // colour states something false about at least one of them.
  const tones = [];
  for (const dx of [10, 60, 110, 170, 230]) {
    await page.mouse.move(box.x + dx, box.y + 12);
    await page.waitForTimeout(140);
    tones.push(await page.evaluate(() => {
      const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
      const tt = sh.getElementById("tt-thai");
      return { word: tt ? tt.textContent : "",
               bg: getComputedStyle(sh.getElementById("td-highlight")).backgroundColor };
    }));
  }
  const painted = new Set(tones.filter(t => t.word).map(t => t.bg));
  check("the highlight is painted by tone", painted.size >= 3,
    `${painted.size} distinct colours over ${tones.filter(t => t.word).length} words`);
  const TONE_RGB = ["176, 182, 189", "74, 163, 255", "255, 107, 107", "47, 191, 113", "247, 179, 43"];
  check("those colours come from the app's tone palette",
    [...painted].some(c => TONE_RGB.some(t => c.includes(t))),
    [...painted].join(" "));


  // Alt+click opens the card
  await page.mouse.click(box.x + 32, box.y + 12);
  await page.waitForTimeout(400);
  const card = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    const ov = sh.getElementById("wc-overlay");
    return { open: ov.classList.contains("open") || ov.childElementCount > 0,
             text: (ov.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70) };
  });
  check("Alt+click opens the word card", card.open, card.text);

  // A word the lexicon knows but the dictionary does not. บทสนทนา segments as
  // one token and has no Wiktionary gloss; it used to get a highlight and no
  // tooltip, which a reader cannot tell apart from "did not parse".
  // The card from the previous check is still open and its overlay covers
  // the page — close it, or the pointer lands on the overlay and this block
  // measures nothing. (Yes, this exact mistake is in the last commit message.)
  await page.keyboard.up("Alt");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const ng = await page.locator("#nogloss").boundingBox();
  await page.keyboard.down("Alt");
  await page.mouse.move(ng.x + 20, ng.y + ng.height / 2);
  await page.waitForTimeout(200);
  const nogloss = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    const tt = sh.getElementById("word-tooltip");
    return { shown: getComputedStyle(tt).display, thai: sh.getElementById("tt-thai").textContent,
             en: sh.getElementById("tt-en").textContent };
  });
  check("a known word with no gloss still gets a tooltip", nogloss.shown === "block" && nogloss.thai === "บทสนทนา",
    `${nogloss.shown} "${nogloss.thai}"`);
  check("and the tooltip says why there is no meaning", /no meaning on file/.test(nogloss.en), nogloss.en);
  await page.mouse.click(ng.x + 20, ng.y + ng.height / 2);
  await page.waitForTimeout(400);
  const ngCard = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    const ov = sh.getElementById("wc-overlay");
    return { layers: ov.querySelectorAll(".wc-layer").length,
             decomp: ov.querySelectorAll(".decomp-char").length,
             text: ov.textContent.replace(/\s+/g, " ").trim().slice(0, 60) };
  });
  check("Alt-click on it opens the card with the letter breakdown", ngCard.layers > 0 && ngCard.decomp > 0,
    `${ngCard.layers} layers, ${ngCard.decomp} decomp chars: ${ngCard.text}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.keyboard.up("Alt");
  // re-open the original card for the checks that follow
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + 32, box.y + 12);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 32, box.y + 12);
  await page.waitForTimeout(400);

  // The card must actually be READABLE. The CSS extractor once dropped every
  // rule that happened to follow a comment — including #wc-overlay, .wc-layer
  // and #word-tooltip — so the card rendered with transparent backgrounds and
  // black text on a dark scrim, and the only legible thing was the tooltip's
  // yellow headword. Nothing in the suite noticed.
  const paint = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    const cs = sel => { const el = sh.querySelector(sel); if (!el) return null;
      const c = getComputedStyle(el); return { color: c.color, bg: c.backgroundColor }; };
    return { layer: cs(".wc-layer"), thai: cs(".wc-thai"), en: cs(".wc-en"), tip: cs("#word-tooltip") };
  });
  const isBlack = c => c && /rgb\(0, 0, 0\)/.test(c.color);
  const transparent = c => c && /rgba\(0, 0, 0, 0\)/.test(c.bg);
  check("card text is not black-on-dark", !isBlack(paint.layer) && !isBlack(paint.en),
    `layer ${paint.layer && paint.layer.color}`);
  check("the card panel has its scrim", !transparent(paint.layer),
    `layer bg ${paint.layer && paint.layer.bg}`);
  check("the tooltip has its background", paint.tip && !transparent(paint.tip),
    `tooltip bg ${paint.tip && paint.tip.bg}`);
  check("the headword keeps its accent colour", paint.thai && /255, 20, 147/.test(paint.thai.color),
    paint.thai && paint.thai.color);

  // CC BY-SA 3.0 attribution is a condition of using the Wiktionary glosses,
  // and the extension is where it would otherwise go unmet.
  const credit = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    const c = sh.getElementById("td-credit");
    return c ? { shown: getComputedStyle(c).display, text: c.textContent.replace(/\s+/g, " ").trim(),
                 links: [...c.querySelectorAll("a")].map(a => a.href) } : null;
  });
  check("the card credits Wiktionary and its licence",
    credit && credit.shown !== "none" && /Wiktionary/.test(credit.text) && /CC BY-SA 3\.0/.test(credit.text),
    credit ? credit.text.slice(0, 60) : "no credit element");
  check("the credit links to the licence deed",
    credit && credit.links.some(h => /creativecommons\.org\/licenses\/by-sa\/3\.0/.test(h)),
    credit ? credit.links.join(" ") : "");
  await page.keyboard.up("Alt");

  // Escape must close it — the card sits over someone else's page, so a modal
  // with no keyboard exit is a trap.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    return sh.getElementById("wc-overlay").querySelectorAll(".wc-layer").length;
  });
  check("Escape closes the card", closed === 0, `${closed} layers left`);

  const creditGone = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    const c = sh.getElementById("td-credit");
    return c ? getComputedStyle(c).display : "ABSENT";
  });
  check("the credit goes with the card", creditGone === "none", `display: ${creditGone}`);

  // the page itself must be untouched throughout
  const after = await page.evaluate(() => ({ text: document.body.innerText, html: document.body.innerHTML.length }));
  check("host page text unchanged", before.text === after.text);
  check("host page markup unchanged", before.html === after.html, `${before.html} -> ${after.html}`);

  // macOS puts Alt on the Option key, where Chrome already means something by
  // it: Option+click on a link is "download linked file". Our handler has to
  // suppress that as well as navigation, or looking up a word inside a link
  // would quietly drop files in ~/Downloads.
  const downloads = [];
  page.on("download", d => downloads.push(d.suggestedFilename()));
  const linkBox = await page.locator("#thelink").boundingBox();
  const urlBeforeAlt = page.url();
  await page.keyboard.down("Alt");
  await page.mouse.move(linkBox.x + 20, linkBox.y + linkBox.height / 2);
  await page.waitForTimeout(200);
  await page.mouse.click(linkBox.x + 20, linkBox.y + linkBox.height / 2);
  await page.waitForTimeout(600);
  await page.keyboard.up("Alt");
  const altOnLink = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    return sh.getElementById("wc-overlay").querySelectorAll(".wc-layer").length;
  });
  check("Alt+click on a Thai LINK opens the card", altOnLink > 0, `${altOnLink} layers`);
  check("Alt+click on a link does not navigate", page.url() === urlBeforeAlt,
    page.url() === urlBeforeAlt ? "url unchanged" : "NAVIGATED");
  check("Alt+click on a link starts no download", downloads.length === 0,
    downloads.length ? downloads.join(", ") : "none");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  // an ordinary click on a link still navigates
  const urlBefore = page.url();
  await page.click("#thelink").catch(() => {});
  await page.waitForTimeout(400);
  check("a plain click still follows links", page.url() !== urlBefore, page.url() === urlBefore ? "did NOT navigate" : "navigated");

  check("no page errors", errs.length === 0, errs.join("; "));

  for (const r of results) console.log(`  ${r.p ? "PASS" : "FAIL"}  ${r.n}${r.d ? "  — " + r.d : ""}`);
  const failed = results.filter(r => !r.p).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
} finally { kill(); }
