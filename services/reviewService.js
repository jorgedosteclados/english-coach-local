const db = require("../database");

const reviewIntervalsInDays = [1, 3, 7, 14];

function saveQuestionAttempt({ questionId, unitId, exerciseType, userAnswer, isCorrect }) {
  const parsedQuestionId = Number(questionId);
  const parsedUnitId = Number(unitId) || null;
  const answer = String(userAnswer || "").trim();
  const correct = Boolean(isCorrect);

  if (!parsedQuestionId || !answer) {
    const validationError = new Error("Question and answer are required.");
    validationError.statusCode = 400;
    return Promise.reject(validationError);
  }

  return getQuestion(parsedQuestionId).then(
    () =>
      new Promise((resolve, reject) => {
        db.get(
          "SELECT correct_streak FROM question_mastery WHERE question_id = ?",
          [parsedQuestionId],
          (masteryError, mastery) => {
            if (masteryError) {
              reject(new Error("Error reading question mastery."));
              return;
            }

            const correctStreak = correct ? Number(mastery?.correct_streak || 0) + 1 : 0;
            const intervalDays = correct
              ? reviewIntervalsInDays[Math.min(correctStreak - 1, reviewIntervalsInDays.length - 1)]
              : 0;

            db.serialize(() => {
              db.run("BEGIN TRANSACTION");
              db.run(
                `
                INSERT INTO question_attempts
                  (question_id, unit_id, exercise_type, user_answer, is_correct)
                VALUES (?, ?, ?, ?, ?)
                `,
                [parsedQuestionId, parsedUnitId, exerciseType || "lesson", answer, correct ? 1 : 0]
              );
              db.run(
                `
                INSERT INTO question_mastery (
                  question_id,
                  total_correct,
                  total_wrong,
                  correct_streak,
                  last_result,
                  last_attempt_at,
                  next_review_at
                )
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, datetime('now', ?))
                ON CONFLICT(question_id) DO UPDATE SET
                  total_correct = total_correct + excluded.total_correct,
                  total_wrong = total_wrong + excluded.total_wrong,
                  correct_streak = excluded.correct_streak,
                  last_result = excluded.last_result,
                  last_attempt_at = CURRENT_TIMESTAMP,
                  next_review_at = excluded.next_review_at
                `,
                [
                  parsedQuestionId,
                  correct ? 1 : 0,
                  correct ? 0 : 1,
                  correctStreak,
                  correct ? 1 : 0,
                  `+${intervalDays} days`
                ]
              );
              db.run("COMMIT", (commitError) => {
                if (commitError) {
                  reject(new Error("Error saving question attempt."));
                  return;
                }

                resolve({
                  success: true,
                  correctStreak,
                  nextReviewInDays: intervalDays
                });
              });
            });
          }
        );
      })
  );
}

function getQuestion(questionId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM lesson_questions WHERE id = ?", [questionId], (error, row) => {
      if (error) {
        reject(new Error("Error validating question."));
      } else if (!row) {
        const notFoundError = new Error("Question not found.");
        notFoundError.statusCode = 404;
        reject(notFoundError);
      } else {
        resolve(row);
      }
    });
  });
}

function getDueMistakes(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT
        lesson_questions.*,
        question_mastery.total_correct,
        question_mastery.total_wrong,
        question_mastery.correct_streak,
        question_mastery.next_review_at
      FROM question_mastery
      JOIN lesson_questions ON lesson_questions.id = question_mastery.question_id
      WHERE question_mastery.total_wrong > 0
        AND question_mastery.next_review_at <= CURRENT_TIMESTAMP
      ORDER BY
        (question_mastery.total_wrong - question_mastery.total_correct) DESC,
        question_mastery.last_attempt_at ASC
      LIMIT ?
      `,
      [Number(limit) || 10],
      (error, rows) => {
        if (error) {
          reject(new Error("Error loading review questions."));
          return;
        }

        resolve(
          rows.flatMap((row) => {
            try {
              return [
                {
                  questionId: row.id,
                  questionPt: row.question_pt,
                  options: JSON.parse(row.options_json),
                  correctAnswer: row.correct_answer,
                  explanationPt: row.explanation_pt,
                  totalCorrect: row.total_correct,
                  totalWrong: row.total_wrong,
                  correctStreak: row.correct_streak
                }
              ];
            } catch (parseError) {
              console.error("Error parsing review question:", parseError.message);
              return [];
            }
          })
        );
      }
    );
  });
}

module.exports = {
  saveQuestionAttempt,
  getDueMistakes
};
