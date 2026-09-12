# Rosey translations in the Visual Editor — fix plan for SiteStitcher

**Audience:** a coding agent working in the upstream SiteStitcher repo.
**Origin:** diagnosed on 2026-09-11 in `exampleBookShop` (a SiteStitcher site) by building with Rosey enabled, running the local CloudCannon editor, and inspecting the Visual Editor in headless Chromium. All evidence below comes from that session. File paths and line numbers are from `exampleBookShop` and may have drifted upstream, so **locate every call site with the grep commands given, not by line number.**

**Constraints**

- No production site uses translations yet. **Re-keying is free.** Don't write migrations, preserve existing locale entries, or keep old keys working. `write-locales` prunes unused keys on the next build.
- Keep the existing promise: **with `ROSEY_ENABLED` unset or not `"true"`, build output must not contain any `data-rosey*` attribute or the `data-rcc` wrapper.**
- Don't patch `node_modules` (Rosey or `rosey-cloudcannon-connector`). Every fix here lives in SiteStitcher's templates, filters and tests.
- Follow `CLAUDE.md` (Tailwind/hyperscript preferences, and so on). Nothing here needs new styling.

---

## 1. Symptom and summary

In the Visual Editor, after switching to a locale with the RCC (Rosey CloudCannon Connector) switcher, **no page-body text is translatable**. Only some header/footer items are: the flat nav links with a real URL, the contact line, and the footer legal links.

Five independent defects, in priority order:

| # | Defect | Effect |
|---|---|---|
| 1 | Bookshop's in-browser renderer uses do-nothing Rosey filters (`_component-library/bookshop/rosey.js`). `roseyRoot` isn't registered at all. | Every component is re-rendered without `data-rosey*` when the editor loads, so nothing inside `<main>` is translatable. The unknown `roseyRoot` filter passes its input through as a stray attribute (`common=""`). |
| 2 | `data-rosey-ns` / `data-rosey-root` placed **on the same element** as `data-rosey`. | Rosey (the build) and RCC (the editor) compute **different keys** for that element. Editor edits land on keys the build never reads. |
| 3 | Sub-field includes and array items share one key (`textBlock` always uses the key `text`; items without their own namespace). | Different strings share one translation. Editing one overwrites all of them. |
| 4 | Nav/footer links are keyed by URL, and the key filter turns `/` into an empty key. | Home, every placeholder link and every dropdown group label gets no tag. |
| 5 | Components rendered as snippets inside rich text, and editor-only notices, emit their own tags. | Tags nested inside tagged rich-text regions, and junk keys that exist only in the editor. |

Recommended implementation order: **tooling (§8) → Fix 1 → Fix 2 → Fix 3 → Fix 4 → Fix 5 → verification (§9)**. Build the validators first; they give a precise, reproducible worklist for Fixes 2, 3 and 5.

---

## 2. Background you need before touching anything

### 2.1 Two different programs resolve keys, and they must agree

- **Rosey (build time)** scans built HTML and writes `base.json`. Source: `rosey/src/runners/generator/html.rs` in https://github.com/CloudCannon/rosey. For each element it applies the element's **own** `data-rosey-root` / `data-rosey-ns` **before** building that element's key.
- **RCC client (Visual Editor)** reads keys from the *live DOM* and saves translations under them. Source: `src/rosey-key.ts` in https://github.com/CloudCannon/rcc:

  ```ts
  let current = el.parentElement;   // starts at the PARENT, so the element's own ns/root are ignored
  ```

  RCC's README documents `data-rosey-ns` / `data-rosey-root` as attributes for **"Parent elements"**.

So for `<div data-rosey-ns="abc" data-rosey="text">` inside `<main data-rosey-root="index">`:
Rosey's key is `index:abc:text`, RCC's key is `index:text`. An editor edit is saved to `index:text`. The build never reads that key and `write-locales` prunes it on the next build. **Rule: a `data-rosey` element must never carry `data-rosey-ns` or `data-rosey-root` itself.**

### 2.2 The Visual Editor shows Bookshop's live render, not `dist/`

When a page opens in the Visual Editor, Bookshop re-renders **every component** in the browser using the Liquid engine bundled into `dist/_cloudcannon/bookshop-live.js`. That engine uses the plugins listed in `_component-library/bookshop/bookshop.config.cjs`, **not** the Eleventy filters in `.eleventy.js`. RCC then snapshots that live DOM when the user switches locale. RCC pauses Bookshop during a locale switch, but only *after* the initial live render has already replaced the DOM.

The documented Bookshop pattern (RCC fixture `test/fixtures/eleventy/component-library/components/hero/hero.eleventy.liquid`) writes the attributes directly in the template, so both engines output them:

```liquid
<section data-rosey-ns="{{ _uuid }}">
  <h1 data-rosey="heading">{{ heading }}</h1>
```

SiteStitcher routes them through filters so that `ROSEY_ENABLED` can switch them off. That's fine, **as long as both engines' filters output the same markup.**

### 2.3 Where things are wired today

| Piece | File |
|---|---|
| Eleventy filters (build) | `src/filters/rosey-filters.js`, registered in `.eleventy.js` (`roseyTag`, `roseyWrap`, `roseyNs`, `roseyRoot`, `roseyMarkdown`, `roseyAttrs`) |
| Bookshop live filters (editor) | `_component-library/bookshop/rosey.js`, listed in `_component-library/bookshop/bookshop.config.cjs` → `plugins` |
| RCC boundary + client | `src/_includes/layouts/base.html`: `{% if rosey.enabled %}<div data-rcc class="contents">{% endif %}` and the `import("/_rcc/client.mjs")` script, both only when Rosey is enabled |
| Page root namespace | `base.html`: `<main … {{ pageRoot \| roseyRoot }}>` (`index` for `/`) |
| Shared chrome | `site-head.html` / `site-foot.html` open `{{ "common" \| roseyRoot }}`, and nav uses `{{ "nav" \| roseyNs }}` |
| Postbuild | `utils/rosey.js` (`npm run rosey`), run by `npm run cc:build` |

