const Image = require("@11ty/eleventy-img");
const path = require("path");
const dateFilter = require("./src/filters/date-filter.js");
const w3DateFilter = require("./src/filters/w3-date-filter.js");
const readTimeFilter = require("./src/filters/read-time-filter.js");
const randomBlogsFilter = require("./src/filters/random-blogs-filter.js");
const uuidFilter = require("./src/filters/uuid-filter.js");
const linkFilter = require("./src/filters/active-link-filter.js");
const military_time = require("./src/filters/military-time-filter.js");
const id_filter = require("./src/filters/id-filter.js");
const log_filter = require("./src/filters/log-filter.js");
const fileSubstringFilter = require("./src/filters/extract-file-substring-filter.js");
const stringifyFilter = require("./src/filters/stringify-filter.js");
const evalLiquid = require("./src/filters/evalLiquid-filter.js");
const happeningsFilter = require("./src/filters/happenings-filter.js");
const listingsFilter = require("./src/filters/listings-filter.js");
const getServiceCategories = require("./src/filters/getServiceCategories-filter.js");
const pathExistsFilter = require("./src/filters/pathExists-filter.js");
const uuidHashFilter = require("./src/filters/uuid-hash-filter.js");
const tagColorFilter = require("./src/filters/tag-color-filter.js");
const collectionsFilter = require("./src/filters/collections-filter.js");
const rot20_7 = require("./src/filters/rot20-7-filter.js");
const docsModeFilter = require("./src/filters/docsDarkMode-filter.js");
const jsonPathFilter = require("./src/filters/jsonPath-filter.js");
const mime = require("mime-types");
const sanitizeRssFilter = require("./src/filters/sanitizeRss-filter.js");

const rssPlugin = require("@11ty/eleventy-plugin-rss");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const markdownIt = require("markdown-it"),
  md = markdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });
md.disable(["code"]);

const ultree = require("markdown-it-ultree");

const slugify = require("slugify");

const markdownItAnchor = require("markdown-it-anchor");

