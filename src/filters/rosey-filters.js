/**
 * Rosey internationalization filters.
 *
 * These emit `data-rosey*` attribute strings directly into markup, in the same
 * style as `active-link-filter.js` (`{{ entry.url | linkFilter: page.url }}`).
 *
 * Every filter returns "" unless ROSEY_ENABLED === "true", so a default build
 * is byte-for-byte identical to one without Rosey installed.
 *
 * Key generation mirrors `generateRoseyId` from
 * `rosey-cloudcannon-connector/utils` exactly (that module is ESM, so it cannot
 * be required from this CommonJS config). Keeping them identical means keys we
 * write by hand match the ones the RCC auto-tagger would produce.
 */
const slugify = require("slugify");

const MARKDOWN_NAMESPACE = "rcc-markdown";

function isEnabled() {
  return process.env.ROSEY_ENABLED === "true";
}

/** Matches rosey-cloudcannon-connector/utils `generateRoseyId`. */
function generateRoseyId(text) {
  if (!text) {
    return "";
  }
  // Periods break YAML keys but survive encodeURIComponent, so encode them by hand.
  return encodeURIComponent(slugify(String(text))).replaceAll(".", "%2E");
}

/**
 * Rosey keys come out of encodeURIComponent, so `<`, `>`, `&` and `"` are
 * already encoded. Apostrophes are not, and they would terminate the
 * single-quoted attribute used by `data-rosey-attrs-explicit`.
 */
function escapeForAttribute(key) {
  return key.replaceAll("'", "&#39;");
}

/**
 * Marks an element for translation.
 *
 *   <h2{{ content.text | roseyTag }}>{{ content.text }}</h2>
 *   <p{{ content.text | roseyTag: "explicit-key" }}>...</p>
 *
 * @param {string} text  Text used to derive the key.
 * @param {string} [key] Explicit key, when the text is a poor key source.
 */
function roseyTag(text, key) {
  if (!isEnabled()) {
    return "";
  }
  const roseyId = key ? generateRoseyId(key) : generateRoseyId(text);
  if (!roseyId) {
    return "";
  }
  return ` data-rosey="${escapeForAttribute(roseyId)}"`;
}

/**
 * Returns `text` wrapped in a tagged span, for text that shares an element with
 * sibling markup (an icon, a decorative quote mark, a form control) where
 * tagging the parent would swallow that markup into the translation.
 *
 *   <h2 class="...">{% icon %}{{ text | roseyWrap }}</h2>
 *
 * When Rosey is off it returns `text` unchanged, so no extra element appears.
 * Being a filter rather than an `{% if %}` block matters: `{% render %}` gives
 * partials an isolated scope where `rosey.enabled` is not visible, but globally
 * registered filters always are.
 */
function roseyWrap(text, key) {
  const value = text == null ? "" : String(text);
  if (!isEnabled()) {
    return value;
  }
  const tag = roseyTag(text, key);
  if (!tag) {
    return value;
  }
  return `<span${tag}>${value}</span>`;
}

/**
 * Opens a namespace for this element and its descendants. Namespaces from all
 * ancestors concatenate with `:`, so `about-us` + `our-mission` becomes the key
 * `about-us:our-mission`.
 *
 *   <main{{ title | roseyNs }}>            -> data-rosey-ns="Page-Title"
 *   <footer{{ "common" | roseyNs: true }}> -> data-rosey-ns="common"
 *
 * @param {string} text    Text used to derive the namespace.
 * @param {boolean} [raw]  Use `text` verbatim instead of slugifying it. Required
 *                         for namespaces that must match `rcc.yaml` exactly,
 *                         such as `common`.
 */
function roseyNs(text, raw) {
  if (!isEnabled()) {
    return "";
  }
  const namespace = raw ? String(text || "") : generateRoseyId(text);
  if (!namespace) {
    return "";
  }
  return ` data-rosey-ns="${escapeForAttribute(namespace)}"`;
}

/**
 * Tags a block whose contents are rendered markdown. The `rcc-markdown`
 * namespace tells the Rosey CloudCannon Connector to generate a rich-text
 * (`type: markdown`) input for editors rather than a plain text field.
 *
 *   <div class="c-text"{{ content.text | roseyMarkdown }}>
 *     {{ content.text | markdownify }}
 *   </div>
 */
function roseyMarkdown(text, key) {
  if (!isEnabled()) {
    return "";
  }
  const tag = roseyTag(text, key);
  if (!tag) {
    return "";
  }
  return ` data-rosey-ns="${MARKDOWN_NAMESPACE}"${tag}`;
}

/**
 * Translates an element's attribute (alt text, meta descriptions, placeholders)
 * without translating the element's contents.
 *
 *   <img src="..." alt="{{ alt }}"{{ alt | roseyAttrs: "alt" }} />
 *   <meta name="description" content="{{ d }}"{{ d | roseyAttrs: "content" }} />
 *
 * @param {string} text          Attribute value, used to derive the key.
 * @param {string} attributeName Attribute to translate.
 * @param {string} [key]         Explicit key.
 */
function roseyAttrs(text, attributeName, key) {
  if (!isEnabled() || !attributeName) {
    return "";
  }
  const roseyId = key ? generateRoseyId(key) : generateRoseyId(text);
  if (!roseyId) {
    return "";
  }
  const explicit = JSON.stringify({ [attributeName]: roseyId });
  return ` data-rosey-attrs-explicit='${escapeForAttribute(explicit)}'`;
}

module.exports = {
  isEnabled,
  generateRoseyId,
  roseyTag,
  roseyWrap,
  roseyNs,
  roseyMarkdown,
  roseyAttrs,
};
