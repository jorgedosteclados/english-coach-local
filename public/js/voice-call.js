const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const supportCallData = JSON.parse(document.getElementById("supportCallData").textContent);

const startCallBtn = document.getElementById("startCallBtn");
const speakCallBtn = document.getElementById("speakCallBtn");
const replayCustomerBtn = document.getElementById("replayCustomerBtn");
const endCallBtn = document.getElementById("endCallBtn");
const callStatus = document.getElementById("callStatus");
const callStatusDot = document.getElementById("callStatusDot");
const currentCustomerLine = document.getElementById("currentCustomerLine");
const callSupportMessage = document.getElementById("callSupportMessage");
const callTranscript = document.getElementById("callTranscript");
const callThread = document.getElementById("callThread");
const callTurnCount = document.getElementById("callTurnCount");
const callFeedback = document.getElementById("callFeedback");
const callFeedbackContent = document.getElementById("callFeedbackContent");
const scenarioSelect = document.getElementById("scenarioSelect");
const typedCallReply = document.getElementById("typedCallReply");
const sendTypedReplyBtn = document.getElementById("sendTypedReplyBtn");

const messages = [
  {
    role: "customer",
    content: supportCallData.initialMessage
  }
];

let recognition = null;
let currentAudio = null;
let currentSpeechUtterance = null;
let callStarted = false;
let isListening = false;
let isWaitingForCustomer = false;
let lastCustomerReply = supportCallData.initialMessage;

scenarioSelect.addEventListener("change", () => {
  scenarioSelect.form.submit();
});

startCallBtn.addEventListener("click", () => {
  callStarted = true;
  startCallBtn.disabled = true;
  speakCallBtn.disabled = !recognition;
  typedCallReply.disabled = false;
  sendTypedReplyBtn.disabled = false;
  endCallBtn.disabled = false;
  setCallStatus("In call", "active");
  callTranscript.textContent = "Tap Speak and answer the customer.";
  renderThread();
  playCustomerLine(lastCustomerReply).then(() => {
    if (callStarted && !isWaitingForCustomer && !isListening) {
      setCallStatus("Your turn", "active");
    }
  });
});

speakCallBtn.addEventListener("click", () => {
  startRecognition();
});

replayCustomerBtn.addEventListener("click", () => {
  playCustomerLine(lastCustomerReply);
});

endCallBtn.addEventListener("click", () => {
  finishCall();
});

sendTypedReplyBtn.addEventListener("click", () => {
  sendTypedReply();
});

typedCallReply.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    sendTypedReply();
  }
});

function setupRecognition() {
  if (!SpeechRecognition) {
    speakCallBtn.disabled = true;
    showSupportMessage("Speech recognition is not available in this browser. You can type your reply.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript.trim();
    callTranscript.textContent = transcript;
    handleSupportReply(transcript);
  });

  recognition.addEventListener("error", (event) => {
    setListening(false);

    if (event.error === "not-allowed") {
      showSupportMessage("Microphone access was blocked. You can type your reply below.");
      return;
    }

    showSupportMessage("I could not hear that clearly. Try again or type your reply below.");
  });

  recognition.addEventListener("end", () => {
    setListening(false);
  });
}

function startRecognition() {
  if (!callStarted || !recognition || isListening || isWaitingForCustomer) {
    return;
  }

  hideSupportMessage();
  callTranscript.textContent = "Listening...";
  setListening(true);
  recognition.start();
}

async function handleSupportReply(transcript) {
  const cleanTranscript = String(transcript || "").trim();

  if (!cleanTranscript) {
    showSupportMessage("No speech detected. Try again.");
    return;
  }

  messages.push({
    role: "support",
    content: cleanTranscript
  });
  typedCallReply.value = "";
  callTranscript.textContent = cleanTranscript;
  renderThread();
  await requestCustomerReply();
}

function sendTypedReply() {
  if (!callStarted || isWaitingForCustomer) {
    return;
  }

  handleSupportReply(typedCallReply.value);
}

