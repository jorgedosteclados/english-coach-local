const mistakeQuestions = JSON.parse(document.getElementById("mistakeQuestionsData").textContent);
const mistakeProgress = document.getElementById("mistakeProgress");
const mistakeProgressBar = document.getElementById("mistakeProgressBar");
const mistakeMastery = document.getElementById("mistakeMastery");
const mistakeQuestion = document.getElementById("mistakeQuestion");
const mistakeOptions = document.getElementById("mistakeOptions");
const mistakeFeedback = document.getElementById("mistakeFeedback");
const checkMistakeBtn = document.getElementById("checkMistakeBtn");
const nextMistakeBtn = document.getElementById("nextMistakeBtn");
const mistakeExercise = document.getElementById("mistakeExercise");

let currentMistakeIndex = 0;
let selectedAnswer = "";

function getCurrentMistake() {
  return mistakeQuestions[currentMistakeIndex];
}

function renderMistake() {
  const question = getCurrentMistake();
  selectedAnswer = "";
  mistakeProgress.textContent = `${currentMistakeIndex + 1} of ${mistakeQuestions.length}`;
  mistakeProgressBar.style.width = `${(currentMistakeIndex / mistakeQuestions.length) * 100}%`;
  mistakeQuestion.textContent = question.questionPt;
  mistakeMastery.textContent = `${question.totalWrong} mistakes · ${question.totalCorrect} correct reviews`;
  mistakeOptions.innerHTML = "";
  mistakeFeedback.className = "feedback-box hidden";
  checkMistakeBtn.classList.add("hidden");
  nextMistakeBtn.classList.add("hidden");

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;
    button.addEventListener("click", () => {
      mistakeOptions
        .querySelectorAll(".option-btn")
        .forEach((item) => item.classList.remove("selected-option"));
      button.classList.add("selected-option");
      selectedAnswer = option;
      checkMistakeBtn.classList.remove("hidden");
    });
    mistakeOptions.appendChild(button);
  });
}

async function checkMistake() {
  const question = getCurrentMistake();
  const isCorrect = selectedAnswer === question.correctAnswer;

  mistakeOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.disabled = true;

    if (button.textContent === question.correctAnswer) {
      button.classList.add("correct-option");
    } else if (button.textContent === selectedAnswer) {
      button.classList.add("wrong-option");
    }
  });

  mistakeFeedback.textContent = isCorrect
    ? `Correct. ${question.explanationPt}`
    : `Not quite. Correct answer: ${question.correctAnswer}. ${question.explanationPt}`;
  mistakeFeedback.className = `feedback-box ${isCorrect ? "correct-feedback" : "wrong-feedback"}`;
  window.EnglishCoachSound?.play(isCorrect ? "correct" : "incorrect");
  checkMistakeBtn.classList.add("hidden");
  nextMistakeBtn.classList.remove("hidden");
  mistakeProgressBar.style.width = `${((currentMistakeIndex + 1) / mistakeQuestions.length) * 100}%`;

  try {
    await fetch("/ai/save-question-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.questionId,
        exerciseType: "adaptive-review",
        userAnswer: selectedAnswer,
        isCorrect
      })
    });
  } catch (error) {
    console.error("Could not save review attempt:", error);
  }
}

function showReviewComplete() {
  window.EnglishCoachSound?.play("complete");
  mistakeExercise.innerHTML = `
    <div class="lesson-complete">
      <div class="success-badge">✓</div>
      <h2>Review complete!</h2>
      <p class="motivation-message">Your next reviews are scheduled automatically.</p>
      <a href="/" class="primary-link">Back to learning path</a>
    </div>
  `;
}

checkMistakeBtn.addEventListener("click", checkMistake);
nextMistakeBtn.addEventListener("click", () => {
  currentMistakeIndex++;

  if (currentMistakeIndex >= mistakeQuestions.length) {
    showReviewComplete();
  } else {
    renderMistake();
  }
});

renderMistake();
