const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const reviewCards = JSON.parse(document.getElementById("reviewCardsData").textContent);
const totalReviewCards = reviewCards.length;

const reviewProgress = document.getElementById("reviewProgress");
const reviewImage = document.getElementById("reviewImage");
const reviewCategory = document.getElementById("reviewCategory");
const reviewPrompt = document.getElementById("reviewPrompt");
const reviewContext = document.getElementById("reviewContext");
const reviewAnswer = document.getElementById("reviewAnswer");
const reviewAnswerBox = document.getElementById("reviewAnswerBox");
const reviewTargetPhrase = document.getElementById("reviewTargetPhrase");
const reviewTip = document.getElementById("reviewTip");
const reviewFeedback = document.getElementById("reviewFeedback");
const listenPhraseBtn = document.getElementById("listenPhraseBtn");
const speakReviewBtn = document.getElementById("speakReviewBtn");
const checkReviewBtn = document.getElementById("checkReviewBtn");
const nextReviewBtn = document.getElementById("nextReviewBtn");
const reviewResult = document.getElementById("reviewResult");
const reviewResultContent = document.getElementById("reviewResultContent");

let currentReviewIndex = 0;
let correctReviewAnswers = 0;
let wrongReviewAnswers = 0;
let recognition = null;
let isListening = false;

function normalizeReviewText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreReviewAnswer(expectedText, userText) {
  const expectedWords = normalizeReviewText(expectedText);
  const userWords = normalizeReviewText(userText);

  if (expectedWords.length === 0 || userWords.length === 0) {
    return 0;
  }

  const matchedWords = expectedWords.filter((word) => userWords.includes(word));
  return Math.round((matchedWords.length / expectedWords.length) * 100);
}

function getCurrentCard() {
  return reviewCards[currentReviewIndex];
}

function renderReviewCard() {
  const card = getCurrentCard();

  reviewProgress.textContent = `Card ${currentReviewIndex + 1} of ${totalReviewCards}`;
  reviewImage.src = card.image;
  reviewCategory.textContent = card.category;
  reviewPrompt.textContent = card.promptPt;
  reviewContext.textContent = card.contextPt;
  reviewTargetPhrase.textContent = card.targetPhrase;
  reviewTip.textContent = card.tipPt;
  reviewAnswer.value = "";
  reviewFeedback.classList.add("hidden");
  reviewAnswerBox.classList.add("hidden");
  checkReviewBtn.classList.remove("hidden");
  nextReviewBtn.classList.add("hidden");
}

function speakText(text) {
  if (!window.speechSynthesis) {
    reviewFeedback.textContent = "Audio playback is not available in this browser.";
    reviewFeedback.classList.remove("hidden");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function setupRecognition() {
  if (!SpeechRecognition) {
    speakReviewBtn.disabled = true;
    speakReviewBtn.textContent = "Speech unavailable";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript.trim();
    reviewAnswer.value = transcript;
  });

  recognition.addEventListener("error", (event) => {
    reviewFeedback.textContent =
      event.error === "not-allowed"
        ? "Microphone access was blocked. You can still type your answer."
        : "I could not hear clearly. Try again or type your answer.";
    reviewFeedback.classList.remove("hidden");
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    speakReviewBtn.textContent = "Speak";
    speakReviewBtn.disabled = false;
  });
}

function startSpeechAttempt() {
  if (!recognition || isListening) {
    return;
  }

  isListening = true;
  speakReviewBtn.textContent = "Listening...";
  speakReviewBtn.disabled = true;
  recognition.start();
}

function checkReviewAnswer() {
  const card = getCurrentCard();
  const answer = reviewAnswer.value.trim();

  if (!answer) {
    reviewFeedback.textContent = "Type or speak your answer first.";
    reviewFeedback.classList.remove("hidden");
    return;
  }

  const score = scoreReviewAnswer(card.targetPhrase, answer);
  const passed = score >= 70;

  if (passed) {
    correctReviewAnswers++;
  } else {
    wrongReviewAnswers++;
  }
  window.EnglishCoachSound?.play(passed ? "correct" : "incorrect");

  reviewAnswerBox.classList.remove("hidden");
  reviewFeedback.innerHTML = `
    <p><strong>${passed ? "Good recall." : "Keep practicing."}</strong> Match score: ${score}%.</p>
    <p>Professional version: ${escapeReviewHtml(card.professionalVersion)}</p>
  `;
  reviewFeedback.classList.remove("hidden");
  checkReviewBtn.classList.add("hidden");
  nextReviewBtn.classList.remove("hidden");
}

async function finishReview() {
  window.EnglishCoachSound?.play("complete");
  const xpEarned = correctReviewAnswers * 8 + wrongReviewAnswers * 3;

  reviewResult.classList.remove("hidden");
  reviewResultContent.innerHTML = `
    <div class="lesson-complete">
      <div class="success-badge">✓</div>
      <h2>Review complete!</h2>
      <p class="motivation-message">You practiced with visual memory, listening, and active recall.</p>
      <div class="completion-stats">
        <div>
          <span>${xpEarned}</span>
          <small>XP earned</small>
        </div>
        <div>
          <span>${correctReviewAnswers}/${totalReviewCards}</span>
          <small>Strong recall</small>
        </div>
      </div>
      <p class="save-status">Saving progress...</p>
      <div class="review-complete-actions"></div>
    </div>
  `;

  try {
    const response = await fetch("/ai/save-lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        xpEarned,
        correctAnswers: correctReviewAnswers,
        wrongAnswers: wrongReviewAnswers,
        unitId: null
      })
    });

    const data = await response.json();
    const saveStatus = reviewResultContent.querySelector(".save-status");

    saveStatus.textContent = data.success
      ? "Progress saved successfully."
      : "Progress could not be saved.";
    const nextHref = data.nextUnit?.href || "/progress";
    const continueLabel = data.nextUnit ? "Continue to next lesson" : "View final progress";
    reviewResultContent.querySelector(".review-complete-actions").innerHTML = `
      <a href="${nextHref}" class="primary-link">${continueLabel}</a>
      <a href="/" class="secondary-link">Back to learning path</a>
    `;
  } catch (error) {
    console.error(error);
    reviewResultContent.querySelector(".save-status").textContent = "Progress could not be saved.";
    reviewResultContent.querySelector(".review-complete-actions").innerHTML = `
      <a href="/" class="primary-link">Back to learning path</a>
    `;
  }
}

function escapeReviewHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

listenPhraseBtn.addEventListener("click", () => {
  speakText(getCurrentCard().targetPhrase);
});

speakReviewBtn.addEventListener("click", () => {
  startSpeechAttempt();
});

checkReviewBtn.addEventListener("click", () => {
  checkReviewAnswer();
});

nextReviewBtn.addEventListener("click", () => {
  currentReviewIndex++;

  if (currentReviewIndex >= totalReviewCards) {
    document.querySelector(".visual-review-card").classList.add("hidden");
    finishReview();
    return;
  }

  renderReviewCard();
});

setupRecognition();
renderReviewCard();
