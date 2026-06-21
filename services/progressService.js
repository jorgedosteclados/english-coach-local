const db = require("../database");
const { learningPathUnits } = require("../data/learningPath");

const pathUnitById = new Map(learningPathUnits.map((unit) => [unit.id, unit]));

function saveProgress({ xpEarned, correctAnswers, wrongAnswers, unitId }) {
  const xp = Number(xpEarned) || 0;
  const correct = Number(correctAnswers) || 0;
  const wrong = Number(wrongAnswers) || 0;
  const completedUnitId = Number(unitId) || null;
  const activitiesToAdd = 1;
  const today = new Date().toISOString().split("T")[0];

  return validateUnitAccess(completedUnitId).then(() => new Promise((resolve, reject) => {
    db.get("SELECT * FROM user_progress WHERE id = 1", [], (selectError, row) => {
      if (selectError) {
        console.error("Error reading user progress:", selectError.message);
        reject(new Error("Error reading user progress."));
        return;
      }

      const newStreak = calculateStreak(row, today);

      db.run(
        `
        UPDATE user_progress
        SET
          total_xp = total_xp + ?,
          lessons_completed = lessons_completed + ?,
          total_correct = total_correct + ?,
          total_wrong = total_wrong + ?,
          streak_days = ?,
          last_study_date = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        `,
        [xp, activitiesToAdd, correct, wrong, newStreak, today],
        function (updateError) {
          if (updateError) {
            console.error("Error saving lesson progress:", updateError.message);
            reject(new Error("Error saving lesson progress."));
            return;
          }

          const result = {
            success: true,
            totalXpAdded: xp,
            correctAdded: correct,
            wrongAdded: wrong,
            streakDays: newStreak,
            unitProgress: null
          };

          const continueAfterActivityLog = () => {
            if (!completedUnitId) {
              loadNextUnit((nextUnit) => resolve({ ...result, nextUnit }));
              return;
            }

            saveUnitProgress(completedUnitId, (unitProgress) => {
              loadNextUnit((nextUnit) => {
                resolve({
                  ...result,
                  unitProgress,
                  nextUnit
                });
              });
            });
          };

          db.run(
            `
            INSERT INTO activity_log (
              unit_id,
              activity_type,
              xp_earned,
              correct_answers,
              wrong_answers
            )
            VALUES (?, 'practice', ?, ?, ?)
            `,
            [completedUnitId, xp, correct, wrong],
            (activityError) => {
              if (activityError) {
                console.error("Error saving activity log:", activityError.message);
              }

              continueAfterActivityLog();
            }
          );
        }
      );
    });
  }));
}

function loadNextUnit(callback) {
  db.get(
    `
    SELECT learning_units.id
    FROM learning_units
    WHERE learning_units.unit_order >= COALESCE(
      (SELECT starting_unit_order FROM learning_preferences WHERE id = 1),
      1
    )
      AND NOT EXISTS (
        SELECT 1
        FROM user_unit_progress
        WHERE user_id = 1
          AND unit_id = learning_units.id
          AND status = 'completed'
      )
    ORDER BY learning_units.unit_order
    LIMIT 1
    `,
    [],
    (error, row) => {
      if (error) {
        console.error("Error loading next learning path unit:", error.message);
        callback(null);
        return;
      }

      const unit = pathUnitById.get(row?.id);
      callback(
        unit
          ? {
              id: unit.id,
              title: unit.title,
              href: unit.href,
              isCheckpoint: Boolean(unit.isCheckpoint)
            }
          : null
      );
    }
  );
}

function validateUnitAccess(completedUnitId) {
  if (!completedUnitId) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT
        current_unit.id,
        NOT EXISTS (
          SELECT 1
          FROM learning_units AS previous_unit
          WHERE previous_unit.unit_order < current_unit.unit_order
            AND previous_unit.unit_order >= COALESCE(
              (SELECT starting_unit_order FROM learning_preferences WHERE id = 1),
              1
            )
            AND NOT EXISTS (
              SELECT 1
              FROM user_unit_progress
              WHERE user_id = 1
                AND unit_id = previous_unit.id
                AND status = 'completed'
            )
        ) AS prerequisites_completed
      FROM learning_units AS current_unit
      WHERE current_unit.id = ?
      `,
      [completedUnitId],
      (error, row) => {
        if (error) {
          console.error("Error validating unit access:", error.message);
          reject(new Error("Error validating learning path."));
          return;
        }

        if (!row) {
          const invalidUnitError = new Error("Learning path unit not found.");
          invalidUnitError.statusCode = 400;
          reject(invalidUnitError);
          return;
        }

        if (!row.prerequisites_completed) {
          const lockedUnitError = new Error("Complete the previous learning path steps first.");
          lockedUnitError.statusCode = 409;
          reject(lockedUnitError);
          return;
        }

        resolve();
      }
    );
  });
}

function calculateStreak(row, today) {
  if (!row || !row.last_study_date) {
    return 1;
  }

  const lastStudyDate = new Date(row.last_study_date);
  const currentDate = new Date(today);

  const differenceInDays = Math.floor(
    (currentDate - lastStudyDate) / (1000 * 60 * 60 * 24)
  );

  if (differenceInDays === 0) {
    return row.streak_days;
  }

  if (differenceInDays === 1) {
    return row.streak_days + 1;
  }

  return 1;
}

function saveUnitProgress(completedUnitId, callback) {
  db.run(
    `
    INSERT INTO user_unit_progress (
      user_id,
      unit_id,
      status,
      completed_count,
      last_completed_at,
      updated_at
    )
    VALUES (1, ?, 'completed', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, unit_id) DO UPDATE SET
      status = 'completed',
      completed_count = completed_count + 1,
      last_completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    `,
    [completedUnitId],
    function (progressError) {
      if (progressError) {
        console.error("Error saving unit progress:", progressError.message);
        callback(null);
        return;
      }

      callback({
        unitId: completedUnitId,
        status: "completed"
      });
    }
  );
}

module.exports = {
  saveProgress,
  calculateStreak,
  validateUnitAccess
};
