/**
 * Rosey internationalization filters (Rosey v2 / CloudCannon Connector v2).
 *
 * These emit `data-rosey*` attribute strings directly into markup, in the same
 * style as `active-link-filter.js` (`{{ entry.url | linkFilter: page.url }}`).
 *
 * Every filter returns "" unless ROSEY_ENABLED === "true", so a default build
 * is byte-for-byte identical to one without Rosey installed.
 *
 * ## This file is one of two — keep them in step
 *
 * The Visual Editor does not show the built HTML. Bookshop re-renders every
 * component in the browser and the RCC client reads `data-rosey*` from THAT
 * live DOM, so `_component-library/bookshop/rosey.js` registers the same
 * filters for Bookshop's Liquid engine. Both are thin gates over the shared,
 * environment-free builders in `_component-library/bookshop/rosey-markup.js`.
 * Add any new `rosey*` filter to both; `npm run test:roseyParity` fails if the
 * two ever diverge.
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
 *
 * ## Never put -ns / -root on the tagged element itself
 *
 * Rosey's generator applies an element's OWN `data-rosey-ns` / `data-rosey-root`
 * before building its key; the RCC editor client starts from the parent and
 * ignores them. So `<div data-rosey-ns="abc" data-rosey="text">` is
 * `page:abc:text` to the build but `page:text` to the editor, and an edit is
 * saved under a key the build never reads. Either put the namespace on an
 * untagged ancestor, or fold it into the key:
 *
 *     <section{{ _uuid | roseyNs }}><h2{{ text | roseyTag: "heading" }}>       ancestor
 *     {% capture k %}{{ _uuid }}:text{% endcapture %}<div{{ text | roseyMarkdown: k }}>   folded
 *     <p{{ "common" | roseyRoot }}>{{ "Read more" | roseyWrap: "ui:read-more" }}</p>      root + inner span
 *
 * `npm run test:roseyKeys` checks the built site for violations.
 */

const markup = require("../../_component-library/bookshop/rosey-markup.js");

const ENABLED_FLAG = "true";

/** Rosey joins namespace segments with this; see `separator` in rosey.yml. */
const SEPARATOR = markup.SEPARATOR;

function isEnabled() {
  return process.env.ROSEY_ENABLED === ENABLED_FLAG;
}

/** Normalises a key. Exported because other tooling builds keys the same way. */
const sanitizeKey = markup.sanitizeKey;

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
  return isEnabled() ? markup.tag(text, key) : "";
}

/**
 * Returns `text` wrapped in a tagged span, for text that shares an element with
 * sibling markup (an icon, a decorative quote mark, a form control) where
 * tagging the parent would swallow that markup into the translation — and for
 * text whose element carries a `roseyRoot` / `roseyNs` of its own, which must
 * not also carry the tag (see the header).
 *
 *   <a href="...">{% icon %}{{ label | roseyWrap: "label" }}</a>
 *
 * When Rosey is off it returns `text` unchanged, so no extra element appears.
 * Being a filter rather than an `{% if %}` block matters: `{% render %}` gives
 * partials an isolated scope where `rosey.enabled` is not visible, but globally
 * registered filters always are.
 */
function roseyWrap(text, key) {
  if (!isEnabled()) {
    return text === null || text === undefined ? "" : String(text);
  }
  return markup.wrap(text, key);
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
  return isEnabled() ? markup.ns(value) : "";
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
  return isEnabled() ? markup.root(value) : "";
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
  return isEnabled() ? markup.markdown(text, key) : "";
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
  return isEnabled() ? markup.attrs(text, attributeName, key) : "";
}

/**
 * Strips every Rosey attribute from a rendered fragment. For snippet wrappers
 * (`_snippets` in cloudcannon.config.yml): a snippet renders inside a rich-text
 * region that is already tagged as ONE translation, and a tag nested inside a
 * tag gives Rosey two overlapping keys and the editor two stacked inputs.
 *
 *   {% capture output %}{% bookshop "…/countdown" bind: obj %}{% endcapture %}
 *   {{ output | roseyStrip | removeExtraWhitespace | strip }}
 */
function roseyStrip(html) {
  if (!isEnabled()) {
    return html === null || html === undefined ? "" : String(html);
  }
  return markup.strip(html);
}

module.exports = {
  isEnabled,
  sanitizeKey,
  SEPARATOR,
  roseyTag,
  roseyWrap,
  roseyNs,
  roseyRoot,
  roseyMarkdown,
  roseyAttrs,
  roseyStrip,
};
