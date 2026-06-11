require("dotenv").config();

const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const aiRoutes = require("./routes/ai");
const PORT = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/ai", aiRoutes);

app.get("/", (req, res) => {
  db.get("SELECT * FROM user_progress WHERE id = 1", [], (err, progress) => {
    if (err) {
      console.error("Error loading user progress:", err.message);
      return res.render("home", {
        progress: {
          total_xp: 0,
          lessons_completed: 0,
          total_correct: 0,
          total_wrong: 0,
          streak_days: 0
        }
      });
    }

    res.render("home", {
      progress: progress || {
        total_xp: 0,
        lessons_completed: 0,
        total_correct: 0,
        total_wrong: 0,
        streak_days: 0
      }
    });
  });
});

app.get("/correct", (req, res) => {
  res.render("correct");
});

app.get("/lesson", (req, res) => {
  res.render("lesson");
});

app.get("/writing", (req, res) => {
  res.render("writing");
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
