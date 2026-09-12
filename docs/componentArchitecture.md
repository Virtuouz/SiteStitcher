# Core Elements
## Heading
### text string | default: My Heading

The text content of the heading.

### level enum | default: h2

The heading level or type.

**Accepted values:**

- `h1`
- `h2`
- `h3`
- `h4`
- `h5`
- `h6`

### size enum | default: default

The font size of the text.

**Accepted values:**

- `default`
- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`
- `4xl`

### alignX enum | default: start

The horizontal alignment of the text.

**Accepted values:**

- `start`
- `center`
- `end`

### iconName enum

The name of the icon to display.

### iconPosition enum | default: before

The position of the icon relative to the text.

**Accepted values:**

- `before`
- `after`

## Text
### text string | default: My text goes here.

The content for the text component (Markdown format). Leave empty to use slot content instead.

### alignX enum | default: start

The horizontal alignment of the text component.

**Accepted values:**

- `start`
- `center`
- `end`

## Image
### source string

The URL or path to the image.

### alt string

Alternative text for accessibility.
### aspectRatio enum | default: none

Set a fixed aspect ratio for the image.

**Accepted values:**

- `none`
- `square`
- `landscape`
- `portrait`
- `widescreen`
- `horizontal-strip`

### positionVertical enum | default: center

Vertical positioning of the image within the container (if aspect ratio is set).

**Accepted values:**

- `top`
- `center`
- `bottom`

### positionHorizontal enum | default: center

Horizontal positioning of the image within the container (if aspect ratio is set).

**Accepted values:**

- `left`
- `center`
- `right`

## Button
### text string | default: My Button

The text that goes inside the button.

### link string

The URL to which the button should link.

### iconName enum

The name of the icon to display. See the Icon component documentation for more information.

### iconPosition enum | default: before

The position of the icon relative to the text.

**Accepted values:**

- `before`
- `after`

### hideText boolean | default: false

Whether to hide the button text and show only the icon.

### colorGroup enum | default: primary

Which color group to use for this button

* `primary`
* `...`
### colorFromGroup enum | default: primary

Which color from the selected group to use

* `primary`
* `secondary`
* `accent`
* `text`
* `background`

### variant enum | default: normal

The presentation of button.

**Accepted values:**

- `normal`
- `ghost`
- `text`

### size enum | default: md

The size of the button.

**Accepted values:**

- `sm`
- `md`
- `lg`

## Counter
### number number | default: 100

The number to count to.

### prefix string | default: $

Text immediately before the number.

### suffix string | default: M

Text immediately after the number.

### alignX enum | default: start

The horizontal alignment of the counter.

**Accepted values:**

- `start`
- `center`
- `end`

### size enum | default: 2xl

The font size of the counter.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`
- `4xl`

## Definition List
### items array | default: array

**Item Properties:**

### _component string | default: building-blocks/core-elements/definition-list/definition-list-item

#### title string

A bolded title for the list item.

#### text string

The text content of the list item.

### alignX enum | default: start

The horizontal alignment of the definition list items.

**Accepted values:**

- `start`
- `center`
- `end`
## Divider
### paddingVertical enum | default: lg

The space on the top and bottom of the horizontal line.

**Accepted values:**

- `none`
- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`
## Embed
### html string

The raw HTML content to render.

### aspectRatio enum | default: landscape

The aspect ratio of the embed.

**Accepted values:**

- `square`
- `landscape`
- `portrait`
- `widescreen`

## Icon
### name enum | default: bolt

The name of the icon to display from the icon library.

### size enum | default: lg

The size of the icon.

**Accepted values:**

- `none`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`

### color enum | default: default

The color of the icon.

**Accepted values:**

- `default`
- `blue`
- `green`
- `yellow`
- `orange`
- `red`
- `purple`
- `pink`
- `cyan`

### background boolean | default: true

Show a background behind the icon.

### alignX enum | default: start

Horizontal alignment of the icon.

**Accepted values:**

- `start`
- `center`
- `end`

## List
### items array | default: array

Array of list items.

**Item Properties:**

### _component string | default: building-blocks/core-elements/list-item

### text string | default: List item

The text to display in the list item.

### iconName enum

The name of the icon to display from the icon library.

### iconColor enum | default: default

The color of the icon.

**Accepted values:**

- `default`
- `blue`
- `green`
- `yellow`
- `orange`
- `red`
- `purple`
- `pink`
- `cyan`

### direction enum | default: vertical

The direction in which list items are arranged.

**Accepted values:**

- `horizontal`
- `vertical`

### alignX enum | default: start

The horizontal alignment of the list items.

