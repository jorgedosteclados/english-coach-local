const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const lessonQuery = new URLSearchParams(window.location.search);
const requestedLessonUnitId = Number(lessonQuery.get("unit"));
const activeLessonUnitId = requestedLessonUnitId > 0 ? requestedLessonUnitId : 1;
const requestedLessonCategory = lessonQuery.get("category");

const totalQuestions = 5;
const lessonStateKey = `englishCoach.lesson.unit${activeLessonUnitId}.state`;
const exerciseTypes = [
  "multiple-choice",
  "listen-build",
  "listen-type",
  "speak",
  "multiple-choice"
];

let currentQuestion = null;
let questionNumber = 1;
let correctAnswers = 0;
let wrongAnswers = 0;
let xpEarned = 0;
let selectedOption = "";
let currentQuestionAnswered = false;
let lessonCompleted = false;
let lessonSaveInProgress = false;
let selectedButton = null;
let recognition = null;
let wordTokens = [];
let selectedWordTokenIds = [];

const lessonTitle = document.getElementById("lessonTitle");
const progressText = document.querySelector(".lesson-progress");
const questionText = document.querySelector(".question-text");
const optionsContainer = document.querySelector(".options");
const lessonFeedback = document.getElementById("lessonFeedback");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const restartLessonBtn = document.getElementById("restartLessonBtn");
const lessonCategorySelect = document.getElementById("lessonCategory");
const lessonProgressBar = document.getElementById("lessonProgressBar");
const lessonXpValue = document.getElementById("lessonXpValue");
const scoreDisplay = document.getElementById("scoreDisplay");
const confirmAnswerBtn = document.getElementById("confirmAnswerBtn");
const continueHomeBtn = document.getElementById("continueHomeBtn");

if (
  requestedLessonCategory &&
  [...(lessonCategorySelect?.options || [])].some((option) => option.value === requestedLessonCategory)
) {
  lessonCategorySelect.value = requestedLessonCategory;
}

let selectedCategory = lessonCategorySelect?.value || "all";

continueHomeBtn.addEventListener("click", () => {
  window.location.href = "/";
});

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedLessonProgress()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

function getExerciseType() {
  return exerciseTypes[questionNumber - 1] || "multiple-choice";
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateWordMatch(expectedText, actualText) {
  const expectedWords = normalizeText(expectedText).split(" ").filter(Boolean);
  const actualWords = normalizeText(actualText).split(" ").filter(Boolean);

  if (!expectedWords.length || !actualWords.length) {
    return 0;
  }

  const matches = expectedWords.filter((word, index) => actualWords[index] === word).length;
  return Math.round((matches / expectedWords.length) * 100);
}

function hasUnsavedLessonProgress() {
  return (
    !lessonCompleted &&
    (questionNumber > 1 || correctAnswers > 0 || wrongAnswers > 0 || Boolean(currentQuestion))
  );
}

function updateScoreDisplay() {
  scoreDisplay.innerHTML = `
    <span><strong>${correctAnswers}</strong> correct</span>
    <span><strong>${wrongAnswers}</strong> to review</span>
  `;
  lessonXpValue.textContent = xpEarned;
}

function saveLessonState() {
  if (lessonCompleted || !currentQuestion) {
    return;
  }

  localStorage.setItem(
    lessonStateKey,
    JSON.stringify({
      currentQuestion,
      questionNumber,
      correctAnswers,
      wrongAnswers,
      xpEarned,
      selectedOption,
      currentQuestionAnswered,
      selectedCategory
    })
  );
}

function clearLessonState() {
  localStorage.removeItem(lessonStateKey);
}

function restoreLessonState() {
  const savedState = localStorage.getItem(lessonStateKey);

  if (!savedState) {
    return false;
  }

  try {
    const state = JSON.parse(savedState);

    if (!state.currentQuestion || !Array.isArray(state.currentQuestion.options)) {
      clearLessonState();
      return false;
    }

    currentQuestion = state.currentQuestion;
    questionNumber = Number(state.questionNumber) || 1;
    correctAnswers = Number(state.correctAnswers) || 0;
    wrongAnswers = Number(state.wrongAnswers) || 0;
    xpEarned = Number(state.xpEarned) || 0;
    selectedOption = state.selectedOption || "";
    currentQuestionAnswered = Boolean(state.currentQuestionAnswered);
    selectedCategory = state.selectedCategory || "all";

    if (lessonCategorySelect) {
      lessonCategorySelect.value = selectedCategory;
    }

    showQuestionShell();
    renderQuestion(currentQuestion, selectedOption);
    updateScoreDisplay();

    if (currentQuestionAnswered) {
      renderRestoredAnswer();
    }

    return true;
  } catch (error) {
    console.error(error);
    clearLessonState();
    return false;
  }
}

function showQuestionShell() {
  lessonTitle.classList.remove("hidden");
  progressText.classList.remove("hidden");
  questionText.classList.remove("hidden");
  scoreDisplay.classList.remove("hidden");
  progressText.textContent = `Question ${questionNumber} of ${totalQuestions}`;
  lessonProgressBar.style.width = `${((questionNumber - 1) / totalQuestions) * 100}%`;
}

function playSound(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return;
  }

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = type === "correct" ? 880 : 220;
  gainNode.gain.value = 0.08;
  oscillator.start();

  setTimeout(() => {
    oscillator.stop();
    audioContext.close();
  }, 180);
}

