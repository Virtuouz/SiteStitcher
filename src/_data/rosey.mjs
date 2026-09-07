import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const ROSEY_CONFIG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../rosey.yml",
);

function isEnabled() {
  return process.env.ROSEY_ENABLED === "true";
}

function readConfig() {
  try {
    const config = yaml.load(fs.readFileSync(ROSEY_CONFIG_PATH, "utf8"));
    return config && typeof config === "object" ? config : {};
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`[rosey] Could not read ${ROSEY_CONFIG_PATH}: ${error.message}`);
    }
    return {};
  }
}

/**
 * Exposes Rosey's configuration to templates as `{{ rosey }}`.
 *
 *   rosey.enabled          ROSEY_ENABLED is "true"
 *   rosey.defaultLanguage  the language the site is authored in, from rosey.yml
 *   rosey.languages        the locales it is translated into
 *   rosey.allLanguages     both, original first — the language switcher's list
 *
 * `rosey.yml` is the single source of truth rather than `site.json` for two
 * reasons: `tests/validateSiteFile.js` strips any top-level key from
 * `site.json` that is missing from `src/_data-ref/site.json`, and `rosey.yml`
 * is the file the Rosey CLI and the CloudCannon Connector actually read. One
 * file, no chance of the build and the templates disagreeing.
 *
 * `defaultLanguage` is deliberately not defaulted to English anywhere in this
 * codebase. A Spanish-first site sets `default_language: es` and lists `en`
 * under `languages`; English is then a translation like any other. `en` is the
 * fallback here only because a value is needed for the `lang` attribute when
 * the config is missing entirely.
 *
 * This is an .mjs file, unlike the CommonJS `meta.js` beside it, because
 * Eleventy loads data files with `import()`. Under CJS interop Node lifts
 * recognisable object-literal keys into named exports, so a CommonJS
 * `module.exports = { enabled, languages }` reaches templates as
 * `{default, "module.exports", enabled}` and `rosey.languages` reads as
 * undefined. Real ESM has an unambiguous default export.
 */
export default function () {
  const config = readConfig();
  const enabled = isEnabled();

  const defaultLanguage =
    typeof config.default_language === "string" && config.default_language.trim()
      ? config.default_language.trim()
      : "en";

  const languages = enabled && Array.isArray(config.languages)
    ? config.languages.filter(Boolean).map((locale) => String(locale).trim())
    : [];

  return {
    enabled,
    defaultLanguage,
    languages,
    allLanguages: [defaultLanguage, ...languages.filter((l) => l !== defaultLanguage)],
  };
}
