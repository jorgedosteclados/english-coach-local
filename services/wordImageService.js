const axios = require("axios");
const db = require("../database");

const DEFAULT_OPENVERSE_URL = "https://api.openverse.engineering/v1/images/";
const IMAGE_TIMEOUT_MS = 4500;
const ABSTRACT_WORDS = new Set([
  "a",
  "able",
  "about",
  "after",
  "all",
  "although",
  "am",
  "an",
  "and",
  "another",
  "are",
  "as",
  "be",
  "because",
  "before",
  "could",
  "did",
  "do",
  "does",
  "don't",
  "everything",
  "for",
  "he",
  "he's",
  "her",
  "hers",
  "him",
  "his",
  "i",
  "i'm",
  "if",
  "is",
  "issue",
  "it",
  "it's",
  "me",
  "my",
  "of",
  "or",
  "our",
  "please",
  "problem",
  "some",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "they",
  "they're",
  "this",
  "to",
  "unless",
  "us",
  "was",
  "we",
  "we're",
  "while",
  "why",
  "will",
  "would",
  "you",
  "you're",
  "your",
  "yours"
]);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function normalizeWord(word) {
  return String(word || "")
    .toLowerCase()
    .replace(/[^a-z']/g, "")
    .trim();
}

function shouldLookupImage(word) {
  return Boolean(word && word.length > 2 && !ABSTRACT_WORDS.has(word));
}

async function getReadingWordImage(word) {
  const normalizedWord = normalizeWord(word);
  if (!shouldLookupImage(normalizedWord)) {
    return { word: normalizedWord, image: null, source: "skipped" };
  }

  const cachedImage = await getCachedImage(normalizedWord);
  if (cachedImage) {
    return { word: normalizedWord, image: formatImage(cachedImage), source: "cache" };
  }

  const image = await searchOpenverse(normalizedWord);
  if (!image) {
    return { word: normalizedWord, image: null, source: "missing" };
  }

  await saveCachedImage(normalizedWord, image);
  return { word: normalizedWord, image, source: "openverse" };
}

async function getCachedImage(word) {
  return get(
    `
    SELECT image_url, thumbnail_url, provider, source_url, title, creator, license
    FROM reading_image_cache
    WHERE word = ?
    `,
    [word]
  );
}

async function saveCachedImage(word, image) {
  await run(
    `
    INSERT INTO reading_image_cache (
      word,
      image_url,
      thumbnail_url,
      provider,
      source_url,
      title,
      creator,
      license
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(word) DO UPDATE SET
      image_url = excluded.image_url,
      thumbnail_url = excluded.thumbnail_url,
      provider = excluded.provider,
      source_url = excluded.source_url,
      title = excluded.title,
      creator = excluded.creator,
      license = excluded.license,
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      word,
      image.imageUrl,
      image.thumbnailUrl || null,
      image.provider,
      image.sourceUrl || null,
      image.title || null,
      image.creator || null,
      image.license || null
    ]
  );
}

async function searchOpenverse(word) {
  const apiUrl = process.env.OPENVERSE_API_URL || DEFAULT_OPENVERSE_URL;

  try {
    const response = await axios.get(apiUrl, {
      params: {
        q: word,
        page_size: 1,
        mature: false
      },
      timeout: Number(process.env.OPENVERSE_TIMEOUT_MS) || IMAGE_TIMEOUT_MS,
      headers: {
        "User-Agent": "EnglishCoachLocal/1.0"
      }
    });

    const result = response.data?.results?.[0];
    if (!result?.url) {
      return null;
    }

    return {
      imageUrl: result.url,
      thumbnailUrl: result.thumbnail || result.url,
      provider: "openverse",
      sourceUrl: result.foreign_landing_url || result.url,
      title: result.title || word,
      creator: result.creator || null,
      license: result.license || null
    };
  } catch (error) {
    console.warn("Openverse image lookup unavailable:", error.message);
    return null;
  }
}

function formatImage(row) {
  return {
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url || row.image_url,
    provider: row.provider || "openverse",
    sourceUrl: row.source_url,
    title: row.title,
    creator: row.creator,
    license: row.license
  };
}

module.exports = {
  getReadingWordImage,
  shouldLookupImage
};