function speakPhrase(rate = 0.88) {
  if (!window.speechSynthesis || !currentQuestion) {
    showTemporaryFeedback("Audio playback is not available in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentQuestion.correctAnswer);
  utterance.lang = "en-US";
  utterance.rate = rate;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function showTemporaryFeedback(message) {
  lessonFeedback.textContent = message;
  lessonFeedback.classList.remove("hidden");
}

async function loadQuestion() {
  selectedButton = null;
  selectedOption = "";
  currentQuestionAnswered = false;
  recognition?.abort?.();
  recognition = null;

  showQuestionShell();
  updateScoreDisplay();
  lessonTitle.textContent = "Preparing your exercise";
  questionText.textContent = "Loading your next question...";
  optionsContainer.innerHTML = "";
  lessonFeedback.className = "feedback-box hidden";
  nextQuestionBtn.classList.add("hidden");
  restartLessonBtn.classList.add("hidden");
  continueHomeBtn.classList.add("hidden");
  confirmAnswerBtn.classList.add("hidden");

  try {
    const response = await fetch("/ai/generate-lesson-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: selectedCategory })
    });
    const data = await response.json();

    if (data.error) {
      questionText.textContent = data.error;
      return;
    }

    currentQuestion = data;
    renderQuestion(currentQuestion);
    saveLessonState();
  } catch (error) {
    console.error(error);
    questionText.textContent = "Error loading lesson question.";
  }
}

function renderQuestion(question, restoredAnswer = "") {
  const exerciseType = getExerciseType();
  optionsContainer.className = `options exercise-${exerciseType}`;
  optionsContainer.innerHTML = "";

  if (exerciseType === "multiple-choice") {
    renderMultipleChoice(question, restoredAnswer);
  } else if (exerciseType === "listen-build") {
    renderListenBuild(question, restoredAnswer);
  } else if (exerciseType === "listen-type") {
    renderListenType(restoredAnswer);
  } else {
    renderSpeaking(question, restoredAnswer);
  }
}

function renderMultipleChoice(question, restoredAnswer) {
  lessonTitle.textContent = "How do you say this in English?";
  questionText.textContent = question.questionPt || question.question;

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;

    if (option === restoredAnswer) {
      selectedButton = button;
      button.classList.add("selected-option");
      confirmAnswerBtn.classList.remove("hidden");
    }

    button.addEventListener("click", () => selectAnswer(button, option));
    optionsContainer.appendChild(button);
  });
}

function createAudioControls() {
  const controls = document.createElement("div");
  controls.className = "lesson-audio-controls";

  const normalButton = document.createElement("button");
  normalButton.type = "button";
  normalButton.className = "lesson-audio-btn";
  normalButton.textContent = "Listen";
  normalButton.setAttribute("aria-label", "Play phrase");
  normalButton.addEventListener("click", () => speakPhrase(0.88));

  const slowButton = document.createElement("button");
  slowButton.type = "button";
  slowButton.className = "lesson-audio-btn slow";
  slowButton.textContent = "Slow";
  slowButton.setAttribute("aria-label", "Play phrase slowly");
  slowButton.addEventListener("click", () => speakPhrase(0.58));

  controls.append(normalButton, slowButton);
  return controls;
}

