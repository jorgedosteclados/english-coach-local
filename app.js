require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const db = require("./database");
const { buildAchievements } = require("./services/achievementService");

const app = express();
const aiRoutes = require("./routes/ai");
const { lessonCategories } = require("./data/lessonCategories");
const speakingPrompts = require("./data/speakingPrompts");
const visualReviewCards = require("./data/visualReviewCards");
const { learningPathUnits } = require("./data/learningPath");
const { getSupportCallScenario, supportCallScenarios } = require("./data/supportCallScenarios");
const {
  getWritingMission,
  getConversationContent,
  getSpeakingPrompts
} = require("./data/unitContent");
const { getDueMistakes } = require("./services/reviewService");
const { getDashboardData, getDueReviewCount } = require("./services/dashboardService");
const { getQuestionBankData } = require("./services/questionBankService");
const { generateSpeechFile, getAvailableVoices } = require("./services/ttsService");
const {
  approveReadingWordImage,
  getReadingWordImage,
  getReadingWordImageCandidates
} = require("./services/wordImageService");
const {
  createBook,
  deleteBook,
  extractUploadText,
  getBookReader,
  getContextualReadingTranslation,
  getReadingTranslation,
  getTrailReader,
  listBooks,
  saveProgress,
  saveUserTranslation,
  saveVocabulary
} = require("./services/readingService");
const {
  applyPlacementRecommendation,
  getPublicQuestions,
  submitPlacement
} = require("./services/placementService");
const { skillMatrix, levelMatrix } = require("./data/pedagogy");
const PORT = Number(process.env.PORT) || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const filename = String(file.originalname || "").toLowerCase();
    const mimetype = String(file.mimetype || "").toLowerCase();
    const isSupported =
      mimetype === "application/pdf" ||
      mimetype.startsWith("text/") ||
      filename.endsWith(".pdf") ||
      filename.endsWith(".txt");

    callback(isSupported ? null : new Error("Upload a PDF or TXT file."), isSupported);
  }
});

const learningPathMetadata = new Map(learningPathUnits.map((unit) => [unit.id, unit]));

function getRequestedUnitId(req, fallbackUnitId) {
  const requestedUnitId = Number(req.query.unit);
  return requestedUnitId > 0 ? requestedUnitId : fallbackUnitId;
}

