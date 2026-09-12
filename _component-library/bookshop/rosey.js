/**
 * Rosey filters for the Bookshop engine (CloudCannon Visual Editor live
 * rendering and the component browser).
 *
 * These are NOT no-ops. When a page opens in the Visual Editor, Bookshop
 * re-renders every component in the browser and the RCC (Rosey CloudCannon
 * Connector) client reads `data-rosey*` attributes from that live DOM — not
 * from dist/ — to decide what is translatable and which key to save an edit
 * under. So this engine has to emit exactly the markup the Eleventy build
 * emits. Both sides are thin gates over the shared builders in
 * ./rosey-markup.js; `npm run test:roseyParity` fails if they differ.
 *
 * There is no `process.env` in the browser. layouts/base.html renders the RCC
 * boundary `<div data-rcc>` only when Rosey is enabled, so its presence is the
 * flag. The component browser (`npm run browser`) has no boundary and stays
 * untagged. The result is cached: the boundary is static markup from the
 * layout, present before any component renders.
 *
 * Add any new `rosey*` filter here AND in src/filters/rosey-filters.js.
 */
const markup = require("./rosey-markup.js");

let enabled = false;
function isEnabled() {
  if (!enabled) {
    enabled = typeof document !== "undefined" && document.querySelector("[data-rcc]") !== null;
  }
  return enabled;
}

const text = (value) => (value === null || value === undefined ? "" : String(value));

module.exports = function (Liquid) {
  this.registerFilter("roseyTag", (value, key) => (isEnabled() ? markup.tag(value, key) : ""));
  this.registerFilter("roseyWrap", (value, key) => (isEnabled() ? markup.wrap(value, key) : text(value)));
  this.registerFilter("roseyNs", (value) => (isEnabled() ? markup.ns(value) : ""));
  this.registerFilter("roseyRoot", (value) => (isEnabled() ? markup.root(value) : ""));
  this.registerFilter("roseyMarkdown", (value, key) => (isEnabled() ? markup.markdown(value, key) : ""));
  this.registerFilter("roseyAttrs", (value, attr, key) => (isEnabled() ? markup.attrs(value, attr, key) : ""));
  this.registerFilter("roseyStrip", (html) => (isEnabled() ? markup.strip(html) : text(html)));
};