async function requestCustomerReply() {
  isWaitingForCustomer = true;
  speakCallBtn.disabled = true;
  sendTypedReplyBtn.disabled = true;
  typedCallReply.disabled = true;
  setCallStatus("Customer is replying...", "thinking");

  try {
    const response = await fetch("/ai/support-call-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scenario: supportCallData.scenario,
        customerProfile: supportCallData.customerProfile,
        messages
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (!callStarted) {
      return;
    }

    lastCustomerReply = data.reply;
    currentCustomerLine.textContent = lastCustomerReply;
    messages.push({
      role: "customer",
      content: lastCustomerReply
    });
    renderThread();
    setCallStatus("Playing customer voice...", "thinking");
    await playCustomerLine(lastCustomerReply);
    if (!callStarted) {
      return;
    }
    setCallStatus("Your turn", "active");
  } catch (error) {
    console.error(error);
    showSupportMessage(error.message || "Local AI is unavailable. Make sure Ollama is running.");
    setCallStatus("Needs attention", "error");
  } finally {
    isWaitingForCustomer = false;
    speakCallBtn.disabled = !callStarted || !recognition;
    typedCallReply.disabled = !callStarted;
    sendTypedReplyBtn.disabled = !callStarted;
  }
}

async function playCustomerLine(text) {
  if (!text) {
    return false;
  }

  stopCurrentAudio();

  const params = new URLSearchParams({
    provider: "edge",
    voice: "en-US-JennyNeural",
    rate: "0.92",
    text
  });

  const audio = new Audio(`/reading/tts?${params.toString()}`);
  currentAudio = audio;

  const audioStarted = new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Generated audio timed out."));
    }, 18000);

    audio.addEventListener(
      "playing",
      () => {
        window.clearTimeout(timeoutId);
        resolve(true);
      },
      { once: true }
    );

    audio.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeoutId);
        reject(new Error("Generated audio failed."));
      },
      { once: true }
    );
  });

  try {
    await audio.play();
    await audioStarted;
    return true;
  } catch (error) {
    console.error(error);
    stopCurrentAudio();
    return speakWithBrowserVoice(text);
  }
}

function speakWithBrowserVoice(text) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    showSupportMessage("Audio playback is unavailable. Read the customer reply on screen.");
    return false;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const englishVoice = window.speechSynthesis
    .getVoices()
    .find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("en-us"));

  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  utterance.lang = "en-US";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  currentSpeechUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  showSupportMessage("Using browser voice fallback for this reply.");
  return true;
}

function stopCurrentAudio() {
  if (!currentAudio) {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    currentSpeechUtterance = null;
    return;
  }

  currentAudio.pause();
  currentAudio.removeAttribute("src");
  currentAudio.load();
  currentAudio = null;

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentSpeechUtterance = null;
}

async function finishCall() {
  if (!callStarted) {
    return;
  }

  stopCurrentAudio();
  callStarted = false;
  isListening = false;
  isWaitingForCustomer = false;
  speakCallBtn.textContent = "Speak";
  speakCallBtn.disabled = true;
  typedCallReply.disabled = true;
  sendTypedReplyBtn.disabled = true;
  endCallBtn.disabled = true;
  startCallBtn.disabled = false;
  setCallStatus("Call ended", "ended");
  callFeedback.classList.remove("hidden");
  callFeedbackContent.innerHTML = `
    <div class="feedback-box writing-loading">
      Preparing your call feedback...
      <br><br>
      Please wait a few seconds.
    </div>
  `;

  try {
    const response = await fetch("/ai/support-call-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scenario: supportCallData.scenario,
        messages
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    callFeedbackContent.innerHTML = `
      <div class="lesson-complete writing-complete">
        <div class="success-badge">✓</div>
        <h2>Call complete</h2>
        <p class="motivation-message">You practiced a realistic support call with a local AI customer.</p>
        ${typeof renderCallFeedback === "function" ? renderCallFeedback(data.result) : renderStructuredFeedback(data.result)}
        <button type="button" class="secondary-btn" id="restartCallBtn">Start Again</button>
      </div>
    `;
    document.getElementById("restartCallBtn").addEventListener("click", () => {
      window.location.reload();
    });
  } catch (error) {
    console.error(error);
    callFeedbackContent.innerHTML = `
      <div class="lesson-complete">
        <h2>Feedback unavailable</h2>
        <p class="motivation-message">${escapeHtml(error.message || "Make sure Ollama is running and try again.")}</p>
      </div>
    `;
  }
}

function renderThread() {
  callThread.innerHTML = messages
    .map(
      (message) => `
        <article class="conversation-message ${message.role === "support" ? "support" : "customer"}">
          <span>${message.role === "support" ? "You" : "Customer"}</span>
          <p>${escapeHtml(message.content)}</p>
        </article>
      `
    )
    .join("");

  const supportReplies = messages.filter((message) => message.role === "support").length;
  callTurnCount.textContent = `${supportReplies} support ${supportReplies === 1 ? "reply" : "replies"}`;
  callThread.scrollTop = callThread.scrollHeight;
}

function setListening(nextListeningState) {
  isListening = nextListeningState;
  speakCallBtn.textContent = isListening ? "Listening..." : "Speak";
  speakCallBtn.disabled = isListening || isWaitingForCustomer || !callStarted;
  sendTypedReplyBtn.disabled = isWaitingForCustomer || !callStarted;
  typedCallReply.disabled = isWaitingForCustomer || !callStarted;
  if (!callStarted) {
    return;
  }
  setCallStatus(isListening ? "Listening" : "Your turn", isListening ? "listening" : "active");
}

function setCallStatus(text, state) {
  callStatus.textContent = text;
  callStatusDot.className = state || "";
}

function showSupportMessage(message) {
  callSupportMessage.textContent = message;
  callSupportMessage.classList.remove("hidden");
}

function hideSupportMessage() {
  callSupportMessage.classList.add("hidden");
}

setupRecognition();
renderThread();
