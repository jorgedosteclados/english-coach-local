const questions = window.placementQuestions || [];
const skillLabels = new Map([
  ["comprehension", "Meaning and comprehension"],
  ["grammar", "Grammar and structure"],
  ["professional-tone", "Professional tone"],
  ["problem-solving", "Problem-solving language"]
]);

const intro = document.getElementById("placementIntro");
const questionCard = document.getElementById("placementQuestion");
const resultCard = document.getElementById("placementResult");
const progressBar = document.getElementById("placementProgressBar");
const progressText = document.getElementById("placementProgressText");
const levelLabel = document.getElementById("placementLevel");
const skillLabel = document.getElementById("placementSkill");
const prompt = document.getElementById("placementPrompt");
const options = document.getElementById("placementOptions");
const nextButton = document.getElementById("placementNextBtn");
const applyButton = document.getElementById("applyPlacementBtn");
const applyStatus = document.getElementById("placementApplyStatus");

let currentIndex = 0;
let selectedAnswer = "";
const answers = {};
let completedAssessment = null;

document.getElementById("startPlacementBtn").addEventListener("click", () => {
  intro.classList.add("hidden");
  questionCard.classList.remove("hidden");
  renderQuestion();
});

document.getElementById("restartPlacementBtn").addEventListener("click", () => {
  window.location.reload();
});

applyButton.addEventListener("click", async () => {
  if (!completedAssessment) return;

  applyButton.disabled = true;
  applyButton.textContent = "Preparing your path...";
  try {
    const response = await fetch("/placement/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId: completedAssessment.assessmentId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to update your path.");
    window.location.href = result.startHref || "/";
  } catch (error) {
    applyStatus.textContent = error.message;
    applyStatus.classList.remove("hidden");
    applyButton.disabled = false;
    applyButton.textContent = `Start Phase ${completedAssessment.recommendedPhase}`;
  }
});

nextButton.addEventListener("click", async () => {
  if (!selectedAnswer) return;

  answers[questions[currentIndex].id] = selectedAnswer;
  if (currentIndex < questions.length - 1) {
    currentIndex += 1;
    selectedAnswer = "";
    renderQuestion();
    return;
  }

  nextButton.disabled = true;
  nextButton.textContent = "Calculating...";
  await submitPlacement();
});

function renderQuestion() {
  const question = questions[currentIndex];
  levelLabel.textContent = question.level;
  skillLabel.textContent = skillLabels.get(question.skill) || question.skill;
  prompt.textContent = question.prompt;
  progressText.textContent = `${currentIndex + 1} / ${questions.length}`;
  progressBar.style.width = `${((currentIndex + 1) / questions.length) * 100}%`;
  nextButton.disabled = true;
  nextButton.textContent = currentIndex === questions.length - 1 ? "See my result" : "Continue";
  options.innerHTML = "";

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "placement-option";
    button.textContent = option;
    button.addEventListener("click", () => {
      selectedAnswer = option;
      options.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      nextButton.disabled = false;
    });
    options.appendChild(button);
  });
}

async function submitPlacement() {
  try {
    const response = await fetch("/placement/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to calculate your result.");
    renderResult(result);
  } catch (error) {
    nextButton.disabled = false;
    nextButton.textContent = "Try again";
    window.alert(error.message);
  }
}

function renderResult(result) {
  completedAssessment = result;
  questionCard.classList.add("hidden");
  resultCard.classList.remove("hidden");
  progressBar.style.width = "100%";
  document.getElementById("placementLevelResult").textContent = result.estimatedLevel;
  document.getElementById("placementResultTitle").textContent = `Start around Phase ${result.recommendedPhase}`;
  document.getElementById("placementResultCopy").textContent = result.objective;
  applyButton.textContent = `Start Phase ${result.recommendedPhase}`;
  document.getElementById("placementScore").textContent = `${result.totalCorrect}/${result.totalQuestions}`;
  document.getElementById("placementSkillResults").innerHTML = result.skills
    .map((skill) => `
      <div>
        <header><strong>${escapeHtml(skill.label)}</strong><span>${skill.percent}%</span></header>
        <div><span style="width: ${skill.percent}%"></span></div>
        <small>${skill.correct} of ${skill.total} correct</small>
      </div>
    `)
    .join("");
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
