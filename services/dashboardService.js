const db = require("../database");
const { lessonCategories } = require("../data/lessonCategories");
const { learningPathSections } = require("../data/learningPath");

function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
  });
}

function getRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows || [])));
  });
}

function getDueReviewCount() {
  return getRow(`
    SELECT COUNT(*) AS count
    FROM question_mastery
    WHERE total_wrong > 0
      AND next_review_at <= CURRENT_TIMESTAMP
  `).then((row) => Number(row?.count || 0));
}

async function getDashboardData() {
  const [progress, unitProgress, categoryRows, weakQuestions, weeklyRows, dueReviewCount, mastery, placement] =
    await Promise.all([
      getRow("SELECT * FROM user_progress WHERE id = 1"),
      getRows("SELECT unit_id, status FROM user_unit_progress WHERE user_id = 1"),
      getRows(`
        SELECT
          lesson_questions.source,
          SUM(question_mastery.total_correct) AS correct,
          SUM(question_mastery.total_wrong) AS wrong,
          COUNT(*) AS practiced
        FROM question_mastery
        JOIN lesson_questions ON lesson_questions.id = question_mastery.question_id
        GROUP BY lesson_questions.source
        ORDER BY (SUM(question_mastery.total_wrong) - SUM(question_mastery.total_correct)) DESC
      `),
      getRows(`
        SELECT
          lesson_questions.id,
          lesson_questions.question_pt,
          lesson_questions.correct_answer,
          question_mastery.total_correct,
          question_mastery.total_wrong,
          question_mastery.correct_streak,
          question_mastery.next_review_at
        FROM question_mastery
        JOIN lesson_questions ON lesson_questions.id = question_mastery.question_id
        WHERE question_mastery.total_wrong > 0
        ORDER BY
          (question_mastery.total_wrong - question_mastery.total_correct) DESC,
          question_mastery.last_attempt_at DESC
        LIMIT 5
      `),
      getRows(`
        SELECT
          date(created_at) AS day,
          SUM(xp_earned) AS xp,
          COUNT(*) AS activities
        FROM activity_log
        WHERE created_at >= datetime('now', '-6 days', 'start of day')
        GROUP BY date(created_at)
        ORDER BY day
      `),
      getDueReviewCount(),
      getRow(`
        SELECT
          COUNT(*) AS practiced,
          COALESCE(SUM(total_correct), 0) AS correct,
          COALESCE(SUM(total_wrong), 0) AS wrong
        FROM question_mastery
      `),
      getRow(`
        SELECT score, total_questions, cefr_level, recommended_phase, created_at
        FROM placement_assessments
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `)
    ]);

  const completedUnitIds = new Set(
    unitProgress.filter((unit) => unit.status === "completed").map((unit) => unit.unit_id)
  );
  const phases = learningPathSections.map((section) => {
    const completed = section.units.filter((unit) => completedUnitIds.has(unit.id)).length;
    const total = section.units.length;

    return {
      id: section.id,
      title: section.title,
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
      checkpointComplete: completedUnitIds.has(section.units[section.units.length - 1].id)
    };
  });
  const categoryLabels = new Map(
    lessonCategories.filter((category) => category.source).map((category) => [category.source, category.label])
  );
  const categories = categoryRows.map((category) => {
    const correct = Number(category.correct || 0);
    const wrong = Number(category.wrong || 0);
    const attempts = correct + wrong;

    return {
      source: category.source,
      label: categoryLabels.get(category.source) || category.source.replace(/^csv:/, ""),
      correct,
      wrong,
      practiced: Number(category.practiced || 0),
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0
    };
  });
  const weekly = buildWeeklyActivity(weeklyRows);
  const totalAnswers = Number(mastery.correct || 0) + Number(mastery.wrong || 0);

  return {
    progress: progress || {},
    phases,
    categories,
    weakQuestions,
    weekly,
    dueReviewCount,
    placement: placement || null,
    questionsPracticed: Number(mastery.practiced || 0),
    masteryAccuracy: totalAnswers ? Math.round((Number(mastery.correct || 0) / totalAnswers) * 100) : 0
  };
}

function buildWeeklyActivity(rows) {
  const valuesByDay = new Map(rows.map((row) => [row.day, row]));
  const days = [];

  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const value = valuesByDay.get(key);
    days.push({
      day: key,
      label: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
      xp: Number(value?.xp || 0),
      activities: Number(value?.activities || 0)
    });
  }

  return days;
}

module.exports = {
  getDashboardData,
  getDueReviewCount
};
