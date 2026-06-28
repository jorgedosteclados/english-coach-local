const db = require("../database");
const { getTrailReading } = require("../data/trailReadings");
const { PDFParse } = require("pdf-parse");
const { translateWithLibreTranslate } = require("./libreTranslateService");

const translations = {
  a: "um / uma",
  able: "capaz",
  account: "conta",
  after: "depois",
  all: "todo / todos",
  am: "sou / estou",
  an: "um / uma",
  and: "e",
  although: "embora",
  anything: "qualquer coisa",
  another: "outro",
  aunt: "tia",
  are: "são / estão",
  as: "assim / como",
  be: "ser / estar",
  bag: "bolsa / saco",
  before: "antes",
  because: "porque",
  bike: "bicicleta",
  big: "grande",
  cause: "causa",
  catch: "pegar / alcançar",
  check: "verificar",
  course: "claro / curso",
  confirm: "confirmar",
  contacting: "entrar em contato",
  could: "poderia",
  "couldn't": "não conseguia / não podia",
  customer: "cliente",
  details: "detalhes",
  director: "diretor",
  do: "fazer",
  does: "faz",
  "don't": "não faça / não",
  dudley: "Dudley (nome próprio)",
  error: "erro",
  everything: "tudo",
  explain: "explicar",
  exactly: "exatamente",
  exercise: "exercício",
  exact: "exato",
  expect: "esperar / esperar que",
  favorite: "favorito",
  fat: "gordo",
  firm: "empresa",
  found: "encontramos",
  grunnings: "Grunnings (nome próprio)",
  harry: "Harry (nome próprio)",
  hardly: "mal / quase não",
  has: "tem",
  have: "ter",
  hated: "odiava",
  he: "ele",
  "he's": "ele é / ele está",
  her: "dela / sua",
  hers: "dela",
  help: "ajudar",
  him: "ele / o",
  his: "dele / seu",
  hold: "segurar / conter",
  i: "eu",
  "i'm": "eu sou / eu estou",
  is: "é / está",
  it: "isso / ele / ela",
  "it's": "isso é / isso está",
  informed: "informado",
  internal: "interno",
  investigating: "investigando",
  involved: "envolvia / envolvido",
  issue: "problema",
  know: "saber / avisar",
  last: "último",
  made: "fazia / feito",
  man: "homem",
  me: "me / mim",
  message: "mensagem",
  my: "meu / minha",
  mysterious: "misterioso",
  mystery: "mistério",
  neck: "pescoço",
  nonsense: "bobagem / absurdo",
  normal: "normal",
  often: "frequentemente",
  patience: "paciencia",
  perfectly: "perfeitamente",
  please: "por favor",
  privet: "Privet (nome da rua)",
  problem: "problema",
  proud: "orgulhoso",
  punching: "socar / socando",
  racing: "corrida",
  reliable: "confiavel",
  request: "solicitacao",
  review: "revisar",
  say: "dizer",
  screenshot: "captura de tela",
  send: "enviar",
  settings: "configuracoes",
  share: "compartilhar",
  solution: "solucao",
  somebody: "alguém",
  strange: "estranho",
  support: "suporte",
  team: "equipe",
  technical: "tecnico",
  the: "o / a / os / as",
  their: "deles / delas",
  theirs: "deles / delas",
  them: "eles / elas / os / as",
  they: "eles / elas",
  "they're": "eles são / eles estão",
  to: "para / a",
  unless: "a menos que",
  uncle: "tio",
  update: "atualizacao",
  urgency: "urgencia",
  us: "nos / nós",
  user: "usuario",
  wanted: "queria",
  was: "era / estava",
  we: "nós",
  "we're": "nós somos / nós estamos",
  while: "enquanto",
  why: "por que",
  will: "vai / irá",
  you: "você",
  "you're": "você é / você está",
  your: "seu / sua",
  yours: "seu / sua",
  would: "iria / ajudaria"
};

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

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows || []);
    });
  });
}

function splitChapters(text) {
  const normalized = normalizeText(text);
  const chapterMatches = [
    ...normalized.matchAll(
      /(?:^|\n)(chapter\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twenty-one|twenty-two|twenty-three|twenty-four|twenty-five|twenty-six|twenty-seven|twenty-eight|twenty-nine|thirty|thirty-one|thirty-two|thirty-three|thirty-four|thirty-five|thirty-six|thirty-seven)|capitulo\s+\d+)\b[^\n]*/gi
    )
  ];

  if (chapterMatches.length < 2) {
    return splitIntoReadingParts(normalized);
  }

  return chapterMatches.map((match, index) => {
    const start = match.index + (match[0].startsWith("\n") ? 1 : 0);
    const next = chapterMatches[index + 1];
    const chapterText = normalized.slice(start, next ? next.index : normalized.length).trim();
    const [titleLine, ...bodyLines] = chapterText.split("\n");

    return {
      title: titleLine.trim() || `Chapter ${index + 1}`,
      body: bodyLines.join("\n").trim() || chapterText
    };
  });
}