**Accepted values:**

- `start`
- `center`
- `end`

### size enum | default: md

Controls the size of the icon and text.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`

## Pagination

## Simple Text
### text string | default: My text goes here.

The text content of the simple text (inline markdown only).

### alignX enum | default: start

The horizontal alignment of the text.

**Accepted values:**

- `start`
- `center`
- `end`

### size enum | default: default

The font size of the text.

**Accepted values:**

- `default`
- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`
- `4xl`

## Spacer
### size enum | default: md

The amount of space to add.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`

## Testimonial
### text string | default: My testimonial text.

Quotation marks will be added around the text.

### authorName string | default: Charlie Parker

The person to whom you're attributing the quotation.

### authorDescription string | default: Author

The role or company of the person.

### authorImage string

The image of the author.

## fiveStarRating boolean

If a 5 star rating should be shown.

### alignX enum | default: start

The horizontal alignment of the testimonial.

**Accepted values:**

- `start`
- `center`
## Video
### type enum | default: youtube

**Accepted values:**

- `youtube`
- `vimeo`
- `local-source`

### id string

Used for externally hosted videos - Enter the YouTube or Vimeo id.

### title string

Used for externally hosted videos - The video title provides accessibility information for assistive technologies (like screen readers) and can display a tooltip when a user hovers over the video.

### source string

Used for locally hosted videos - Must be mp4 as this is supported by all modern browsers.

### thumbnail string

Used for locally hosted videos - The image displayed before the video plays or while it is loading.

## Badge/tag
### text string | default: tag.



# Wrappers

## Card
### label string

Optional label for the card to help identify it in the editor.

### contentSections array | default: array

Content inside the main area of the card, with padding.

### maxContentWidth enum

Maximum width constraint for the card content.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`

### paddingHorizontal enum | default: sm

Horizontal padding applied to the card content.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`

### paddingVertical enum | default: sm

Vertical padding applied to the card content.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`

### colorScheme enum

Color scheme theme for the card.

**Accepted values:**

- `default`
- `contrast`

### backgroundColor enum | default: base

Background color for the card.

**Accepted values:**

- `none`
- `base`
- `surface`
- `accent`
- `highlight`

### backgroundImage object

Background image configuration for the card.

**Properties:**

### source string

URL or path to the background image.

### alt string

Alt text for the background image.

### positionVertical enum

Vertical position of the background image.

**Accepted values:**

- `top`
- `center`
- `bottom`

### positionHorizontal enum

Horizontal position of the background image.

**Accepted values:**

- `left`
- `center`
- `right`

### link string

URL to make the entire card clickable. Leave empty for a non-clickable card.

### rounded boolean | default: false

Whether to apply rounded corners to the card.

### border boolean | default: false

Whether to apply a border to the card.

### showBeforeAfter boolean | default: false

Whether to show the before/after content blocks used to add content outside the card's padding.

### beforeContentSections array | default: array

Content that appears above the main card area, without padding.

### afterContentSections array | default: array

Content that appears below the main card area, without padding.
## Content Unit
This would be a grouping of:
* eyebrow - text
* heading - heading
* description - content
* buttons - button group

## Card
### label string

Optional label for the card to help identify it in the editor.

### contentSections array | default: array

Content inside the main area of the card, with padding.

### maxContentWidth enum

Maximum width constraint for the card content.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`

### paddingHorizontal enum | default: sm

Horizontal padding applied to the card content.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`

### paddingVertical enum | default: sm

Vertical padding applied to the card content.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`

### colorScheme enum

Color scheme theme for the card.

**Accepted values:**

- `default`
- `contrast`

### backgroundColor enum | default: base

Background color for the card.

**Accepted values:**

- `none`
- `base`
- `surface`
- `accent`
- `highlight`

### backgroundImage object

Background image configuration for the card.

**Properties:**

### source string

URL or path to the background image.

### alt string

Alt text for the background image.

### positionVertical enum

Vertical position of the background image.

**Accepted values:**

- `top`
- `center`
- `bottom`

### positionHorizontal enum

Horizontal position of the background image.

**Accepted values:**

- `left`
- `center`
- `right`

### link string

URL to make the entire card clickable. Leave empty for a non-clickable card.

### rounded boolean | default: false

Whether to apply rounded corners to the card.

### border boolean | default: false

Whether to apply a border to the card.

### showBeforeAfter boolean | default: false

Whether to show the before/after content blocks used to add content outside the card's padding.

### beforeContentSections array | default: array

Content that appears above the main card area, without padding.

### afterContentSections array | default: array

Content that appears below the main card area, without padding.

## Split
### label string

Optional label for the split to help identify it in the editor.

### firstColumnContentSections array | default: array

Array of content sections to render in the first column.

### secondColumnContentSections array | default: array

Array of content sections to render in the second column.

### distributionMode enum | default: half

Predefined distribution mode for both columns.

**Accepted values:**

- `quarter-three-quarters`
- `third-two-thirds`
- `half`
- `two-thirds-third`
- `three-quarters-quarter`
- `fixed-flexible`
- `flexible-fixed`

### fixedWidth number

Fixed width in pixels for the fixed column (used when distribution mode includes 'fixed').

### minSplitWidth number | default: 760

Minimum width in pixels before switching to mobile layout.

### verticalAlignment enum | default: center

Vertical alignment of the columns.

**Accepted values:**

- `top`
- `center`
- `bottom`
- `stretch`

### reverse boolean | default: false

Swaps the order of the columns.

### reverseOrderOnMobile boolean | default: false

When true, reversed splits will have their order flipped on mobile (text-image pattern). When false, reversed splits keep their desktop order on mobile.

### gap enum | default: lg

Spacing between the two columns.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`

