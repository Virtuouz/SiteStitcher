/**
 * Rosey internationalization filters (Rosey v2 / CloudCannon Connector v2).
 *
 * These emit `data-rosey*` attribute strings directly into markup, in the same
 * style as `active-link-filter.js` (`{{ entry.url | linkFilter: page.url }}`).
 *
 * Every filter returns "" unless ROSEY_ENABLED === "true", so a default build
 * is byte-for-byte identical to one without Rosey installed.
 *
 * ## Keys are static, not derived from content
 *
 * Under the v1 connector a key was the slugified source text, so editing a
 * heading silently orphaned its translations. v2 keys are stable identifiers
 * that survive content edits, which is what lets the connector mark a
 * translation *stale* (source changed since it was translated) instead of
 * simply losing it. Every filter therefore takes the key as an argument:
 *
 *     {{ content.text | roseyTag: "heading" }}
 *
 * The piped value is still the text, and is used only to decide whether to emit
 * anything at all — tagging an empty element would add a junk key to base.json.
 *
 * ## Keys are built from namespaces, not written out in full
 *
 * A key is the `:`-joined chain of `data-rosey-root` / `data-rosey-ns` values
 * above the element, ending in the element's own `data-rosey`. Components emit
 * `data-rosey-ns` from their block's `_uuid`, so a leaf key only has to be
 * unique within its own component:
 *
 *     <main data-rosey-root="about">              layouts/base.html
 *       <section data-rosey-ns="6ec0bd7f-...">    a component
 *         <h2 data-rosey="heading">               -> about:6ec0bd7f-...:heading
 *
 * `data-rosey-root` also stops upward traversal, which is what makes shared
 * chrome shared: the header and footer open `common`, so `common:nav:home` is
 * one key on every page and is translated once. See `roseyRoot`.
 */

const ENABLED_FLAG = "true";

/** Rosey joins namespace segments with this; see `separator` in rosey.yml. */
const SEPARATOR = ":";

function isEnabled() {
  return process.env.ROSEY_ENABLED === ENABLED_FLAG;
}

/**
 * Keys end up as JSON object keys, YAML-ish CloudCannon input names and HTML
 * attribute values, so keep them to an unambiguous character set. `:` survives
 * because a call site is allowed to write its own nesting ("nav:home").
 *
 * This normalises rather than rejects: a stray space or capital in a key is a
 * typo, not a reason to fail a build, and silently emitting two different keys
 * for what an author wrote as one string would be worse.
 */
function sanitizeKey(key) {
  if (key === null || key === undefined) {
    return "";
  }
  return String(key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    // Keys are often assembled from paths ("meta:/about/:title"), which leaves a
    // hyphen stranded on either side of a separator once the slashes are
    // replaced. Tidy those first, then collapse the empty segments they leave
    // behind, so the key reads as "meta:about:title".
    .replace(new RegExp(`-*${SEPARATOR}-*`, "g"), SEPARATOR)
    .replace(new RegExp(`${SEPARATOR}{2,}`, "g"), SEPARATOR)
    .replace(/^[-:]+|[-:]+$/g, "");
}

/**
 * For a normal double-quoted attribute value. Sanitised keys can't contain any
 * of these, but namespace values are interpolated from content (`_uuid`, page
 * URLs), so escape defensively.
 */
function escapeForAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * For the JSON payload of `data-rosey-attrs-explicit`, which sits inside a
 * SINGLE-quoted attribute. Its double quotes are structural and must stay raw;
 * only `&` and `'` would break out of the attribute.
 */
function escapeForJsonAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("'", "&#39;");
}

/**
 * Is this value worth tagging? Rosey records a key for every tagged element, so
 * tagging an empty one adds a permanently-untranslatable entry to base.json and
 * an empty row to every locale file.
 */
function hasContent(text) {
  return text !== null && text !== undefined && String(text).trim() !== "";
}

/**
 * Marks an element for translation. The key is static and scoped by the
 * enclosing namespaces, so it only needs to be unique within its component.
 *
 *   <h2{{ content.text | roseyTag: "heading" }}>{{ content.text }}</h2>
 *   <a href="..."{{ label | roseyTag: "cta:label" }}>{{ label }}</a>
 *
 * @param {string} text Element content. Only checked for emptiness.
 * @param {string} key  Static key, unique within the current namespace.
 */
function roseyTag(text, key) {
  if (!isEnabled() || !hasContent(text)) {
    return "";
  }
  const roseyKey = sanitizeKey(key);
  if (!roseyKey) {
    return "";
  }
  return ` data-rosey="${escapeForAttribute(roseyKey)}"`;
}

