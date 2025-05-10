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
const rssPlugin = require("@11ty/eleventy-plugin-rss");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const markdownIt = require("markdown-it"),
  md = markdownIt({
    html: true,
    linkify: false,
    typographer: true,
  });
md.disable(["code", "blockquote"]);
const markdownItAnchor = require("markdown-it-anchor");
const pluginTOC = require("eleventy-plugin-toc");
const pluginBookshop = require("@bookshop/eleventy-bookshop");
const yaml = require("js-yaml");
const { execSync } = require("child_process");
const fs = require("fs");
const svgContents = require("eleventy-plugin-svg-contents");
const sharp = require("sharp");
const ColorThief = require("colorthief");
const Fetch = require("@11ty/eleventy-fetch");

const imageHashes = {};
const imageShortcode = async (
  src,
  alt,
  cls = "",
  sizes = "100vw",
  preferSvg = true,
  widths = [200, 400, 850, 1280, 1600],
  formats = ["webp", "svg", "jpeg"],
) => {
  let before = Date.now();

  let inputFilePath = src == null ? src : path.join("src", src);
  let isRemoteUrl = false;
  if (src.includes("http://") || src.includes("https://")) {
    inputFilePath = src;
    isRemoteUrl = true;
  }

  // console.log(
  //   `[11ty/eleventy-img] ${Date.now() - before}ms: ${inputFilePath}`,
  // );
  const cacheDuration = "90d";
  const imageMetadata = await Image(inputFilePath, {
    svgShortCircuit: preferSvg ? "size" : false,
    widths: [...widths],
    formats: [...formats, null],
    outputDir: "dist/assets/images",
    urlPath: "/assets/images",
    cacheOptions: {
      duration: cacheDuration,
    }
  });
  if (!(Image.getHash(inputFilePath) in imageHashes) && !isRemoteUrl) {
    imageHashes[Image.getHash(inputFilePath)] =
      await Fetch(async function() {

		return generateLQIP(inputFilePath);
	}, {
		// must supply a unique id for the callback
		requestId: `imagelqip-${Image.getHash(inputFilePath)}`,
    duration: cacheDuration
	});
  } else if (!(Image.getHash(inputFilePath) in imageHashes) && isRemoteUrl) {
    imageHashes[Image.getHash(inputFilePath)] = await Fetch(async function() {
		// do some expensive operation here, this is simplified for brevity
    let imageBuffer = await Fetch(inputFilePath, { type: "buffer" });

		return generateLQIP(imageBuffer);
	}, {
		// must supply a unique id for the callback
		requestId: `imagelqip-${Image.getHash(inputFilePath)}`,
    duration: cacheDuration
	});
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

async function generateLQIP(imagePath) {
  const theSharp = sharp(imagePath);
  const stats = await theSharp.stats();

  const opaque = stats.isOpaque;
  console.log(opaque);
  if (!opaque) {
    return {
      opaque: false,
    };
  }

  const [previewBuffer, dominantColor] = await Promise.all([
    theSharp
      .resize(3, 2, { fit: "fill" })
      .sharpen({ sigma: 1 })
      .removeAlpha()
      .toFormat("raw", { bitdepth: 8 })
      .toBuffer(),
    ColorThief.getPalette(imagePath, 4, 10).then((palette) => palette[0]),
  ]);

  const {
    L: rawBaseL,
    a: rawBaseA,
    b: rawBaseB,
  } = rgbToOkLab({
    r: dominantColor[0],
    g: dominantColor[1],
    b: dominantColor[2],
  });
  const { ll, aaa, bbb } = findOklabBits(rawBaseL, rawBaseA, rawBaseB);
  const { L: baseL, a: baseA, b: baseB } = bitsToLab(ll, aaa, bbb);
  console.log(
    "dominant rgb",
    dominantColor,
    "lab",
    Number(rawBaseL.toFixed(4)),
    Number(rawBaseA.toFixed(4)),
    Number(rawBaseB.toFixed(4)),
    "compressed",
    Number(baseL.toFixed(4)),
    Number(baseA.toFixed(4)),
    Number(baseB.toFixed(4)),
  );

  const cells = Array.from({ length: 6 }, (_, index) => {
    const r = previewBuffer.readUint8(index * 3);
    const g = previewBuffer.readUint8(index * 3 + 1);
    const b = previewBuffer.readUint8(index * 3 + 2);
    return rgbToOkLab({ r, g, b });
  });

  const values = cells.map(({ L }) => clamp(0.5 + L - baseL, 0, 1));
  const ca = Math.round(values[0] * 0b11);
  const cb = Math.round(values[1] * 0b11);
  const cc = Math.round(values[2] * 0b11);
  const cd = Math.round(values[3] * 0b11);
  const ce = Math.round(values[4] * 0b11);
  const cf = Math.round(values[5] * 0b11);
  const lqip =
    -(2 ** 19) +
    ((ca & 0b11) << 18) +
    ((cb & 0b11) << 16) +
    ((cc & 0b11) << 14) +
    ((cd & 0b11) << 12) +
    ((ce & 0b11) << 10) +
    ((cf & 0b11) << 8) +
    ((ll & 0b11) << 6) +
    ((aaa & 0b111) << 3) +
    (bbb & 0b111);
  return `--lqip:${lqip.toFixed(0)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// find the best bit configuration that would produce a color closest to target
function findOklabBits(targetL, targetA, targetB) {
  const targetChroma = Math.hypot(targetA, targetB);
  const scaledTargetA = scaleComponentForDiff(targetA, targetChroma);
  const scaledTargetB = scaleComponentForDiff(targetB, targetChroma);

  let bestBits = [0, 0, 0];
  let bestDifference = Infinity;

  for (let lli = 0; lli <= 0b11; lli++) {
    for (let aaai = 0; aaai <= 0b111; aaai++) {
      for (let bbbi = 0; bbbi <= 0b111; bbbi++) {
        const { L, a, b } = bitsToLab(lli, aaai, bbbi);
        const chroma = Math.hypot(a, b);
        const scaledA = scaleComponentForDiff(a, chroma);
        const scaledB = scaleComponentForDiff(b, chroma);

        const difference = Math.hypot(
          L - targetL,
          scaledA - scaledTargetA,
          scaledB - scaledTargetB,
        );

        if (difference < bestDifference) {
          bestDifference = difference;
          bestBits = [lli, aaai, bbbi];
        }
      }
    }
  }

  return { ll: bestBits[0], aaa: bestBits[1], bbb: bestBits[2] };
}
function rgbToOkLab(c) {
  const r = gamma_inv(c.r / 255);
  const g = gamma_inv(c.g / 255);
  const b = gamma_inv(c.b / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: l * +0.2104542553 + m * +0.793617785 + s * -0.0040720468,
    a: l * +1.9779984951 + m * -2.428592205 + s * +0.4505937099,
    b: l * +0.0259040371 + m * +0.7827717662 + s * -0.808675766,
  };
}

function gamma_inv(x) {
  return x >= 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
}

// Scales a or b of Oklab to move away from the center
// so that euclidean comparison won't be biased to the center
function scaleComponentForDiff(x, chroma) {
  return x / (1e-6 + Math.pow(chroma, 0.5));
}

function bitsToLab(ll, aaa, bbb) {
  const L = (ll / 0b11) * 0.6 + 0.2;
  const a = (aaa / 0b1000) * 0.7 - 0.35;
  const b = ((bbb + 1) / 0b1000) * 0.7 - 0.35;
  return { L, a, b };
}

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

const slugify = (key) =>
  key
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "-")
    .replace(/^-|-$/g, "");

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
        flattenedTokens[contactKey] = contactFields[key];
      }
    });

    console.log(flattenedTokens);
    return flattenedTokens;
  } catch (e) {
    console.warn("Warning: site.json could not be loaded or is empty.");
    return {}; // Return an empty object if the file doesn't exist or has errors
  }
}

module.exports = (eleventyConfig) => {
  // Markdown
  let options = {
    html: true,
    linkify: true,
    typographer: true,
  };
  eleventyConfig.setLibrary(
    "md",
    markdownIt(options).disable(["code"]).use(markdownItAnchor),
  );
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
  eleventyConfig.addPlugin(rssPlugin);
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(pluginTOC, {
    tags: ["h1", "h2", "h3", "h4", "h5", "h6"],
  });
  eleventyConfig.addPlugin(svgContents);

  eleventyConfig.addPlugin(
    pluginBookshop({
      bookshopLocations: ["_component-library"],
      pathPrefix: "",
    }),
  );

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
  eleventyConfig.addFilter("pathExists", pathExistsFilter);
  eleventyConfig.addFilter("uuidHashFilter", uuidHashFilter);
  eleventyConfig.addFilter("tagColorFilter", tagColorFilter);

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
