#!/usr/bin/env node
/**
 * Rosey post-build step (Rosey v2 + CloudCannon Connector v2).
 *
 * Runs after Eleventy (and after the Tailwind minify in `.eleventy.js`'s
 * `eleventy.after` hook) to turn the built original-language site in `dist/`
 * into a multilingual one. Used by both `.cloudcannon/postbuild` and
 * `netlify.toml` so the pipeline is defined in exactly one place.
 *
 * Does nothing unless ROSEY_ENABLED === "true".
 *
 * Pipeline (https://rosey.cc/docs/):
 *   1. rosey generate      scan dist/ for data-rosey -> src/rosey/base.json
 *   2. rcc write-locales   sync src/rosey/locales/*.json against base.json, and
 *                          write the dist/_rcc/locales.json manifest
 *   3. rcc install-client  copy the editor client to dist/_rcc/client.mjs
 *   4. rosey build         dist/ + locales -> per-locale dist/
 *   5. report              translated / untranslated / stale, per locale
 *
 * The v1 connector's `tag` and `generate` commands are gone: v2 does not
 * auto-tag (this project tags explicitly in the component library anyway), and
 * `write-locales` replaces `generate`'s YAML-per-page editor files with one
 * JSON file per locale.
 *
 * Configuration comes from `rosey.yml`, which both binaries read directly. The
 * only things passed as flags below are the ones that describe *this script's*
 * temporary directory shuffle, plus overrides Rosey has no config key for.
 */
require("dotenv").config();

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const ROSEY_CONFIG = path.join(ROOT, "rosey.yml");

function readConfig() {
  try {
    const config = yaml.load(fs.readFileSync(ROSEY_CONFIG, "utf8"));
    return config && typeof config === "object" ? config : {};
  } catch (error) {
    return {};
  }
}

const config = readConfig();
const OUTPUT_DIR = path.join(ROOT, config.source || "dist");
const UNTRANSLATED_DIR = path.join(ROOT, "_untranslated_site");
const DEFAULT_LANGUAGE = config.default_language || "en";
const LANGUAGES = Array.isArray(config.languages)
  ? config.languages.filter(Boolean).map(String)
  : [];

/**
 * The locales `rosey build` will actually emit. It has no language filter — it
 * builds one copy of the site per file in the locales directory — so this, not
 * `languages`, is the real output set. `npm run rosey:sync` keeps the two equal;
 * reading the directory means a drifted file still gets cleaned up rather than
 * being quietly published forever.
 */
function builtLocales() {
  const localesDir = path.join(ROOT, config.locales || "src/rosey/locales");
  try {
    return fs
      .readdirSync(localesDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -".json".length));
  } catch (error) {
    return LANGUAGES;
  }
}

if (process.env.ROSEY_ENABLED !== "true") {
  console.log('[rosey] ROSEY_ENABLED is not "true" — skipping translation.');
  process.exit(0);
}