/**
 * Returns `text` wrapped in a tagged span, for text that shares an element with
 * sibling markup (an icon, a decorative quote mark, a form control) where
 * tagging the parent would swallow that markup into the translation.
 *
 *   <a href="...">{% icon %}{{ label | roseyWrap: "label" }}</a>
 *
 * When Rosey is off it returns `text` unchanged, so no extra element appears.
 * Being a filter rather than an `{% if %}` block matters: `{% render %}` gives
 * partials an isolated scope where `rosey.enabled` is not visible, but globally
 * registered filters always are.
 */
function roseyWrap(text, key) {
  const value = text === null || text === undefined ? "" : String(text);
  const tag = roseyTag(text, key);
  if (!tag) {
    return value;
  }
  return `<span${tag}>${value}</span>`;
}

/**
 * Adds a namespace segment for this element and its descendants. Segments from
 * every ancestor concatenate with `:`.
 *
 * Components pass their block's `_uuid`, which is what keeps keys stable when
 * an editor reorders or inserts blocks — an array index would shift every key
 * after the edit and orphan its translations.
 *
 *   <section{{ _uuid | roseyNs }}>
 *     <h2{{ content.heading | roseyTag: "heading" }}>...
 *
 * A falsy value emits nothing, so the component's keys land in the parent
 * namespace rather than under an empty segment. That is a collision risk when
 * the same component appears twice on a page, which is why
 * `tests/validateRoseyIds.js` reports content blocks with no `_uuid`.
 *
 * @param {string} value Namespace segment, usually a block `_uuid`.
 */
function roseyNs(value) {
  if (!isEnabled() || !hasContent(value)) {
    return "";
  }
  return ` data-rosey-ns="${escapeForAttribute(sanitizeKey(value))}"`;
}

/**
 * Opens a *root* namespace: like `roseyNs`, but it also stops Rosey walking
 * further up the tree. Two uses, and only two:
 *
 *   <main{{ page.url | roseyRoot }}>      per-page scope, so the same words on
 *                                         two pages stay independently editable
 *   <footer{{ "common" | roseyRoot }}>    shared chrome, so `common:copyright`
 *                                         is ONE key across the whole site and
 *                                         is translated exactly once
 *
 * The root must be stable. Deriving it from a page title would re-key every
 * string on the page the day someone retitles it, so `layouts/base.html` uses
 * the page URL.
 *
 * @param {string} value Root namespace. `common` for site-wide chrome.
 */
function roseyRoot(value) {
  if (!isEnabled()) {
    return "";
  }
  // `data-rosey-root=""` is not a no-op — it RESETS the namespace, dropping every
  // key below it to the global scope where it can collide with anything. So an
  // empty root is only ever emitted when the caller explicitly asks for one by
  // passing nothing. A non-empty value that sanitises away (a URL of "/", say)
  // emits no attribute at all, leaving the ancestor namespace in place: keeping
  // the wrong-but-scoped namespace beats silently globalising the page.
  if (value === null || value === undefined || String(value).trim() === "") {
    return ` data-rosey-root=""`;
  }
  const root = sanitizeKey(value);
  if (!root) {
    return "";
  }
  return ` data-rosey-root="${escapeForAttribute(root)}"`;
}

/**
 * Tags a block of rendered markdown. `data-type="block"` tells the connector to
 * open a multi-paragraph rich-text editor for the translation rather than a
 * single-line field, matching the input the editor gets for the source.
 *
 * The v1 `rcc-markdown` namespace this replaces is not read by v2.
 *
 *   <div class="c-text"{{ content.text | roseyMarkdown: "body" }}>
 *     {{ content.text | markdownify }}
 *   </div>
 *
 * Rosey substitutes the translation as raw HTML, so the locale value holds the
 * rendered markup, not the markdown source.
 */
function roseyMarkdown(text, key) {
  const tag = roseyTag(text, key);
  if (!tag) {
    return "";
  }
  return `${tag} data-type="block"`;
}

/**
 * Translates an element's attribute (alt text, meta descriptions, placeholders)
 * without translating the element's contents.
 *
 *   <img src="..." alt="{{ alt }}"{{ alt | roseyAttrs: "alt", "hero-alt" }} />
 *   <meta name="description" content="{{ d }}"{{ d | roseyAttrs: "content", "meta-desc" }} />
 *
 * @param {string} text          Attribute value. Only checked for emptiness.
 * @param {string} attributeName The attribute to translate.
 * @param {string} key           Static key for the translation.
 */
function roseyAttrs(text, attributeName, key) {
  if (!isEnabled() || !attributeName || !hasContent(text)) {
    return "";
  }
  const roseyKey = sanitizeKey(key);
  if (!roseyKey) {
    return "";
  }
  const explicit = JSON.stringify({ [String(attributeName)]: roseyKey });
  return ` data-rosey-attrs-explicit='${escapeForJsonAttribute(explicit)}'`;
}

module.exports = {
  isEnabled,
  sanitizeKey,
  roseyTag,
  roseyWrap,
  roseyNs,
  roseyRoot,
  roseyMarkdown,
  roseyAttrs,
};
