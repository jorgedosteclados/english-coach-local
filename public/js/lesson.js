let currentQuestion = null;
let questionNumber = 1;
const totalQuestions = 5;
const lessonStateKey = "englishCoach.lesson.unit1.state";

let correctAnswers = 0;
let wrongAnswers = 0;
let xpEarned = 0;

let selectedButton = null;
let selectedOption = null;
let currentQuestionAnswered = false;
let lessonCompleted = false;
let lessonSaveInProgress = false;

const lessonTitle = document.getElementById("lessonTitle");
const progressText = document.querySelector(".lesson-progress");
const questionText = document.querySelector(".question-text");
const optionsContainer = document.querySelector(".options");
const lessonFeedback = document.getElementById("lessonFeedback");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const restartLessonBtn = document.getElementById("restartLessonBtn");
const lessonCategorySelect = document.getElementById("lessonCategory");

let selectedCategory = lessonCategorySelect ? lessonCategorySelect.value : "all";

const scoreDisplay = document.createElement("div");
scoreDisplay.className = "score-display";
progressText.insertAdjacentElement("afterend", scoreDisplay);

const confirmAnswerBtn = document.createElement("button");
confirmAnswerBtn.textContent = "Confirm Answer";
confirmAnswerBtn.className = "hidden";
confirmAnswerBtn.style.marginTop = "14px";

const continueHomeBtn = document.createElement("button");
continueHomeBtn.textContent = "Continue";
continueHomeBtn.className = "continue-home-btn hidden";
continueHomeBtn.addEventListener("click", () => {
  window.location.href = "/units";
});

nextQuestionBtn.insertAdjacentElement("beforebegin", confirmAnswerBtn);
restartLessonBtn.insertAdjacentElement("beforebegin", continueHomeBtn);

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedLessonProgress()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

function hasUnsavedLessonProgress() {
  return (
    !lessonCompleted &&
    (questionNumber > 1 ||
      correctAnswers > 0 ||
      wrongAnswers > 0 ||
      xpEarned > 0 ||
      Boolean(currentQuestion))
  );
}

function updateScoreDisplay() {
  scoreDisplay.textContent = `XP: ${xpEarned} | Correct: ${correctAnswers} | Wrong: ${wrongAnswers}`;
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
    selectedOption = state.selectedOption || null;
    currentQuestionAnswered = Boolean(state.currentQuestionAnswered);
    selectedCategory = state.selectedCategory || "all";

    if (lessonCategorySelect) {
      lessonCategorySelect.value = selectedCategory;
    }

    showQuestionShell();
    renderQuestion(currentQuestion);
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

  lessonTitle.textContent = "How do you say:";
  progressText.textContent = `Question ${questionNumber} of ${totalQuestions}`;
}

function playSound(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContext();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (type === "correct") {
    oscillator.frequency.value = 880;
  } else {
    oscillator.frequency.value = 220;
  }

  gainNode.gain.value = 0.08;

  oscillator.start();

  setTimeout(() => {
    oscillator.stop();
    audioContext.close();
  }, 180);
}

async function loadQuestion() {
  selectedButton = null;
  selectedOption = null;
  currentQuestionAnswered = false;

  showQuestionShell();
  updateScoreDisplay();

  questionText.textContent = "Loading your next question...";
  optionsContainer.innerHTML = "";
  lessonFeedback.classList.add("hidden");
  nextQuestionBtn.classList.add("hidden");
  restartLessonBtn.classList.add("hidden");
  continueHomeBtn.classList.add("hidden");
  confirmAnswerBtn.classList.add("hidden");

  try {
    const response = await fetch("/ai/generate-lesson-question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        category: selectedCategory
      })
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

function renderQuestion(question) {
  questionText.textContent = question.questionPt || question.question;
  optionsContainer.innerHTML = "";

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;

    button.addEventListener("click", () => {
      selectAnswer(button, option);
    });

    optionsContainer.appendChild(button);
  });
}

function selectAnswer(button, option) {
  if (currentQuestionAnswered) {
    return;
  }

  const buttons = document.querySelectorAll(".option-btn");

  buttons.forEach((btn) => {
    btn.style.border = "";
    btn.style.background = "";
    btn.style.transform = "";
  });

  selectedButton = button;
  selectedOption = option;

  button.style.border = "2px solid #005cff";
  button.style.background = "#eef4ff";
  button.style.transform = "scale(1.02)";

  lessonFeedback.classList.add("hidden");
  confirmAnswerBtn.classList.remove("hidden");
  saveLessonState();
}

