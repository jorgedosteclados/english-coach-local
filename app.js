require("dotenv").config();

const express = require("express");
const path = require("path");
const db = require("./database");
const {
  buildAchievements,
  getAchievementForUnit
} = require("./services/achievementService");

const app = express();
const aiRoutes = require("./routes/ai");
const { lessonCategories } = require("./data/lessonCategories");
const speakingPrompts = require("./data/speakingPrompts");
const visualReviewCards = require("./data/visualReviewCards");
const PORT = 3000;

const defaultProgress = {
  total_xp: 0,
  lessons_completed: 0,
  total_correct: 0,
  total_wrong: 0,
  streak_days: 0
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/ai", aiRoutes);

function buildPathState(rows) {
  let previousCompleted = true;

  const units = rows.map((unit) => {
    const isCompleted = unit.status === "completed";
    const isLocked = Boolean(unit.is_locked_default) || !previousCompleted;

    previousCompleted = isCompleted;

    return {
      ...unit,
      isCompleted,
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

  return {
    units,
    nextUnit,
    completedCount,
    totalCount,
    progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  };
}

function loadLearningPath(callback) {
  db.all(
    `
    SELECT
      learning_units.*,
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

      res.render("home", {
        progress: selectedProgress,
        pathState: pathState || buildPathState([]),
        achievements: buildAchievements(selectedProgress, (pathState || buildPathState([])).units)
      });
    });
  });
});

app.get("/correct", (req, res) => {
  res.render("correct");
});

app.get("/lesson", (req, res) => {
  res.render("lesson", { lessonCategories });
});

app.get("/review", (req, res) => {
  res.render("review", { reviewCards: visualReviewCards });
});

app.get("/units", (req, res) => {
  loadLearningPath((err, pathState) => {
    if (err) {
      console.error("Error loading units:", err.message);
      const emptyPathState = buildPathState([]);

      return res.render("units", {
        pathState: emptyPathState,
        units: [],
        achievements: []
      });
    }

    const achievements = buildAchievements(defaultProgress, pathState.units);

    res.render("units", {
      pathState,
      units: pathState.units.map((unit) => ({
        ...unit,
        achievement: getAchievementForUnit(unit.id, achievements)
      }))
    });
  });
});

app.get("/writing", (req, res) => {
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
  res.render("conversation");
});

app.get("/speaking", (req, res) => {
  const prompt = speakingPrompts[Math.floor(Math.random() * speakingPrompts.length)];

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
