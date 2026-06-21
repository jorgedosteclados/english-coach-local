const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const rootDir = path.resolve(__dirname, "..");
const dbPath = path.join(rootDir, "english_coach.db");
const backupDir = path.join(rootDir, "local_backups");
const backupPath = path.join(backupDir, "progress-original.db");
const command = process.argv[2] || "status";
const commandValue = process.argv[3];

if (!fs.existsSync(dbPath)) {
  console.error("english_coach.db was not found. Start the app once before using this tool.");
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve(this);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
      } else {
        resolve(row);
      }
    });
  });
}

function quoteSqlPath(value) {
  return value.replace(/'/g, "''");
}

async function createBackup(force = false) {
  fs.mkdirSync(backupDir, { recursive: true });

  if (fs.existsSync(backupPath)) {
    if (!force) {
      console.log(`Using existing backup: ${backupPath}`);
      return;
    }

    fs.unlinkSync(backupPath);
  }

  await run(`VACUUM INTO '${quoteSqlPath(backupPath)}'`);
  console.log(`Progress backup created: ${backupPath}`);
}

async function resetProgress() {
  await run("BEGIN IMMEDIATE TRANSACTION");

  try {
    await run("DELETE FROM question_attempts");
    await run("DELETE FROM question_mastery");
    await run("DELETE FROM user_unit_progress");
    await run("DELETE FROM corrections");
    await run("UPDATE lesson_questions SET times_used = 0");
    await run("UPDATE writing_missions SET times_used = 0");
    await run(`
      UPDATE user_progress
      SET
        total_xp = 0,
        lessons_completed = 0,
        total_correct = 0,
        total_wrong = 0,
        streak_days = 0,
        last_study_date = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);
    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
}

async function prepareCheckpoint(phase) {
  const checkpointIds = { 1: 21, 2: 22, 3: 23, 4: 24 };
  const checkpointId = checkpointIds[phase];

  if (!checkpointId) {
    throw new Error("Checkpoint phase must be 1, 2, 3, or 4.");
  }

  await createBackup(false);
  await resetProgress();
  const checkpoint = await get("SELECT unit_order FROM learning_units WHERE id = ?", [checkpointId]);

  if (!checkpoint) {
    throw new Error("Checkpoint not found. Restart the app to apply the latest database migration.");
  }

  await run(`
    INSERT INTO user_unit_progress (
      user_id,
      unit_id,
      status,
      completed_count,
      last_completed_at,
      updated_at
    )
    SELECT 1, id, 'completed', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM learning_units
    WHERE unit_order < ?
  `, [checkpoint.unit_order]);

  const completed = await get(
    "SELECT COUNT(*) AS count FROM user_unit_progress WHERE user_id = 1 AND status = 'completed'"
  );
  await run(
    `
    UPDATE user_progress
    SET
      total_xp = ?,
      lessons_completed = ?,
      total_correct = ?,
      total_wrong = 0,
      streak_days = 1,
      last_study_date = date('now'),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    `,
    [completed.count * 10, completed.count, completed.count * 5]
  );

  console.log(`Checkpoint ${phase} is ready to test at http://localhost:3000`);
}

async function restoreBackup() {
  if (!fs.existsSync(backupPath)) {
    throw new Error("No saved progress backup exists.");
  }

  await run(`ATTACH DATABASE '${quoteSqlPath(backupPath)}' AS progress_backup`);
  await run("BEGIN IMMEDIATE TRANSACTION");

  try {
    for (const table of [
      "question_attempts",
      "question_mastery",
      "user_unit_progress",
      "corrections",
      "user_progress",
      "lesson_questions",
      "writing_missions"
    ]) {
      await run(`DELETE FROM main.${table}`);
      await run(`INSERT INTO main.${table} SELECT * FROM progress_backup.${table}`);
    }

    await run("COMMIT");
    await run("DETACH DATABASE progress_backup");
    console.log("Original progress restored.");
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
}

async function showStatus() {
  const progress = await get("SELECT * FROM user_progress WHERE id = 1");
  const path = await get(`
    SELECT
      COUNT(*) AS completed,
      (SELECT COUNT(*) FROM learning_units) AS total
    FROM user_unit_progress
    WHERE user_id = 1 AND status = 'completed'
  `);
  const nextUnit = await get(`
    SELECT id, title, activity_type
    FROM learning_units
    WHERE id NOT IN (
      SELECT unit_id FROM user_unit_progress WHERE user_id = 1 AND status = 'completed'
    )
    ORDER BY unit_order
    LIMIT 1
  `);

  console.log(`Path: ${path.completed}/${path.total} nodes completed`);
  console.log(`XP: ${progress?.total_xp || 0} | Activities: ${progress?.lessons_completed || 0}`);
  console.log(nextUnit ? `Next: ${nextUnit.title} (${nextUnit.activity_type})` : "Path complete");
  console.log(`Backup: ${fs.existsSync(backupPath) ? backupPath : "not created"}`);
}

async function main() {
  if (command === "backup") {
    await createBackup(true);
  } else if (command === "fresh") {
    await createBackup(false);
    await resetProgress();
    console.log("Fresh progress is ready at http://localhost:3000");
  } else if (command === "checkpoint") {
    await prepareCheckpoint(Number(commandValue));
  } else if (command === "restore") {
    await restoreBackup();
  } else if (command === "status") {
    await showStatus();
  } else {
    throw new Error("Use: backup, fresh, checkpoint <1-4>, restore, or status.");
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
