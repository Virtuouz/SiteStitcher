module.exports = {
    engines: {
        "@bookshop/eleventy-engine": {
            "plugins": ["./image.js", "./ymlify.js", "./getServicesCategories.js", "./read-time.js","./removeExtraWhiteSpace.js","./evalLiquid.js","./stringify.js","./pathExists.js","./tag-color.js","./listings.js","./rosey.js"],
        }
    }
}
