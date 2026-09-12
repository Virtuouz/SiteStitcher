#!/usr/bin/env node
/**
 * Validates the Rosey keys in the BUILT site (run after `npm run cc:build` with
 * ROSEY_ENABLED=true). Source-level checks can't see these problems because keys
 * are assembled from namespaces across nested components at render time.
 *
 * Fails on:
 *
 *   1. Self-namespaced elements — a `data-rosey` element that also carries its
 *      own `data-rosey-ns` or `data-rosey-root`. Rosey's generator applies the
 *      element's own ns/root when building its key; the RCC editor client
 *      (`resolveRoseyKey`) starts at `el.parentElement` and ignores them. The
 *      two disagree, so Visual Editor edits land on a key the build never reads
 *      (and `write-locales` prunes it on the next build).
 *
 *   2. Collisions — one key used by elements with different content. Every
 *      element on that key shows the same translation, and editing one in the
 *      Visual Editor overwrites all of them.
 *
 *   3. Nested tags — a `data-rosey` element inside another. Rosey captures the
 *      outer element's innerHTML (inner tags included) as one translation, and
 *      the editor stacks two inline editors on the same text.
 *
 * Identical content on one key is fine and intended (shared nav labels, "Days").
 *
 * Usage: node ./tests/validateRoseyKeys.js [outputDir] [--verbose]
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const cheerio = require("cheerio");
const { glob } = require("glob");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const config = yaml.load(fs.readFileSync(path.join(ROOT, "rosey.yml"), "utf8")) || {};
const OUT = path.resolve(ROOT, args.find((a) => !a.startsWith("--")) || config.source || "dist");
const SEP = config.separator || ":";
const TAG = config.tag || "data-rosey";
// Rosey writes translated copies to <out>/<locale>/; scan only the original.
const LOCALES = new Set(config.languages || []);

const norm = (html) => String(html || "").replace(/\s+/g, " ").trim();

/** Rosey's own rule (rosey/src/runners/generator/html.rs): the element's own
 *  root/ns apply before its key is built. */
function roseyKey($, el) {
  const chain = [el, ...$(el).parents().toArray()];
  const parts = [];
  for (const node of chain) {
    const $n = $(node);
    const ns = $n.attr(`${TAG}-ns`);
    const root = $n.attr(`${TAG}-root`);
    if (ns) parts.unshift(ns);
    if (root !== undefined) {
      if (root) parts.unshift(root);
      break;
    }
  }
  return [...parts, $(el).attr(TAG)].join(SEP);
}

if (!fs.existsSync(OUT)) {
  console.error(`[rosey:keys] ${OUT} does not exist — run ROSEY_ENABLED=true npm run cc:build first.`);
  process.exit(1);
}

const files = glob
  .sync("**/*.html", { cwd: OUT })
  .filter((f) => !LOCALES.has(f.split("/")[0]) && !f.startsWith("_"));

const selfNamespaced = new Map(); // component -> count
const nested = new Map(); // component -> count
const byKey = new Map(); // key -> [{ file, text, component }]
const details = []; // verbose: one line per offending element

for (const file of files) {
  const $ = cheerio.load(fs.readFileSync(path.join(OUT, file), "utf8"));
  const stack = [];
  const walk = (node) => {
    for (const child of node.children || []) {
      if (child.type === "comment") {
        const name = child.data.match(/bookshop-live name\(([^)]+)\)/);
        if (name) stack.push(name[1]);
        else if (/bookshop-live end/.test(child.data)) stack.pop();
        continue;
      }
      if (child.type !== "tag") continue;
      const $el = $(child);
      if ($el.attr(TAG) !== undefined) {
        const component = stack[stack.length - 1] || "(layout/partial)";
        const key = roseyKey($, child);
        if ($el.attr(`${TAG}-ns`) !== undefined || $el.attr(`${TAG}-root`) !== undefined) {
          selfNamespaced.set(component, (selfNamespaced.get(component) || 0) + 1);
          details.push(`self-ns  ${component}  ${key}  (${file})`);
        }
        if ($el.parents(`[${TAG}]`).length) {
          nested.set(component, (nested.get(component) || 0) + 1);
          details.push(`nested   ${component}  ${key}  (${file})`);
        }
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push({ file, text: norm($el.html()), component });
      }
      walk(child);
    }
  };
  walk($.root()[0]);
}

const collisions = [...byKey].filter(([, uses]) => new Set(uses.map((u) => u.text)).size > 1);

let failed = false;
if (selfNamespaced.size) {
  failed = true;
  console.error("[rosey:keys] data-rosey elements carrying their own -ns/-root (editor and build keys disagree):");
  for (const [component, count] of [...selfNamespaced].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(count).padStart(4)}  ${component}`);
  }
}
if (nested.size) {
  failed = true;
  console.error("\n[rosey:keys] data-rosey elements nested inside another data-rosey element:");
  for (const [component, count] of [...nested].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(count).padStart(4)}  ${component}`);
  }
}
if (collisions.length) {
  failed = true;
  console.error(`\n[rosey:keys] ${collisions.length} key(s) shared by elements with different content:`);
  for (const [key, uses] of collisions) {
    console.error(`  ${key}`);
    const seen = new Set();
    for (const u of uses) {
      const preview = u.text.replace(/<[^>]+>/g, "").slice(0, 50);
      if (seen.has(preview)) continue;
      seen.add(preview);
      console.error(`      "${preview}"  (${u.component}, ${u.file})`);
    }
  }
}
if (VERBOSE && details.length) {
  console.error("\n[rosey:keys] offending elements:");
  for (const line of details) console.error(`  ${line}`);
}
console.log(`[rosey:keys] ${files.length} pages, ${byKey.size} keys checked.`);
process.exit(failed ? 1 : 0);