### 2.4 Evidence captured in exampleBookShop

- Home page `dist/index.html`: **127** `data-rosey` elements, **81** inside `<main>`.
- The same page live in the Visual Editor: **45** `data-rosey` elements, **0** inside `<main>`.
- After switching to `es`, all 44 tagged header/footer elements got editors. No body text did.
- Replacing only the do-nothing filters inside `dist/_cloudcannon/bookshop-live.js` with working ones made all 43 live-tagged body elements editable in `es`. This confirms Fix 1 is the primary cause.
- In the live render, countdown labels came out as `<span class="c-countdown__label …" common="" data-rosey="countdown:days">`. That's the unregistered `roseyRoot` passing `"common"` straight through. A template like `<p{{ "common" | roseyRoot }}>` would come out as a `<pcommon>` element.

---

## 3. Fix 1 — Bookshop live render must output the same Rosey markup as Eleventy

### Change

1. **Create one shared, environment-free implementation** at `_component-library/bookshop/rosey-markup.js` (CommonJS). Put it inside the Bookshop directory deliberately: Node can `require` it from anywhere, and it's certain to be inside what Bookshop's bundler resolves. Other plugins there already `require` modules (e.g. `evalLiquid.js` requires `liquidjs`). It holds everything that's currently pure in `rosey-filters.js`: `sanitizeKey`, both escape helpers, `hasContent`, and the markup builders. **No `process`, no `document`, no env checks in this file.**

   ```js
   // _component-library/bookshop/rosey-markup.js — shared by the Eleventy filters
   // (src/filters/rosey-filters.js) and the Bookshop live engine (./rosey.js).
   // Pure: no env or DOM access, so it runs identically in Node and the browser.
   const SEPARATOR = ":";
   function sanitizeKey(key) { /* moved verbatim from rosey-filters.js */ }
   function escapeForAttribute(value) { /* moved verbatim */ }
   function escapeForJsonAttribute(value) { /* moved verbatim */ }
   function hasContent(text) { /* moved verbatim */ }
   function tag(text, key) { if (!hasContent(text)) return ""; const k = sanitizeKey(key); return k ? ` data-rosey="${escapeForAttribute(k)}"` : ""; }
   function wrap(text, key) { const v = text == null ? "" : String(text); const t = tag(text, key); return t ? `<span${t}>${v}</span>` : v; }
   function ns(value) { return hasContent(value) ? ` data-rosey-ns="${escapeForAttribute(sanitizeKey(value))}"` : ""; }
   function root(value) { /* the body of roseyRoot after its isEnabled() check, verbatim */ }
   function markdown(text, key) { const t = tag(text, key); return t ? `${t} data-type="block"` : ""; }
   function attrs(text, attributeName, key) { /* body of roseyAttrs after its isEnabled() check */ }
   module.exports = { SEPARATOR, sanitizeKey, hasContent, tag, wrap, ns, root, markdown, attrs };
   ```

2. **`src/filters/rosey-filters.js`** keeps its `isEnabled()` (`process.env.ROSEY_ENABLED === "true"`) and becomes a thin gate over `rosey-markup.js`. The disabled outputs stay exactly as today: `""` for everything, except `roseyWrap`, which returns the plain text. Keep exporting `isEnabled` and `sanitizeKey`; other code may import them.

3. **Rewrite `_component-library/bookshop/rosey.js`** to register **all six** filters from the same module, behind a browser-side gate:

   ```js
   const markup = require("./rosey-markup.js");

   // There is no process.env in the browser. base.html renders the RCC boundary
   // <div data-rcc> only when rosey.enabled, so its presence is the flag. The
   // component browser (npm run browser) has no boundary, so it stays untagged.
   let enabled = false;
   function isEnabled() {
     if (!enabled) enabled = typeof document !== "undefined" && document.querySelector("[data-rcc]") !== null;
     return enabled;
   }

   module.exports = function (Liquid) {
     this.registerFilter("roseyTag", (text, key) => (isEnabled() ? markup.tag(text, key) : ""));
     this.registerFilter("roseyWrap", (text, key) => (isEnabled() ? markup.wrap(text, key) : text == null ? "" : String(text)));
     this.registerFilter("roseyNs", (value) => (isEnabled() ? markup.ns(value) : ""));
     this.registerFilter("roseyRoot", (value) => (isEnabled() ? markup.root(value) : ""));
     this.registerFilter("roseyMarkdown", (text, key) => (isEnabled() ? markup.markdown(text, key) : ""));
     this.registerFilter("roseyAttrs", (text, attr, key) => (isEnabled() ? markup.attrs(text, attr, key) : ""));
   };
   ```

   Update the file's header comment. Its current claim, "Translation only ever happens against the built site … so these are unconditional no-ops", is the root cause. The RCC editor works on the live-rendered DOM.

4. **Any future `rosey*` filter must be added to both files.** The parity test in §8.3 enforces this.

### Done when