function renderListenBuild(question, restoredAnswer) {
  lessonTitle.textContent = "Listen and build the phrase";
  questionText.textContent = "Tap the words in the order you hear them.";
  optionsContainer.appendChild(createAudioControls());

  const answerZone = document.createElement("div");
  answerZone.className = "word-answer-zone";
  answerZone.id = "wordAnswerZone";
  answerZone.setAttribute("aria-label", "Your phrase");
  optionsContainer.appendChild(answerZone);

  const bank = document.createElement("div");
  bank.className = "word-bank";
  bank.id = "wordBank";
  optionsContainer.appendChild(bank);

  prepareWordTokens(question, restoredAnswer);
  renderWordTokens();
}

function prepareWordTokens(question, restoredAnswer) {
  const targetWords = question.correctAnswer.split(/\s+/).filter(Boolean);
  const normalizedTargetWords = new Set(targetWords.map(normalizeText));
  const distractors = question.options
    .filter((option) => option !== question.correctAnswer)
    .flatMap((option) => option.split(/\s+/))
    .filter((word) => !normalizedTargetWords.has(normalizeText(word)))
    .filter((word, index, words) => words.findIndex((item) => normalizeText(item) === normalizeText(word)) === index)
    .slice(0, 3);

  wordTokens = [...targetWords, ...distractors]
    .map((word, index) => ({ id: `${index}-${word}`, word }))
    .sort(() => Math.random() - 0.5);
  selectedWordTokenIds = [];

  const restoredWords = restoredAnswer.split(/\s+/).filter(Boolean);
  restoredWords.forEach((word) => {
    const token = wordTokens.find(
      (item) => !selectedWordTokenIds.includes(item.id) && normalizeText(item.word) === normalizeText(word)
    );

    if (token) {
      selectedWordTokenIds.push(token.id);
    }
  });
}

function renderWordTokens() {
  const answerZone = document.getElementById("wordAnswerZone");
  const bank = document.getElementById("wordBank");
  answerZone.innerHTML = "";
  bank.innerHTML = "";

  selectedWordTokenIds.forEach((tokenId) => {
    const token = wordTokens.find((item) => item.id === tokenId);
    const button = createWordButton(token, true);
    answerZone.appendChild(button);
  });

  wordTokens
    .filter((token) => !selectedWordTokenIds.includes(token.id))
    .forEach((token) => bank.appendChild(createWordButton(token, false)));

  selectedOption = selectedWordTokenIds
    .map((id) => wordTokens.find((token) => token.id === id)?.word)
    .filter(Boolean)
    .join(" ");
  confirmAnswerBtn.classList.toggle("hidden", !selectedOption);
  saveLessonState();
}

function createWordButton(token, selected) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `word-token${selected ? " selected" : ""}`;
  button.textContent = token.word;
  button.dataset.tokenId = token.id;
  button.addEventListener("click", () => {
    if (currentQuestionAnswered) {
      return;
    }

    if (selected) {
      selectedWordTokenIds = selectedWordTokenIds.filter((id) => id !== token.id);
    } else {
      selectedWordTokenIds.push(token.id);
    }

    renderWordTokens();
  });
  return button;
}

function renderListenType(restoredAnswer) {
  lessonTitle.textContent = "Listen and type what you hear";
  questionText.textContent = "You can play the phrase as many times as you need.";
  optionsContainer.appendChild(createAudioControls());

  const input = document.createElement("textarea");
  input.id = "lessonTypedAnswer";
  input.className = "lesson-answer-input";
  input.placeholder = "Type the English phrase...";
  input.value = restoredAnswer;
  input.addEventListener("input", () => updateTextAnswer(input.value));
  optionsContainer.appendChild(input);
  updateTextAnswer(restoredAnswer);
}

