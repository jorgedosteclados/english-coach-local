const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const requestedSpeakingUnitId = Number(new URLSearchParams(window.location.search).get("unit"));
const speakingUnitId = requestedSpeakingUnitId > 0 ? requestedSpeakingUnitId : 5;

const speakingScenario = document.getElementById("speakingScenario").textContent.trim();
const targetPhrase = document.getElementById("targetPhrase").textContent.trim();
const recordSpeechBtn = document.getElementById("recordSpeechBtn");
const tryAgainSpeechBtn = document.getElementById("tryAgainSpeechBtn");
const listenTargetBtn = document.getElementById("listenTargetBtn");
const listenSlowBtn = document.getElementById("listenSlowBtn");
const completeSpeakingBtn = document.getElementById("completeSpeakingBtn");
const speechSupportMessage = document.getElementById("speechSupportMessage");
const speechTranscript = document.getElementById("speechTranscript");
const speakingFeedback = document.getElementById("speakingFeedback");
const speakingResult = document.getElementById("speakingResult");
const speakingResultContent = document.getElementById("speakingResultContent");
const speakingCard = document.getElementById("speakingCard");

let recognition = null;
let lastTranscript = "";
let lastScore = 0;
let isListening = false;
let progressSaved = false;
let feedbackRequestId = 0;

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function calculateScore(expectedText, spokenText) {
  return alignWords(expectedText, spokenText).score;
}

function alignWords(expectedText, spokenText) {
  const expectedWords = normalizeText(expectedText);
  const spokenWords = normalizeText(spokenText);

  if (expectedWords.length === 0 || spokenWords.length === 0) {
    return {
      score: 0,
      items: expectedWords.map((word) => ({ type: "missing", expected: word }))
    };
  }

  const matrix = Array.from({ length: expectedWords.length + 1 }, () =>
    Array(spokenWords.length + 1).fill(0)
  );

  for (let expectedIndex = 0; expectedIndex <= expectedWords.length; expectedIndex++) {
    matrix[expectedIndex][0] = expectedIndex;
  }

  for (let spokenIndex = 0; spokenIndex <= spokenWords.length; spokenIndex++) {
    matrix[0][spokenIndex] = spokenIndex;
  }

  for (let expectedIndex = 1; expectedIndex <= expectedWords.length; expectedIndex++) {
    for (let spokenIndex = 1; spokenIndex <= spokenWords.length; spokenIndex++) {
      const substitutionCost =
        expectedWords[expectedIndex - 1] === spokenWords[spokenIndex - 1] ? 0 : 1;
      matrix[expectedIndex][spokenIndex] = Math.min(
        matrix[expectedIndex - 1][spokenIndex] + 1,
        matrix[expectedIndex][spokenIndex - 1] + 1,
        matrix[expectedIndex - 1][spokenIndex - 1] + substitutionCost
      );
    }
  }

  const items = [];
  let expectedIndex = expectedWords.length;
  let spokenIndex = spokenWords.length;

  while (expectedIndex > 0 || spokenIndex > 0) {
    const expectedWord = expectedWords[expectedIndex - 1];
    const spokenWord = spokenWords[spokenIndex - 1];

    if (
      expectedIndex > 0 &&
      spokenIndex > 0 &&
      expectedWord === spokenWord &&
      matrix[expectedIndex][spokenIndex] === matrix[expectedIndex - 1][spokenIndex - 1]
    ) {
      items.push({ type: "match", expected: expectedWord, spoken: spokenWord });
      expectedIndex--;
      spokenIndex--;
    } else if (
      expectedIndex > 0 &&
      spokenIndex > 0 &&
      matrix[expectedIndex][spokenIndex] === matrix[expectedIndex - 1][spokenIndex - 1] + 1
    ) {
      items.push({ type: "different", expected: expectedWord, spoken: spokenWord });
      expectedIndex--;
      spokenIndex--;
    } else if (
      expectedIndex > 0 &&
      matrix[expectedIndex][spokenIndex] === matrix[expectedIndex - 1][spokenIndex] + 1
    ) {
      items.push({ type: "missing", expected: expectedWord });
      expectedIndex--;
    } else {
      items.push({ type: "extra", spoken: spokenWord });
      spokenIndex--;
    }
  }

  items.reverse();
  const matches = items.filter((item) => item.type === "match").length;
  const score = Math.round((matches / Math.max(expectedWords.length, spokenWords.length)) * 100);

  return { score, items };
}

function showSupportMessage(message) {
  speechSupportMessage.textContent = message;
  speechSupportMessage.classList.remove("hidden");
}

function hideSupportMessage() {
  speechSupportMessage.classList.add("hidden");
}

