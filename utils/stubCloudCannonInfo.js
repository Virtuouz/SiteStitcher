#!/usr/bin/env node
/**
 * Creates the `dist/_cloudcannon/info.json` that `npx @bookshop/generate` needs
 * in order to find the built site.
 *
 * ## Why this is needed
 *
 * Bookshop's visual editing is not part of the Eleventy build. Three artifacts
 * make it work, and all three come from `npx @bookshop/generate`:
 *
 *   1. `dist/_cloudcannon/bookshop-live.js` — the live renderer
 *   2. a connector <script> injected into every page containing `bookshop-live`
 *      comments, which loads that renderer inside the Visual Editor
 *   3. `_structures` written into `info.json` — the component list the editor
 *      offers when an author adds a block
 *
 * `generate` discovers sites by globbing for `**\/_cloudcannon/info.json`, and
 * exits 1 with "Could not find any output sites" when there is none. On a
 * hosted CloudCannon build that file is there already — CloudCannon writes it
 * before `.cloudcannon/postbuild` runs. Nothing writes it locally, so
 * `cloudcannon dev dist` shows Bookshop components as inert HTML: the markers
 * are in the page, but no renderer ever binds to them.
 *
 * An empty object is enough. `generate` only ever reads back the keys it wrote
 * itself (`_structures`, `prefetchFiles`), so a stub gives it a valid site to
 * attach to and it fills in the rest.
 *
 * ## Why it is rewritten every time
 *
 * `generate` MERGES into `_structures` rather than replacing it, so a file kept
 * across runs accumulates components that have since been renamed or deleted,
 * and the editor keeps offering them. Starting from `{}` makes each run reflect
 * the component library as it stands.
 *
 * LOCAL ONLY. `.cloudcannon/postbuild` must never call this — it would discard
 * the real info.json CloudCannon generated, taking the site's collection and
 * editing metadata with it. The guard below refuses to overwrite a file holding
 * anything beyond what `generate` writes, so a misfire fails loudly instead.
 *
 * Usage:
 *   node ./utils/stubCloudCannonInfo.js [outputDir]   defaults to dist/
 */
const fs = require("fs");
const path = require("path");

/** Keys `@bookshop/generate` adds itself, and so can safely be thrown away. */
const GENERATED_KEYS = new Set(["_structures", "prefetchFiles"]);

const ROOT = path.join(__dirname, "..");
// Matches `dir.output` in .eleventy.js.
const OUTPUT_DIR = path.join(ROOT, process.argv[2] || "dist");
const INFO_JSON = path.join(OUTPUT_DIR, "_cloudcannon", "info.json");

if (!fs.existsSync(OUTPUT_DIR)) {
  console.error(
    `[cloudcannon] ${path.relative(ROOT, OUTPUT_DIR)} does not exist. Build the site first.`,
  );
  process.exit(1);
}

if (fs.existsSync(INFO_JSON)) {
  let existing;
  try {
    existing = JSON.parse(fs.readFileSync(INFO_JSON, "utf8"));
  } catch (error) {
    existing = {};
  }

  const foreignKeys = Object.keys(existing).filter(
    (key) => !GENERATED_KEYS.has(key),
  );
  if (foreignKeys.length) {
    console.error(
      `[cloudcannon] Refusing to overwrite ${path.relative(ROOT, INFO_JSON)}: it holds ${foreignKeys.join(", ")}.`,
    );
    console.error(
      `[cloudcannon] That is a real info.json — this script is for local builds only.`,
    );
    process.exit(1);
  }
}

fs.mkdirSync(path.dirname(INFO_JSON), { recursive: true });
fs.writeFileSync(INFO_JSON, "{}\n");
console.log(`[cloudcannon] Wrote stub ${path.relative(ROOT, INFO_JSON)}`);
