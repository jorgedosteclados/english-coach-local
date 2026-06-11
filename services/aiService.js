const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function callGemini(prompt) {
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt
  });

  return response.text;
}

async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content;
}

async function callOpenRouter(prompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "qwen/qwen-2.5-72b-instruct:free",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "English Coach Local"
      }
    }
  );

  return response.data.choices[0].message.content;
}

async function generateAIResponse(prompt) {
  try {
    console.log("Trying Gemini...");
    return await callGemini(prompt);
  } catch (geminiError) {
    console.error("Gemini failed:", geminiError.message);
  }

  try {
    console.log("Trying Groq...");
    return await callGroq(prompt);
  } catch (groqError) {
    console.error("Groq failed:", groqError.message);
  }

  try {
    console.log("Trying OpenRouter...");
    return await callOpenRouter(prompt);
  } catch (openRouterError) {
    console.error("OpenRouter failed:", openRouterError.message);
  }

  return "Sorry, all AI providers are currently unavailable. Please try again later.";
}

module.exports = {
  generateAIResponse
};