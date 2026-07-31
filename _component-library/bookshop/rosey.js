/**
 * Rosey filters for the Bookshop engine (component browser and CloudCannon
 * live editing).
 *
 * Translation only ever happens against the built site, and there is no
 * `process.env` in the browser, so these are unconditional no-ops. They exist
 * purely so components using `{{ text | roseyTag }}` render identically in
 * Bookshop as they do with the feature switched off in Eleventy.
 */
module.exports = function (Liquid) {
  this.registerFilter("roseyTag", () => "");
  this.registerFilter("roseyWrap", (text) => (text == null ? "" : String(text)));
  this.registerFilter("roseyNs", () => "");
  this.registerFilter("roseyMarkdown", () => "");
  this.registerFilter("roseyAttrs", () => "");
};
