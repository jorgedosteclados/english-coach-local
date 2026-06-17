const express = require("express");

const router = express.Router();
const db = require("../database");
const { generateAIResponse } = require("../services/aiService");
const {
  buildCorrectionPrompt,
  buildConversationFeedbackPrompt,
  buildConversationMessagePrompt,
  buildSpeakingFeedbackPrompt
} = require("../services/promptService");
const { getLessonQuestion } = require("../services/questionService");
const { saveProgress } = require("../services/progressService");

router.post("/correct", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        error: "Text is required."
      });
    }

    const aiFeedback = await generateAIResponse(buildCorrectionPrompt(text));

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
  try {
    const question = await getLessonQuestion(req.body.category);

    res.json(question);
  } catch (error) {
    console.error("Lesson question route failed:", error.message);
    res.status(500).json({
      error: "Error generating lesson question."
    });
  }
});

router.post("/conversation-message", async (req, res) => {
  try {
    const { scenario, messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Conversation messages are required."
      });
    }

    const customerReply = await generateAIResponse(
      buildConversationMessagePrompt(scenario, messages)
    );

    res.json({
      reply: customerReply.trim()
    });
  } catch (error) {
    console.error("Conversation message failed:", error.message);
    res.status(500).json({
      error: "Error generating customer reply."
    });
  }
});

router.post("/conversation-feedback", async (req, res) => {
  try {
    const { scenario, messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Conversation messages are required."
      });
    }

    const feedback = await generateAIResponse(
      buildConversationFeedbackPrompt(scenario, messages)
    );

    res.json({
      result: feedback
    });
  } catch (error) {
    console.error("Conversation feedback failed:", error.message);
    res.status(500).json({
      error: "Error generating conversation feedback."
    });
  }
});

router.post("/speaking-feedback", async (req, res) => {
  try {
    const { scenario, targetPhrase, transcript, score } = req.body;

    if (!transcript || transcript.trim() === "") {
      return res.status(400).json({
        error: "Speech transcript is required."
      });
    }

    const feedback = await generateAIResponse(
      buildSpeakingFeedbackPrompt({
        scenario,
        targetPhrase,
        transcript,
        score: Number(score) || 0
      })
    );

    res.json({
      result: feedback
    });
  } catch (error) {
    console.error("Speaking feedback failed:", error.message);
    res.status(500).json({
      error: "Error generating speaking feedback."
    });
  }
});

router.post("/save-lesson-progress", async (req, res) => {
  try {
    const result = await saveProgress(req.body);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;
