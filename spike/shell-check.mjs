// Does the shadow-root shell keep the card and the host page out of each
// other's way? Run: node spike/shell-check.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/Users/mario/projects/last-baht-bus/package.json");
const { chromium } = require("@playwright/test");

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const browser = await chromium.launch();
for (const ev of ["exit", "SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"]) {
  process.on(ev, err => {
    try { browser.process()?.kill("SIGKILL"); } catch {}
    if (ev === "uncaughtException" || ev === "unhandledRejection") { console.error(err); process.exit(1); }
    if (ev !== "exit") process.exit(130);
  });
}
const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass: !!pass, detail: String(detail).slice(0, 74) });

try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message.slice(0, 80)));
  await page.goto(`file://${REPO}/spike/fixtures/hostile-styles.html`);

  const before = await page.evaluate(() => ({
    html: document.body.innerHTML.length,
    text: document.body.innerText,
    prose: JSON.stringify([...document.querySelectorAll("#prose,#rom,#plain")]
      .map(el => { const c = getComputedStyle(el); return [c.color, c.fontSize, c.border, c.letterSpacing]; })),
    height: document.body.getBoundingClientRect().height,
  }));

  const css = readFileSync(`${REPO}/extension/shell.css`, "utf8");
  for (const f of ["web/js/thai-script.js", "web/js/tokeniser.js", "web/js/wordcard.js", "extension/shell.js"]) {
    await page.addScriptTag({ path: `${REPO}/${f}` });
  }
  const built = await page.evaluate(cssText => {
    const shadow = tdShell(cssText);
    return { hasShadow: !!shadow, mounts: ["wc-overlay", "script-tooltip", "word-tooltip", "tt-thai"]
      .map(id => !!shadow.getElementById(id)) };
  }, css);
  check("shell builds with all mounts", built.hasShadow && built.mounts.every(Boolean), JSON.stringify(built.mounts));

  const after = await page.evaluate(() => ({
    html: document.body.innerHTML.length,
    text: document.body.innerText,
    prose: JSON.stringify([...document.querySelectorAll("#prose,#rom,#plain")]
      .map(el => { const c = getComputedStyle(el); return [c.color, c.fontSize, c.border, c.letterSpacing]; })),
    height: document.body.getBoundingClientRect().height,
  }));

  // ── our styles must not reach their page ────────────────────────────────
  check("host page text unchanged", before.text === after.text);
  check("host page computed styles unchanged", before.prose === after.prose,
    before.prose === after.prose ? "" : "OUR CSS LEAKED OUT");
  check("host page layout unchanged", Math.abs(before.height - after.height) < 1,
    `${Math.round(before.height)} -> ${Math.round(after.height)}`);

  // ── their styles must not reach our card ────────────────────────────────
  const inside = await page.evaluate(() => {
    const sh = document.getElementById("soisanuk-reader-root").shadowRoot;
    const tt = sh.getElementById("tt-thai");
    tt.textContent = "ทดสอบ";
    const c = getComputedStyle(tt);
    const host = getComputedStyle(document.getElementById("soisanuk-reader-root"));
    return { fontSize: c.fontSize, color: c.color, letterSpacing: c.letterSpacing,
             hostW: host.width, hostH: host.height, hostPos: host.position };
  });
  // the page screams .tt-thai { font-size:60px } and * { letter-spacing:3px }
  check("host CSS does not reach the card", inside.fontSize !== "60px" && inside.letterSpacing !== "3px",
    `font ${inside.fontSize}, letter-spacing ${inside.letterSpacing}`);
  check("shell host occupies no space", inside.hostW === "0px" && inside.hostH === "0px",
    `${inside.hostW} x ${inside.hostH}, ${inside.hostPos}`);

  // ── idempotence and clean removal ───────────────────────────────────────
  const again = await page.evaluate(cssText => {
    tdShell(cssText); tdShell(cssText);
    return document.querySelectorAll("#soisanuk-reader-root").length;
  }, css);
  check("re-running leaves exactly one shell", again === 1, `${again} hosts`);

  const removed = await page.evaluate(() => {
    tdShellRemove();
    return { hosts: document.querySelectorAll("#soisanuk-reader-root").length,
             html: document.body.innerHTML.length };
  });
  check("removal leaves nothing behind", removed.hosts === 0 && removed.html === before.html,
    `${removed.hosts} hosts, html ${before.html} -> ${removed.html}`);

  check("no page errors", errs.length === 0, errs.join("; "));

  for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
} finally {
  await browser.close();
  try { browser.process()?.kill("SIGKILL"); } catch {}
}
