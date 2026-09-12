#!/usr/bin/env node
/**
 * Drives the local CloudCannon editor (`cloudcannon dev dist`) in headless
 * Chromium and checks that Rosey translation works in the Visual Editor, which
 * no build-output check can see: Bookshop re-renders every component in the
 * browser, so the live DOM — not dist/ — is what the RCC client reads.
 *
 * Prereqs (dev-only, not project dependencies):
 *   npm i -g @cloudcannon/cli                    # needs Node 24+
 *   npm i --no-save playwright && npx playwright install chromium
 *   ROSEY_ENABLED=true npm run cc:build
 *   cloudcannon dev --no-app-sync dist           # separate terminal
 *
 * Usage:
 *   node ./tests/checkVisualEditorRosey.mjs [--path /src/pages/home.md]
 *     [--collection pages] [--locale es] [--base http://127.0.0.1:10101]
 *
 * Exits non-zero when:
 *   - no data-rosey elements survive Bookshop's live render inside <main>
 *   - a live data-rosey element carries its own data-rosey-ns / -root
 *   - after switching locale, a tagged element inside <main> has no editor
 * Reports (does not fail on) keys present in dist/ but absent live — some
 * sections legitimately don't render in the live engine (e.g. ones built from
 * Eleventy collections) — and on out-of-date flags on a fresh build.
 *
 * Local caveat: `utils/stubCloudCannonInfo.js` writes an info.json with no
 * collection/URL mapping, so the local editor opens every source file inside
 * dist/index.html and only `content_blocks` render live. A post's
 * `editorial_blocks` therefore cannot be checked locally — test them on a
 * hosted CloudCannon site, where the real info.json maps the post to its own
 * output page. A page with no components at all reports 0 live elements.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://127.0.0.1:10101");
const COLLECTION = arg("collection", "pages");
const SOURCE_PATH = arg("path", "/src/pages/home.md");
const LOCALE = arg("locale", "es");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// Runs in the page. Keys resolved with Rosey's rule so a mismatch is visible.
function collect() {
  const text = (el) => el.innerHTML.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
  const roseyKey = (el) => {
    const parts = [];
    for (let n = el; n; n = n.parentElement) {
      const ns = n.getAttribute("data-rosey-ns");
      const root = n.getAttribute("data-rosey-root");
      if (ns) parts.unshift(ns);
      if (root !== null) {
        if (root) parts.unshift(root);
        break;
      }
    }
    return [...parts, el.getAttribute("data-rosey")].join(":");
  };
  return [...document.querySelectorAll("main [data-rosey]")].map((el) => ({
    key: roseyKey(el),
    text: text(el),
    selfNamespaced: el.hasAttribute("data-rosey-ns") || el.hasAttribute("data-rosey-root"),
    nested: el.parentElement?.closest("[data-rosey]") !== null,
  }));
}

const browser = await chromium.launch();
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  // Not `networkidle`: the app keeps long-lived connections open, so wait for the
  // element we need instead.
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector('a[href*="#sites/"]', { timeout: 60000 });
  const siteHref = await page.$eval('a[href*="#sites/"]', (a) => a.getAttribute("href"));
  const siteId = siteHref.match(/#sites\/([^/]+)/)[1];
  const editUrl =
    `${BASE}/#sites/${siteId}/collections/${COLLECTION}:/edit?collection=${COLLECTION}` +
    `&path=${encodeURIComponent(SOURCE_PATH)}&editor=visual`;
  await page.goto(editUrl, { waitUntil: "load" });

  // The site renders in a nested frame; find the one holding the RCC boundary.
  let frame;
  for (let i = 0; i < 60 && !frame; i++) {
    for (const f of page.frames()) {
      if (await f.$("#rcc-locale-switcher").catch(() => null)) frame = f;
    }
    if (!frame) await page.waitForTimeout(500);
  }
  if (!frame) throw new Error("RCC locale switcher never appeared — is ROSEY_ENABLED=true in the build?");
  await page.waitForTimeout(3000); // let Bookshop finish its initial live render

  // The editor frame's URL names the output file it is showing.
  const editorFrame = page.frames().find((f) => f.url().includes("__source/"));
  const builtFile = decodeURIComponent(editorFrame.url().split("__source/")[1].split("?")[0]);
  const live = await frame.evaluate(collect);

  const staticCtx = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticCtx.newPage();
  await staticPage.setContent(fs.readFileSync(path.join(ROOT, builtFile), "utf8"));
  const built = await staticPage.evaluate(collect);

  console.log(`${SOURCE_PATH} -> ${builtFile}`);
  console.log(`  tagged elements in <main>: built ${built.length}, live ${live.length}`);
  if (live.length === 0) failures.push("no data-rosey elements inside <main> after Bookshop's live render");

  const selfNs = live.filter((e) => e.selfNamespaced);
  if (selfNs.length) {
    failures.push(`${selfNs.length} live data-rosey element(s) carry their own -ns/-root (editor and build keys disagree)`);
  }
  const nestedLive = live.filter((e) => e.nested);
  if (nestedLive.length) {
    failures.push(`${nestedLive.length} live data-rosey element(s) nested inside another: ${nestedLive.slice(0, 5).map((e) => e.key).join(", ")}`);
  }

  const liveKeys = new Set(live.map((e) => e.key));
  const builtKeys = new Set(built.map((e) => e.key));
  const missing = [...builtKeys].filter((k) => !liveKeys.has(k));
  if (missing.length) {
    console.log(`  report: ${missing.length} built key(s) not present live:`);
    for (const k of missing.slice(0, 25)) console.log(`      ${k}`);
  }
  const extra = [...liveKeys].filter((k) => !builtKeys.has(k));
  if (extra.length) {
    console.log(`  report: ${extra.length} live key(s) absent from the build (editor-only text?):`);
    for (const k of extra.slice(0, 25)) console.log(`      ${k}`);
  }

  await frame.click("#rcc-locale-switcher");
  await frame.click(`#rcc-locale-popover button[data-locale="${LOCALE}"]`);
  await page.waitForTimeout(8000);
  const result = await frame.evaluate(() => {
    const root = document.querySelector("[data-rcc-translation-root]") || document;
    const tagged = [...root.querySelectorAll("main [data-rosey]:not([data-rcc-ignore])")];
    const withEditor = tagged.filter((el) => el.isContentEditable);
    return {
      tagged: tagged.length,
      withEditor: withEditor.length,
      withoutEditor: tagged.filter((el) => !el.isContentEditable).map((el) => el.getAttribute("data-rosey")),
      stale: root.querySelectorAll("[data-rosey][data-rcc-stale]").length,
    };
  });
  console.log(`  ${LOCALE}: ${result.withEditor}/${result.tagged} tagged <main> elements have an editor, ${result.stale} flagged out of date`);
  if (result.tagged && result.withEditor < result.tagged) {
    failures.push(`${result.tagged - result.withEditor} tagged element(s) without an editor: ${result.withoutEditor.slice(0, 10).join(", ")}`);
  }
  if (result.stale) console.log(`  report: ${result.stale} element(s) flagged out of date on a fresh build — check live vs built markup`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("\nFAIL");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\nPASS");