const defaultProgress = {
  total_xp: 0,
  lessons_completed: 0,
  total_correct: 0,
  total_wrong: 0,
  streak_days: 0
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/ai", aiRoutes);

function buildPathState(rows) {
  let previousCompleted = true;

  const units = rows.map((unit) => {
    const isCompleted = unit.status === "completed";
    const isPlacementSkipped = !isCompleted && unit.unit_order < Number(unit.placement_start_order || 1);
    const isLocked = isPlacementSkipped || Boolean(unit.is_locked_default) || !previousCompleted;

    previousCompleted = isCompleted || isPlacementSkipped;

    return {
      ...unit,
      sectionId: learningPathMetadata.get(unit.id)?.sectionId || 1,
      sectionTitle: learningPathMetadata.get(unit.id)?.sectionTitle || "Learning Path",
      sectionDescription: learningPathMetadata.get(unit.id)?.sectionDescription || "",
      isCheckpoint: Boolean(learningPathMetadata.get(unit.id)?.isCheckpoint),
      isCompleted,
      isPlacementSkipped,
      isLocked,
      completedCount: unit.completed_count || 0,
      lastCompletedAt: unit.last_completed_at || null
    };
  });

  const completedCount = units.filter((unit) => unit.isCompleted).length;
  const totalCount = units.length;
  const nextUnit =
    units.find((unit) => !unit.isLocked && !unit.isCompleted && unit.href) ||
    units.find((unit) => !unit.isLocked && unit.href) ||
    null;
  const currentSectionUnit = nextUnit || units[units.length - 1] || null;

  return {
    units,
    nextUnit,
    completedCount,
    totalCount,
    currentSection: currentSectionUnit
      ? {
          id: currentSectionUnit.sectionId,
          title: currentSectionUnit.sectionTitle,
          description: currentSectionUnit.sectionDescription
        }
      : null,
    progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  };
}

function loadLearningPath(callback) {
  db.all(
    `
    SELECT
      learning_units.*,
      COALESCE((SELECT starting_unit_order FROM learning_preferences WHERE id = 1), 1)
        AS placement_start_order,
      user_unit_progress.status,
      user_unit_progress.completed_count,
      user_unit_progress.last_completed_at
    FROM learning_units
    LEFT JOIN user_unit_progress
      ON user_unit_progress.unit_id = learning_units.id
      AND user_unit_progress.user_id = 1
    ORDER BY learning_units.unit_order ASC
    `,
    [],
    (err, rows) => {
      if (err) {
        callback(err);
        return;
      }

      callback(null, buildPathState(rows || []));
    }
  );
}

app.get("/", (req, res) => {
  db.get("SELECT * FROM user_progress WHERE id = 1", [], (err, progress) => {
    const selectedProgress = progress || defaultProgress;

    if (err) {
      console.error("Error loading user progress:", err.message);
    }

    loadLearningPath((pathError, pathState) => {
      if (pathError) {
        console.error("Error loading learning path:", pathError.message);
      }

      const selectedPathState = pathState || buildPathState([]);

      getDueReviewCount()
        .catch((reviewError) => {
          console.error("Error loading due review count:", reviewError.message);
          return 0;
        })
        .then((dueReviewCount) => {
          res.render("home", {
            progress: selectedProgress,
            pathState: selectedPathState,
            achievements: buildAchievements(selectedProgress, selectedPathState.units),
            dueReviewCount
          });
        });
    });
  });
});

app.get("/correct", (req, res) => {
  res.render("correct");
});

app.get("/lesson", (req, res) => {
  const unit = learningPathMetadata.get(getRequestedUnitId(req, 1));
  res.render("lesson", {
    lessonCategories,
    lessonName: unit?.title || "Support Basics",
    isCheckpoint: Boolean(unit?.isCheckpoint)
  });
});

app.get("/review", (req, res) => {
  res.render("review", { reviewCards: visualReviewCards });
});

app.get("/reading", async (req, res) => {
  try {
    const unitId = getRequestedUnitId(req, 1);
    const reader = await getTrailReader(unitId);
    res.render("reading", {
      reader,
      readerJson: JSON.stringify(reader).replace(/</g, "\\u003c")
    });
  } catch (error) {
    console.error("Error loading trail reading:", error.message);
    res.status(500).send("Unable to load reading mode right now.");
  }
});

app.get("/reading/book/:id", async (req, res) => {
  try {
    const chapterIndex = Number(req.query.chapter);
    const reader = await getBookReader(
      Number(req.params.id),
      Number.isFinite(chapterIndex) ? chapterIndex : undefined
    );
    res.render("reading", {
      reader,
      readerJson: JSON.stringify(reader).replace(/</g, "\\u003c")
    });
  } catch (error) {
    console.error("Error loading book reader:", error.message);
    res.status(error.statusCode || 500).send(error.message || "Unable to load this book.");
  }
});

app.post("/reading/progress", async (req, res) => {
  try {
    res.json(await saveProgress(req.body || {}));
  } catch (error) {
    console.error("Error saving reading progress:", error.message);
    res.status(error.statusCode || 500).json({ error: "Unable to save reading progress." });
  }
});

app.post("/reading/vocabulary", async (req, res) => {
  try {
    res.json(await saveVocabulary(req.body || {}));
  } catch (error) {
    console.error("Error saving reading vocabulary:", error.message);
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to save word." });
  }
});

app.get("/reading/translate", async (req, res) => {
  try {
    res.json(await getReadingTranslation(req.query.word));
  } catch (error) {
    console.error("Error reading translation:", error.message);
    res.status(error.statusCode || 500).json({ error: "Unable to read translation." });
  }
});

app.post("/reading/translation", async (req, res) => {
  try {
    res.json(await saveUserTranslation(req.body || {}));
  } catch (error) {
    console.error("Error saving reading translation:", error.message);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Unable to save translation." });
  }
});

app.post("/reading/context-translation", async (req, res) => {
  try {
    res.json(await getContextualReadingTranslation(req.body || {}));
  } catch (error) {
    console.error("Error reading contextual translation:", error.message);
    res
      .status(error.statusCode || 500)
      .json({ error: error.statusCode ? error.message : "Local AI is unavailable. Make sure Ollama is running." });
  }
});

app.get("/reading/image", async (req, res) => {
  try {
    res.json(await getReadingWordImage(req.query.word));
  } catch (error) {
    console.error("Error reading word image:", error.message);
    res.status(error.statusCode || 500).json({ error: "Unable to read word image." });
  }
});

app.get("/reading/image/candidates", async (req, res) => {
  try {
    res.json(await getReadingWordImageCandidates(req.query.word));
  } catch (error) {
    console.error("Error reading word image candidates:", error.message);
    res.status(error.statusCode || 500).json({ error: "Unable to find word images." });
  }
});

app.post("/reading/image/approve", async (req, res) => {
  try {
    res.json(await approveReadingWordImage(req.body || {}));
  } catch (error) {
    console.error("Error approving word image:", error.message);
    res.status(error.statusCode || 500).json({ error: error.message || "Unable to save image." });
  }
});

app.get("/reading/tts", async (req, res) => {
  await sendGeneratedSpeech(req, res);
});

app.get("/tts", async (req, res) => {
  await sendGeneratedSpeech(req, res);
});

async function sendGeneratedSpeech(req, res) {
  try {
    const audioFile = await generateSpeechFile({
      text: req.query.text,
      rate: req.query.rate,
      voice: req.query.voice,
      provider: req.query.provider
    });

    res.type(audioFile.contentType);
    res.sendFile(audioFile.filePath);
  } catch (error) {
    console.error("Error generating reading audio:", error.message);
    res.status(error.statusCode || 500).json({ error: "Unable to generate audio." });
  }
}

app.get("/reading/tts/voices", async (req, res) => {
  await sendAvailableTtsVoices(req, res);
});

app.get("/tts/voices", async (req, res) => {
  await sendAvailableTtsVoices(req, res);
});

async function sendAvailableTtsVoices(req, res) {
  try {
    res.json({ voices: await getAvailableVoices(req.query.provider) });
  } catch (error) {
    console.error("Error listing reading voices:", error.message);
    res.status(500).json({ error: "Unable to list voices." });
  }
}

app.get("/library", async (req, res) => {
  try {
    res.render("library", { books: await listBooks(), error: null });
  } catch (error) {
    console.error("Error loading library:", error.message);
    res.status(500).send("Unable to load your library right now.");
  }
});

app.post("/library/import", (req, res) => {
  upload.single("bookFile")(req, res, async (uploadError) => {
    if (uploadError) {
      await renderLibraryImportError(res, uploadError);
      return;
    }

    try {
      const uploadedText = await extractUploadText(req.file);
      const text = uploadedText || req.body?.bookText;
      const fileTitle = req.file?.originalname?.replace(/\.[^.]+$/, "");
      const bookId = await createBook({
        title: req.body?.title || fileTitle,
        text,
        sourceLabel: req.file ? `${req.file.originalname}` : "Pasted text"
      });
      res.redirect(`/reading/book/${bookId}`);
    } catch (error) {
      console.error("Error importing book:", error.message);
      await renderLibraryImportError(res, error);
    }
  });
});

app.post("/library/books/:id/delete", async (req, res) => {
  try {
    await deleteBook(req.params.id);
    res.redirect("/library");
  } catch (error) {
    console.error("Error deleting book:", error.message);
    await renderLibraryImportError(res, error);
  }
});

async function renderLibraryImportError(res, error) {
  res.status(error.statusCode || 400).render("library", {
    books: await listBooks().catch(() => []),
    error: error.message || "Unable to import this book."
  });
}

app.get("/mistakes", async (req, res) => {
  try {
    const questions = await getDueMistakes(10);
    const questionsJson = JSON.stringify(questions).replace(/</g, "\\u003c");
    res.render("mistakes", { questions, questionsJson });
  } catch (error) {
    console.error("Error loading mistakes:", error.message);
    res.render("mistakes", { questions: [], questionsJson: "[]" });
  }
});

app.get("/progress", async (req, res) => {
  try {
    res.render("progress", { dashboard: await getDashboardData() });
  } catch (error) {
    console.error("Error loading progress dashboard:", error.message);
    res.status(500).send("Unable to load progress right now.");
  }
});

app.get("/question-bank", async (req, res) => {
  try {
    res.render("question-bank", { bank: await getQuestionBankData() });
  } catch (error) {
    console.error("Error loading question bank:", error.message);
    res.status(500).send("Unable to load the question bank right now.");
  }
});

app.get("/placement", (req, res) => {
  const questions = getPublicQuestions();
  res.render("placement", {
    questions,
    questionsJson: JSON.stringify(questions).replace(/</g, "\\u003c"),
    skillMatrix,
    levelMatrix
  });
});

app.post("/placement/submit", async (req, res) => {
  const questions = getPublicQuestions();
  const answers = req.body?.answers;
  const hasEveryAnswer =
    answers && questions.every((question) => question.options.includes(answers[question.id]));

  if (!hasEveryAnswer) {
    res.status(400).json({ error: "Answer every placement question before submitting." });
    return;
  }

  try {
    res.json(await submitPlacement(answers));
  } catch (error) {
    console.error("Error saving placement assessment:", error.message);
    res.status(500).json({ error: "Unable to save the placement result." });
  }
});

app.post("/placement/apply", async (req, res) => {
  try {
    res.json(await applyPlacementRecommendation(req.body?.assessmentId));
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Unable to apply the placement recommendation."
    });
  }
});

