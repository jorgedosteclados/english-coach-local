let currentQuestion = null;
let questionNumber = 1;
const totalQuestions = 5;

let correctAnswers = 0;
let wrongAnswers = 0;
let xpEarned = 0;

let selectedButton = null;
let selectedOption = null;

const lessonTitle = document.getElementById("lessonTitle");
const progressText = document.querySelector(".lesson-progress");
const questionText = document.querySelector(".question-text");
const optionsContainer = document.querySelector(".options");
const lessonFeedback = document.getElementById("lessonFeedback");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const restartLessonBtn = document.getElementById("restartLessonBtn");

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

function updateScoreDisplay() {
  scoreDisplay.textContent = `XP: ${xpEarned} | Correct: ${correctAnswers} | Wrong: ${wrongAnswers}`;
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

  lessonTitle.classList.remove("hidden");
  progressText.classList.remove("hidden");
  questionText.classList.remove("hidden");
  scoreDisplay.classList.remove("hidden");

  updateScoreDisplay();

  lessonTitle.textContent = "How do you say:";
  progressText.textContent = `Question ${questionNumber} of ${totalQuestions}`;
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
      }
    });

    const data = await response.json();

    if (data.error) {
      questionText.textContent = data.error;
      return;
    }

    currentQuestion = data;

    questionText.textContent = currentQuestion.questionPt || currentQuestion.question;
    optionsContainer.innerHTML = "";

    currentQuestion.options.forEach((option) => {
      const button = document.createElement("button");
      button.className = "option-btn";
      button.textContent = option;

      button.addEventListener("click", () => {
        selectAnswer(button, option);
      });

      optionsContainer.appendChild(button);
    });
  } catch (error) {
    console.error(error);
    questionText.textContent = "Error loading lesson question.";
  }
}

function selectAnswer(button, option) {
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
}

function checkAnswer() {
  if (!selectedOption || !selectedButton) {
    lessonFeedback.textContent = "Please select an answer first.";
    lessonFeedback.classList.remove("hidden");
    return;
  }

  const buttons = document.querySelectorAll(".option-btn");
  const explanation = currentQuestion.explanationPt || currentQuestion.explanation;

  buttons.forEach((button) => {
    button.disabled = true;

    if (button.textContent === currentQuestion.correctAnswer) {
      button.classList.add("correct-option");
    }
  });

  if (selectedOption === currentQuestion.correctAnswer) {
    correctAnswers++;
    xpEarned += 10;
    playSound("correct");
    lessonFeedback.textContent = `Correct! +10 XP. ${explanation}`;
  } else {
    wrongAnswers++;
    playSound("wrong");
    selectedButton.classList.add("wrong-option");
    lessonFeedback.textContent = `Not quite. Correct answer: ${currentQuestion.correctAnswer}. ${explanation}`;
  }

  updateScoreDisplay();

  lessonFeedback.classList.remove("hidden");
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.remove("hidden");
}

async function finishLesson() {
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

loadQuestion();