function splitIntoReadingParts(text, wordsPerPart = 1800) {
  const units = normalizeText(text)
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .flatMap((unit) => splitOversizedUnit(unit, wordsPerPart))
    .map((unit) => unit.trim())
    .filter(Boolean);
  const parts = [];
  let currentUnits = [];
  let currentWordCount = 0;

  units.forEach((unit) => {
    const unitWords = countWords(unit);

    if (currentUnits.length > 0 && currentWordCount + unitWords > wordsPerPart) {
      parts.push({
        title: `Part ${parts.length + 1}`,
        body: currentUnits.join(" ")
      });
      currentUnits = [];
      currentWordCount = 0;
    }

    currentUnits.push(unit);
    currentWordCount += unitWords;
  });

  if (currentUnits.length > 0) {
    parts.push({
      title: `Part ${parts.length + 1}`,
      body: currentUnits.join(" ")
    });
  }

  return parts.length > 0 ? parts : [{ title: "Part 1", body: text }];
}

function splitOversizedUnit(text, wordsPerPart) {
  const words = String(text || "").match(/\S+/g) || [];
  if (words.length <= wordsPerPart) {
    return [text];
  }

  const chunks = [];
  for (let index = 0; index < words.length; index += wordsPerPart) {
    chunks.push(words.slice(index, index + wordsPerPart).join(" "));
  }

  return chunks;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+'\s*/g, "'")
    .replace(/\t/g, " ")
    .replace(/\s*-+\s*\d+\s+of\s+\d+\s*-+\s*/gi, "\n")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenizeSentence(sentence) {
  return sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?|\d+|[^\sA-Za-z\d]/g) || [];
}

function translateLocally(word) {
  const normalizedWord = normalizeWord(word);
  if (!normalizedWord) {
    return null;
  }

  if (translations[normalizedWord]) {
    return translations[normalizedWord];
  }

  const singular = normalizedWord.endsWith("s") ? normalizedWord.slice(0, -1) : null;
  if (singular && translations[singular]) {
    return translations[singular];
  }

  const withoutEd = normalizedWord.endsWith("ed") ? normalizedWord.slice(0, -2) : null;
  if (withoutEd && translations[withoutEd]) {
    return translations[withoutEd];
  }

  const withoutIng = normalizedWord.endsWith("ing") ? normalizedWord.slice(0, -3) : null;
  if (withoutIng && translations[withoutIng]) {
    return translations[withoutIng];
  }

  return null;
}

function getLocalTranslation(word) {
  const normalizedWord = normalizeWord(word);

  return {
    word: normalizedWord,
    translation: translateLocally(normalizedWord),
    source: "local"
  };
}

async function getReadingTranslation(word) {
  const normalizedWord = normalizeWord(word);
  if (!normalizedWord) {
    return { word: "", translation: null, source: "missing" };
  }

  const userEntry = await get(
    `
    SELECT translation
    FROM reading_user_dictionary
    WHERE user_id = 1
      AND word = ?
    `,
    [normalizedWord]
  );

  if (userEntry?.translation) {
    return {
      word: normalizedWord,
      translation: userEntry.translation,
      source: "user"
    };
  }

  const localTranslation = translateLocally(normalizedWord);
  if (localTranslation) {
    return {
      word: normalizedWord,
      translation: localTranslation,
      source: "local"
    };
  }

  const cachedTranslation = await getCachedTranslation(normalizedWord);
  if (cachedTranslation) {
    return {
      word: normalizedWord,
      translation: cachedTranslation.translation,
      source: cachedTranslation.provider || "cache"
    };
  }

  const remoteTranslation = await translateWordWithFallback(normalizedWord);
  if (remoteTranslation) {
    await saveCachedTranslation({
      word: normalizedWord,
      translation: remoteTranslation,
      provider: "libretranslate"
    });

    return {
      word: normalizedWord,
      translation: remoteTranslation,
      source: "libretranslate"
    };
  }

  return {
    word: normalizedWord,
    translation: null,
    source: "missing"
  };
}

async function getCachedTranslation(word) {
  return get(
    `
    SELECT translation, provider
    FROM reading_translation_cache
    WHERE word = ?
      AND source_language = 'en'
      AND target_language = 'pt'
    `,
    [word]
  );
}

