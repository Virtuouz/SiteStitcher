#!/usr/bin/env node
/**
 * Rosey post-build step.
 *
 * Runs after Eleventy (and after the Tailwind minify in `.eleventy.js`'s
 * `eleventy.after` hook) to turn the built English site in `dist/` into a
 * multilingual one. Used by both `.cloudcannon/postbuild` and `netlify.toml`
 * so the pipeline is defined in exactly one place.
 *
 * Does nothing unless ROSEY_ENABLED === "true".
 *
 * Pipeline (https://rosey.cc/docs/):
 *   1. rosey generate            scan dist/ for data-rosey -> rosey/base.json
 *   2. rcc generate              base.json -> editor YAML -> rosey/locales/*.json
 *   3. rosey build               dist/ + locales -> per-locale dist/
 *   4. rosey check               report on missing/outdated translations
 *
 * We deliberately skip `rosey-cloudcannon-connector tag`: this project tags
 * content explicitly in the component library instead of auto-tagging.
 */
require("dotenv").config();

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "dist");
const UNTRANSLATED_DIR = path.join(ROOT, "untranslated_site");
const RCC_CONFIG = path.join(ROOT, "rosey", "rcc.yaml");
const CHECKS_FILE = path.join(ROOT, "rosey", "checks.json");

function configuredLocales() {
  try {
    const config = yaml.load(fs.readFileSync(RCC_CONFIG, "utf8"));
    return Array.isArray(config && config.locales)
      ? config.locales.filter(Boolean)
      : [];
  } catch (error) {
    return [];
  }
}

if (process.env.ROSEY_ENABLED !== "true") {
  console.log("[rosey] ROSEY_ENABLED is not \"true\" — skipping translation.");
  process.exit(0);
}

function run(command) {
  console.log(`[rosey] $ ${command}`);
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

if (!fs.existsSync(OUTPUT_DIR)) {
  console.error(`[rosey] No build output at ${OUTPUT_DIR}. Run the Eleventy build first.`);
  process.exit(1);
}

// A previous failed run can leave this behind; it would break the rename below.
fs.rmSync(UNTRANSLATED_DIR, { recursive: true, force: true });

// Eleventy writes into dist/ without clearing it, so locale directories from a
// previous Rosey build survive. Rosey treats an existing dist/<locale>/page.html
// as a pre-translated page and copies it through verbatim instead of generating
// it (https://rosey.app/docs/pretranslated-pages/), which silently serves stale
// markup. Eleventy never emits these directories itself, so anything here is a
// leftover.
for (const locale of configuredLocales()) {
  const stale = path.join(OUTPUT_DIR, locale);
  if (fs.existsSync(stale)) {
    console.log(`[rosey] Removing stale locale output at dist/${locale}`);
    fs.rmSync(stale, { recursive: true, force: true });
  }
}

run("npx rosey generate --source dist");
run("npx rosey-cloudcannon-connector generate");

console.log("[rosey] Translating site with Rosey");
fs.renameSync(OUTPUT_DIR, UNTRANSLATED_DIR);

try {
  // --default-language-at-root keeps English on the existing URLs and skips the
  // browser-language redirect page. Locales are served from /<locale>/.
  run(
    "npx rosey build --source untranslated_site --dest dist --default-language-at-root",
  );
} catch (error) {
  // Never leave the build without a dist/ directory.
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.renameSync(UNTRANSLATED_DIR, OUTPUT_DIR);
  }
  throw error;
}

fs.rmSync(UNTRANSLATED_DIR, { recursive: true, force: true });

// Reporting only — an incomplete translation should never fail a build.
try {
  run("npx rosey check");
  // checks.json is keyed by locale at the top level, with a companion
  // "<locale>.urls" entry for the translated-URL files.
  const checks = JSON.parse(fs.readFileSync(CHECKS_FILE, "utf8"));
  for (const [locale, report] of Object.entries(checks)) {
    const states = (report && report.states) || {};
    console.log(
      `[rosey] ${locale}: ${states.current || 0} current, ` +
        `${states.outdated || 0} outdated, ${states.missing || 0} missing, ` +
        `${states.unused || 0} unused`,
    );
  }
} catch (error) {
  console.warn(`[rosey] Skipped translation check: ${error.message}`);
}

console.log("[rosey] Done.");