- `npm run cc:build` succeeds and `grep -c "rosey-markup" dist/_cloudcannon/bookshop-live.js` is non-zero (the shared module was bundled).
- The parity test (§8.3) passes.
- The Visual Editor check (§8.2) shows a non-zero live tag count inside `<main>`, and no `common=""` attributes remain in the live DOM.

---

## 4. Fix 2 — Never put `data-rosey-ns` / `data-rosey-root` on the tagged element

See §2.1 for why. In exampleBookShop's build, **about 200 tagged elements across 18 components** carry their own namespace or root:

```
66 generic/textBlock            31 generic/blog/defaultCard      26 building-blocks/core-elements/text
24 sections/menu                 8 sections/faq                   7 sections/upcomingHappening
 5 core-elements/countdown       4 generic/blog/defaultFeatured   4 generic/listings/defaultListingCard
 4 simple/formBuilder            4 (layout partials)              3 generic/bigText
 3 generic/button                2 editorial/tabs                 2 generic/happenings/defaultFeatured
 1 generic/modalButton           1 generic/videoEmbed             1 generic/form/simpleText
```

Layout partials with the same pattern: `src/_includes/partials/pagination.html`, `partials/post-list.html`, and `layouts/post.html` ("On This Page"). Find candidates with:

```bash
grep -rnE 'rosey(Root|Ns) *\}\}[^>]*rosey(Tag|Markdown)' _component-library src/_includes
```

Some cases span lines or use `{% capture %}`, and the grep misses those. **The validator (§8.1) is the source of truth.** Fix every element it reports.

### Two mechanical remedies

**(a) Root on the element, key moves to an inner span.** Use this when the element sets a shared root such as `common`, `item:<url>` or `review:<name>`. It has precedent in the codebase: `generic/blog/defaultFeatured.eleventy.liquid` already does `<p{{ "common" | roseyRoot }}>{{ "Written by" | roseyWrap: "ui:written-by" }} {{ author }}</p>`.

```liquid
{%- comment -%} before: root and key on one element — RCC ignores the root {%- endcomment -%}
<p{{ "common" | roseyRoot }}{{ "Expires at:" | roseyTag: "ui:expires-at" }}>Expires at:</p>
{%- comment -%} after {%- endcomment -%}
<p{{ "common" | roseyRoot }}>{{ "Expires at:" | roseyWrap: "ui:expires-at" }}</p>
```

Wrap only the text. If the element also holds an icon or other markup, keep that outside the span (see the agent-skill note on mixed children in §12).

**(b) Namespace folded into the key.** Use this when the element sets its own `_uuid` namespace and the tagged element *is* the component root, especially block-level rich text, where a wrapping `<span>` would be invalid HTML:

```liquid
{%- comment -%} before {%- endcomment -%}
<div class="c-textBlock w-full"{{ _uuid | roseyNs }}{{ text | roseyMarkdown: "text" }}>
{%- comment -%} after: identical resolved key in Rosey and RCC ({ancestors}:{uuid}:text) {%- endcomment -%}
{%- capture roseyKey -%}{{ _uuid }}:text{%- endcapture -%}
<div class="c-textBlock w-full"{{ text | roseyMarkdown: roseyKey }}>
```

`sanitizeKey` keeps `:` and trims a leading one, so an empty `_uuid` degrades cleanly to `text`.

Alternatively, move `roseyNs` onto an existing **untagged** ancestor inside the component. Both remedies are correct; pick per component. Don't add `data-rosey-ns` to purely structural wrappers (grid cells, columns, slides, tab panels). The skill (§12) says that makes keys depend on where a block sits rather than what it is.

`roseyAttrs` on an element with its own root (for example `videoEmbed`'s `<a … roseyRoot … roseyAttrs>`) doesn't cause an editor mismatch: RCC never edits attributes. The validator only flags `data-rosey` elements. Leave attrs-only elements alone unless they also carry `data-rosey`.

### Done when

The validator's "carrying their own -ns/-root" section is empty, and the Visual Editor check reports 0 self-namespaced live elements.

---

## 5. Fix 3 — Every key maps to exactly one string

RCC docs, *Tagging Content → Key uniqueness and stability*: "Each Rosey key maps to exactly one entry in the locale file." In exampleBookShop's build, **17 keys are shared by elements with different content** (resolved with Rosey's own rule, §2.1). Four causes:

### 5.1 `textBlock` included as a sub-field always keys as `text`

These call sites include `generic/textBlock` with explicit values (not `bind:`). Every one of them renders two or three textBlocks that resolve to the same key:

```bash
grep -rn 'bookshop "generic/textBlock"' _component-library src/_includes | grep -v "bind:"
```

In exampleBookShop: `generic/heading` (eyebrow, headline, description), `generic/headingImage`, `generic/headingHorizontal`, `sections/fullImageHero`, `sections/fullImageTextBottomHero`, `generic/bigText` (description), `generic/pricingCard`, `sections/faq` (per-item description), `editorial/taskList` (per-task text), `generic/form/helperText`, and `generic/listings/{default,horizontal}ListingCard` (keyInformation).

Child components **inherit the parent's `_uuid`** when it isn't passed. The build shows this: the FAQ key `about-us:b4256de3…:b4256de3…:text` has the FAQ's UUID twice, once from the FAQ's own namespace and once as the textBlock's inherited `_uuid`. Nobody has checked whether Bookshop's live engine inherits it the same way, so **don't rely on it; pass everything explicitly.**

**Change:**