function renderSpeaking(question, restoredAnswer) {
  lessonTitle.textContent = "Speak this phrase";
  questionText.textContent = question.correctAnswer;
  optionsContainer.appendChild(createAudioControls());

  const recordButton = document.createElement("button");
  recordButton.type = "button";
  recordButton.id = "lessonRecordButton";
  recordButton.className = "lesson-record-btn";
  recordButton.textContent = SpeechRecognition ? "Start speaking" : "Microphone unavailable";
  recordButton.disabled = !SpeechRecognition;
  optionsContainer.appendChild(recordButton);

  const input = document.createElement("textarea");
  input.id = "lessonSpokenAnswer";
  input.className = "lesson-answer-input speech-answer-input";
  input.placeholder = SpeechRecognition
    ? "Your words will appear here. You can also type your answer."
    : "Type the phrase here to continue.";
  input.value = restoredAnswer;
  input.addEventListener("input", () => updateTextAnswer(input.value));
  optionsContainer.appendChild(input);
  updateTextAnswer(restoredAnswer);

  if (SpeechRecognition) {
    setupLessonRecognition(recordButton, input);
  }
}

function setupLessonRecognition(recordButton, input) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", (event) => {
    input.value = event.results[0][0].transcript.trim();
    updateTextAnswer(input.value);
  });
  recognition.addEventListener("error", (event) => {
    recordButton.textContent = "Try speaking again";
    showTemporaryFeedback(
      event.error === "not-allowed"
        ? "Microphone access was blocked. You can type the phrase instead."
        : "I could not hear clearly. Try again or type the phrase."
    );
  });
  recognition.addEventListener("end", () => {
    recordButton.disabled = false;
    recordButton.textContent = "Speak again";
  });
  recordButton.addEventListener("click", () => {
    lessonFeedback.classList.add("hidden");
    recordButton.disabled = true;
    recordButton.textContent = "Listening...";
    recognition.start();
  });
}

function updateTextAnswer(value) {
  selectedOption = value.trim();
  confirmAnswerBtn.classList.toggle("hidden", !selectedOption);
  saveLessonState();
}

function selectAnswer(button, option) {
  if (currentQuestionAnswered) {
    return;
  }

  document.querySelectorAll(".option-btn").forEach((item) => item.classList.remove("selected-option"));
  selectedButton = button;
  selectedOption = option;
  button.classList.add("selected-option");
  lessonFeedback.classList.add("hidden");
  confirmAnswerBtn.classList.remove("hidden");
  saveLessonState();
}

function isCurrentAnswerCorrect() {
  if (getExerciseType() === "speak") {
    return calculateWordMatch(currentQuestion.correctAnswer, selectedOption) >= 70;
  }

  return normalizeText(selectedOption) === normalizeText(currentQuestion.correctAnswer);
}

function checkAnswer() {
  if (!selectedOption || currentQuestionAnswered) {
    showTemporaryFeedback("Complete your answer first.");
    return;
  }

  const isCorrect = isCurrentAnswerCorrect();
  const explanation = currentQuestion.explanationPt || currentQuestion.explanation;
  currentQuestionAnswered = true;

  if (isCorrect) {
    correctAnswers++;
    xpEarned += 10;
    playSound("correct");
    lessonFeedback.textContent = `Correct! +10 XP. ${explanation}`;
    lessonFeedback.className = "feedback-box correct-feedback";
  } else {
    wrongAnswers++;
    playSound("wrong");
    lessonFeedback.textContent = `Not quite. Correct answer: ${currentQuestion.correctAnswer}. ${explanation}`;
    lessonFeedback.className = "feedback-box wrong-feedback";
  }

  if (getExerciseType() === "multiple-choice") {
    renderAnsweredOptions();
  } else {
    optionsContainer.querySelectorAll("button, textarea").forEach((control) => {
      if (!control.classList.contains("lesson-audio-btn")) {
        control.disabled = true;
      }
    });
  }

  lessonProgressBar.style.width = `${(questionNumber / totalQuestions) * 100}%`;
  updateScoreDisplay();
  saveLessonState();
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.remove("hidden");
}