function renderFeedback(transcript) {
  const alignment = alignWords(targetPhrase, transcript);
  lastScore = alignment.score;
  const summary =
    lastScore >= 80
      ? "Strong match. Your phrase is very close to the target."
      : lastScore >= 50
        ? "Good start. Review the highlighted words and try once more."
        : "Try again in smaller chunks and use the slow reference audio.";

  speakingFeedback.innerHTML = `
    <div class="speaking-feedback-summary">
      <div class="speaking-score"><strong>${lastScore}%</strong><span>word match</span></div>
      <div><h3>Recognition result</h3><p>${summary}</p></div>
    </div>
    <div class="speaking-word-review">
      <span>Target comparison</span>
      <div>${renderAlignedWords(alignment.items)}</div>
    </div>
    <p class="speaking-score-note">This score compares the speech-recognition transcript with the target phrase. It does not directly measure pronunciation.</p>
    <details class="speaking-ai-details">
      <summary>View detailed AI feedback</summary>
      <div id="speakingAiDetails"><p class="ai-feedback-loading">Preparing feedback...</p></div>
    </details>
  `;
  speakingFeedback.classList.remove("hidden");
  completeSpeakingBtn.classList.remove("hidden");
  tryAgainSpeechBtn.classList.remove("hidden");
  recordSpeechBtn.classList.add("hidden");
  loadAISpeakingFeedback(transcript);
}

function renderAlignedWords(items) {
  return items
    .map((item) => {
      if (item.type === "match") {
        return `<span class="word-match">${escapeHtml(item.expected)}</span>`;
      }

      if (item.type === "different") {
        return `<span class="word-different" title="Recognized: ${escapeHtml(item.spoken)}">${escapeHtml(item.expected)}</span>`;
      }

      if (item.type === "missing") {
        return `<span class="word-missing" title="Not recognized">${escapeHtml(item.expected)}</span>`;
      }

      return `<span class="word-extra" title="Extra recognized word">+${escapeHtml(item.spoken)}</span>`;
    })
    .join(" ");
}

async function loadAISpeakingFeedback(transcript) {
  const currentRequestId = feedbackRequestId + 1;
  feedbackRequestId = currentRequestId;

  try {
    const response = await fetch("/ai/speaking-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scenario: speakingScenario,
        targetPhrase,
        transcript,
        score: lastScore
      })
    });

    const data = await response.json();

    if (currentRequestId !== feedbackRequestId) {
      return;
    }

    if (data.error) {
      throw new Error(data.error);
    }

    const detailsContainer = document.getElementById("speakingAiDetails");

    if (detailsContainer) {
      detailsContainer.innerHTML = renderStructuredFeedback(data.result);
    }
  } catch (error) {
    console.error(error);

    if (currentRequestId !== feedbackRequestId) {
      return;
    }

    const detailsContainer = document.getElementById("speakingAiDetails");

    if (detailsContainer) {
      detailsContainer.innerHTML =
        '<p class="ai-feedback-loading">Detailed AI feedback is unavailable right now.</p>';
    }
  }
}

function setListeningState(nextListeningState) {
  isListening = nextListeningState;
  recordSpeechBtn.textContent = isListening ? "Listening..." : "Start Speaking";
  recordSpeechBtn.disabled = isListening;
  tryAgainSpeechBtn.textContent = isListening ? "Listening..." : "Try Again";
  tryAgainSpeechBtn.disabled = isListening;
}

function startRecognition() {
  if (!recognition || isListening) {
    return;
  }

  hideSupportMessage();
  speakingFeedback.classList.add("hidden");
  completeSpeakingBtn.classList.add("hidden");
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
        unitId: speakingUnitId
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error("Progress was not saved.");
    }
    window.EnglishCoachSound?.play("complete");

    const nextHref = data.nextUnit?.href || "/progress";
    const continueLabel = data.nextUnit ? "Continue to next lesson" : "View final progress";

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
        <div class="speaking-complete-actions">
          <a href="${nextHref}" class="primary-link">${continueLabel}</a>
          <a href="/" class="secondary-link">Back to learning path</a>
          <button type="button" class="secondary-btn" id="practiceSpeakingAgainBtn">Practice again</button>
        </div>
      </div>
    `;

    speakingCard.classList.add("hidden");
    speakingResult.classList.remove("hidden");
    document.getElementById("practiceSpeakingAgainBtn").addEventListener("click", () => {
      window.location.reload();
    });
    speakingResult.scrollIntoView({ behavior: "smooth", block: "start" });
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
    speakingResult.classList.remove("hidden");
  }
}

recordSpeechBtn.addEventListener("click", () => {
  startRecognition();
});

tryAgainSpeechBtn.addEventListener("click", () => {
  lastTranscript = "";
  lastScore = 0;
  startRecognition();
});

function speakTarget(rate) {
  if (!window.speechSynthesis) {
    showSupportMessage("Reference audio is not available in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(targetPhrase);
  utterance.lang = "en-US";
  utterance.rate = rate;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

listenTargetBtn.addEventListener("click", () => speakTarget(0.88));
listenSlowBtn.addEventListener("click", () => speakTarget(0.58));

completeSpeakingBtn.addEventListener("click", () => {
  saveSpeakingProgress();
});

setupRecognition();
