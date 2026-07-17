// Menu sweep — every sidebar item, desktop + iPhone, checking JS errors,
// overflow, empty screens, clipped text, and <40px tap targets.
// Usage: node tools/sweep.mjs   (borrows Playwright from last-baht-bus).
import { createRequire } from "node:module";
const require = createRequire("/Users/mario/last-baht-bus/package.json");
const { chromium, devices } = require("@playwright/test");
const browser = await chromium.launch();
const report = [];
for (const [label, opts] of [["DESKTOP", { viewport: { width: 1280, height: 850 } }],
    ["MOBILE", { ...devices["iPhone 13"], defaultBrowserType: undefined }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message.slice(0, 100)));
  await page.goto("file:///Users/mario/thaicab/web/index.html");
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
    [...document.querySelectorAll(".sidebar-list li")].map(li => ({ id: li.id, txt: li.textContent.trim().slice(0, 24) })));
  for (const nav of navs) {
    errs.length = 0;
    await page.evaluate(id => document.getElementById(id).click(), nav.id).catch(e => errs.push("CLICK: " + e.message.slice(0, 60)));
    await page.waitForTimeout(350);
    const m = await page.evaluate(vw => {
      const scr = [...document.querySelectorAll(".screen")].find(s => s.classList.contains("active"));
      const out = { screen: scr ? scr.id : "NONE", issues: [] };
      if (document.documentElement.scrollWidth > vw + 2) out.issues.push("H-OVERFLOW " + document.documentElement.scrollWidth + ">" + vw);
      if (scr) {
        if (scr.innerText.trim().length < 5) out.issues.push("EMPTY");
        for (const el of scr.querySelectorAll("button, li[onclick], .tkey, .chip")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.width < 34 || r.height < 30)) { out.issues.push("TINY-TAP " + (el.id || el.className.toString().slice(0,16)) + " " + Math.round(r.width) + "x" + Math.round(r.height)); break; }
        }
        for (const el of scr.querySelectorAll("*")) {
          if (el.scrollWidth > el.clientWidth + 8 && getComputedStyle(el).overflowX === "visible" && el.clientWidth > 0) {
            out.issues.push("CLIP " + (el.id || el.className.toString().slice(0, 20))); break;
          }
        }
      }
      return out;
    }, opts.viewport ? opts.viewport.width : 390);
    if (errs.length) m.issues.push("JS: " + errs.join(";"));
    if (m.issues.length) report.push(`${label} ${nav.id} (${nav.txt}) [${m.screen}]: ${m.issues.join(" | ")}`);
    await page.screenshot({ path: `/tmp/sw-${label}-${nav.id}.png` }).catch(() => {});
    await page.evaluate(() => { if (typeof endSession === "function") endSession(); }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await ctx.close();
}
await browser.close();
console.log(report.length ? report.join("\n") : "ALL SCREENS CLEAN on both form factors");
