const sqlite3 = require("sqlite3").verbose();
const seedLessonQuestions = require("./data/seedLessonQuestions");
const csvLessonQuestions = require("./data/csvLessonQuestions");
const { learningPathUnits } = require("./data/learningPath");

const databasePath = process.env.DATABASE_PATH || "./english_coach.db";
const db = new sqlite3.Database(databasePath, (err) => {
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
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER,
    activity_type TEXT DEFAULT 'practice',
    xp_earned INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    wrong_answers INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES learning_units(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS reading_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    source_label TEXT DEFAULT 'Pasted text',
    total_chapters INTEGER DEFAULT 1,
    total_words INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS reading_chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, chapter_index),
    FOREIGN KEY (book_id) REFERENCES reading_books(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS reading_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    chapter_index INTEGER DEFAULT 0,
    sentence_index INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, source_type, source_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS reading_vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    word TEXT NOT NULL,
    translation TEXT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    sentence TEXT,
    saved_count INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, word)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS placement_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    cefr_level TEXT NOT NULL,
    recommended_phase INTEGER NOT NULL,
    result_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS learning_preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    placement_assessment_id INTEGER,
    starting_unit_order INTEGER NOT NULL DEFAULT 1,
    recommended_phase INTEGER NOT NULL DEFAULT 1,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (placement_assessment_id) REFERENCES placement_assessments(id)
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

db.run(`
  CREATE TABLE IF NOT EXISTS question_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    unit_id INTEGER,
    exercise_type TEXT NOT NULL,
    user_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES lesson_questions(id),
    FOREIGN KEY (unit_id) REFERENCES learning_units(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS question_mastery (
    question_id INTEGER PRIMARY KEY,
    total_correct INTEGER DEFAULT 0,
    total_wrong INTEGER DEFAULT 0,
    correct_streak INTEGER DEFAULT 0,
    last_result INTEGER DEFAULT 0,
    last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    next_review_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES lesson_questions(id)
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

[...seedLessonQuestions, ...csvLessonQuestions].forEach((question) => {
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

db.run(
  `
  DELETE FROM lesson_questions
  WHERE source = 'csv:sap-ics'
    OR question_pt LIKE '%SAP%'
    OR question_pt LIKE '%Concur%'
    OR options_json LIKE '%SAP%'
    OR options_json LIKE '%Concur%'
  `,
  (cleanupError) => {
    if (cleanupError) {
      console.error("Error removing legacy branded questions:", cleanupError.message);
    }
  }
);

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

const learningPathStatement = db.prepare(`
  INSERT INTO learning_units
    (id, title, description, unit_order, activity_type, href, is_locked_default)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    unit_order = excluded.unit_order,
    activity_type = excluded.activity_type,
    href = excluded.href,
    is_locked_default = excluded.is_locked_default
`);

learningPathUnits.forEach((pathUnit) => {
  learningPathStatement.run([
    pathUnit.id,
    pathUnit.title,
    pathUnit.description,
    pathUnit.unitOrder,
    pathUnit.activityType,
    pathUnit.href,
    pathUnit.isLockedDefault
  ]);
});

learningPathStatement.finalize((pathError) => {
  if (pathError) {
    console.error("Error seeding learning path:", pathError.message);
  }
});

[
  { checkpointId: 21, laterUnitIds: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
  { checkpointId: 22, laterUnitIds: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
  { checkpointId: 23, laterUnitIds: [16, 17, 18, 19, 20] }
].forEach(({ checkpointId, laterUnitIds }) => {
  db.run(
    `
    INSERT OR IGNORE INTO user_unit_progress (
      user_id,
      unit_id,
      status,
      completed_count,
      last_completed_at,
      updated_at
    )
    SELECT 1, ?, 'completed', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE EXISTS (
      SELECT 1
      FROM user_unit_progress
      WHERE user_id = 1
        AND status = 'completed'
        AND unit_id IN (${laterUnitIds.map(() => "?").join(", ")})
    )
    `,
    [checkpointId, ...laterUnitIds]
  );
});

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