function run(command) {
  console.log(`[rosey] $ ${command}`);
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

if (!fs.existsSync(OUTPUT_DIR)) {
  console.error(
    `[rosey] No build output at ${OUTPUT_DIR}. Run the Eleventy build first.`,
  );
  process.exit(1);
}

// Keep cloudcannon.config.yml's data_config and the locale files in step with
// rosey.yml before anything reads them.
run("node ./utils/syncRoseyLocales.js");

// A previous failed run can leave this behind; it would break the rename below.
fs.rmSync(UNTRANSLATED_DIR, { recursive: true, force: true });

// Eleventy writes into dist/ without clearing it, so locale directories from a
// previous Rosey build survive. Rosey treats an existing dist/<locale>/page.html
// as a pre-translated page and copies it through verbatim instead of generating
// it (https://rosey.app/docs/pretranslated-pages/), which silently serves stale
// markup. Eleventy never emits these directories itself, so anything here is a
// leftover.
//
// The set to clear is the union of the locales configured NOW and the ones the
// last run actually wrote: dropping a locale from rosey.yml would otherwise
// strand its directory in dist/ forever, still being served, with no config left
// that mentions it. That state file is why this is recorded rather than guessed
// from directory names — a site is free to have a real /en/ page of its own.
const STATE_FILE = path.join(ROOT, "src", "rosey", ".last-build-locales.json");

function previouslyBuiltLocales() {
  try {
    const previous = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return Array.isArray(previous) ? previous.filter((l) => typeof l === "string") : [];
  } catch (error) {
    return [];
  }
}

for (const locale of new Set([...previouslyBuiltLocales(), ...builtLocales()])) {
  const stale = path.join(OUTPUT_DIR, locale);
  if (fs.existsSync(stale)) {
    console.log(`[rosey] Removing stale locale output at ${config.source}/${locale}`);
    fs.rmSync(stale, { recursive: true, force: true });
  }
}

run("npx rosey generate");
// --source is the Rosey directory holding BOTH base.json and locales/. The
// connector derives the locales path from it, so it must be the real directory
// rather than the repo root -- passing "rosey" would write locale files to
// rosey/locales/ and leave the ones CloudCannon reads untouched.
run("npx rosey-cloudcannon-connector write-locales --source src/rosey");
run("npx rosey-cloudcannon-connector install-client");

console.log("[rosey] Translating site with Rosey");
fs.renameSync(OUTPUT_DIR, UNTRANSLATED_DIR);

try {
  // --default-language-at-root keeps the original language on the existing URLs
  // and skips the browser-language redirect page. Locales are served from
  // /<locale>/.
  //
  // --default-language names the language the site is AUTHORED in. It comes
  // from rosey.yml rather than being hardcoded to English, so a Spanish-first
  // site sets `default_language: es` and gets lang="es" at the root with
  // English served from /en/ as an ordinary translation.
  //
  // --exclusions overrides Rosey's default of '\.(html?|json)$'. JSON has to be
  // copied through as an asset or dist/_rcc/locales.json — the manifest the
  // editor client reads to discover locales — never reaches the built site.
  run(
    `npx rosey build --source _untranslated_site --dest ${JSON.stringify(config.source || "dist")} ` +
      `--default-language ${JSON.stringify(DEFAULT_LANGUAGE)} ` +
      `--default-language-at-root --exclusions ${JSON.stringify("\\.(html?)$")}`,
  );
} catch (error) {
  // Never leave the build without an output directory.
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.renameSync(UNTRANSLATED_DIR, OUTPUT_DIR);
  }
  throw error;
}

fs.rmSync(UNTRANSLATED_DIR, { recursive: true, force: true });

// Record what this run emitted so the next one can clear it even if the locale
// has since been removed from rosey.yml.
fs.writeFileSync(STATE_FILE, `${JSON.stringify(builtLocales())}\n`);

// Reporting only — an incomplete translation should never fail a build.
//
// Counted from the locale files rather than by parsing `rosey check`'s output.
// `rosey check` compares base.json's raw extracted text against the locale's
// `original`, but `write-locales` normalises whitespace when it writes that
// field, so every key whose source HTML happens to be indented comes back
// "outdated" on a locale file that was written seconds earlier. The connector
// itself normalises before comparing, so those keys are NOT stale in the editor
// and reporting them here would send people looking for work that isn't there.
//
// The three states below are the ones an editor actually sees:
//   translated   value differs from the source text
//   untranslated value is still the source text write-locales seeded
//   stale        source text changed since the translation was last reviewed
//                (`original` vs `_base_original` — the connector's own signal)
function normalise(text) {
  return String(text === null || text === undefined ? "" : text)
    .replace(/\s+/g, " ")
    .trim();
}

for (const locale of builtLocales()) {
  const localeFile = path.join(
    ROOT,
    config.locales || "src/rosey/locales",
    `${locale}.json`,
  );
  let entries;
  try {
    entries = Object.values(JSON.parse(fs.readFileSync(localeFile, "utf8")));
  } catch (error) {
    console.warn(`[rosey] Could not read ${path.relative(ROOT, localeFile)}: ${error.message}`);
    continue;
  }

  let translated = 0;
  let untranslated = 0;
  let stale = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    if (normalise(entry.value) === normalise(entry.original)) {
      untranslated += 1;
    } else {
      translated += 1;
    }
    if (normalise(entry.original) !== normalise(entry._base_original)) {
      stale += 1;
    }
  }

  console.log(
    `[rosey] ${locale}: ${entries.length} keys — ${translated} translated, ` +
      `${untranslated} untranslated, ${stale} stale`,
  );
}

console.log(
  `[rosey] Done. Original (${DEFAULT_LANGUAGE}) at /, ` +
    `${builtLocales().length ? builtLocales().map((l) => `/${l}/`).join(", ") : "no translations"}.`,
);