## Grid
### label string

Optional label for the grid to help identify it in the editor.

### layout enum | default: center

Defines how grid items are arranged.

**Accepted values:**

- `start`
- `center`

### minItemWidth number | default: 280

The minimum width for each grid item in pixels.

### maxItemWidth number | default: 400

The maximum width for each grid item in pixels.

### items array | default: array

Array of grid items, each containing content blocks to render.

**Item Properties:**

### _component string | default: building-blocks/wrappers/grid/grid-item

### contentSections array | default: array

Content sections to render within this grid item.

### gap enum | default: md

The gap between grid items.

**Accepted values:**

- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `3xl`

## Accordion
### label string

Optional label for the accordion to help identify it in the editor.

### items array | default: array

The items to display in the accordion.

**Item Properties:**

### _component string | default: building-blocks/wrappers/accordion/accordion-item

### title string

The title of the accordion item.

### contentSections array

### openFirst boolean | default: false

Whether the first item will be open by default.

### singleOpen boolean | default: false

Whether only one item can be open at a time within this accordion.

## Button Group
### label string

Optional label for the button group to help identify it in the editor.

### buttonSections array | default: array

Array of button components to render within the group.

### direction enum | default: row

Direction of button layout.

**Accepted values:**

- `row`
- `column`

### alignX enum | default: start

The horizontal alignment of the buttons within the group.

**Accepted values:**

- `start`
- `center`
- `end`

## Carousel
### label string

Optional label for the carousel to help identify it in the editor.

### slides array | default: array

Array of slides to display in the carousel.

**Item Properties:**

### _component string | default: building-blocks/wrappers/carousel/carousel-slide

### contentSections array | default: array

### autoPlay boolean | default: false

Enable auto-play functionality.

### autoScroll boolean | default: false

Enable auto-scroll functionality.

### slideWidthPercent string | default: 100

Width of each slide as a percentage of the carousel (e.g., 33, 50, 100).

### minSlideWidth number | default: 0

Minimum width of slides in pixels. Prevents slides from getting too small.

## Content selector
### label string

Optional label for the content selector to help identify it in the editor.

### items array | default: array

**Item Properties:**

### _component string | default: building-blocks/wrappers/content-selector/content-selector-item

### title string | default: Section Title

The heading for the content panel.

### contentSections array | default: array

### navigationPosition enum | default: start

**Accepted values:**

- `start`
- `top`

## Modal
### contentSections array | default: array



# Sections
## Base Section
* background image
* Opacity layer
* Height - Content or screen
* vertical padding
* Horizontal padding
* vertical Positioning
* Background color
* Top partial color
* bottom partial color

# Translation (Rosey)

Authoring rules live in `CLAUDE.md` → *Internationalization (Rosey)*. The two that
break silently if missed:

* **Never put `roseyNs` / `roseyRoot` on the element that carries `roseyTag` /
  `roseyMarkdown`.** The build and the Visual Editor resolve different keys for
  that element, so editor translations land where the build never reads them.
  Namespace an untagged ancestor, fold `_uuid` into the key, or move the tag to an
  inner `roseyWrap` span.
* **A sub-field include needs its own key.** `{% bookshop "generic/textBlock"
  text: content.headline _uuid: "" roseyKey: "headline" %}` — otherwise every
  textBlock in the parent keys as `text` and shares one translation.

`ROSEY_ENABLED=true npm run cc:build && npm run test:roseyKeys` checks the built
site; `npm run test:roseyParity` checks the Eleventy and Bookshop filters agree.