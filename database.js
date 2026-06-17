const sqlite3 = require("sqlite3").verbose();
const seedLessonQuestions = require("./data/seedLessonQuestions");

const db = new sqlite3.Database("./english_coach.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

db.serialize(() => {
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

const seedLessonQuestionStatement = db.prepare(`
  INSERT INTO lesson_questions
    (question_pt, options_json, correct_answer, explanation_pt, source)
  SELECT ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1
    FROM lesson_questions
    WHERE question_pt = ?
      AND correct_answer = ?
  )
`);

seedLessonQuestions.forEach((question) => {
  seedLessonQuestionStatement.run([
    question.questionPt,
    JSON.stringify(question.options),
    question.correctAnswer,
    question.explanationPt,
    question.source,
    question.questionPt,
    question.correctAnswer
  ]);
});

seedLessonQuestionStatement.finalize((seedError) => {
  if (seedError) {
    console.error("Error seeding lesson questions:", seedError.message);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS learning_units (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    unit_order INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    href TEXT,
    is_locked_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS writing_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER,
    title TEXT NOT NULL,
    scenario TEXT NOT NULL,
    task TEXT NOT NULL,
    placeholder TEXT,
    xp_reward INTEGER DEFAULT 10,
    times_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES learning_units(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS user_unit_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    unit_id INTEGER NOT NULL,
    status TEXT DEFAULT 'not_started',
    completed_count INTEGER DEFAULT 0,
    last_completed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, unit_id),
    FOREIGN KEY (unit_id) REFERENCES learning_units(id)
  )
`);

db.run(
  `
  INSERT OR IGNORE INTO learning_units
    (id, title, description, unit_order, activity_type, href, is_locked_default)
  VALUES
    (1, 'Support Basics', 'Practice useful phrases for everyday customer support.', 1, 'lesson', '/lesson', 0),
    (2, 'Ask for Details', 'Write clear messages asking coworkers or customers for more information.', 2, 'writing', '/writing', 0),
    (3, 'Correct and Improve', 'Send your own sentence and get AI feedback for more natural English.', 3, 'correction', '/correct', 0),
    (4, 'Customer Conversation', 'Simulate a real conversation with a customer and practice responses.', 4, 'conversation', NULL, 1),
    (5, 'Speaking Practice', 'Practice pronunciation, fluency, and confidence for live calls.', 5, 'speaking', NULL, 1)
  `
);

db.run(
  `
  UPDATE learning_units
  SET href = '/conversation',
      is_locked_default = 0
  WHERE id = 4
  `
);

db.run(
  `
  UPDATE learning_units
  SET href = '/speaking',
      is_locked_default = 0
  WHERE id = 5
  `
);

db.run(
  `
  INSERT OR IGNORE INTO writing_missions
    (id, unit_id, title, scenario, task, placeholder, xp_reward)
  VALUES
    (
      1,
      2,
      'Ask for Details',
      'You need to send a short message to a coworker asking for more details about an issue.',
      'Write a professional message in English asking for more details.',
      'Example: Hi Ana, could you please share more details about the issue?',
      10
    ),
    (
      2,
      2,
      'Follow Up Politely',
      'A customer has not replied with the information you need to continue investigating a ticket.',
      'Write a polite follow-up message asking for the missing information.',
      'Example: Hi, I am following up to check whether you could share the requested details.',
      10
    ),
    (
      3,
      2,
      'Give a Short Update',
      'You are still investigating an issue and need to update the customer without promising a final solution yet.',
      'Write a short professional update explaining that you are still checking the case.',
      'Example: Hi, I am still investigating this issue and will update you as soon as possible.',
      10
    )
  `
);
});

module.exports = db;
