const db = require("../database");
const { generateAIResponse } = require("./aiService");
const { buildLessonQuestionPrompt } = require("./promptService");

const fallbackQuestions = [
  {
    questionPt: "Eu vou verificar internamente.",
    options: [
      "I will check internally.",
      "I will verify in the internal.",
      "I go check internal.",
      "I will look inside."
    ],
    correctAnswer: "I will check internally.",
    explanationPt:
      "A frase 'I will check internally' é natural e profissional para dizer que você vai verificar algo dentro da empresa."
  },
  {
    questionPt: "Você poderia fornecer mais detalhes?",
    options: [
      "Could you please provide more details?",
      "Can you give more details to me?",
      "You can provide more details?",
      "Could you please provide more detailings?"
    ],
    correctAnswer: "Could you please provide more details?",
    explanationPt:
      "Essa é uma forma educada e profissional de pedir mais informações ao cliente."
  },
  {
    questionPt: "Obrigado pela sua paciência.",
    options: [
      "Thank you for your patience.",
      "Thanks for your pacient.",
      "Thank you by your patience.",
      "Thanks for wait me."
    ],
    correctAnswer: "Thank you for your patience.",
    explanationPt:
      "Usamos 'for your patience' para agradecer pela paciência de alguém."
  },
  {
    questionPt: "Vou continuar investigando este caso.",
    options: [
      "I will continue investigating this case.",
      "I will keep investigate this case.",
      "I will continue to investigate this case internally.",
      "I will still investigating this case."
    ],
    correctAnswer: "I will continue investigating this case.",
    explanationPt:
      "Depois de 'continue', podemos usar o verbo com -ing: 'continue investigating'."
  },
  {
    questionPt: "Assim que eu tiver uma atualização, avisarei você.",
    options: [
      "As soon as I have an update, I will let you know.",
      "When I will have an update, I advise you.",
      "As soon I have update, I tell you.",
      "When I have updating, I will inform."
    ],
    correctAnswer: "As soon as I have an update, I will let you know.",
    explanationPt:
      "Essa frase é natural, educada e muito usada em suporte profissional."
  }
];

function getFallbackQuestion() {
  return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
}

function loadSavedQuestion() {
  return new Promise((resolve) => {
    db.get(
      `
      SELECT *
      FROM lesson_questions
      ORDER BY times_used ASC, RANDOM()
      LIMIT 1
      `,
      [],
      (selectError, row) => {
        if (selectError) {
          console.error("Error loading saved lesson question:", selectError.message);
          return resolve(null);
        }

        if (!row) {
          return resolve(null);
        }

        let options;

        try {
          options = JSON.parse(row.options_json);
        } catch (parseError) {
          console.error("Error parsing saved lesson question:", parseError.message);
          return resolve(null);
        }

        db.run(
          "UPDATE lesson_questions SET times_used = times_used + 1 WHERE id = ?",
          [row.id],
          function (updateError) {
            if (updateError) {
              console.error("Error updating lesson question usage:", updateError.message);
            }
          }
        );

        return resolve({
          question: row.question_pt,
          questionPt: row.question_pt,
          options,
          correctAnswer: row.correct_answer,
          explanation: row.explanation_pt,
          explanationPt: row.explanation_pt,
          source: row.source || "database"
        });
      }
    );
  });
}

function saveAIQuestion(question) {
  return new Promise((resolve) => {
    db.run(
      `
      INSERT INTO lesson_questions
        (question_pt, options_json, correct_answer, explanation_pt, source)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        question.questionPt,
        JSON.stringify(question.options),
        question.correctAnswer,
        question.explanationPt,
        "ai"
      ],
      function (insertError) {
        if (insertError) {
          console.error("Error saving AI lesson question:", insertError.message);
        }

        resolve(question);
      }
    );
  });
}

function parseAIQuestion(aiTextRaw) {
  const aiText = aiTextRaw.replace(/```json/g, "").replace(/```/g, "").trim();
  const question = JSON.parse(aiText);

  if (
    !question.questionPt ||
    !Array.isArray(question.options) ||
    question.options.length !== 4 ||
    !question.correctAnswer ||
    !question.explanationPt ||
    !question.options.includes(question.correctAnswer)
  ) {
    throw new Error("Invalid AI question format.");
  }

  return question;
}

async function getLessonQuestion() {
  const savedQuestion = await loadSavedQuestion();

  if (savedQuestion) {
    return savedQuestion;
  }

  try {
    const aiTextRaw = await generateAIResponse(buildLessonQuestionPrompt());
    const question = parseAIQuestion(aiTextRaw);

    return await saveAIQuestion(question);
  } catch (error) {
    console.error("AI lesson generation failed:", error.message);
    return getFallbackQuestion();
  }
}

module.exports = {
  getLessonQuestion,
  getFallbackQuestion
};
