/**
 * Rosey markup builders shared by BOTH template engines:
 *
 *   - Eleventy (the build)        src/filters/rosey-filters.js
 *   - Bookshop live (the editor)  ./rosey.js
 *
 * It lives in the Bookshop directory because Bookshop's bundler has to be able
 * to resolve it into dist/_cloudcannon/bookshop-live.js; Node can require it
 * from anywhere.
 *
 * Pure by design: no `process`, no `document`, no environment checks. Each
 * engine wraps these in its own enabled/disabled gate. That is what guarantees
 * the Visual Editor's live render carries exactly the same `data-rosey*`
 * attributes as the built HTML — the RCC client reads keys from the live DOM
 * and saves translations under them, so the two must never disagree.
 * `tests/validateRoseyFilterParity.js` enforces it.
 */

/** Rosey joins namespace segments with this; see `separator` in rosey.yml. */
const SEPARATOR = ":";

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

/** ` data-rosey="key"`, or "" when there is nothing to tag. */
function tag(text, key) {
  if (!hasContent(text)) {
    return "";
  }
  const roseyKey = sanitizeKey(key);
  if (!roseyKey) {
    return "";
  }
  return ` data-rosey="${escapeForAttribute(roseyKey)}"`;
}

/** `text` wrapped in a tagged span, or the plain text when it can't be tagged. */
function wrap(text, key) {
  const value = text === null || text === undefined ? "" : String(text);
  const attribute = tag(text, key);
  if (!attribute) {
    return value;
  }
  return `<span${attribute}>${value}</span>`;
}

/** ` data-rosey-ns="segment"`, or "" for an empty value. */
function ns(value) {
  if (!hasContent(value)) {
    return "";
  }
  return ` data-rosey-ns="${escapeForAttribute(sanitizeKey(value))}"`;
}

/** ` data-rosey-root="segment"`; see roseyRoot in rosey-filters.js for the rules. */
function root(value) {
  // `data-rosey-root=""` is not a no-op — it RESETS the namespace, dropping every
  // key below it to the global scope where it can collide with anything. So an
  // empty root is only ever emitted when the caller explicitly asks for one by
  // passing nothing. A non-empty value that sanitises away (a URL of "/", say)
  // emits no attribute at all, leaving the ancestor namespace in place: keeping
  // the wrong-but-scoped namespace beats silently globalising the page.
  if (value === null || value === undefined || String(value).trim() === "") {
    return ` data-rosey-root=""`;
  }
  const rootKey = sanitizeKey(value);
  if (!rootKey) {
    return "";
  }
  return ` data-rosey-root="${escapeForAttribute(rootKey)}"`;
}

/** `tag()` plus `data-type="block"`, which asks the connector for a rich-text editor. */
function markdown(text, key) {
  const attribute = tag(text, key);
  if (!attribute) {
    return "";
  }
  return `${attribute} data-type="block"`;
}

/** ` data-rosey-attrs-explicit='{"attr":"key"}'`, or "". */
function attrs(text, attributeName, key) {
  if (!attributeName || !hasContent(text)) {
    return "";
  }
  const roseyKey = sanitizeKey(key);
  if (!roseyKey) {
    return "";
  }
  const explicit = JSON.stringify({ [String(attributeName)]: roseyKey });
  return ` data-rosey-attrs-explicit='${escapeForJsonAttribute(explicit)}'`;
}

/**
 * Removes every Rosey attribute from a rendered fragment. Used by snippet
 * wrappers: a snippet renders INSIDE a rich-text region that is already tagged
 * as one unit, and Rosey must not see a second tag nested in the first. The
 * `<span>` that `wrap()` adds is left in place — untagged, it is inert.
 *
 * Only the `data-type="block"` that `markdown()` emitted is removed (it always
 * directly follows the `data-rosey` attribute); other `data-type` attributes in
 * the site's own markup are untouched.
 */
function strip(html) {
  if (html === null || html === undefined) {
    return "";
  }
  return String(html).replace(
    /\sdata-rosey(?:-ns|-root)?="[^"]*"(?:\sdata-type="block")?|\sdata-rosey-attrs-explicit='[^']*'/g,
    "",
  );
}

module.exports = {
  SEPARATOR,
  sanitizeKey,
  hasContent,
  tag,
  wrap,
  ns,
  root,
  markdown,
  attrs,
  strip,
};
