const axios = require("axios");
const db = require("../database");

const DEFAULT_OPENVERSE_URL = "https://api.openverse.engineering/v1/images/";
const IMAGE_TIMEOUT_MS = 4500;
const CACHE_PROVIDER = "openverse-ranked-v2";
const SEARCH_PAGE_SIZE = 12;
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
const VISUAL_QUERY_OVERRIDES = {
  bike: "bicycle",
  bikes: "bicycle",
  drill: "electric drill",
  drills: "electric drill",
  mustache: "mustache",
  moustache: "mustache",
  screenshot: "computer screenshot"
};
const NEGATIVE_TITLE_TERMS = [
  "advertisement",
  "album",
  "book",
  "cover",
  "diagram",
  "festival",
  "logo",
  "map",
  "poster",
  "sign",
  "sticker",
  "text"
];

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

  const cachedImage = await getApprovedImage(normalizedWord);
  if (cachedImage) {
    return { word: normalizedWord, image: formatImage(cachedImage), source: "approved" };
  }

  return { word: normalizedWord, image: null, source: "needs-approval" };
}

async function getReadingWordImageCandidates(word) {
  const normalizedWord = normalizeWord(word);
  if (!shouldLookupImage(normalizedWord)) {
    return { word: normalizedWord, images: [], source: "skipped" };
  }

  const images = await searchOpenverseCandidates(normalizedWord);
  return {
    word: normalizedWord,
    images,
    source: images.length > 0 ? "openverse" : "missing"
  };
}

async function approveReadingWordImage({ word, image }) {
  const normalizedWord = normalizeWord(word);
  if (!shouldLookupImage(normalizedWord) || !image?.imageUrl) {
    const error = new Error("Choose a valid image before saving.");
    error.statusCode = 400;
    throw error;
  }

  const approvedImage = normalizeImagePayload(image, normalizedWord);
  await saveApprovedImage(normalizedWord, approvedImage);

  return {
    success: true,
    word: normalizedWord,
    image: approvedImage,
    source: "approved"
  };
}

async function getApprovedImage(word) {
  return get(
    `
    SELECT image_url, thumbnail_url, provider, source_url, title, creator, license
    FROM reading_image_cache
    WHERE word = ?
      AND approved = 1
    `,
    [word]
  );
}

async function saveApprovedImage(word, image) {
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
      license,
      approved,
      approved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(word) DO UPDATE SET
      image_url = excluded.image_url,
      thumbnail_url = excluded.thumbnail_url,
      provider = excluded.provider,
      source_url = excluded.source_url,
      title = excluded.title,
      creator = excluded.creator,
      license = excluded.license,
      approved = 1,
      approved_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      word,
      image.imageUrl,
      image.thumbnailUrl || null,
      CACHE_PROVIDER,
      image.sourceUrl || null,
      image.title || null,
      image.creator || null,
      image.license || null
    ]
  );
}

async function searchOpenverseCandidates(word) {
  const apiUrl = process.env.OPENVERSE_API_URL || DEFAULT_OPENVERSE_URL;
  const query = getImageSearchQuery(word);

  try {
    const response = await axios.get(apiUrl, {
      params: {
        q: query,
        page_size: SEARCH_PAGE_SIZE,
        mature: false
      },
      timeout: Number(process.env.OPENVERSE_TIMEOUT_MS) || IMAGE_TIMEOUT_MS,
      headers: {
        "User-Agent": "EnglishCoachLocal/1.0"
      }
    });

    return rankImageResults(response.data?.results || [], word, query)
      .slice(0, 6)
      .map(({ result }) => formatOpenverseResult(result, word));
  } catch (error) {
    console.warn("Openverse image lookup unavailable:", error.message);
    return [];
  }
}

function getImageSearchQuery(word) {
  if (VISUAL_QUERY_OVERRIDES[word]) {
    return VISUAL_QUERY_OVERRIDES[word];
  }

  if (word.endsWith("s") && word.length > 4) {
    const singular = word.slice(0, -1);
    return VISUAL_QUERY_OVERRIDES[singular] || singular;
  }

  return word;
}

function pickBestImage(results, word, query) {
  return rankImageResults(results, word, query)[0]?.result;
}

function rankImageResults(results, word, query) {
  return results
    .filter((result) => result?.url && result.mature !== true)
    .map((result) => ({
      result,
      score: scoreImageResult(result, word, query)
    }))
    .sort((left, right) => right.score - left.score);
}

function formatOpenverseResult(result, word) {
  return {
    imageUrl: result.url,
    thumbnailUrl: result.thumbnail || result.url,
    provider: "openverse",
    sourceUrl: result.foreign_landing_url || result.url,
    title: result.title || word,
    creator: result.creator || null,
    license: result.license || null
  };
}

function normalizeImagePayload(image, word) {
  return {
    imageUrl: String(image.imageUrl || "").trim(),
    thumbnailUrl: String(image.thumbnailUrl || image.imageUrl || "").trim(),
    provider: String(image.provider || "openverse").trim(),
    sourceUrl: String(image.sourceUrl || image.imageUrl || "").trim(),
    title: String(image.title || word).trim(),
    creator: image.creator ? String(image.creator).trim() : null,
    license: image.license ? String(image.license).trim() : null
  };
}

function scoreImageResult(result, word, query) {
  const title = String(result.title || "").toLowerCase();
  const provider = String(result.provider || "").toLowerCase();
  const tags = (result.tags || []).map((tag) => String(tag.name || "").toLowerCase());
  const queryTerms = query.split(/\s+/).filter(Boolean);
  let score = 0;

  if (title === query) {
    score += 35;
  } else if (title.includes(query)) {
    score += 24;
  }

  queryTerms.forEach((term) => {
    if (title.includes(term)) {
      score += 8;
    }
    if (tags.includes(term)) {
      score += 5;
    }
  });

  if (title.includes(word)) {
    score += 6;
  }
  if (tags.includes(word)) {
    score += 5;
  }
  if (provider === "wikimedia") {
    score += 5;
  }
  if (result.thumbnail) {
    score += 3;
  }
  if (Number(result.width) >= 500 && Number(result.height) >= 350) {
    score += 2;
  }
  if (title.length > 90) {
    score -= 6;
  }

  NEGATIVE_TITLE_TERMS.forEach((term) => {
    if (title.includes(term)) {
      score -= 10;
    }
  });

  return score;
}

function formatImage(row) {
  return {
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url || row.image_url,
    provider: formatProvider(row.provider),
    sourceUrl: row.source_url,
    title: row.title,
    creator: row.creator,
    license: row.license
  };
}

function formatProvider(provider) {
  return String(provider || "openverse").split(":")[0].replace(/-.+$/, "");
}

module.exports = {
  approveReadingWordImage,
  getReadingWordImageCandidates,
  getReadingWordImage,
  shouldLookupImage
};
