import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const RCC_CONFIG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../rosey/rcc.yaml",
);

function isEnabled() {
  return process.env.ROSEY_ENABLED === "true";
}

function readLocales() {
  if (!isEnabled()) {
    return [];
  }
  try {
    const config = yaml.load(fs.readFileSync(RCC_CONFIG_PATH, "utf8"));
    const locales = config && config.locales;
    return Array.isArray(locales) ? locales.filter(Boolean) : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`[rosey] Could not read ${RCC_CONFIG_PATH}: ${error.message}`);
    }
    return [];
  }
}

/**
 * Exposes the Rosey feature flag and configured locales to templates as
 * `{{ rosey.enabled }}` / `{{ rosey.locales }}`.
 *
 * Locales are read from `rosey/rcc.yaml` rather than `site.json` on purpose:
 * `tests/validateSiteFile.js` strips any top-level key from `site.json` that is
 * missing from `src/_data-ref/site.json`, and `rcc.yaml` is the file the Rosey
 * CloudCannon Connector actually reads.
 *
 * This is an .mjs file, unlike the CommonJS `meta.js` beside it, because
 * Eleventy loads data files with `import()`. Under CJS interop Node lifts
 * recognisable object-literal keys into named exports, so a CommonJS
 * `module.exports = { enabled, locales }` reaches templates as
 * `{default, "module.exports", enabled}` and `rosey.locales` reads as
 * undefined. Real ESM has an unambiguous default export.
 */
export default function () {
  return {
    enabled: isEnabled(),
    defaultLocale: "en",
    locales: readLocales(),
  };
}