1. `generic/textBlock` accepts an optional `roseyKey` param (template-only; nothing to add to the blueprint or `_inputs`). Using remedy (b) from §4, its tag becomes `{{ _uuid }}:{{ roseyKey | default: "text" }}`. Apply this to **both** branches of the template (`env_bookshop_live` and the build branch).
2. Every sub-field include passes **`_uuid: ""`** (blocks inheritance) and a **distinct `roseyKey`**, scoped to the parent. Either:
   - the parent puts its own `{{ _uuid | roseyNs }}` on an untagged wrapper around the includes, and passes `roseyKey: "eyebrow"` / `"headline"` / `"description"`; or
   - the parent folds its UUID into the key: `{% capture k %}{{ _uuid }}:headline{% endcapture %}{% bookshop "generic/textBlock" text: content.headline _uuid: "" roseyKey: k %}`.

   Confirm with the validator, and the live check, that Bookshop's param parser takes `_uuid: ""` in both engines. If it doesn't, rename the textBlock-side param (e.g. `roseyNs`) so it can't be inherited, and have bound textBlocks (`bind: editorial`) pass `roseyNs: _uuid`.
3. Other sub-field components that output fixed leaf keys follow the same rule. For example, `generic/bigText` tags its headline `headline` on its own root, which also needs remedy (b).

### 5.2 Array items rendered inside one component

`sections/faq` (items), `sections/menu` (menuItems) and `editorial/taskList` (tasks) render arrays inside one component. Today the item's `_uuid` namespace sits on the tagged element itself (a Fix 2 violation), or doesn't exist at all (taskList). Give each item a stable namespace on an **untagged per-item wrapper**, or fold `item._uuid` into each key.

- `taskList`'s blueprint has no `_uuid` on its task items. Add `_uuid:` to the item in `tasks` (`editorial/taskList/taskList.bookshop.yml`). The global `_inputs._uuid` (`instance_value: UUID`) in `cloudcannon.config.yml` then fills it as items are added.
- `faq` and `menu` blueprints already declare item `_uuid:`.
- For plain-string arrays with nowhere to put a `_uuid`, use content-as-key (slugify the string). **Never** use the array index (skill §3g).

### 5.3 Blocks whose content has no `_uuid`

`npm run test:roseyIds` reports content blocks without `_uuid`. Missing UUIDs combined with inherited parent UUIDs is what makes, e.g., six `core-elements/text` blocks in one grid share `index:883add6b…:text`. Fill in `_uuid` on SiteStitcher's own demo/starter content, and make sure every blueprint that renders translatable text declares `_uuid:`.

### 5.4 One string rendered two ways under one key

The same key must always render identical text. In exampleBookShop:
- `tag:pending-sale` renders as "Pending sale" in `generic/listings/defaultListingCard` but "Pendingsale" in `generic/blog/defaultFeatured` / `defaultCard`. Derive tag labels through one helper.
- `countdown:seconds` is "seconds" in `sections/upcomingHappening` but "Seconds" in `core-elements/countdown`.

### Done when

The validator's collisions section is empty for SiteStitcher's own content. Identical text sharing a key (nav labels, "Days") is fine and intended.

---

## 6. Fix 4 — Key nav and footer links by their label (content-as-key)

Today links use `roseyTag: entry.url`. `sanitizeKey("/")` is `""`, and an empty key means no tag. So `Home`, every placeholder link pointing to `/`, and every dropdown group button (Admissions, About, Demos, Academics) are untagged in the build, not only in the editor. Only links with real URLs (`/hero2/` → `hero2`) worked.

URL-as-key isn't one of the documented strategies (static, content, UUID). The docs recommend content-as-key for nav:
- CloudCannon agent skill `make-site-multilingual/tagging.md` §3d: "For short link text, use content-as-key."
- RCC docs, *Tagging Content*, cite the Rosey Astro Starter for "content-as-key on nav/footer links".

**Change:** replace the URL argument with the title at every link call site:

```bash
grep -nE 'roseyTag: (entry|subEntry|megaEntry)\.url' src/_includes/partials/*.html
```

In exampleBookShop these are `render-nav.html` (5 sites, including the two group `<button>`s after the hyperscript `_=` attribute), `render-footer.html` (1) and `site-foot.html` (2). Example: `{{ subEntry.title | roseyTag: subEntry.url }}` → `{{ subEntry.title | roseyTag: subEntry.title }}`. Group headings already use the title (`roseyWrap: entry.title`), so leave them. Update the header comments in `render-nav.html`, `render-footer.html` and `site-foot.html`: they explain the URL-key rationale, which no longer applies. Leave the social links in `site-foot.html` alone; they're keyed from host/path on purpose.

Result: keys like `common:nav:dates-and-deadlines`. Repeated labels share one translation, which the docs call a benefit. The accepted trade-off: renaming a label drops its translation and starts fresh, instead of flagging it as out of date.

### Done when

Every visible nav and footer link and every group label in the built header/footer carries `data-rosey`, and each has an editor after a locale switch.

---

## 7. Fix 5 — Content that must not carry its own tags

1. **Components rendered as snippets inside rich text.** A rich-text region is tagged as one unit, and the RCC docs say to tag the region, not its contents. Snippet output inside it must not tag itself. In exampleBookShop the validator found 35 nested tags. They come from `core-elements/countdown/snippet`, `core-elements/simple-text/snippet`, and colored label spans (`<span class="green label" data-rosey="text">`) inside `core-elements/text` and `textBlock` markdown. Snippets are registered under `_snippets` in `cloudcannon.config.yml`. Add a `rosey: false` param to the components those snippets render, have the snippet wrappers pass it, and when it's set skip the rosey filters (e.g. assign the text passed to the filter to `nil`, since the filters output nothing for empty text).
2. **Editor-only notices.** `generic/bigText` and `sections/scatterGallery` render `generic/notification` ("No large text in Live Editor", "No Scatter in Live Editor") only in the live engine. With Fix 1 in place these become translatable keys that never exist in the build. Pass `rosey: false` to those notifications too.

