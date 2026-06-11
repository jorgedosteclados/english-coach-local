const fs = require("fs");
const path = require("path");
const db = require("./database");

const csvPath = path.join(__dirname, "questions_seed.csv");

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCsv(content) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return row;
  });
}

if (!fs.existsSync(csvPath)) {
  console.error("questions_seed.csv not found in the project root.");
  process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(csvContent);

let inserted = 0;
let skipped = 0;
let failed = 0;

db.serialize(() => {
  const stmt = db.prepare(`
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

  rows.forEach((row) => {
    try {
      const options = JSON.parse(row.options_json);

      if (
        !row.question_pt ||
        !Array.isArray(options) ||
        options.length !== 4 ||
        !row.correct_answer ||
        !row.explanation_pt ||
        !options.includes(row.correct_answer)
      ) {
        console.error("Invalid row skipped:", row.question_pt);
        failed++;
        return;
      }

      stmt.run(
        [
          row.question_pt,
          JSON.stringify(options),
          row.correct_answer,
          row.explanation_pt,
          row.source || "csv",
          row.question_pt,
          row.correct_answer
        ],
        function (err) {
          if (err) {
            console.error("Insert failed:", err.message);
            failed++;
            return;
          }

          if (this.changes === 1) {
            inserted++;
          } else {
            skipped++;
          }
        }
      );
    } catch (error) {
      console.error("Invalid JSON skipped:", row.question_pt, error.message);
      failed++;
    }
  });

  stmt.finalize((err) => {
    if (err) {
      console.error("Finalize error:", err.message);
    }

    console.log("Import completed.");
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped duplicates: ${skipped}`);
    console.log(`Failed: ${failed}`);

    db.close();
  });
});