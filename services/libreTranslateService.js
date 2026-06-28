const axios = require("axios");

const DEFAULT_TIMEOUT_MS = 3500;

function getLibreTranslateUrl() {
  return String(process.env.LIBRETRANSLATE_URL || "").replace(/\/+$/, "");
}

async function translateWithLibreTranslate(text, options = {}) {
  const baseUrl = getLibreTranslateUrl();
  const query = String(text || "").trim();

  if (!baseUrl || !query) {
    return null;
  }

  const response = await axios.post(
    `${baseUrl}/translate`,
    {
      q: query,
      source: options.source || "en",
      target: options.target || "pt",
      format: "text",
      api_key: process.env.LIBRETRANSLATE_API_KEY || undefined
    },
    {
      timeout: Number(process.env.LIBRETRANSLATE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
    }
  );

  return String(response.data?.translatedText || "").trim() || null;
}

module.exports = {
  translateWithLibreTranslate
};
