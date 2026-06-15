const express = require("express");

const router = express.Router();
const db = require("../database");
const { generateAIResponse } = require("../services/aiService");

router.post("/correct", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        error: "Text is required."
      });
    }

    const prompt = `
You are an English teacher helping a Brazilian Portuguese speaker improve professional English.

Correct the user's English sentence while preserving the original meaning.

Rules:
- Do not translate the sentence to Portuguese.
- Keep the corrected sentences in English.
- Use Portuguese only in the explanation.
- Keep the answer concise.
- Focus on grammar, prepositions, word choice, and natural professional English.

User sentence:
${text}

Return exactly in this format:

Original:
${text}

Corrected:
[corrected English sentence]

More natural:
[more natural English sentence]

Professional version:
[professional English sentence]

Explanation in Portuguese:
[short explanation in Portuguese]

Useful alternatives:
- [English alternative 1]
- [English alternative 2]
- [English alternative 3]
`;

    const aiFeedback = await generateAIResponse(prompt);

    db.run(
      "INSERT INTO corrections (original_text, ai_feedback) VALUES (?, ?)",
      [text, aiFeedback],
      function (dbError) {
        if (dbError) {
          console.error("Error saving correction:", dbError.message);
        }

        res.json({
          result: aiFeedback
        });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error connecting to AI providers."
    });
  }
});

router.post("/generate-lesson-question", async (req, res) => {
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
    const randomQuestion =
      fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];

    return randomQuestion;
  }

  function getSavedQuestionOrFallback() {
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

          return res.json(getFallbackQuestion());
        }

        if (!row) {
          return res.json(getFallbackQuestion());
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

        try {
          return res.json({
            questionPt: row.question_pt,
            options: JSON.parse(row.options_json),
            correctAnswer: row.correct_answer,
            explanationPt: row.explanation_pt
          });
        } catch (parseError) {
          console.error("Error parsing saved lesson question:", parseError.message);

          return res.json(getFallbackQuestion());
        }
      }
    );
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
            options: options,
            correctAnswer: row.correct_answer,
            explanation: row.explanation_pt,
            explanationPt: row.explanation_pt,
            source: row.source || "database"
          });
        }
      );
    });
  }

  try {
    const savedQuestion = await loadSavedQuestion();

    if (savedQuestion) {
      return res.json(savedQuestion);
    }

    const prompt = `
You are an English teacher helping a Brazilian Portuguese speaker learn professional English.

Create ONE multiple-choice question for an English lesson.

The question must be useful for SAP Support, customer service, or professional work.

Return ONLY valid JSON in this exact format:

{
  "questionPt": "Portuguese sentence here",
  "options": [
    "English option 1",
    "English option 2",
    "English option 3",
    "English option 4"
  ],
  "correctAnswer": "Correct English option here",
  "explanationPt": "Short explanation in Portuguese here"
}

Rules:
- The Portuguese sentence must be natural.
- Only one option must be correct.
- The correct answer must be one of the options.
- Keep the English professional and natural.
- Do not add markdown.
- Do not add text outside the JSON.
`;

    const aiTextRaw = await generateAIResponse(prompt);

    let aiText = aiTextRaw.trim();

    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

    const question = JSON.parse(aiText);

    if (
      !question.questionPt ||
      !Array.isArray(question.options) ||
      question.options.length !== 4 ||
      !question.correctAnswer ||
      !question.explanationPt ||
      !question.options.includes(question.correctAnswer)
    ) {
      console.error("Invalid AI question format.");
      return getSavedQuestionOrFallback();
    }

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

        res.json(question);
      }
    );
  } catch (error) {
    console.error("AI lesson generation failed:", error.message);

    getSavedQuestionOrFallback();
  }
});

router.post("/save-lesson-progress", (req, res) => {
  const { xpEarned, correctAnswers, wrongAnswers, unitId } = req.body;

  const xp = Number(xpEarned) || 0;
  const correct = Number(correctAnswers) || 0;
  const wrong = Number(wrongAnswers) || 0;
  const completedUnitId = Number(unitId) || null;

  const today = new Date().toISOString().split("T")[0];

  db.get("SELECT * FROM user_progress WHERE id = 1", [], (selectError, row) => {
    if (selectError) {
      console.error("Error reading user progress:", selectError.message);
      return res.status(500).json({
        error: "Error reading user progress."
      });
    }

    let newStreak = 1;

    if (row && row.last_study_date) {
      const lastStudyDate = new Date(row.last_study_date);
      const currentDate = new Date(today);

      const differenceInDays = Math.floor(
        (currentDate - lastStudyDate) / (1000 * 60 * 60 * 24)
      );

      if (differenceInDays === 0) {
        newStreak = row.streak_days;
      } else if (differenceInDays === 1) {
        newStreak = row.streak_days + 1;
      } else {
        newStreak = 1;
      }
    }

    db.run(
      `
      UPDATE user_progress
      SET
        total_xp = total_xp + ?,
        lessons_completed = lessons_completed + 1,
        total_correct = total_correct + ?,
        total_wrong = total_wrong + ?,
        streak_days = ?,
        last_study_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `,
      [xp, correct, wrong, newStreak, today],
      function (updateError) {
        if (updateError) {
          console.error("Error saving lesson progress:", updateError.message);
          return res.status(500).json({
            error: "Error saving lesson progress."
          });
        }

        function sendSuccess(unitProgress) {
          res.json({
            success: true,
            totalXpAdded: xp,
            correctAdded: correct,
            wrongAdded: wrong,
            streakDays: newStreak,
            unitProgress: unitProgress || null
          });
        }

        if (!completedUnitId) {
          return sendSuccess(null);
        }

        db.run(
          `
          INSERT INTO user_unit_progress (
            user_id,
            unit_id,
            status,
            completed_count,
            last_completed_at,
            updated_at
          )
          VALUES (1, ?, 'completed', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, unit_id) DO UPDATE SET
            status = 'completed',
            completed_count = completed_count + 1,
            last_completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          `,
          [completedUnitId],
          function (progressError) {
            if (progressError) {
              console.error("Error saving unit progress:", progressError.message);
              return sendSuccess(null);
            }

            sendSuccess({
              unitId: completedUnitId,
              status: "completed"
            });
          }
        );
      }
    );
  });
});

module.exports = router;
