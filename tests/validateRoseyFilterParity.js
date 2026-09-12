#!/usr/bin/env node
/**
 * Asserts the Bookshop live filters (browser, `_component-library/bookshop/rosey.js`)
 * and the Eleventy filters (build, `src/filters/rosey-filters.js`) emit identical
 * Rosey markup, with Rosey on and off.
 *
 * Why it matters: the Visual Editor shows Bookshop's in-browser re-render, not
 * dist/. The RCC client reads `data-rosey*` from that live DOM, so if the two
 * engines disagree the editor either finds nothing to translate or saves under a
 * key the build never reads. Any new `rosey*` filter must be registered in both
 * files; this test fails if one is missing.
 */
const assert = require("assert");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PLUGIN = path.join(ROOT, "_component-library/bookshop/rosey.js");
const ELEVENTY = path.join(ROOT, "src/filters/rosey-filters.js");

function bookshopFilters() {
  delete require.cache[require.resolve(PLUGIN)]; // reset the plugin's cached gate
  const filters = {};
  require(PLUGIN).call({ registerFilter: (name, fn) => (filters[name] = fn) }, {});
  return filters;
}

const CASES = [
  ["roseyTag", ["Hello", "heading"]],
  ["roseyTag", ["", "heading"]],
  ["roseyTag", [null, "heading"]],
  ["roseyTag", ["Home", "/"]],
  ["roseyTag", ["Dates and Deadlines", "Dates and Deadlines"]],
  ["roseyTag", ["x", "D325CEF1-b7bd:Text"]],
  ["roseyTag", ["x", ":text"]],
  ["roseyTag", ["x", `a "q" & <b>`]],
  ["roseyWrap", ["Links", "links-heading"]],
  ["roseyWrap", ["Links", ""]],
  ["roseyWrap", [null, "k"]],
  ["roseyWrap", [0, "k"]],
  ["roseyNs", ["08EB0093-E88C"]],
  ["roseyNs", [""]],
  ["roseyNs", [null]],
  ["roseyRoot", ["common"]],
  ["roseyRoot", [""]],
  ["roseyRoot", [null]],
  ["roseyRoot", ["/"]],
  ["roseyRoot", ["item:/posts/hello-world/"]],
  ["roseyMarkdown", ["<p>x</p>", "text"]],
  ["roseyMarkdown", ["", "text"]],
  ["roseyAttrs", ["Alt text", "alt", "hero-alt"]],
  ["roseyAttrs", ["", "alt", "hero-alt"]],
  ["roseyAttrs", ["Alt", "", "hero-alt"]],
  ["roseyAttrs", ["it's & co", "content", "meta:desc"]],
  ["roseyStrip", ['<div data-rosey-ns="u"><p data-rosey="a" data-type="block">x</p><span data-rosey="b">y</span></div>']],
  ["roseyStrip", [`<img alt="a" data-rosey-attrs-explicit='{"alt":"k"}'><p data-type="neutral" data-rosey-root="common">z</p>`]],
  ["roseyStrip", [null]],
];

let checked = 0;
for (const enabled of [true, false]) {
  process.env.ROSEY_ENABLED = enabled ? "true" : "false";
  // The plugin detects the RCC boundary in the DOM; stub just enough of it.
  global.document = { querySelector: (sel) => (sel === "[data-rcc]" && enabled ? {} : null) };
  const eleventy = require(ELEVENTY);
  const live = bookshopFilters();
  const names = Object.keys(eleventy).filter((n) => /^rosey[A-Z]/.test(n));
  for (const name of names) {
    assert.ok(typeof live[name] === "function", `Bookshop plugin does not register ${name}`);
  }
  for (const name of Object.keys(live)) {
    assert.ok(typeof eleventy[name] === "function", `Eleventy filters do not export ${name}`);
  }
  for (const [name, args] of CASES) {
    assert.strictEqual(
      live[name](...args),
      eleventy[name](...args),
      `${name}(${JSON.stringify(args)}) differs between engines (Rosey ${enabled ? "on" : "off"})`
    );
    checked++;
  }
  if (!enabled) {
    // roseyStrip is a pass-through when off, so its input (which contains
    // Rosey markup by construction) is excluded from this check.
    for (const [name, args] of CASES.filter(([n]) => n !== "roseyStrip")) {
      const out = eleventy[name](...args);
      assert.ok(!/data-rosey/.test(String(out)), `${name} emits Rosey markup with the flag off`);
    }
  }
}
delete global.document;
console.log(`[rosey:parity] Bookshop live filters match the Eleventy filters (${checked} cases).`);
