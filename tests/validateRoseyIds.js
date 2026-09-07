#!/usr/bin/env node
/**
 * Reports content blocks that are missing the `_uuid` their component needs to
 * build stable Rosey translation keys.
 *
 * Components emit `data-rosey-ns="{{ _uuid }}"`, which scopes every translation
 * key inside them. When a block has no `_uuid` the namespace is omitted and the
 * block's keys fall into its parent's namespace, where two instances of the same
 * component on one page silently collide onto one translation — edit one and the
 * other changes too.
 *
 * CloudCannon fills `_uuid` in from `instance_value: UUID` (declared once in
 * cloudcannon.config.yml) as blocks are added, so this only catches content that
 * predates the component gaining a `_uuid`, or blocks written by hand.
 *
 * Advisory by default, because a missing `_uuid` degrades translation quality
 * rather than breaking the site, and Rosey is off unless ROSEY_ENABLED=true.
 * Pass --strict to exit non-zero, for use in CI once a site is translating.
 *
 * Usage:
 *   node ./tests/validateRoseyIds.js
 *   node ./tests/validateRoseyIds.js --strict
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { glob } = require("glob");
const matter = require("gray-matter");

const ROOT = path.join(__dirname, "..");
const COMPONENT_GLOB = "_component-library/**/*.bookshop.yml";
const CONTENT_GLOBS = [
  "src/pages/**/*.md",
  "src/posts/**/*.md",
  "src/services/**/*.md",
  "src/happenings/**/*.md",
  "src/listings/**/*.md",
  "src/_data/*.yml",
  "src/_data/*.json",
];

/**
 * Files whose components are site-wide singletons. There is exactly one of each,
 * rendered identically into every page's chrome, so having no `_uuid` is the
 * intended state: the block's keys land in the `common` namespace opened by the
 * header and footer and get translated once for the whole site instead of once
 * per page. Flagging them would be telling authors to break that.
 */
const SINGLETON_FILES = new Set(["src/_data/site.json"]);

const strict = process.argv.includes("--strict");

/** Components whose blueprint declares `_uuid`, keyed by `_bookshop_name`. */
function componentsNeedingUuid() {
  const needed = new Set();
  for (const file of glob.sync(COMPONENT_GLOB, { cwd: ROOT, absolute: true })) {
    let doc;
    try {
      doc = yaml.load(fs.readFileSync(file, "utf8"));
    } catch (error) {
      continue;
    }
    if (!doc || !doc.blueprint || !("_uuid" in doc.blueprint)) {
      continue;
    }
    // `_bookshop_name` is the component's path within components/, which is what
    // content files reference.
    const relative = path.relative(path.join(ROOT, "_component-library", "components"), file);
    needed.add(path.dirname(relative).split(path.sep).join("/"));
  }
  return needed;
}

/**
 * Walks any parsed content structure looking for objects that name a component.
 * Blocks nest arbitrarily (a section holds cards which hold buttons), so this
 * cannot assume a fixed shape.
 */
function findBlocks(node, needed, found, trail) {
  if (Array.isArray(node)) {
    node.forEach((entry, index) => findBlocks(entry, needed, found, `${trail}[${index}]`));
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }
  const name = node._bookshop_name;
  if (typeof name === "string" && needed.has(name) && !node._uuid) {
    found.push({ name, at: trail || "(root)" });
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "_bookshop_name") {
      continue;
    }
    findBlocks(value, needed, found, trail ? `${trail}.${key}` : key);
  }
}

const needed = componentsNeedingUuid();
const problems = [];

for (const pattern of CONTENT_GLOBS) {
  for (const file of glob.sync(pattern, { cwd: ROOT, absolute: true })) {
    let data;
    try {
      if (file.endsWith(".md")) {
        data = matter(fs.readFileSync(file, "utf8")).data;
      } else if (file.endsWith(".json")) {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
      } else {
        data = yaml.load(fs.readFileSync(file, "utf8"));
      }
    } catch (error) {
      console.warn(`[rosey:ids] Could not parse ${path.relative(ROOT, file)}: ${error.message}`);
      continue;
    }
    if (SINGLETON_FILES.has(path.relative(ROOT, file).split(path.sep).join("/"))) {
      continue;
    }
    const found = [];
    findBlocks(data, needed, found, "");
    for (const block of found) {
      problems.push(`${path.relative(ROOT, file)} — ${block.name} at ${block.at}`);
    }
  }
}

console.log(`[rosey:ids] ${needed.size} components build translation keys from _uuid.`);

if (!problems.length) {
  console.log("[rosey:ids] No content blocks are missing a _uuid.");
  process.exit(0);
}

console.log(
  `\n[rosey:ids] ${problems.length} content block(s) have no _uuid. Their translation\n` +
    `            keys will fall into the parent namespace, so two instances of the\n` +
    `            same component on one page share one translation:\n` +
    problems.map((problem) => `  - ${problem}`).join("\n") +
    `\n\n            Fix by opening the page in CloudCannon and re-saving (which fills\n` +
    `            in _uuid from instance_value), or by adding a unique _uuid by hand.\n`,
);

process.exit(strict ? 1 : 0);
