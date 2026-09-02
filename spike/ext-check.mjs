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

  // the page itself must be untouched throughout
  const after = await page.evaluate(() => ({ text: document.body.innerText, html: document.body.innerHTML.length }));
  check("host page text unchanged", before.text === after.text);
  check("host page markup unchanged", before.html === after.html, `${before.html} -> ${after.html}`);

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
