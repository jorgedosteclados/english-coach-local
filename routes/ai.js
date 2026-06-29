const express = require("express");

const router = express.Router();
const db = require("../database");
const { callOllamaStream, generateAIResponse } = require("../services/aiService");
const {
  buildCallPhraseFeedbackPrompt,
  buildCorrectionPrompt,
  buildConversationFeedbackPrompt,
  buildConversationMessagePrompt,
  buildLocalChatPrompt,
  buildSpeakingFeedbackPrompt,
  buildSupportCallFeedbackPrompt,
  buildSupportCallMessagePrompt
} = require("../services/promptService");
const { getLessonQuestion } = require("../services/questionService");
const { saveProgress } = require("../services/progressService");
const { saveQuestionAttempt } = require("../services/reviewService");

function getValidLocalChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      error: "Chat messages are required."
    };
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role !== "user" || !String(lastMessage.content || "").trim()) {
    return {
      error: "Send a user message first."
    };
  }

  return {
    messages
  };
}

router.post("/correct", async (req, res) => {
  try {
    const { text, mode } = req.body;
    const feedbackMode = mode === "call" ? "call" : "general";

    if (!text || text.trim() === "") {
      return res.status(400).json({
        error: "Text is required."
      });
    }

    const aiFeedback =
      feedbackMode === "call"
        ? await generateAIResponse(buildCallPhraseFeedbackPrompt(text), {
            provider: "ollama",
            localOnly: true
          })
        : await generateAIResponse(buildCorrectionPrompt(text));

    db.run(
      "INSERT INTO corrections (original_text, ai_feedback, mode) VALUES (?, ?, ?)",
      [text, aiFeedback, feedbackMode],
      function (dbError) {
        if (dbError) {
          console.error("Error saving correction:", dbError.message);
        }

        res.json({
          result: aiFeedback,
          mode: feedbackMode
        });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error:
        req.body?.mode === "call"
          ? "Local AI is unavailable. Make sure Ollama is running."
          : "Error connecting to AI providers."
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

router.post("/support-call-message", async (req, res) => {
  try {
    const { scenario, customerProfile, messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Call messages are required."
      });
    }

    const reply = await generateAIResponse(
      buildSupportCallMessagePrompt({ scenario, customerProfile, messages }),
      { provider: "ollama", localOnly: true }
    );

    res.json({
      reply: reply.trim()
    });
  } catch (error) {
    console.error("Support call message failed:", error.message);
    res.status(500).json({
      error: "Local AI is unavailable. Make sure Ollama is running."
    });
  }
});

router.post("/support-call-feedback", async (req, res) => {
  try {
    const { scenario, messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Call messages are required."
      });
    }

    const feedback = await generateAIResponse(
      buildSupportCallFeedbackPrompt({ scenario, messages }),
      { provider: "ollama", localOnly: true }
    );

    res.json({
      result: feedback
    });
  } catch (error) {
    console.error("Support call feedback failed:", error.message);
    res.status(500).json({
      error: "Local AI feedback is unavailable. Make sure Ollama is running."
    });
  }
});

router.post("/local-chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const validation = getValidLocalChatMessages(messages);

    if (validation.error) {
      return res.status(400).json({
        error: validation.error
      });
    }

    const reply = await generateAIResponse(buildLocalChatPrompt(validation.messages), {
      provider: "ollama",
      localOnly: true
    });

    res.json({
      reply: reply.trim()
    });
  } catch (error) {
    console.error("Local chat failed:", error.message);
    res.status(500).json({
      error: "Local AI is unavailable. Make sure Ollama is running."
    });
  }
});

router.post("/local-chat-stream", async (req, res) => {
  const { messages, think } = req.body;
  const validation = getValidLocalChatMessages(messages);

  if (validation.error) {
    return res.status(400).json({
      error: validation.error
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await callOllamaStream(buildLocalChatPrompt(validation.messages), {
      think: Boolean(think),
      onToken: (token) => {
        sendEvent("token", { token });
      }
    });

    sendEvent("done", {});
    res.end();
  } catch (error) {
    console.error("Local chat stream failed:", error.message);
    sendEvent("error", {
      error: "Local AI is unavailable. Make sure Ollama is running."
    });
    res.end();
  }
});

router.post("/save-lesson-progress", async (req, res) => {
  try {
    const result = await saveProgress(req.body);

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message
    });
  }
});

router.post("/save-question-attempt", async (req, res) => {
  try {
    const result = await saveQuestionAttempt(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

module.exports = router;