function checkAnswer() {
  if (!selectedOption || !selectedButton) {
    lessonFeedback.textContent = "Please select an answer first.";
    lessonFeedback.classList.remove("hidden");
    return;
  }

  if (currentQuestionAnswered) {
    return;
  }

  const explanation = currentQuestion.explanationPt || currentQuestion.explanation;
  currentQuestionAnswered = true;

  if (selectedOption === currentQuestion.correctAnswer) {
    correctAnswers++;
    xpEarned += 10;
    playSound("correct");
    lessonFeedback.textContent = `Correct! +10 XP. ${explanation}`;
  } else {
    wrongAnswers++;
    playSound("wrong");
    lessonFeedback.textContent = `Not quite. Correct answer: ${currentQuestion.correctAnswer}. ${explanation}`;
  }

  renderAnsweredOptions();
  updateScoreDisplay();
  saveLessonState();

  lessonFeedback.classList.remove("hidden");
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.remove("hidden");
}

function renderAnsweredOptions() {
  const buttons = document.querySelectorAll(".option-btn");

  buttons.forEach((button) => {
    button.disabled = true;

    if (button.textContent === currentQuestion.correctAnswer) {
      button.classList.add("correct-option");
    }

    if (
      selectedOption &&
      selectedOption !== currentQuestion.correctAnswer &&
      button.textContent === selectedOption
    ) {
      button.classList.add("wrong-option");
    }
  });
}

function renderRestoredAnswer() {
  const explanation = currentQuestion.explanationPt || currentQuestion.explanation;

  renderAnsweredOptions();

  if (selectedOption === currentQuestion.correctAnswer) {
    lessonFeedback.textContent = `Correct! +10 XP. ${explanation}`;
  } else {
    lessonFeedback.textContent = `Not quite. Correct answer: ${currentQuestion.correctAnswer}. ${explanation}`;
  }

  lessonFeedback.classList.remove("hidden");
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.remove("hidden");
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
  optionsContainer.innerHTML = "";

  renderCompletionScreen("Saving...", "Saving your progress...");

  lessonFeedback.classList.remove("hidden");
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.add("hidden");
  continueHomeBtn.classList.add("hidden");
  restartLessonBtn.classList.add("hidden");

  try {
    const response = await fetch("/ai/save-lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        xpEarned,
        correctAnswers,
        wrongAnswers,
        unitId: 1
      })
    });

    const data = await response.json();

    if (data.success) {
      renderCompletionScreen(`${data.streakDays} day`, "Progress saved successfully.");
    } else {
      renderCompletionScreen("Not saved", "Progress could not be saved.");
    }
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
      <p class="motivation-message">Great work. You are building the English you need for real customer conversations.</p>

      <div class="completion-stats">
        <div>
          <span>${xpEarned}</span>
          <small>XP earned</small>
        </div>
        <div>
          <span>${correctAnswers}/${totalQuestions}</span>
          <small>Correct</small>
        </div>
        <div>
          <span>${wrongAnswers}</span>
          <small>Wrong</small>
        </div>
        <div>
          <span>${streakText}</span>
          <small>Current streak</small>
        </div>
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
  selectedOption = null;
  currentQuestionAnswered = false;
  lessonCompleted = false;
  lessonSaveInProgress = false;
  selectedCategory = lessonCategorySelect ? lessonCategorySelect.value : "all";

  clearLessonState();
  updateScoreDisplay();
  loadQuestion();
}

confirmAnswerBtn.addEventListener("click", () => {
  checkAnswer();
});

nextQuestionBtn.addEventListener("click", () => {
  questionNumber++;

  if (questionNumber > totalQuestions) {
    finishLesson();
    return;
  }

  loadQuestion();
});

restartLessonBtn.addEventListener("click", () => {
  restartLesson();
});

if (lessonCategorySelect) {
  lessonCategorySelect.addEventListener("change", () => {
    restartLesson();
  });
}

if (!restoreLessonState()) {
  loadQuestion();
}
