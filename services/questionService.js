const db = require("../database");
const { getLessonCategory } = require("../data/lessonCategories");
const fallbackQuestions = require("../data/fallbackQuestions");
const seedLessonQuestions = require("../data/seedLessonQuestions");
const { generateAIResponse } = require("./aiService");
const { buildLessonQuestionPrompt } = require("./promptService");
const { getAiSource } = require("./questionBankService");

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getFallbackQuestion(categoryId) {
  const category = getLessonCategory(categoryId);
  const categoryQuestions = category.source
    ? seedLessonQuestions.filter((question) => question.source === category.source)
    : [];

  if (categoryQuestions.length > 0) {
    return getRandomItem(categoryQuestions);
  }

  return getRandomItem(fallbackQuestions);
}

function loadSavedQuestion(categoryId) {
  const category = getLessonCategory(categoryId);
  const whereClause = category.source
    ? "WHERE source IN (?, ?) AND times_used = 0"
    : "WHERE times_used = 0";
  const params = category.source ? [category.source, getAiSource(category)] : [];

  return new Promise((resolve) => {
    db.get(
      `
      SELECT *
      FROM lesson_questions
      ${whereClause}
      ORDER BY RANDOM()
      LIMIT 1
      `,
      params,
      (selectError, row) => {
        if (selectError) {
          console.error("Error loading saved lesson question:", selectError.message);
          return resolve(null);
        }

        if (!row) {
          return resolve(null);
        }

        let options;

        try {
          options = JSON.parse(row.options_json);
        } catch (parseError) {
          console.error("Error parsing saved lesson question:", parseError.message);
          return resolve(null);
        }

        db.run(
          "UPDATE lesson_questions SET times_used = times_used + 1 WHERE id = ?",
          [row.id],
          function (updateError) {
            if (updateError) {
              console.error("Error updating lesson question usage:", updateError.message);
            }
          }
        );

        return resolve({
          questionId: row.id,
          question: row.question_pt,
          questionPt: row.question_pt,
          options,
          correctAnswer: row.correct_answer,
          explanation: row.explanation_pt,
          explanationPt: row.explanation_pt,
          source: row.source || "database"
        });
      }
    );
  });
}

function saveAIQuestion(question, category) {
  const source = getAiSource(category);

  return new Promise((resolve) => {
    db.run(
      `
      INSERT INTO lesson_questions
        (question_pt, options_json, correct_answer, explanation_pt, source, times_used)
      VALUES (?, ?, ?, ?, ?, 1)
      `,
      [
        question.questionPt,
        JSON.stringify(question.options),
        question.correctAnswer,
        question.explanationPt,
        source
      ],
      function (insertError) {
        if (insertError) {
          console.error("Error saving AI lesson question:", insertError.message);
        }

        resolve({
          ...question,
          questionId: this.lastID || null,
          source
        });
      }
    );
  });
}

function parseAIQuestion(aiTextRaw) {
  const aiText = aiTextRaw.replace(/```json/g, "").replace(/```/g, "").trim();
  const question = JSON.parse(aiText);

  if (
    !question.questionPt ||
    !Array.isArray(question.options) ||
    question.options.length !== 4 ||
    !question.correctAnswer ||
    !question.explanationPt ||
    !question.options.includes(question.correctAnswer)
  ) {
    throw new Error("Invalid AI question format.");
  }

  return question;
}

async function getLessonQuestion(categoryId, options = {}) {
  const category = getLessonCategory(categoryId);
  const savedQuestion = await loadSavedQuestion(categoryId);

  if (savedQuestion) {
    return savedQuestion;
  }

  try {
    const generateResponse = options.generateAIResponse || generateAIResponse;
    const aiTextRaw = await generateResponse(buildLessonQuestionPrompt(category));
    const question = parseAIQuestion(aiTextRaw);

    return await saveAIQuestion(question, category);
  } catch (error) {
    console.error("AI lesson generation failed:", error.message);
    return getFallbackQuestion(categoryId);
  }
}

module.exports = {
  getLessonQuestion,
  getFallbackQuestion,
  loadSavedQuestion,
  parseAIQuestion
};