function renderAnsweredOptions() {
  document.querySelectorAll(".option-btn").forEach((button) => {
    button.disabled = true;

    if (button.textContent === currentQuestion.correctAnswer) {
      button.classList.add("correct-option");
    } else if (button.textContent === selectedOption) {
      button.classList.add("wrong-option");
    }
  });
}

function renderRestoredAnswer() {
  const isCorrect = isCurrentAnswerCorrect();
  const explanation = currentQuestion.explanationPt || currentQuestion.explanation;

  if (getExerciseType() === "multiple-choice") {
    renderAnsweredOptions();
  } else {
    optionsContainer.querySelectorAll("button, textarea").forEach((control) => {
      if (!control.classList.contains("lesson-audio-btn")) {
        control.disabled = true;
      }
    });
  }

  lessonFeedback.textContent = isCorrect
    ? `Correct! +10 XP. ${explanation}`
    : `Not quite. Correct answer: ${currentQuestion.correctAnswer}. ${explanation}`;
  lessonFeedback.className = `feedback-box ${isCorrect ? "correct-feedback" : "wrong-feedback"}`;
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.remove("hidden");
  lessonProgressBar.style.width = `${(questionNumber / totalQuestions) * 100}%`;
}

async function finishLesson() {
  if (lessonSaveInProgress) {
    return;
  }

  lessonSaveInProgress = true;
  lessonCompleted = true;
  clearLessonState();
  lessonTitle.classList.add("hidden");
  progressText.classList.add("hidden");
  questionText.classList.add("hidden");
  scoreDisplay.classList.add("hidden");
  lessonProgressBar.style.width = "100%";
  optionsContainer.innerHTML = "";
  lessonFeedback.className = "feedback-box";
  renderCompletionScreen("Saving...", "Saving your progress...");
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.add("hidden");
  continueHomeBtn.classList.add("hidden");
  restartLessonBtn.classList.add("hidden");

  try {
    const response = await fetch("/ai/save-lesson-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        xpEarned,
        correctAnswers,
        wrongAnswers,
        unitId: activeLessonUnitId
      })
    });
    const data = await response.json();
    renderCompletionScreen(
      data.success ? `${data.streakDays} day` : "Not saved",
      data.success ? "Progress saved successfully." : "Progress could not be saved."
    );
  } catch (error) {
    console.error(error);
    renderCompletionScreen("Not saved", "Progress could not be saved.");
  }

  continueHomeBtn.classList.remove("hidden");
  restartLessonBtn.classList.remove("hidden");
}

function renderCompletionScreen(streakText, saveStatus) {
  lessonFeedback.innerHTML = `
    <div class="lesson-complete">
      <div class="success-badge">✓</div>
      <h2>Lesson complete!</h2>
      <p class="motivation-message">Great work. You practiced reading, listening, writing, and speaking for real support situations.</p>
      <div class="completion-stats">
        <div><span>${xpEarned}</span><small>XP earned</small></div>
        <div><span>${correctAnswers}/${totalQuestions}</span><small>Correct</small></div>
        <div><span>${wrongAnswers}</span><small>To review</small></div>
        <div><span>${streakText}</span><small>Current streak</small></div>
      </div>
      <p class="save-status">${saveStatus}</p>
    </div>
  `;
}

function restartLesson() {
  currentQuestion = null;
  questionNumber = 1;
  correctAnswers = 0;
  wrongAnswers = 0;
  xpEarned = 0;
  selectedButton = null;
  selectedOption = "";
  currentQuestionAnswered = false;
  lessonCompleted = false;
  lessonSaveInProgress = false;
  selectedCategory = lessonCategorySelect?.value || "all";
  clearLessonState();
  updateScoreDisplay();
  loadQuestion();
}

confirmAnswerBtn.addEventListener("click", checkAnswer);
nextQuestionBtn.addEventListener("click", () => {
  questionNumber++;

  if (questionNumber > totalQuestions) {
    finishLesson();
  } else {
    loadQuestion();
  }
});
restartLessonBtn.addEventListener("click", restartLesson);
lessonCategorySelect?.addEventListener("change", restartLesson);

if (!restoreLessonState()) {
  loadQuestion();
}
