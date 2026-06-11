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

// Create score display
const scoreDisplay = document.createElement("div");
scoreDisplay.style.margin = "12px 0";
scoreDisplay.style.padding = "10px 12px";
scoreDisplay.style.borderRadius = "12px";
scoreDisplay.style.background = "#f3f7ff";
scoreDisplay.style.fontWeight = "600";
scoreDisplay.style.color = "#0b1f4d";

progressText.insertAdjacentElement("afterend", scoreDisplay);

// Create confirm button
const confirmAnswerBtn = document.createElement("button");
confirmAnswerBtn.textContent = "Confirm Answer";
confirmAnswerBtn.className = "hidden";
confirmAnswerBtn.style.marginTop = "14px";

nextQuestionBtn.insertAdjacentElement("beforebegin", confirmAnswerBtn);

function updateScoreDisplay() {
  scoreDisplay.textContent = `⭐ XP: ${xpEarned} | ✅ Correct: ${correctAnswers} | ❌ Wrong: ${wrongAnswers}`;
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

  updateScoreDisplay();

  lessonTitle.textContent = "How do you say:";
  progressText.textContent = `Question ${questionNumber} of ${totalQuestions}`;
  questionText.textContent = "Generating a new question with AI...";
  optionsContainer.innerHTML = "";
  lessonFeedback.classList.add("hidden");
  nextQuestionBtn.classList.add("hidden");
  restartLessonBtn.classList.add("hidden");
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

    questionText.textContent = currentQuestion.questionPt;
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
    questionText.textContent = "Error loading AI question.";
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
    lessonFeedback.textContent = `✅ Correct! +10 XP. ${currentQuestion.explanationPt}`;
  } else {
    wrongAnswers++;
    playSound("wrong");
    selectedButton.classList.add("wrong-option");
    lessonFeedback.textContent = `❌ Not quite. Correct answer: ${currentQuestion.correctAnswer}. ${currentQuestion.explanationPt}`;
  }

  updateScoreDisplay();

  lessonFeedback.classList.remove("hidden");
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.remove("hidden");
}

async function finishLesson() {
  progressText.textContent = "Completed";
  lessonTitle.textContent = "Lesson completed!";
  questionText.textContent = "You finished 5 AI-generated questions.";
  optionsContainer.innerHTML = "";

  lessonFeedback.innerHTML = `
    🎉 Great job! You finished this AI lesson.<br><br>
    ✅ Correct answers: ${correctAnswers}/${totalQuestions}<br>
    ❌ Wrong answers: ${wrongAnswers}<br>
    ⭐ XP earned: ${xpEarned}<br><br>
    Saving your progress...
  `;

  updateScoreDisplay();

  lessonFeedback.classList.remove("hidden");
  confirmAnswerBtn.classList.add("hidden");
  nextQuestionBtn.classList.add("hidden");
  restartLessonBtn.classList.remove("hidden");

  try {
    const response = await fetch("/ai/save-lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        xpEarned,
        correctAnswers,
        wrongAnswers
      })
    });

    const data = await response.json();

    if (data.success) {
      lessonFeedback.innerHTML = `
        🎉 Great job! You finished this AI lesson.<br><br>
        ✅ Correct answers: ${correctAnswers}/${totalQuestions}<br>
        ❌ Wrong answers: ${wrongAnswers}<br>
        ⭐ XP earned: ${xpEarned}<br>
        🔥 Current streak: ${data.streakDays} day(s)<br><br>
        Progress saved successfully.
      `;
    } else {
      lessonFeedback.innerHTML += `<br>Progress could not be saved.`;
    }
  } catch (error) {
    console.error(error);
    lessonFeedback.innerHTML += `<br>Progress could not be saved.`;
  }
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