// SPIKE runner — does the Thai DOM walker survive hostile markup?
// Usage: node spike/run.mjs      (borrows Playwright from last-baht-bus)
import { createRequire } from "node:module";
const require = createRequire("/Users/mario/projects/last-baht-bus/package.json");
const { chromium } = require("@playwright/test");

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const FIXTURE = `file://${REPO}/spike/fixtures/hostile.html`;

const browser = await chromium.launch();
for (const ev of ["exit", "SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"]) {
  process.on(ev, err => {
    try { browser.process()?.kill("SIGKILL"); } catch {}
    if (ev === "uncaughtException" || ev === "unhandledRejection") { console.error(err); process.exit(1); }
    if (ev !== "exit") process.exit(130);
  });
}

const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass: !!pass, detail: String(detail).slice(0, 78) });

try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message.slice(0, 90)));
  await page.goto(FIXTURE);

  // what the page SAYS, before we touch it — the thing we must not change
  const before = await page.evaluate(() => ({
    body: document.body.innerText,
    editable: document.getElementById("editable").textContent,
    textarea: document.getElementById("ta").value,
    input: document.getElementById("inp").value,
    script: document.getElementById("scr").textContent,
    shadow: document.getElementById("shadowhost").shadowRoot.getElementById("inshadow").textContent,
    mixed: document.getElementById("mixed").textContent,
  }));

  for (const f of ["web/js/tokeniser.js", "web/js/lexicon-th.js", "web/js/segment.js", "spike/thai-dom.js"]) {
    await page.addScriptTag({ path: `${REPO}/${f}` });
  }
  const ready = await page.evaluate(() => new Promise(res => _segLoad(res)));
  check("lexicon loads", ready);

  const stats = await page.evaluate(() => tdScan());
  const after = await page.evaluate(() => ({
    body: document.body.innerText,
    editable: document.getElementById("editable").textContent,
    textarea: document.getElementById("ta").value,
    input: document.getElementById("inp").value,
    script: document.getElementById("scr").textContent,
    shadow: document.getElementById("shadowhost").shadowRoot.getElementById("inshadow").textContent,
    mixed: document.getElementById("mixed").textContent,
    tokens: document.querySelectorAll(".w-token").length,
    plainTokens: [...document.querySelectorAll("#plain .w-token")].map(s => s.textContent),
    shadowTokens: document.getElementById("shadowhost").shadowRoot.querySelectorAll(".w-token").length,
    editableTokens: document.getElementById("editable").querySelectorAll(".w-token").length,
    linkTokens: document.querySelectorAll("#thelink .w-token").length,
  }));

  // ── the page must still say exactly what it said ────────────────────────
  check("page text unchanged", before.body === after.body,
    before.body === after.body ? "" : "TEXT CHANGED");
  check("mixed script/punctuation preserved byte-for-byte", before.mixed === after.mixed, after.mixed);

  // ── things that must never be touched ───────────────────────────────────
  check("contenteditable untouched", after.editableTokens === 0 && before.editable === after.editable);
  check("textarea untouched", before.textarea === after.textarea);
  check("input value untouched", before.input === after.input);
  check("script contents untouched", before.script === after.script);

  // ── things that must be reached ─────────────────────────────────────────
  check("tokens created", after.tokens > 0, `${after.tokens} tokens`);
  check("plain prose segmented", after.plainTokens.length >= 4, after.plainTokens.join("|"));
  check("shadow DOM reached", after.shadowTokens > 0, `${after.shadowTokens} in shadow root`);
  check("link text tokenised", after.linkTokens > 0, `${after.linkTokens} inside <a>`);

  // ── the cases we cannot segment correctly must be DETECTED ──────────────
  check("split words detected", stats.splitRisks >= 2, `splitRisks=${stats.splitRisks}`);
  const blockFalsePositive = await page.evaluate(() =>
    document.querySelectorAll("#blocks .w-token").length);
  check("block boundary not a split word", blockFalsePositive === 2, `${blockFalsePositive} tokens`);

  // ── idempotence: content scripts run again after a re-render ────────────
  const second = await page.evaluate(() => tdScan());
  const afterTwice = await page.evaluate(() => document.querySelectorAll(".w-token").length);
  check("re-scan does not double-wrap", afterTwice === after.tokens,
    `${after.tokens} -> ${afterTwice}`);
  check("re-scan finds nothing new", second.tokens === 0, `${second.tokens} new`);

  // a React-style re-render replaces our spans with raw text; the next scan
  // must pick it up again
  const reRender = await page.evaluate(() => {
    window.__rerender();
    const s = tdScan(document.getElementById("rerender"));
    return { newTokens: s.tokens, present: document.querySelectorAll("#rerender .w-token").length };
  });
  check("re-rendered region re-tokenised", reRender.present > 0,
    `${reRender.newTokens} new, ${reRender.present} present`);

  // ── clicking a token inside a link must not navigate ────────────────────
  await page.evaluate(() => tdWire(document, w => {
    window.__tokenOpened = (window.__tokenOpened || 0) + 1; window.__lastWord = w;
  }));
  const urlBefore = page.url();
  await page.click("#thelink .w-token", { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(250);
  const clicked = await page.evaluate(() => ({
    opened: window.__tokenOpened || 0, link: window.__linkClicked || 0, word: window.__lastWord || "",
  }));
  check("token click fires our handler", clicked.opened > 0, `opened=${clicked.opened} word=${clicked.word}`);
  check("click inside <a> does not navigate", page.url() === urlBefore,
    page.url() === urlBefore ? "url unchanged" : "NAVIGATED AWAY");
  check("page's own link handler suppressed", clicked.link === 0, `fired ${clicked.link}x`);

  // and a token inside an element the page already listens on
  await page.click("#clicky .w-token", { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(150);
  const host = await page.evaluate(() => window.__handlerFired || 0);
  check("page's own click handler not hijacked", host === 0, `host handler fired ${host}x`);

  // ── the no-mutation path: same answers, no footprint ───────────────────
  const wa = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return [r.left + 6, r.top + r.height / 2]; };
    const out = {};
    const [px, py] = box(document.getElementById("plain"));
    out.plain = tdWordAt(px, py);
    const ta = document.getElementById("ta");
    const tr = ta.getBoundingClientRect();
    out.textarea = tdWordAt(tr.left + 10, tr.top + 10);
    const ed = document.getElementById("editable");
    out.editable = tdWordAt(...box(ed));
    return { plain: out.plain && out.plain.word, textareaNull: out.textarea === null,
             editable: out.editable && out.editable.word,
             htmlLen: document.body.innerHTML.length };
  });
  check("tdWordAt finds a word under the pointer", !!wa.plain, `got "${wa.plain}"`);
  check("tdWordAt reads contenteditable safely", !!wa.editable, `got "${wa.editable}" (read, not rewritten)`);
  check("tdWordAt leaves form fields alone", wa.textareaNull, wa.textareaNull ? "null" : "returned a word");

  check("no page errors", errs.length === 0, errs.join("; "));

  console.log(`\nscan: ${JSON.stringify(stats)}  (tokens on page: ${after.tokens})\n`);
  for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
} finally {
  await browser.close();
  try { browser.process()?.kill("SIGKILL"); } catch {}
}
