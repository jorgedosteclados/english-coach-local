const fs = require("fs");
const path = require("path");

const csvPath = path.join(__dirname, "..", "questions_seed.csv");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      current += '"';
      index++;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current);
  return values;
}

function loadCsvQuestions() {
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  const lines = fs
    .readFileSync(csvPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).flatMap((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));

    try {
      const options = JSON.parse(row.options_json);
      const valid =
        row.question_pt &&
        Array.isArray(options) &&
        options.length === 4 &&
        row.correct_answer &&
        row.explanation_pt &&
        options.includes(row.correct_answer);

      if (!valid) {
        console.error(`Invalid CSV question at row ${rowIndex + 2}.`);
        return [];
      }

      return [
        {
          source: row.source || "csv",
          questionPt: row.question_pt,
          options,
          correctAnswer: row.correct_answer,
          explanationPt: row.explanation_pt
        }
      ];
    } catch (error) {
      console.error(`Invalid CSV JSON at row ${rowIndex + 2}:`, error.message);
      return [];
    }
  });
}

module.exports = loadCsvQuestions();
