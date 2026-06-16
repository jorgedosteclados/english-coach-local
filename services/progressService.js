const db = require("../database");

function saveProgress({ xpEarned, correctAnswers, wrongAnswers, unitId }) {
  const xp = Number(xpEarned) || 0;
  const correct = Number(correctAnswers) || 0;
  const wrong = Number(wrongAnswers) || 0;
  const completedUnitId = Number(unitId) || null;
  const today = new Date().toISOString().split("T")[0];

  return new Promise((resolve, reject) => {
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
          lessons_completed = lessons_completed + 1,
          total_correct = total_correct + ?,
          total_wrong = total_wrong + ?,
          streak_days = ?,
          last_study_date = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
        `,
        [xp, correct, wrong, newStreak, today],
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

          if (!completedUnitId) {
            resolve(result);
            return;
          }

          saveUnitProgress(completedUnitId, (unitProgress) => {
            resolve({
              ...result,
              unitProgress
            });
          });
        }
      );
    });
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
  calculateStreak
};
