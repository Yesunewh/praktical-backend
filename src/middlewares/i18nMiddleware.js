const fs = require("fs");
const path = require("path");

// Load locales into memory
const locales = {
    eng: JSON.parse(fs.readFileSync(path.join(__dirname, "../locales/en.json"), "utf8")),
    am: JSON.parse(fs.readFileSync(path.join(__dirname, "../locales/am.json"), "utf8")),
    orm: JSON.parse(fs.readFileSync(path.join(__dirname, "../locales/om.json"), "utf8")),
};


const i18nMiddleware = (req, res, next) => {
    // 1. Detect language
    let lang = req.headers["accept-language"];

    // Normalize header (e.g., "en-US,en;q=0.9" -> "en")
    if (lang) {
        lang = lang.split(",")[0].split("-")[0].toLowerCase();
        // Map standard codes to our internal keys if necessary
        if (lang === "en") lang = "eng";
        if (lang === "om" || lang === "or") lang = "orm";
    }

    // 2. Fallback to User Preference if authenticated (attached by authMiddleware)
    if ((!lang || !locales[lang]) && req.user && req.user.payload) {
        lang = req.user.payload.language_preference;
    }

    // 3. Final fallback to English
    if (!lang || !locales[lang]) {
        lang = "eng";
    }

    req.lang = lang;

    // 4. Attach translation helper
    req.t = (key) => {
        const keys = key.split(".");
        let result = locales[lang];

        for (const k of keys) {
            if (result && result[k]) {
                result = result[k];
            } else {
                return key; // Return key if not found
            }
        }
        return result;
    };

    next();
};

module.exports = i18nMiddleware;
