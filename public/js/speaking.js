const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const targetPhrase = document.getElementById("targetPhrase").textContent.trim();
const recordSpeechBtn = document.getElementById("recordSpeechBtn");
const tryAgainSpeechBtn = document.getElementById("tryAgainSpeechBtn");
const showBetterPhraseBtn = document.getElementById("showBetterPhraseBtn");
const completeSpeakingBtn = document.getElementById("completeSpeakingBtn");
const speechSupportMessage = document.getElementById("speechSupportMessage");
const speechTranscript = document.getElementById("speechTranscript");
const speakingFeedback = document.getElementById("speakingFeedback");
const betterPhrase = document.getElementById("betterPhrase");
const speakingResult = document.getElementById("speakingResult");
const speakingResultContent = document.getElementById("speakingResultContent");

let recognition = null;
let lastTranscript = "";
let lastScore = 0;
let isListening = false;
let progressSaved = false;

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function calculateScore(expectedText, spokenText) {
  const expectedWords = normalizeText(expectedText);
  const spokenWords = normalizeText(spokenText);

  if (expectedWords.length === 0 || spokenWords.length === 0) {
    return 0;
  }

  const matchedWords = expectedWords.filter((word) => spokenWords.includes(word));
  return Math.round((matchedWords.length / expectedWords.length) * 100);
}

function showSupportMessage(message) {
  speechSupportMessage.textContent = message;
  speechSupportMessage.classList.remove("hidden");
}

function hideSupportMessage() {
  speechSupportMessage.classList.add("hidden");
}

function renderFeedback(transcript) {
  lastScore = calculateScore(targetPhrase, transcript);

  let message = `Match score: ${lastScore}%. `;

  if (lastScore >= 80) {
    message += "Great work. Your spoken phrase is very close to the target.";
  } else if (lastScore >= 50) {
    message += "Good start. Try again slowly and focus on the missing words.";
  } else {
    message += "Try once more. Read the sentence in small chunks and keep your pace steady.";
  }

  speakingFeedback.textContent = message;
  speakingFeedback.classList.remove("hidden");
  completeSpeakingBtn.classList.remove("hidden");
  tryAgainSpeechBtn.classList.remove("hidden");
}

function setListeningState(nextListeningState) {
  isListening = nextListeningState;
  recordSpeechBtn.textContent = isListening ? "Listening..." : "Start Speaking";
  recordSpeechBtn.disabled = isListening;
}

function startRecognition() {
  if (!recognition || isListening) {
    return;
  }

  hideSupportMessage();
  speakingFeedback.classList.add("hidden");
  speechTranscript.textContent = "Listening...";
  setListeningState(true);
  recognition.start();
}

function setupRecognition() {
  if (!SpeechRecognition) {
    recordSpeechBtn.disabled = true;
    showSupportMessage(
      "Speech recognition is not available in this browser. Try Chrome or Edge and allow microphone access."
    );
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript.trim();

    lastTranscript = transcript;
    speechTranscript.textContent = transcript;
    renderFeedback(transcript);
  });

  recognition.addEventListener("error", (event) => {
    setListeningState(false);

    if (event.error === "not-allowed") {
      showSupportMessage("Microphone access was blocked. Allow microphone access and try again.");
      return;
    }

    showSupportMessage("I could not hear the phrase clearly. Try again in a quieter place.");
  });

  recognition.addEventListener("end", () => {
    setListeningState(false);

    if (!lastTranscript) {
      speechTranscript.textContent = "No speech detected yet.";
    }
  });
}

async function saveSpeakingProgress() {
  if (progressSaved) {
    return;
  }

  progressSaved = true;
  completeSpeakingBtn.disabled = true;
  completeSpeakingBtn.textContent = "Saving...";

  try {
    const response = await fetch("/ai/save-lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        xpEarned: 20,
        correctAnswers: lastScore >= 60 ? 1 : 0,
        wrongAnswers: lastScore >= 60 ? 0 : 1,
        unitId: 5
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error("Progress was not saved.");
    }

    speakingResultContent.innerHTML = `
      <div class="lesson-complete">
        <div class="success-badge">✓</div>
        <h2>Speaking complete!</h2>
        <p class="motivation-message">Nice work. You practiced a phrase you can use in real support calls.</p>
        <div class="completion-stats">
          <div>
            <span>20</span>
            <small>XP earned</small>
          </div>
          <div>
            <span>${lastScore}%</span>
            <small>Match score</small>
          </div>
        </div>
        <p class="save-status">Progress saved successfully.</p>
      </div>
    `;
  } catch (error) {
    console.error(error);
    progressSaved = false;
    completeSpeakingBtn.disabled = false;
    completeSpeakingBtn.textContent = "I Practiced This";
    speakingResultContent.innerHTML = `
      <div class="lesson-complete">
        <h2>Progress not saved</h2>
        <p class="motivation-message">Your practice worked, but progress could not be saved. Try again.</p>
      </div>
    `;
  }

  speakingResult.classList.remove("hidden");
}

recordSpeechBtn.addEventListener("click", () => {
  startRecognition();
});

tryAgainSpeechBtn.addEventListener("click", () => {
  lastTranscript = "";
  lastScore = 0;
  startRecognition();
});

showBetterPhraseBtn.addEventListener("click", () => {
  betterPhrase.classList.toggle("hidden");
  showBetterPhraseBtn.textContent = betterPhrase.classList.contains("hidden")
    ? "Show Better Version"
    : "Hide Better Version";
});

completeSpeakingBtn.addEventListener("click", () => {
  saveSpeakingProgress();
});

setupRecognition();
