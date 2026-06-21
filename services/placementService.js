const db = require("../database");
const placementQuestions = require("../data/placementQuestions");
const { levelMatrix, skillMatrix } = require("../data/pedagogy");
const { learningPathSections, learningPathUnits } = require("../data/learningPath");

function getPublicQuestions() {
  const correctPositions = shuffle(
    placementQuestions.map((_, index) => index % 4)
  );

  return placementQuestions.map(({ correctAnswer, ...question }, index) => {
    const distractors = shuffle(question.options.filter((option) => option !== correctAnswer));
    const options = [...distractors];
    options.splice(correctPositions[index], 0, correctAnswer);

    return { ...question, options };
  });
}

function shuffle(values) {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function evaluatePlacement(answers) {
  const submittedAnswers = answers && typeof answers === "object" ? answers : {};
  const levelScores = new Map(levelMatrix.map((level) => [level.level, { correct: 0, total: 0 }]));
  const skillScores = new Map(skillMatrix.map((skill) => [skill.id, { correct: 0, total: 0 }]));

  let totalCorrect = 0;
  const answerResults = placementQuestions.map((question) => {
    const submitted = String(submittedAnswers[question.id] || "");
    const isCorrect = submitted === question.correctAnswer;
    const levelScore = levelScores.get(question.level);
    const skillScore = skillScores.get(question.skill);

    levelScore.total += 1;
    skillScore.total += 1;
    if (isCorrect) {
      totalCorrect += 1;
      levelScore.correct += 1;
      skillScore.correct += 1;
    }

    return { questionId: question.id, submitted, isCorrect };
  });

  let estimatedLevel = "A1";
  for (const level of levelMatrix) {
    const score = levelScores.get(level.level);
    if (score.correct >= 2) {
      estimatedLevel = level.level;
    } else {
      break;
    }
  }

  const levelDefinition = levelMatrix.find((level) => level.level === estimatedLevel);
  const skills = skillMatrix.map((skill) => {
    const score = skillScores.get(skill.id);
    return {
      id: skill.id,
      label: skill.label,
      correct: score.correct,
      total: score.total,
      percent: Math.round((score.correct / score.total) * 100)
    };
  });

  return {
    totalCorrect,
    totalQuestions: placementQuestions.length,
    estimatedLevel,
    recommendedPhase: levelDefinition.phase,
    objective: levelDefinition.objective,
    skills,
    answerResults
  };
}

function savePlacementResult(result) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO placement_assessments (
        score,
        total_questions,
        cefr_level,
        recommended_phase,
        result_json
      ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        result.totalCorrect,
        result.totalQuestions,
        result.estimatedLevel,
        result.recommendedPhase,
        JSON.stringify({ skills: result.skills, answerResults: result.answerResults })
      ],
      function (error) {
        if (error) {
          reject(error);
          return;
        }

        resolve({ ...result, assessmentId: this.lastID });
      }
    );
  });
}

async function submitPlacement(answers) {
  return savePlacementResult(evaluatePlacement(answers));
}

function applyPlacementRecommendation(assessmentId) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id, recommended_phase FROM placement_assessments WHERE id = ?",
      [Number(assessmentId)],
      (selectError, assessment) => {
        if (selectError) return reject(selectError);
        if (!assessment) {
          const error = new Error("Placement assessment not found.");
          error.statusCode = 404;
          return reject(error);
        }

        const section = learningPathSections.find(
          (candidate) => candidate.id === assessment.recommended_phase
        );
        const firstUnit = section?.units[0];
        const pathUnit = learningPathUnits.find((unit) => unit.id === firstUnit?.id);
        if (!firstUnit || !pathUnit) return reject(new Error("Recommended phase is unavailable."));

        db.run(
          `
          INSERT INTO learning_preferences (
            id, placement_assessment_id, starting_unit_order, recommended_phase, applied_at
          ) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            placement_assessment_id = excluded.placement_assessment_id,
            starting_unit_order = excluded.starting_unit_order,
            recommended_phase = excluded.recommended_phase,
            applied_at = CURRENT_TIMESTAMP
          `,
          [assessment.id, pathUnit.unitOrder, assessment.recommended_phase],
          (saveError) => {
            if (saveError) return reject(saveError);
            resolve({
              success: true,
              recommendedPhase: assessment.recommended_phase,
              startHref: firstUnit.href
            });
          }
        );
      }
    );
  });
}

module.exports = {
  evaluatePlacement,
  getPublicQuestions,
  applyPlacementRecommendation,
  submitPlacement
};
