# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SiteStitcher is a component-based static site generator built with:
- **Eleventy 3.0.0** - Static site generator
- **Bookshop 3.11.0** - Component library system with Liquid templates
- **CloudCannon** - Git-backed CMS integration
- **Tailwind CSS 3.3.3** + SASS - Styling
- **Node.js v20.3.0** (see `.nvmrc`)

## Common Commands

```bash
# Development
npm start              # Dev server with Sass, Tailwind, and Eleventy watching

# Production build
npm run eleventy       # Full build (theme variables, favicons, pagination, eleventy)

# Component management
npm run new            # Create new Bookshop component
npm run browser        # Open Bookshop component browser

# Validation
npm test:componentIds  # Validate component IDs match registry
npm test:componentUse  # Check component usage in pages

# Utilities
npm run fetch-theme-variables  # Generate CSS variables from theme.yml
npm run syncPermalinks         # Sync URLs across content files
```

## Architecture

### Directory Structure

```
src/
├── _data/              # Global data (site.json, theme.yml, tokens.yml)
├── _includes/layouts/  # Page layouts (base.html, page.html, post.html)
├── filters/            # Custom Eleventy filters
├── pages/, posts/      # Content files (Markdown with YAML frontmatter)
└── assets/styles/      # SASS source files

_component-library/
├── components/
│   ├── building-blocks/
│   │   ├── core-elements/  # Button, Heading, Image, Text, Icon, etc.
│   │   └── wrappers/       # Card, Split, Grid, Accordion, Carousel, Modal
│   ├── page-sections/      # Full section layouts (base-section)
│   ├── generic/            # Site-specific components (40+)
│   └── sections/           # Legacy section components
├── shared/eleventy/        # Shared partials (renderBlocks.eleventy.liquid)
└── componentRegistry.json  # Component ID registry
```

### Component System (Bookshop)

Each component consists of:
- `{name}.bookshop.yml` - Schema with `spec`, `blueprint`, and `_inputs`
- `{name}.eleventy.liquid` - Liquid template
- `{name}.scss` - SASS source file (tailwind is used as the primary CSS framework)

**Component patterns:**
- Components with both content and styles use `tabbed: true` in spec
- Simple components (styles-only or content-only) are flattened
- Sub-components use `{% bookshop_include "renderBlocks" blocks: contentSections %}`

**Page structure (frontmatter):**
```yaml
hero:
  _bookshop_name: generic/hero
  _componentId: <UUID>
content_blocks:
  - _bookshop_name: sections/cards
    _componentId: <UUID>
```

### Key Configuration Files

- `.eleventy.js` - Main Eleventy config with collections, filters, image processing
- `src/_data/site.json` - Site configuration (navigation, contact, analytics)
- `src/_data/theme.yml` - Color groups and design tokens
- `tailwind.config.js` - Tailwind CSS configuration

### Token System

Design tokens are replaced at build time:
- `[[tk.tokenName]]` - Replaced with values from `tokens.yml`
- `[[st.fieldName]]` - Replaced with values from `site.json`

### Image Handling

Use the `{% image %}` shortcode for responsive images:
- Remote URLs are fetched and cached for 365 days
- Local images generate responsive variants (200-1600px widths)
- GIFs are served as-is (not processed)
- LQIP (Low Quality Image Placeholder) for lazy loading

### Collections

Defined in `.eleventy.js`:
- `blog` - All posts in reverse date order
- `pages` - Static pages
- `services` - Service listings
- `happenings` / `upcomingHappenings` / `pastHappenings` - Events
- `listings` - Marketplace listings

### Internationalization (Rosey)

Off by default, behind the `ROSEY_ENABLED` env var. With it unset, the build output is
byte-identical to a site without Rosey. Locales are configured in `rosey/rcc.yaml` and ship
as an empty list.

Pipeline: `npm run eleventy` (tags content) then `npm run rosey` (`utils/rosey.js` runs
`rosey generate` → `rosey-cloudcannon-connector generate` → `rosey build
--default-language-at-root`). English stays at `/`, locales are served from `/<locale>/`.
Editors translate via the CloudCannon **Translations** collection
(`src/rosey-translations/`).

**Every new component that renders text must be tagged.** Use the filters in
`src/filters/rosey-filters.js` — all return `""` when the flag is off, so tagging never
changes default output:

| Filter | Use for | Example |
|---|---|---|
| `roseyTag` | text that is the element's only content | `<h2{{ text \| roseyTag }}>{{ text }}</h2>` |
| `roseyWrap` | text sharing an element with sibling markup (icon, control) | `<a>{% icon %}{{ text \| roseyWrap }}</a>` |
| `roseyMarkdown` | blocks rendered through `markdownify` (gives editors a rich-text input) | `<div{{ text \| roseyMarkdown }}>{{ text \| markdownify }}</div>` |
| `roseyAttrs` | translatable attributes | `<img alt="{{ alt }}"{{ alt \| roseyAttrs: "alt" }}>` |
| `roseyNs` | opening a namespace | `{{ "common" \| roseyNs: true }}` |

Prefer `roseyWrap` over an `{% if rosey.enabled %}` block: `{% render %}` gives partials an
isolated scope where `rosey.enabled` is invisible, but filters always resolve.

Namespacing: `<main>` in `base.html` opens a per-page namespace from the page title, so
identical copy on two pages stays independently translatable. Site chrome (header, footer)
uses the `common` namespace so it is translated once — `namespace_pages` in `rosey/rcc.yaml`.
Do not tag editor placeholder strings ("Add content to this section"); they are not site copy.

## Technology Preferences

- **Interactivity/Logic:** Use [hyperscript](https://hyperscript.org) where possible. If hyperscript would be cumbersome or require workarounds, use vanilla JavaScript instead.
- **Styling:** Use Tailwind CSS as the default. For complex styling that Tailwind handles poorly, use SCSS instead.
- **Rounding:** Never hardcode border-radius values or Tailwind rounding classes directly. Always reference the theme rounding variables from `src/_data/theme.yml` via Liquid: `{{ theme.button_rounding }}` for buttons, `{{ theme.image_rounding }}` for images, and `{{ theme.container_rounding }}` for containers (cards, form inputs, dropdowns, etc.). These variables resolve to Tailwind rounding classes (e.g. `rounded`, `rounded-md`) and are applied directly in component class attributes.
- **Background Images:** Never use CSS `background-image` for background images. Instead, use an actual image element (via the bookshop image component) positioned absolutely behind the content. This allows images to go through Eleventy's image optimization pipeline (responsive variants, LQIP, etc.). The pattern is a wrapper div with `absolute inset-0` containing the image component with `object-cover`, and content layered on top with `z-10`. See `sections/bannerHero` and `sections/fullImageHero` for reference.

## Component Documentation

See `docs/componentArchitecture.md` for detailed component specs including:
- Core Elements: Heading, Text, Image, Button, Icon, List, Video, Testimonial, etc.
- Wrappers: Card, Split, Grid, Accordion, Carousel, Button Group, Modal
- Page Sections: Base Section with background, padding, and layout options
