const localAiThread = document.getElementById("localAiThread");
const localAiForm = document.getElementById("localAiForm");
const localAiInput = document.getElementById("localAiInput");
const sendLocalAiBtn = document.getElementById("sendLocalAiBtn");
const clearLocalAiBtn = document.getElementById("clearLocalAiBtn");
const localAiThinking = document.getElementById("localAiThinking");
const quickPromptButtons = document.querySelectorAll(".local-ai-prompts button");
const localAiStorageKey = "englishCoach.localAi.messages";

let localAiMessages = loadLocalAiMessages();
let localAiSending = false;

if (localAiMessages.length === 0) {
  localAiMessages = [
    {
      role: "assistant",
      content:
        "Hi. I am your local AI through Ollama. Send me a sentence, a call situation, or a technical support phrase."
    }
  ];
}

renderLocalAiThread();

localAiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendLocalAiMessage();
});

localAiInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    sendLocalAiMessage();
  }
});

clearLocalAiBtn.addEventListener("click", () => {
  localAiMessages = [
    {
      role: "assistant",
      content:
        "Chat cleared. Send me a phrase from a call, or ask me to practice a support conversation."
    }
  ];
  saveLocalAiMessages();
  renderLocalAiThread();
  localAiInput.focus();
});

quickPromptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    localAiInput.value = button.dataset.prompt || "";
    localAiInput.focus();
  });
});

async function sendLocalAiMessage() {
  const text = localAiInput.value.trim();

  if (!text || localAiSending) {
    return;
  }

  localAiSending = true;
  sendLocalAiBtn.disabled = true;
  sendLocalAiBtn.textContent = "Writing...";
  localAiInput.value = "";

  localAiMessages.push({ role: "user", content: text });
  localAiMessages.push({ role: "assistant", content: "", pending: true });
  renderLocalAiThread();

  try {
    const reply = await streamLocalAiReply({
      messages: getRequestMessages(),
      think: Boolean(localAiThinking?.checked)
    });

    replacePendingMessage(reply || "I could not generate a reply.");
    window.EnglishCoachSound?.play("complete");
  } catch (error) {
    console.error(error);
    replacePendingMessage(error.message || "Local AI is unavailable. Make sure Ollama is running.");
  } finally {
    localAiSending = false;
    sendLocalAiBtn.disabled = false;
    sendLocalAiBtn.textContent = "Send";
    saveLocalAiMessages();
    renderLocalAiThread();
    localAiInput.focus();
  }
}

function getRequestMessages() {
  return localAiMessages
    .filter((message) => !message.pending)
    .slice(-12)
    .map(({ role, content }) => ({ role, content }));
}

async function streamLocalAiReply(payload) {
  const response = await fetch("/ai/local-chat-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = "Local AI is unavailable. Make sure Ollama is running.";
    try {
      const data = await response.json();
      message = data.error || message;
    } catch (error) {
      // Keep the friendly fallback message.
    }
    throw new Error(message);
  }

  if (!response.body) {
    return fetchLocalAiReply(payload);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let done = false;

  while (!done) {
    const readResult = await reader.read();
    done = readResult.done;
    buffer += decoder.decode(readResult.value || new Uint8Array(), { stream: !done });

    const eventBlocks = buffer.split("\n\n");
    buffer = eventBlocks.pop() || "";

    eventBlocks.forEach((eventBlock) => {
      const parsedEvent = parseStreamEvent(eventBlock);

      if (parsedEvent.event === "error") {
        throw new Error(parsedEvent.data?.error || "Local AI is unavailable.");
      }

      if (parsedEvent.event === "token" && parsedEvent.data?.token) {
        reply += parsedEvent.data.token;
        replacePendingMessage(reply, true);
        renderLocalAiThread();
      }
    });
  }

  return reply.trim();
}

async function fetchLocalAiReply(payload) {
  const response = await fetch("/ai/local-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: payload.messages,
      think: payload.think
    })
  });
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.reply || "";
}

function parseStreamEvent(eventBlock) {
  const lines = eventBlock.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s?/, ""));

  try {
    return {
      event: eventLine ? eventLine.replace(/^event:\s?/, "") : "message",
      data: dataLines.length ? JSON.parse(dataLines.join("\n")) : {}
    };
  } catch (error) {
    return {
      event: "error",
      data: {
        error: "Could not read the local AI stream."
      }
    };
  }
}

function replacePendingMessage(content, keepPending = false) {
  const pendingIndex = localAiMessages.findIndex((message) => message.pending);
  if (pendingIndex >= 0) {
    localAiMessages[pendingIndex] = { role: "assistant", content, pending: keepPending };
    return;
  }

  localAiMessages.push({ role: "assistant", content });
}

function renderLocalAiThread() {
  localAiThread.innerHTML = localAiMessages.map(renderLocalAiMessage).join("");
  localAiThread.scrollTop = localAiThread.scrollHeight;
}

function renderLocalAiMessage(message) {
  const isUser = message.role === "user";
  const content = message.content || (message.pending ? "Writing..." : "");
  return `
    <article class="local-ai-message ${isUser ? "user" : "assistant"} ${message.pending ? "pending" : ""}">
      <span>${isUser ? "You" : "Local AI"}</span>
      <p>${escapeHtml(content)}</p>
    </article>
  `;
}

function loadLocalAiMessages() {
  try {
    const savedMessages = JSON.parse(localStorage.getItem(localAiStorageKey));
    return Array.isArray(savedMessages)
      ? savedMessages.filter((message) => message?.role && message?.content).slice(-20)
      : [];
  } catch (error) {
    return [];
  }
}

function saveLocalAiMessages() {
  localStorage.setItem(
    localAiStorageKey,
    JSON.stringify(localAiMessages.filter((message) => !message.pending).slice(-20))
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
