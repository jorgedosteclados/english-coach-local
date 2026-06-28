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

const messages = [
  {
    role: "customer",
    content: supportCallData.initialMessage
  }
];

let recognition = null;
let currentAudio = null;
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
  endCallBtn.disabled = false;
  setCallStatus("In call", "active");
  callTranscript.textContent = "Tap Speak and answer the customer.";
  renderThread();
  playCustomerLine(lastCustomerReply);
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

function setupRecognition() {
  if (!SpeechRecognition) {
    speakCallBtn.disabled = true;
    showSupportMessage("Speech recognition is not available in this browser. Try Chrome or Edge.");
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
      showSupportMessage("Microphone access was blocked. Allow microphone access and try again.");
      return;
    }

    showSupportMessage("I could not hear that clearly. Try again in a quieter place.");
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
  if (!transcript) {
    showSupportMessage("No speech detected. Try again.");
    return;
  }

  messages.push({
    role: "support",
    content: transcript
  });
  renderThread();
  await requestCustomerReply();
}

async function requestCustomerReply() {
  isWaitingForCustomer = true;
  speakCallBtn.disabled = true;
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
  }
}

async function playCustomerLine(text) {
  if (!text) {
    return;
  }

  stopCurrentAudio();

  const params = new URLSearchParams({
    provider: "edge",
    voice: "en-US-JennyNeural",
    rate: "0.92",
    text
  });

  currentAudio = new Audio(`/reading/tts?${params.toString()}`);

  try {
    await currentAudio.play();
  } catch (error) {
    console.error(error);
    showSupportMessage("Audio playback was blocked. Use Listen again to play the customer voice.");
  }
}

function stopCurrentAudio() {
  if (!currentAudio) {
    return;
  }

  currentAudio.pause();
  currentAudio.removeAttribute("src");
  currentAudio.load();
  currentAudio = null;
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
        ${renderStructuredFeedback(data.result)}
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