app.get("/units", (req, res) => {
  res.redirect(301, "/");
});

app.get("/writing", (req, res) => {
  const requestedMission = getWritingMission(getRequestedUnitId(req, 2));

  if (requestedMission) {
    res.render("writing", { mission: requestedMission });
    return;
  }

  db.get(
    `
    SELECT *
    FROM writing_missions
    ORDER BY times_used ASC, RANDOM()
    LIMIT 1
    `,
    [],
    (err, mission) => {
      if (err) {
        console.error("Error loading writing mission:", err.message);
      }

      const fallbackMission = {
        id: 0,
        unit_id: 2,
        title: "Ask for Details",
        scenario:
          "You need to send a short message to a coworker asking for more details about an issue.",
        task: "Write a professional message in English asking for more details.",
        placeholder:
          "Example: Hi Ana, could you please share more details about the issue?",
        xp_reward: 10
      };

      const selectedMission = mission || fallbackMission;

      if (mission) {
        db.run(
          "UPDATE writing_missions SET times_used = times_used + 1 WHERE id = ?",
          [mission.id],
          (updateError) => {
            if (updateError) {
              console.error("Error updating writing mission usage:", updateError.message);
            }
          }
        );
      }

      res.render("writing", { mission: selectedMission });
    }
  );
});

app.get("/conversation", (req, res) => {
  const content = getConversationContent(getRequestedUnitId(req, 4));
  res.render("conversation", { content });
});

app.get("/voice-call", (req, res) => {
  const scenario = getSupportCallScenario(req.query.scenario);
  res.render("voice-call", { scenario, scenarios: supportCallScenarios });
});

app.get("/local-ai", (req, res) => {
  res.render("local-ai");
});

app.get("/speaking", (req, res) => {
  const prompts = getSpeakingPrompts(getRequestedUnitId(req, 5), speakingPrompts);
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];

  res.render("speaking", { prompt });
});

app.get("/history", (req, res) => {
  db.all("SELECT * FROM corrections ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      console.error("Error loading history:", err.message);
      return res.render("history", { corrections: [] });
    }

    res.render("history", { corrections: rows });
  });
});

app.listen(PORT, () => {
  console.log(`English Coach Local running at http://localhost:${PORT}`);
});