async function saveCachedTranslation({ word, translation, provider }) {
  await run(
    `
    INSERT INTO reading_translation_cache (
      word,
      source_language,
      target_language,
      translation,
      provider
    )
    VALUES (?, 'en', 'pt', ?, ?)
    ON CONFLICT(word, source_language, target_language) DO UPDATE SET
      translation = excluded.translation,
      provider = excluded.provider,
      updated_at = CURRENT_TIMESTAMP
    `,
    [word, translation, provider]
  );
}

async function translateWordWithFallback(word) {
  try {
    return await translateWithLibreTranslate(word, { source: "en", target: "pt" });
  } catch (error) {
    console.warn("LibreTranslate unavailable:", error.message);
    return null;
  }
}

async function saveUserTranslation({ word, translation }) {
  const normalizedWord = normalizeWord(word);
  const cleanedTranslation = String(translation || "").trim();

  if (!normalizedWord || !cleanedTranslation) {
    const error = new Error("Add a word and a translation before saving.");
    error.statusCode = 400;
    throw error;
  }

  await run(
    `
    INSERT INTO reading_user_dictionary (
      user_id,
      word,
      translation
    )
    VALUES (1, ?, ?)
    ON CONFLICT(user_id, word) DO UPDATE SET
      translation = excluded.translation,
      updated_at = CURRENT_TIMESTAMP
    `,
    [normalizedWord, cleanedTranslation]
  );

  return {
    success: true,
    word: normalizedWord,
    translation: cleanedTranslation,
    source: "user"
  };
}

function buildReaderPayload(reading, progress = {}) {
  const sentences = splitSentences(reading.text).map((sentence, sentenceIndex) => ({
    id: sentenceIndex,
    text: sentence,
    tokens: tokenizeSentence(sentence)
  }));

  return {
    ...reading,
    sentences,
    translationHints: translations,
    progress: {
      sentenceIndex: progress.sentence_index || 0,
      chapterIndex: progress.chapter_index || 0
    }
  };
}

async function getTrailReader(unitId) {
  const reading = getTrailReading(unitId);
  const progress = await get(
    `
    SELECT sentence_index, chapter_index
    FROM reading_progress
    WHERE user_id = 1
      AND source_type = 'trail'
      AND source_id = ?
    `,
    [String(reading.unitId)]
  );

  return buildReaderPayload(reading, progress || {});
}

async function listBooks() {
  return all(
    `
    SELECT
      reading_books.*,
      COALESCE(reading_progress.chapter_index, 0) AS chapter_index,
      COALESCE(reading_progress.sentence_index, 0) AS sentence_index
    FROM reading_books
    LEFT JOIN reading_progress
      ON reading_progress.source_type = 'book'
      AND reading_progress.source_id = CAST(reading_books.id AS TEXT)
      AND reading_progress.user_id = 1
    ORDER BY reading_books.updated_at DESC, reading_books.created_at DESC
    `
  );
}

async function createBook({ title, text, sourceLabel }) {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length < 40) {
    const error = new Error("Add a longer English text or upload a readable PDF/TXT file.");
    error.statusCode = 400;
    throw error;
  }

  const selectedTitle = normalizeText(title) || "Imported Book";
  const chapters = splitChapters(normalized);
  const createdBook = await run(
    `
    INSERT INTO reading_books (title, source_label, total_chapters, total_words)
    VALUES (?, ?, ?, ?)
    `,
    [selectedTitle, sourceLabel || "Pasted text", chapters.length, countWords(normalized)]
  );

  for (const [index, chapter] of chapters.entries()) {
    await run(
      `
      INSERT INTO reading_chapters (book_id, chapter_index, title, content, word_count)
      VALUES (?, ?, ?, ?, ?)
      `,
      [createdBook.id, index, chapter.title, chapter.body, countWords(chapter.body)]
    );
  }

  return createdBook.id;
}

async function extractUploadText(file) {
  if (!file) {
    return null;
  }

  const filename = file.originalname || "uploaded file";
  const mimetype = String(file.mimetype || "").toLowerCase();
  const extension = filename.toLowerCase().split(".").pop();

  if (mimetype === "application/pdf" || extension === "pdf") {
    return extractPdfText(file.buffer);
  }

  if (mimetype.startsWith("text/") || extension === "txt") {
    return file.buffer.toString("utf8");
  }

  const error = new Error("Upload a PDF or TXT file.");
  error.statusCode = 400;
  throw error;
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text || "";
  } catch (error) {
    const importError = new Error("Could not read text from this PDF. If it is scanned as images, try an OCR version or paste the text manually.");
    importError.statusCode = 400;
    throw importError;
  } finally {
    await parser.destroy();
  }
}