const linkAfterHeader = markdownItAnchor.permalink.linkInsideHeader({
  class: "anchor",
  symbol: "<span >#</span>",
  style: "aria-labelledby",
});
const markdownItAnchorOptions = {
  level: [1, 2, 3],
  slugify: (str) =>
    slugify(str, {
      lower: true,
      strict: true,
      remove: /["]/g,
    }),
  tabIndex: false,
  // simply use the constant defined above
  permalink: linkAfterHeader,
};

const pluginTOC = require("eleventy-plugin-toc");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginBookshop = require("@bookshop/eleventy-bookshop");
const yaml = require("js-yaml");
const { execSync } = require("child_process");
const fs = require("fs");
const svgContents = require("eleventy-plugin-svg-contents");
const Fetch = require("@11ty/eleventy-fetch");
const { generateLQIP } = require("./utils/lqip.js");

const imageHashes = {};
const imageShortcode = async (
  src,
  alt,
  cls = "",
  sizes = "100vw",
  widths = [200, 400, 850, 1280, 1600],
  formats = ["webp", "svg", "jpeg"],
  preferSvg = true,
) => {
  let before = Date.now();

  let inputFilePath = src == null ? src : path.join("src", src);
  let isRemoteUrl = false;
  if (src.includes("http://") || src.includes("https://")) {
    inputFilePath = src;
    isRemoteUrl = true;
  }
  if (!widths) {
    widths = [200, 400, 850, 1280, 1600];
  }

  const cacheDuration = "365d";
  const imageMetadata = await Image(inputFilePath, {
    svgShortCircuit: preferSvg ? "size" : false,
    widths: [...widths],
    formats: [...formats, null],
    outputDir: "dist/assets/images",
    urlPath: "/assets/images",
    cacheOptions: {
      duration: cacheDuration,
    },
  });
  if (!(Image.getHash(inputFilePath) in imageHashes) && !isRemoteUrl) {
    imageHashes[Image.getHash(inputFilePath)] = await Fetch(
      async function () {
        return generateLQIP(inputFilePath);
      },
      {
        // must supply a unique id for the callback
        requestId: `imagelqip-${Image.getHash(inputFilePath)}`,
        duration: cacheDuration,
      },
    );
  } else if (!(Image.getHash(inputFilePath) in imageHashes) && isRemoteUrl) {
    imageHashes[Image.getHash(inputFilePath)] = await Fetch(
      async function () {
        let imageBuffer = await Fetch(inputFilePath, { type: "buffer" });

        return generateLQIP(imageBuffer);
      },
      {
        // must supply a unique id for the callback
        requestId: `imagelqip-${Image.getHash(inputFilePath)}`,
        duration: cacheDuration,
      },
    );
  }

  const imageAttributes = {
    class: cls,
    alt,
    style: imageHashes[Image.getHash(inputFilePath)],
    sizes: sizes || "100vw",
    loading: "lazy",
    decoding: "async",
  };

  return Image.generateHTML(imageMetadata, imageAttributes)
    .replace(/\s+/g, " ")
    .trim();
};

const logoShortcode = async (
  src,
  alt,
  cls = "",
  sizes = "100vw",
  preferSvg = true,
  widths = [200],
  formats = ["webp", "svg", "jpeg"],
) => {
  let before = Date.now();
  let inputFilePath = src == null ? src : path.join("src", src);
  if (fs.existsSync(inputFilePath)) {
    // console.log(
    //   `[11ty/eleventy-img] ${Date.now() - before}ms: ${inputFilePath}`,
    // );
    const imageMetadata = await Image(inputFilePath, {
      svgShortCircuit: preferSvg ? "size" : false,
      widths: [...widths],
      formats: [...formats, null],
      outputDir: "dist/assets/images",
      urlPath: "/assets/images",
    });

    const imageAttributes = {
      class: cls,
      alt,
      sizes: sizes || "100vw",
      loading: "lazy",
      decoding: "async",
    };

    return Image.generateHTML(imageMetadata, imageAttributes);
  } else {
    return `<img class='${cls}' src='${src}' alt='${alt}'>`;
  }
};

function generateImages(src, widths = [200, 400, 850, 1920, 2500]) {
  let source = src;
  let options = {
    widths: [...widths, null],
    formats: ["jpeg", "webp", null],
    outputDir: "dist/assets/images",
    urlPath: "/assets/images",
    useCache: true,
    sharpJpegOptions: {
      quality: 80,
      progressive: true,
    },
  };
  // genrate images, ! dont wait
  Image(source, options);
  // get metadata even the image are not fully generated
  return Image.statsSync(source, options);
}

function imageCssBackground(src, selector, widths) {
  const metadata = generateImages(src, widths);
  let markup = [
    `${selector} { background-image: url(${metadata.jpeg[0].url});} `,
  ];
  // i use always jpeg for backgrounds
  metadata.webp.slice(1).forEach((image, idx) => {
    markup.push(
      `@media (min-width: ${metadata.jpeg[idx].width}px) { ${selector} {background-image: url(${image.url});}}`,
    );
  });
  return markup.join("");
}

const evaluateToken = (tokens, inputPath) => {
  const normalizedPath = slugify(inputPath);
  return tokens[normalizedPath] || "";
};

// Load and flatten tokens.yml
function loadTokens() {
  const tokensFile = path.join(__dirname, "src", "_data", "tokens.yml");

  try {
    const tokensData = yaml.load(fs.readFileSync(tokensFile, "utf8"));
    const tokenList = tokensData?.token_list || []; // Default to an empty array if undefined

    // Flatten tokens recursively
    function flattenTokens(tokenList, prefix = "") {
      let flatTokens = {};

      tokenList.forEach((token) => {
        if (token?.key && token?.value) {
          const fullKey = slugify(
            prefix ? `${prefix}.${token.key}` : token.key,
          );
          flatTokens[fullKey] = token.value;
        } else if (token?.groupName && Array.isArray(token.tokens)) {
          const groupPrefix = slugify(
            prefix ? `${prefix}.${token.groupName}` : token.groupName,
          );
          Object.assign(flatTokens, flattenTokens(token.tokens, groupPrefix));
        }
      });
      console.log(flatTokens);
      return flatTokens;
    }

    return flattenTokens(tokenList);
  } catch (e) {
    console.warn("Warning: tokens.yml could not be loaded or is empty.");
    return {}; // Return an empty object if the file doesn't exist or has errors
  }
}

function loadSiteTokens() {
  const siteFile = path.join(__dirname, "src", "_data", "site.json");

  try {
    const siteData = JSON.parse(fs.readFileSync(siteFile, "utf8"));

    const allowedFields = ["name", "legalName", "url"];
    const contactFields = siteData?.contactInfo || {};

    const flattenedTokens = {};

    // Include allowed top-level fields
    allowedFields.forEach((field) => {
      if (siteData?.[field]) {
        const fieldKey = slugify(field);
        flattenedTokens[fieldKey] = siteData[field];
      }
    });

    // Include contactInfo fields
    Object.keys(contactFields).forEach((key) => {
      if (contactFields[key]) {
        let contactKey = slugify(`contactInfo.${key}`);
        console.log(contactKey);
        flattenedTokens[contactKey] =
          key == "email" || key == "phone"
            ? `<span data-rot20-text>${rot20_7(contactFields[key])}</span>`
            : contactFields[key];
      }
    });

    console.log(flattenedTokens);
    return flattenedTokens;
  } catch (e) {
    console.warn("Warning: site.json could not be loaded or is empty.");
    return {}; // Return an empty object if the file doesn't exist or has errors
  }
}

module.exports = async function (eleventyConfig) {
  const { InputPathToUrlTransformPlugin } = await import("@11ty/eleventy");
  const { RenderPlugin } = await import("@11ty/eleventy");
  const { default: pluginMermaid } = await import(
    "@kevingimbel/eleventy-plugin-mermaid"
  );
  // Markdown
  let options = {
    html: true,
    linkify: true,
    typographer: true,
  };
  const md = markdownIt(options)
    .disable(["code"])
    .use(markdownItAnchor, markdownItAnchorOptions)
    .use(ultree);
  md.core.ruler.before("normalize", "strip_bookshop_live_comments", (state) => {
    if (!state.src || !state.src.includes("bookshop-live")) return;

    // remove bookshop live markers (meta/name/end, etc.)
    state.src = state.src.replace(/<!--\s*bookshop-live[\s\S]*?-->/g, "");

    // clean up extra blank lines left behind (prevents paragraph breaks)
    state.src = state.src.replace(/\n{3,}/g, "\n\n");
  });
  eleventyConfig.setLibrary("md", md);
  eleventyConfig.addWatchTarget("./_component-library/**/*");

  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));
  eleventyConfig.addDataExtension("yml", (contents) => yaml.load(contents));

  eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
  eleventyConfig.addPassthroughCopy("./src/images/");
  eleventyConfig.addPassthroughCopy("/src/images/");
  eleventyConfig.addPassthroughCopy("./src/assets/uploads/**");
  eleventyConfig.addPassthroughCopy("./src/assets/images");
  eleventyConfig.addPassthroughCopy("./src/assets/js");
  eleventyConfig.addPassthroughCopy("./src/_includes/partials/background");
  // eleventyConfig.addPassthroughCopy("./src/css/");
  eleventyConfig.addPassthroughCopy({ "./src/images/favicon": "/" });
  eleventyConfig.addPassthroughCopy("./src/fonts");
  //eleventyConfig.addPassthroughCopy({ './src/robots.txt': '/robots.txt' });
  eleventyConfig.addPassthroughCopy("./src/_redirects");
  eleventyConfig.addAsyncShortcode("image", imageShortcode);
  eleventyConfig.addAsyncShortcode("logo", logoShortcode);
  eleventyConfig.addShortcode("cssBackground", imageCssBackground);
  eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);
  eleventyConfig.addPlugin(rssPlugin);
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(pluginTOC, {
    tags: ["h1", "h2", "h3", "h4", "h5", "h6"],
  });
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(svgContents);

  eleventyConfig.addPlugin(
    pluginBookshop({
      bookshopLocations: ["_component-library"],
      pathPrefix: "",
    }),
  );
  eleventyConfig.addPlugin(pluginMermaid, {
    mermaid_config: {
      startOnLoad: true,
      theme: "dark",
    },
  });
  eleventyConfig.addPlugin(RenderPlugin);

  // Returns a collection of blog posts in reverse date order
  eleventyConfig.addCollection("blog", (collection) => {
    return [...collection.getFilteredByGlob("./src/posts/**/*.md")].reverse();
  });

  eleventyConfig.addCollection("pages", (collection) => {
    return collection.getFilteredByGlob("./src/pages/**/*.md");
  });

  eleventyConfig.addCollection("services", (collection) => {
    return collection.getFilteredByGlob("./src/services/**/*.md");
  });
  eleventyConfig.addCollection("happenings", (collection) => {
    return collection.getFilteredByGlob("./src/happenings/**/*.md");
  });

  eleventyConfig.addCollection("upcomingHappenings", function (collectionsApi) {
    const happeningsConfig = yaml.load(
      fs.readFileSync("./src/_data/happenings.yml", "utf8"),
    );
    const tags = ["happenings"].concat(happeningsConfig.tags);
    return collectionsApi
      .getFilteredByGlob(["./src/happenings/**/*.md", "./src/posts/**/*.md"])
      .filter(function (item) {
        const today = new Date();
        return (
          ((item.data.draft === false && item.url.includes("happenings/")) ||
            (item.data.happeningDate !== null &&
              (item.data.happening === null || item.data.happening === true) &&
              (happeningsConfig.tags === null ||
                happeningsConfig.tags.some(
                  (tag) => item.data.tags && item.data.tags.includes(tag),
                )))) &&
          new Date(item.data.happeningDate) >= today
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.data.happeningDate);
        const dateB = new Date(b.data.happeningDate);
        return dateA - dateB;
      });
  });

  eleventyConfig.addCollection("pastHappenings", function (collectionsApi) {
    const happeningsConfig = yaml.load(
      fs.readFileSync("./src/_data/happenings.yml", "utf8"),
    );
    const tags = ["happenings"].concat(happeningsConfig.tags);
    return collectionsApi
      .getFilteredByGlob(["./src/happenings/**/*.md", "./src/posts/**/*.md"])
      .filter(function (item) {
        const today = new Date();
        return (
          ((item.data.draft === false && item.url.includes("happenings/")) ||
            (item.data.happeningDate !== null &&
              (item.data.happening === null || item.data.happening === true) &&
              (happeningsConfig.tags === null ||
                happeningsConfig.tags.some(
                  (tag) => item.data.tags && item.data.tags.includes(tag),
                )))) &&
          new Date(item.data.happeningDate) < today
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.data.happeningDate);
        const dateB = new Date(b.data.happeningDate);
        return dateB - dateA;
      });
  });

  eleventyConfig.addCollection("listings", (collection) => {
    return collection
      .getFilteredByGlob("./src/listings/**/*.md")
      .sort((a, b) => {
        if (a.data.canExpire && !b.data.canExpire) {
          return -1; // a comes before b if a can expire and b cannot
        } else if (!a.data.canExpire && b.data.canExpire) {
          return 1; // b comes before a if b can expire and a cannot
        } else if (a.data.canExpire && b.data.canExpire) {
          return new Date(a.data.expireDate) - new Date(b.data.expireDate); // sort by expireDate if both can expire
        } else {
          return a.data.title.localeCompare(b.data.title); // sort alphabetically if neither can expire
        }
      });
  });

  eleventyConfig.addFilter("dateFilter", dateFilter);
  eleventyConfig.addFilter("w3DateFilter", w3DateFilter);
  eleventyConfig.addFilter("readTimeFilter", readTimeFilter);
  eleventyConfig.addFilter("randomBlogsFilter", randomBlogsFilter);
  eleventyConfig.addFilter("ymlify", (yml) => yaml.load(yml));
  eleventyConfig.addFilter("militaryTime", military_time);
  eleventyConfig.addFilter("markdownify", (markdown) => md.render(markdown));
  eleventyConfig.addFilter("uuidFilter", uuidFilter);
  eleventyConfig.addFilter("linkFilter", linkFilter);
  eleventyConfig.addFilter("idFilter", id_filter);
  eleventyConfig.addFilter("logFilter", log_filter);
  eleventyConfig.addFilter("categoriesFilter", getServiceCategories);
  eleventyConfig.addFilter("fileSubstringFilter", fileSubstringFilter);
  eleventyConfig.addFilter("stringifyFilter", stringifyFilter);
  eleventyConfig.addFilter("removeExtraWhitespace", function (str) {
    return str.replace(/\s+/g, " ").trim();
  });
  eleventyConfig.addFilter("evalLiquid", evalLiquid);
  eleventyConfig.addFilter("happeningsFilter", happeningsFilter);
  eleventyConfig.addFilter("listingsFilter", listingsFilter);
  eleventyConfig.addFilter("collectionsFilter", collectionsFilter);
  eleventyConfig.addFilter("pathExists", pathExistsFilter);
  eleventyConfig.addFilter("uuidHashFilter", uuidHashFilter);
  eleventyConfig.addFilter("tagColorFilter", tagColorFilter);
  eleventyConfig.addFilter("rot20Filter", rot20_7);
  eleventyConfig.addFilter("docsModeFilter", docsModeFilter);
  eleventyConfig.addFilter("jsonPathFilter", jsonPathFilter);
  eleventyConfig.addFilter("dateToRfc3339", rssPlugin.dateToRfc3339);
  eleventyConfig.addFilter("dateToRfc882", rssPlugin.dateToRfc822);
  eleventyConfig.addFilter(
    "getNewestCollectionItemDate",
    rssPlugin.getNewestCollectionItemDate,
  );
  eleventyConfig.addFilter("getMimeType", (path) => mime.lookup(path));
  eleventyConfig.addFilter("sanitizeRss", sanitizeRssFilter);

  // Load and flatten tokens
  const tokens = loadTokens();
  // Load and flatten tokens for st.* tokens
  const siteTokens = loadSiteTokens();
  // Transform for tk.* tokens

  eleventyConfig.addTransform("replace-tokens", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return content.replace(/\[\[tk\.([^\]]+)\]\]/g, (match, path) => {
        return evaluateToken(tokens, path); // Match normalized tokens
      });
    }
    return content;
  });

  eleventyConfig.addTransform("replace-site-tokens", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return content.replace(/\[\[st\.([^\]]+)\]\]/g, (match, path) => {
        return evaluateToken(siteTokens, path); // Match normalized site tokens
      });
    }
    return content;
  });

  eleventyConfig.addTransform("replace-tokens-2", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return content.replace(/\[\[tk\.([^\]]+)\]\]/g, (match, path) => {
        return evaluateToken(tokens, path); // Match normalized tokens
      });
    }
    return content;
  });

  eleventyConfig.addTransform("replace-site-tokens-2", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return content.replace(/\[\[st\.([^\]]+)\]\]/g, (match, path) => {
        return evaluateToken(siteTokens, path); // Match normalized site tokens
      });
    }
    return content;
  });

  eleventyConfig.addTransform("replace-tokens-3", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return content.replace(/\[\[tk\.([^\]]+)\]\]/g, (match, path) => {
        return evaluateToken(tokens, path); // Match normalized tokens
      });
    }
    return content;
  });

  eleventyConfig.addTransform("replace-site-tokens-3", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return content.replace(/\[\[st\.([^\]]+)\]\]/g, (match, path) => {
        return evaluateToken(siteTokens, path); // Match normalized site tokens
      });
    }
    return content;
  });

  eleventyConfig.addTransform("wrap-tables", function (content, outputPath) {
    // 1. Check if the file is an HTML file before processing.
    if (outputPath && outputPath.endsWith(".html")) {
      // 2. Use a regular expression to find all HTML tables.
      // - The /g flag ensures we find ALL tables on the page.
      // - The /s flag (dotAll) allows '.' to match newlines, which is crucial
      //   because tables span multiple lines.
      const tableRegex = /<table[\s\S]*?<\/table>/gs;

      // 3. Use String.prototype.replace() to wrap each match.
      // The callback function receives the matched table string (`match`)
      // and returns it wrapped in the <table-saw> element.
      const transformedContent = content.replace(tableRegex, (match) => {
        return `<table-saw>${match}</table-saw>`;
      });

      return transformedContent;
    }

    // Return the content untouched for non-HTML files.
    return content;
  });

  eleventyConfig.on("eleventy.before", () => {
    execSync("node ./utils/generateFavicon.js");
    execSync("node ./utils/syncPermalinks.js");
    execSync("node ./utils/permalinkDupCheck.js");
    execSync("node ./utils/addHappeningPagination.js");
    execSync("node ./utils/addBlogPagination.js");
    execSync("node ./utils/addListingPagination.js");
    execSync("node ./utils/fetch-theme-variables.js");
    execSync("node ./utils/copyGlideAssets.js");
  });

  eleventyConfig.on("eleventy.after", () => {
    execSync(
      "npx tailwindcss -i ./src/css/main.css -o ./dist/css/styles.css --minify",
    );
  });

  return {
    markdownTemplateEngine: "liquid",
    dataTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
    cssTemplateEngine: "liquid",
    dir: {
      input: "src",
      pages: "pages",
      output: "dist",
    },
  };
};
