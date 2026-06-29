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

function getOllamaConfig() {
  const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "qwen3:8b";

  return {
    endpoint: `${ollamaUrl.replace(/\/$/, "")}/api/chat`,
    model,
    timeout: Number(process.env.OLLAMA_TIMEOUT_MS) || 45000
  };
}

function buildOllamaPayload(prompt, options = {}) {
  return {
    model: getOllamaConfig().model,
    think: Boolean(options.think),
    stream: Boolean(options.stream),
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    options: {
      temperature: 0.45,
      num_predict: options.numPredict || 220
    }
  };
}

function createThinkingFilter() {
  let insideThinkBlock = false;

  return (chunk) => {
    let remaining = String(chunk || "");
    let visible = "";

    while (remaining) {
      const lower = remaining.toLowerCase();

      if (insideThinkBlock) {
        const endIndex = lower.indexOf("</think>");
        if (endIndex === -1) {
          return visible;
        }

        remaining = remaining.slice(endIndex + "</think>".length);
        insideThinkBlock = false;
        continue;
      }

      const startIndex = lower.indexOf("<think>");
      if (startIndex === -1) {
        visible += remaining;
        break;
      }

      visible += remaining.slice(0, startIndex);
      remaining = remaining.slice(startIndex + "<think>".length);
      insideThinkBlock = true;
    }

    return visible;
  };
}

async function callOllama(prompt, options = {}) {
  const config = getOllamaConfig();

  const response = await axios.post(
    config.endpoint,
    buildOllamaPayload(prompt, {
      think: options.think,
      stream: false,
      numPredict: options.numPredict
    }),
    {
      timeout: config.timeout
    }
  );

  const filterThinking = createThinkingFilter();
  return filterThinking(response.data.message.content);
}

async function callOllamaStream(prompt, options = {}) {
  const config = getOllamaConfig();
  const filterThinking = createThinkingFilter();

  const response = await axios.post(
    config.endpoint,
    buildOllamaPayload(prompt, {
      think: options.think,
      stream: true,
      numPredict: options.numPredict
    }),
    {
      responseType: "stream",
      timeout: config.timeout
    }
  );

  return new Promise((resolve, reject) => {
    let buffer = "";
    let fullResponse = "";

    response.data.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }

        try {
          const data = JSON.parse(trimmed);
          const content = data.message?.content || data.response || "";
          const visibleContent = filterThinking(content);

          if (visibleContent) {
            fullResponse += visibleContent;
            options.onToken?.(visibleContent);
          }

          if (data.done) {
            resolve(fullResponse);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    response.data.on("end", () => resolve(fullResponse));
    response.data.on("error", reject);
  });
}

async function generateAIResponse(prompt, options = {}) {
  if (options.provider === "ollama" || process.env.AI_PROVIDER === "ollama") {
    try {
      console.log("Trying Ollama...");
      return await callOllama(prompt, options);
    } catch (ollamaError) {
      console.error("Ollama failed:", ollamaError.message);

      if (options.localOnly) {
        throw ollamaError;
      }
    }
  }

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
  generateAIResponse,
  callOllama,
  callOllamaStream
};
