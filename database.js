const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./english_coach.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_text TEXT NOT NULL,
    ai_feedback TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_xp INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_wrong INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_study_date TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  INSERT OR IGNORE INTO user_progress (
    id,
    total_xp,
    lessons_completed,
    total_correct,
    total_wrong,
    streak_days,
    last_study_date
  )
  VALUES (
    1,
    0,
    0,
    0,
    0,
    0,
    NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS lesson_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_pt TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation_pt TEXT NOT NULL,
    source TEXT DEFAULT 'ai',
    times_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;