const db = require("../database");
const { lessonCategories } = require("../data/lessonCategories");

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || {});
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

function getAiSource(category) {
  return category.id === "all" ? "ai" : `ai:${category.id}`;
}

async function getQuestionBankData() {
  const summary = await getAsync(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN times_used = 0 THEN 1 ELSE 0 END) AS unused,
      SUM(CASE WHEN times_used > 0 THEN 1 ELSE 0 END) AS used,
      SUM(CASE WHEN source LIKE 'ai%' THEN 1 ELSE 0 END) AS ai_generated,
      SUM(CASE WHEN source LIKE 'csv:%' THEN 1 ELSE 0 END) AS saved_questions
    FROM lesson_questions
  `);

  const review = await getAsync(`
    SELECT
      SUM(CASE WHEN next_review_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS due_review,
      SUM(CASE WHEN total_wrong > total_correct THEN 1 ELSE 0 END) AS weak_questions,
      SUM(CASE WHEN correct_streak >= 3 THEN 1 ELSE 0 END) AS mastered_questions
    FROM question_mastery
  `);

  const categories = await Promise.all(
    lessonCategories
      .filter((category) => category.source)
      .map(async (category) => {
        const aiSource = getAiSource(category);
        const row = await getAsync(
          `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN times_used = 0 THEN 1 ELSE 0 END) AS unused,
            SUM(CASE WHEN times_used > 0 THEN 1 ELSE 0 END) AS used,
            SUM(CASE WHEN source = ? THEN 1 ELSE 0 END) AS ai_generated
          FROM lesson_questions
          WHERE source IN (?, ?)
          `,
          [aiSource, category.source, aiSource]
        );

        const mastery = await getAsync(
          `
          SELECT
            SUM(question_mastery.total_wrong) AS wrong,
            SUM(question_mastery.total_correct) AS correct,
            SUM(CASE WHEN question_mastery.total_wrong > question_mastery.total_correct THEN 1 ELSE 0 END)
              AS weak
          FROM question_mastery
          JOIN lesson_questions ON lesson_questions.id = question_mastery.question_id
          WHERE lesson_questions.source IN (?, ?)
          `,
          [category.source, aiSource]
        );

        return {
          id: category.id,
          label: category.label,
          total: Number(row.total || 0),
          unused: Number(row.unused || 0),
          used: Number(row.used || 0),
          aiGenerated: Number(row.ai_generated || 0),
          correct: Number(mastery.correct || 0),
          wrong: Number(mastery.wrong || 0),
          weak: Number(mastery.weak || 0)
        };
      })
  );

  const weakQuestions = await allAsync(`
    SELECT
      lesson_questions.question_pt,
      lesson_questions.correct_answer,
      lesson_questions.source,
      question_mastery.total_wrong,
      question_mastery.total_correct
    FROM question_mastery
    JOIN lesson_questions ON lesson_questions.id = question_mastery.question_id
    WHERE question_mastery.total_wrong > question_mastery.total_correct
    ORDER BY question_mastery.total_wrong DESC, question_mastery.last_attempt_at DESC
    LIMIT 8
  `);

  const recentAiQuestions = await allAsync(`
    SELECT question_pt, correct_answer, source, created_at
    FROM lesson_questions
    WHERE source LIKE 'ai%'
    ORDER BY created_at DESC
    LIMIT 6
  `);

  return {
    summary: {
      total: Number(summary.total || 0),
      unused: Number(summary.unused || 0),
      used: Number(summary.used || 0),
      aiGenerated: Number(summary.ai_generated || 0),
      savedQuestions: Number(summary.saved_questions || 0),
      dueReview: Number(review.due_review || 0),
      weakQuestions: Number(review.weak_questions || 0),
      masteredQuestions: Number(review.mastered_questions || 0)
    },
    categories,
    weakQuestions,
    recentAiQuestions
  };
}

module.exports = {
  getQuestionBankData,
  getAiSource
};