async function getBookReader(bookId, requestedChapterIndex = 0) {
  const book = await get("SELECT * FROM reading_books WHERE id = ?", [bookId]);
  if (!book) {
    const error = new Error("Book not found.");
    error.statusCode = 404;
    throw error;
  }

  const chapters = await all(
    `
    SELECT *
    FROM reading_chapters
    WHERE book_id = ?
    ORDER BY chapter_index ASC
    `,
    [bookId]
  );
  const progress = await get(
    `
    SELECT chapter_index, sentence_index
    FROM reading_progress
    WHERE user_id = 1
      AND source_type = 'book'
      AND source_id = ?
    `,
    [String(bookId)]
  );
  const readableChapters =
    chapters.length === 1 && countWords(chapters[0]?.content || "") > 2200
      ? splitIntoReadingParts(chapters[0].content)
      : chapters.map((chapter) => ({
          title: chapter.title,
          body: chapter.content
        }));

  const chapterIndex = clamp(
    Number.isFinite(requestedChapterIndex) ? requestedChapterIndex : progress?.chapter_index || 0,
    0,
    Math.max(readableChapters.length - 1, 0)
  );
  const chapter = readableChapters[chapterIndex] || readableChapters[0];

  return buildReaderPayload(
    {
      id: `book-${book.id}`,
      bookId: book.id,
      unitId: null,
      title: book.title,
      chapterTitle: chapter?.title || "Chapter 1",
      chapterIndex,
      totalChapters: readableChapters.length,
      level: "Free reading",
      sourceType: "book",
      summary: "Imported book reading mode.",
      text: chapter?.body || ""
    },
    progress || { chapter_index: chapterIndex }
  );
}

async function saveProgress({ sourceType, sourceId, chapterIndex = 0, sentenceIndex = 0 }) {
  await run(
    `
    INSERT INTO reading_progress (
      user_id,
      source_type,
      source_id,
      chapter_index,
      sentence_index,
      updated_at
    )
    VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, source_type, source_id) DO UPDATE SET
      chapter_index = excluded.chapter_index,
      sentence_index = excluded.sentence_index,
      updated_at = CURRENT_TIMESTAMP
    `,
    [sourceType, String(sourceId), chapterIndex, sentenceIndex]
  );

  if (sourceType === "book") {
    await run("UPDATE reading_books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [sourceId]);
  }

  return { success: true };
}

async function saveVocabulary({ sourceType, sourceId, word, sentence, translation }) {
  const normalizedWord = normalizeWord(word);
  if (!normalizedWord) {
    const error = new Error("Select a word before saving it.");
    error.statusCode = 400;
    throw error;
  }

  const savedTranslation = translation || (await getReadingTranslation(normalizedWord)).translation;

  await run(
    `
    INSERT INTO reading_vocabulary (
      user_id,
      word,
      translation,
      source_type,
      source_id,
      sentence
    )
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, word) DO UPDATE SET
      translation = COALESCE(excluded.translation, reading_vocabulary.translation),
      source_type = excluded.source_type,
      source_id = excluded.source_id,
      sentence = excluded.sentence,
      saved_count = reading_vocabulary.saved_count + 1,
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      normalizedWord,
      savedTranslation || null,
      sourceType,
      String(sourceId),
      sentence || null
    ]
  );

  return { success: true, word: normalizedWord };
}

async function deleteBook(bookId) {
  const selectedBookId = Number(bookId);
  if (!selectedBookId) {
    const error = new Error("Book not found.");
    error.statusCode = 404;
    throw error;
  }

  const book = await get("SELECT id FROM reading_books WHERE id = ?", [selectedBookId]);
  if (!book) {
    const error = new Error("Book not found.");
    error.statusCode = 404;
    throw error;
  }

  await run("DELETE FROM reading_progress WHERE source_type = 'book' AND source_id = ?", [
    String(selectedBookId)
  ]);
  await run("DELETE FROM reading_chapters WHERE book_id = ?", [selectedBookId]);
  await run("DELETE FROM reading_books WHERE id = ?", [selectedBookId]);

  return { success: true };
}

function normalizeWord(word) {
  return String(word || "")
    .toLowerCase()
    .replace(/[^a-z']/g, "")
    .trim();
}

function countWords(text) {
  return (String(text || "").match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []).length;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  createBook,
  deleteBook,
  extractUploadText,
  getBookReader,
  getLocalTranslation,
  getReadingTranslation,
  getTrailReader,
  listBooks,
  saveProgress,
  saveUserTranslation,
  saveVocabulary,
  splitChapters,
  splitSentences,
  translateLocally,
  tokenizeSentence
};