### Done when

The validator's "nested inside another data-rosey element" section is empty, and the Visual Editor check shows no notification keys.

---

## 8. Tooling to add

Add these scripts to `package.json`:

```json
"test:roseyKeys": "node ./tests/validateRoseyKeys.js",
"test:roseyParity": "node ./tests/validateRoseyFilterParity.js",
"test:roseyEditor": "node ./tests/checkVisualEditorRosey.mjs"
```

### 8.1 `tests/validateRoseyKeys.js` — built-HTML key validator (tested against exampleBookShop)

It uses the project's existing `cheerio`, `glob` and `js-yaml` dependencies. Against today's exampleBookShop build it exits 1 and reports the self-namespaced, nested and colliding elements cited above.

```js
#!/usr/bin/env node
/**
 * Validates the Rosey keys in the BUILT site (run after `npm run cc:build` with
 * ROSEY_ENABLED=true). Source-level checks can't see these problems because keys
 * are assembled from namespaces across nested components at render time.
 *
 * Fails on:
 *
 *   1. Self-namespaced elements — a `data-rosey` element that also carries its
 *      own `data-rosey-ns` or `data-rosey-root`. Rosey's generator applies the
 *      element's own ns/root when building its key; the RCC editor client
 *      (`resolveRoseyKey`) starts at `el.parentElement` and ignores them. The
 *      two disagree, so Visual Editor edits land on a key the build never reads
 *      (and `write-locales` prunes it on the next build).
 *
 *   2. Collisions — one key used by elements with different content. Every
 *      element on that key shows the same translation, and editing one in the
 *      Visual Editor overwrites all of them.
 *
 *   3. Nested tags — a `data-rosey` element inside another. Rosey captures the
 *      outer element's innerHTML (inner tags included) as one translation, and
 *      the editor stacks two inline editors on the same text.
 *
 * Identical content on one key is fine and intended (shared nav labels, "Days").
 *
 * Usage: node ./tests/validateRoseyKeys.js [outputDir]
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const cheerio = require("cheerio");
const { glob } = require("glob");

const ROOT = path.join(__dirname, "..");
const config = yaml.load(fs.readFileSync(path.join(ROOT, "rosey.yml"), "utf8")) || {};
const OUT = path.resolve(ROOT, process.argv[2] || config.source || "dist");
const SEP = config.separator || ":";
const TAG = config.tag || "data-rosey";
// Rosey writes translated copies to <out>/<locale>/; scan only the original.
const LOCALES = new Set(config.languages || []);

const norm = (html) => String(html || "").replace(/\s+/g, " ").trim();

/** Rosey's own rule (rosey/src/runners/generator/html.rs): the element's own
 *  root/ns apply before its key is built. */
function roseyKey($, el) {
  const chain = [el, ...$(el).parents().toArray()];
  const parts = [];
  for (const node of chain) {
    const $n = $(node);
    const ns = $n.attr(`${TAG}-ns`);
    const root = $n.attr(`${TAG}-root`);
    if (ns) parts.unshift(ns);
    if (root !== undefined) {
      if (root) parts.unshift(root);
      break;
    }
  }
  return [...parts, $(el).attr(TAG)].join(SEP);
}

const files = glob
  .sync("**/*.html", { cwd: OUT })
  .filter((f) => !LOCALES.has(f.split("/")[0]) && !f.startsWith("_"));

const selfNamespaced = new Map(); // component -> count
const nested = new Map(); // component -> count
const byKey = new Map(); // key -> [{ file, text, component }]

for (const file of files) {
  const $ = cheerio.load(fs.readFileSync(path.join(OUT, file), "utf8"));
  const stack = [];
  const walk = (node) => {
    for (const child of node.children || []) {
      if (child.type === "comment") {
        const name = child.data.match(/bookshop-live name\(([^)]+)\)/);
        if (name) stack.push(name[1]);
        else if (/bookshop-live end/.test(child.data)) stack.pop();
        continue;
      }
      if (child.type !== "tag") continue;
      const $el = $(child);
      if ($el.attr(TAG) !== undefined) {
        const component = stack[stack.length - 1] || "(layout/partial)";
        if ($el.attr(`${TAG}-ns`) !== undefined || $el.attr(`${TAG}-root`) !== undefined) {
          selfNamespaced.set(component, (selfNamespaced.get(component) || 0) + 1);
        }
        if ($el.parents(`[${TAG}]`).length) {
          nested.set(component, (nested.get(component) || 0) + 1);
        }
        const key = roseyKey($, child);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push({ file, text: norm($el.html()), component });
      }
      walk(child);
    }
  };
  walk($.root()[0]);
}

const collisions = [...byKey].filter(([, uses]) => new Set(uses.map((u) => u.text)).size > 1);

let failed = false;
if (selfNamespaced.size) {
  failed = true;
  console.error("[rosey:keys] data-rosey elements carrying their own -ns/-root (editor and build keys disagree):");
  for (const [component, count] of [...selfNamespaced].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(count).padStart(4)}  ${component}`);
  }
}
if (nested.size) {
  failed = true;
  console.error("\n[rosey:keys] data-rosey elements nested inside another data-rosey element:");
  for (const [component, count] of [...nested].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(count).padStart(4)}  ${component}`);
  }
}
if (collisions.length) {
  failed = true;
  console.error(`\n[rosey:keys] ${collisions.length} key(s) shared by elements with different content:`);
  for (const [key, uses] of collisions) {
    console.error(`  ${key}`);
    const seen = new Set();
    for (const u of uses) {
      const preview = u.text.replace(/<[^>]+>/g, "").slice(0, 50);
      if (seen.has(preview)) continue;
      seen.add(preview);
      console.error(`      "${preview}"  (${u.component}, ${u.file})`);
    }
  }
}
console.log(`[rosey:keys] ${files.length} pages, ${byKey.size} keys checked.`);
process.exit(failed ? 1 : 0);
```

### 8.2 `tests/checkVisualEditorRosey.mjs` — live Visual Editor check (tested against exampleBookShop)

This check drives the real CloudCannon editing UI locally. It needs dev-only tooling that stays out of `package.json` dependencies:

- CloudCannon CLI: `npm i -g @cloudcannon/cli` (requires **Node 24+**; the site build itself can stay on the project's Node).
- Playwright: `npm i --no-save playwright && npx playwright install chromium`.

Against today's exampleBookShop build it exits 1 with `tagged elements in <main>: built 81, live 0`.

```js
#!/usr/bin/env node
/**
 * Drives the local CloudCannon editor (`cloudcannon dev dist`) in headless
 * Chromium and checks that Rosey translation works in the Visual Editor, which
 * no build-output check can see: Bookshop re-renders every component in the
 * browser, so the live DOM — not dist/ — is what the RCC client reads.
 *
 * Prereqs (dev-only, not project dependencies):
 *   npm i --no-save playwright && npx playwright install chromium
 *   ROSEY_ENABLED=true npm run cc:build
 *   cloudcannon dev --no-app-sync dist          # separate terminal
 *
 * Usage:
 *   node ./tests/checkVisualEditorRosey.mjs [--path /src/pages/home.md]
 *     [--collection pages] [--locale es] [--base http://127.0.0.1:10101]
 *
 * Exits non-zero when:
 *   - no data-rosey elements survive Bookshop's live render inside <main>
 *   - a live data-rosey element carries its own data-rosey-ns / -root
 *   - after switching locale, a tagged element inside <main> has no editor
 * Reports (does not fail on) keys present in dist/ but absent live — some
 * sections legitimately don't render in the live engine (e.g. ones built from
 * Eleventy collections) — and on out-of-date flags on a fresh build.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://127.0.0.1:10101");
const COLLECTION = arg("collection", "pages");
const SOURCE_PATH = arg("path", "/src/pages/home.md");
const LOCALE = arg("locale", "es");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// Runs in the page. Keys resolved both ways so a mismatch is visible.
function collect() {
  const text = (el) => el.innerHTML.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 50);
  const roseyKey = (el) => {
    const parts = [];
    for (let n = el; n; n = n.parentElement) {
      const ns = n.getAttribute("data-rosey-ns");
      const root = n.getAttribute("data-rosey-root");
      if (ns) parts.unshift(ns);
      if (root !== null) { if (root) parts.unshift(root); break; }
    }
    return [...parts, el.getAttribute("data-rosey")].join(":");
  };
  return [...document.querySelectorAll("main [data-rosey]")].map((el) => ({
    key: roseyKey(el),
    text: text(el),
    selfNamespaced: el.hasAttribute("data-rosey-ns") || el.hasAttribute("data-rosey-root"),
  }));
}

const browser = await chromium.launch();
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  const siteHref = await page.$eval('a[href*="#sites/"]', (a) => a.getAttribute("href"));
  const siteId = siteHref.match(/#sites\/([^/]+)/)[1];
  const editUrl =
    `${BASE}/#sites/${siteId}/collections/${COLLECTION}:/edit?collection=${COLLECTION}` +
    `&path=${encodeURIComponent(SOURCE_PATH)}&editor=visual`;
  await page.goto(editUrl, { waitUntil: "networkidle" });

  // The site renders in a nested frame; find the one holding the RCC boundary.
  let frame;
  for (let i = 0; i < 60 && !frame; i++) {
    for (const f of page.frames()) {
      if (await f.$("#rcc-locale-switcher").catch(() => null)) frame = f;
    }
    if (!frame) await page.waitForTimeout(500);
  }
  if (!frame) throw new Error("RCC locale switcher never appeared — is ROSEY_ENABLED=true in the build?");
  await page.waitForTimeout(3000); // let Bookshop finish its initial live render

  // The editor frame's URL names the output file it is showing.
  const editorFrame = page.frames().find((f) => f.url().includes("__source/"));
  const builtFile = decodeURIComponent(editorFrame.url().split("__source/")[1].split("?")[0]);
  const live = await frame.evaluate(collect);

  const staticCtx = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await staticCtx.newPage();
  await staticPage.setContent(fs.readFileSync(path.join(ROOT, builtFile), "utf8"));
  const built = await staticPage.evaluate(collect);

  console.log(`${SOURCE_PATH} -> ${builtFile}`);
  console.log(`  tagged elements in <main>: built ${built.length}, live ${live.length}`);
  if (live.length === 0) failures.push("no data-rosey elements inside <main> after Bookshop's live render");

  const selfNs = live.filter((e) => e.selfNamespaced);
  if (selfNs.length) {
    failures.push(`${selfNs.length} live data-rosey element(s) carry their own -ns/-root (editor and build keys disagree)`);
  }

  const liveKeys = new Set(live.map((e) => e.key));
  const missing = [...new Set(built.map((e) => e.key))].filter((k) => !liveKeys.has(k));
  if (missing.length) {
    console.log(`  report: ${missing.length} built key(s) not present live:`);
    for (const k of missing.slice(0, 25)) console.log(`      ${k}`);
  }

  await frame.click("#rcc-locale-switcher");
  await frame.click(`#rcc-locale-popover button[data-locale="${LOCALE}"]`);
  await page.waitForTimeout(8000);
  const result = await frame.evaluate(() => {
    const root = document.querySelector("[data-rcc-translation-root]");
    const tagged = [...root.querySelectorAll("main [data-rosey]:not([data-rcc-ignore])")];
    const withEditor = tagged.filter((el) => el.isContentEditable);
    return {
      tagged: tagged.length,
      withEditor: withEditor.length,
      withoutEditor: tagged.filter((el) => !el.isContentEditable).map((el) => el.getAttribute("data-rosey")),
      stale: root.querySelectorAll("[data-rosey][data-rcc-stale]").length,
    };
  });
  console.log(`  ${LOCALE}: ${result.withEditor}/${result.tagged} tagged <main> elements have an editor, ${result.stale} flagged out of date`);
  if (result.tagged && result.withEditor < result.tagged) {
    failures.push(`${result.tagged - result.withEditor} tagged element(s) without an editor: ${result.withoutEditor.slice(0, 10).join(", ")}`);
  }
  if (result.stale) console.log(`  report: ${result.stale} element(s) flagged out of date on a fresh build — check live vs built markup`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("\nFAIL");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\nPASS");
```

Implementation notes for this script (observed in the local editor, CLI v0.0.19):
- The app URL is `http://127.0.0.1:10101/#sites/<id>/collections/<collection>:/edit?collection=<collection>&path=<url-encoded /src/...>&editor=visual`. The site id varies, so the script reads it from the sidebar link.
- The site renders in an `about:blank` frame nested inside `app/assets/e2e/omnipage/editor.html#/__source/<output file>`. The script finds the frame by the RCC switcher and derives the built file from the outer frame's URL.
- The RCC client has no stable selectors other than `#rcc-locale-switcher` and `#rcc-locale-popover button[data-locale="<code>"]`.

### 8.3 `tests/validateRoseyFilterParity.js` — both engines output the same markup (write this)

This one wasn't pre-tested. It should (a) fail if any `rosey*` filter exported by `src/filters/rosey-filters.js` isn't registered by the Bookshop plugin, and (b) compare outputs for a table of inputs, with Rosey on and off:

```js
#!/usr/bin/env node
// Asserts the Bookshop live filters (browser) and the Eleventy filters (build)
// emit identical Rosey markup, with Rosey on and off.
const assert = require("assert");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const PLUGIN = path.join(ROOT, "_component-library/bookshop/rosey.js");

function bookshopFilters() {
  delete require.cache[require.resolve(PLUGIN)]; // reset the plugin's cached gate
  const filters = {};
  require(PLUGIN).call({ registerFilter: (name, fn) => (filters[name] = fn) }, {});
  return filters;
}

const CASES = [
  ["roseyTag", ["Hello", "heading"]], ["roseyTag", ["", "heading"]], ["roseyTag", [null, "heading"]],
  ["roseyTag", ["Home", "/"]], ["roseyTag", ["Dates and Deadlines", "Dates and Deadlines"]],
  ["roseyTag", ["x", "D325CEF1-b7bd:Text"]], ["roseyTag", ["x", `a "q" & <b>`]],
  ["roseyWrap", ["Links", "links-heading"]], ["roseyWrap", ["Links", ""]], ["roseyWrap", [null, "k"]],
  ["roseyNs", ["08EB0093-E88C"]], ["roseyNs", [""]], ["roseyNs", [null]],
  ["roseyRoot", ["common"]], ["roseyRoot", [""]], ["roseyRoot", [null]], ["roseyRoot", ["/"]],
  ["roseyMarkdown", ["<p>x</p>", "text"]], ["roseyMarkdown", ["", "text"]],
  ["roseyAttrs", ["Alt text", "alt", "hero-alt"]], ["roseyAttrs", ["", "alt", "hero-alt"]],
];

for (const enabled of [true, false]) {
  process.env.ROSEY_ENABLED = enabled ? "true" : "false";
  global.document = { querySelector: (sel) => (sel === "[data-rcc]" && enabled ? {} : null) };
  const eleventy = require(path.join(ROOT, "src/filters/rosey-filters.js"));
  const live = bookshopFilters();
  for (const name of Object.keys(eleventy).filter((n) => /^rosey[A-Z]/.test(n))) {
    assert.ok(typeof live[name] === "function", `Bookshop plugin does not register ${name}`);
  }
  for (const [name, args] of CASES) {
    assert.strictEqual(live[name](...args), eleventy[name](...args),
      `${name}(${JSON.stringify(args)}) differs between engines (Rosey ${enabled ? "on" : "off"})`);
  }
}
delete global.document;
console.log("[rosey:parity] Bookshop live filters match the Eleventy filters.");
```

---

## 9. Verification procedure

Run in this order. Use a clean `dist/` for each build: Eleventy doesn't clear its output directory, and `utils/rosey.js` relies on that.

1. **Disabled build is untouched:**
   ```bash
   rm -rf dist && ROSEY_ENABLED=false npm run eleventy
   grep -rlE 'data-rosey|data-rcc' dist | wc -l     # must print 0
   ```
2. **Enabled build + static checks:**
   ```bash
   rm -rf dist && ROSEY_ENABLED=true npm run cc:build
   npm run test:roseyParity && npm run test:roseyKeys && npm run test:roseyIds
   grep -c "rosey-markup" dist/_cloudcannon/bookshop-live.js   # non-zero
   ```
3. **Live editor:** start `cloudcannon dev --no-app-sync dist` in a background terminal, then run `npm run test:roseyEditor -- --path <page>` for every page that exercises the fixed components. At minimum: the home page, a page with `sections/faq` and `sections/menu`, a page with `sections/fullImageHero`, and a blog post with editorial blocks (`--collection blog --path /src/posts/<file>.md`). Each must print `PASS`. The "not present live" report may list sections that don't render in the live engine (§10). Everything else in that list must be explained.
4. **End-to-end translation round trip (manual, or automate it):**
   1. Restart the dev server **without** `--no-app-sync` so the editor can write to disk.
   2. Open `http://127.0.0.1:10101`, open a page in the Visual Editor, open the translate button in the bottom-right corner, and choose the locale.
   3. Edit a textBlock headline, a FAQ answer and a nav link, then click **Save**.
   4. Confirm `src/rosey/locales/<code>.json` changed under exactly the keys the validator resolves for those elements (the Rosey keys, e.g. `index:<uuid>:headline`, `common:nav:<label-slug>`).
   5. `rm -rf dist && ROSEY_ENABLED=true npm run cc:build`, then confirm `dist/<code>/…` shows the translations and `write-locales` reported `0 removed` for those keys.
5. **Nothing is flagged out of date on a fresh build:** in step 3, `flagged out of date` should be `0` on pages that haven't been edited since the build. If it isn't, the live and built markup for that element differ (see §10).

## Acceptance criteria

- [ ] Disabled build contains no `data-rosey*` / `data-rcc` (step 1).
- [ ] `test:roseyParity`, `test:roseyKeys` and `test:roseyIds` pass on SiteStitcher's own content.
- [ ] `test:roseyEditor` prints `PASS` on the pages listed in step 3, with every tagged `<main>` element editable after a locale switch.
- [ ] Every header/footer nav link and group label is tagged and editable.
- [ ] The round trip in step 4 writes to the same key the build reads, and the translation appears on the built locale page.
- [ ] Comments that describe the old behavior are updated: `_component-library/bookshop/rosey.js` header, the nav/footer partial headers, and `rosey-filters.js` where it discusses namespacing. Also document the "never ns/root on the tagged element" rule in `docs/componentArchitecture.md` (or wherever component authoring rules live).

---

## 10. Known limitations (don't fix as part of this work)

- **Sections that don't render in the live engine.** `sections/upcomingHappening` reads Eleventy collections, and in the editor it rendered nothing, so its text can't be translated in place. It still translates at build time. The Visual Editor check lists such keys under "not present live".
- **Rich text containing snippets.** `textBlock`'s live branch uses `markdownify` without `renderContent`, so snippets inside markdown show up live as raw `{% bookshop … %}` text, while the build has rendered HTML. That block's live source text differs from what Rosey captured, which can raise false out-of-date flags. Per the agent skill (troubleshooting, "mixed children"), markup captured into a translation is also injected twice on translated pages. Avoid snippets inside translatable rich text, or accept the limitation.
- **Attributes** (`roseyAttrs`: meta descriptions, alt text) translate at build time only; RCC doesn't edit attributes.
- **Upstream RCC behavior.** RCC's `resolveRoseyKey` ignoring an element's own ns/root disagrees with Rosey's generator. It could be reported at https://github.com/CloudCannon/rcc/issues, but SiteStitcher must not depend on a change there. The Fix 2 rule makes both tools agree regardless.

## 11. Appendix — exampleBookShop build findings (for orientation)

Build: `ROSEY_ENABLED=true npm run cc:build`; 29 pages, 214 keys (Rosey rule).

- **Collisions (17):** almost all are `generic/heading` / `fullImageHero` / `bigText` / `taskList` / `faq` sub-field textBlocks, plus blocks without their own `_uuid` inheriting a parent UUID (e.g. `index:883add6b…:text` shared by "State", "California", "Delaware", "Texas", …), plus `tag:pending-sale` and `countdown:seconds` (§5.4).
- **Untagged nav items:** every `href="/"` entry: Home, all placeholder dropdown links, and the Admissions/About/Demos/Academics group buttons.
- **Only 1 of 219 `es` keys was translated** (`common:nav:contact:hours`), which confirms re-keying costs nothing.

## 12. References

- RCC repo and docs source — https://github.com/CloudCannon/rcc (`docs/src/docs/ssg-setup.md`, `tagging-content.md`, `configuration.md`, `known-issues.md`; `src/rosey-key.ts`; `src/bookshop.ts`; fixture `test/fixtures/eleventy/`)
- RCC hosted docs — https://rosey.cc/docs/ssg-setup/ and https://rosey.cc/docs/tagging-content/
- Rosey namespacing — https://github.com/CloudCannon/rosey `docs/content/docs/namespacing.md`; key generation `rosey/src/runners/generator/html.rs`
- CloudCannon agent skills — https://github.com/CloudCannon/agent-skills `skills/make-site-multilingual/` (`tagging.md` §3c, §3d, §3g; `eleventy/overview.md`; `troubleshooting.md` "Mixed text / non-text children")
- CloudCannon CLI `dev` — https://cloudcannon.com/documentation/developer-reference/cli/dev/
