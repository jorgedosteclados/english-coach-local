const correctBtn = document.getElementById("correctBtn");
const textInput = document.getElementById("text");
const correctForm = document.getElementById("correctForm");
const resultSection = document.getElementById("result");
const resultContent = document.getElementById("resultContent");

const correctionXp = 5;
const correctionDraftKey = "englishCoach.correction.draft";

let correctionCompleted = false;
let correctionSaveInProgress = false;

textInput.value = localStorage.getItem(correctionDraftKey) || "";

textInput.addEventListener("input", () => {
  if (correctionCompleted) {
    return;
  }

  localStorage.setItem(correctionDraftKey, textInput.value);
});

window.addEventListener("beforeunload", (event) => {
  if (correctionCompleted || !textInput.value.trim()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

correctBtn.addEventListener("click", async () => {
  const text = textInput.value.trim();

  if (!text) {
    alert("Please write a sentence first.");
    return;
  }

  correctBtn.disabled = true;
  correctBtn.textContent = "Checking...";
  resultSection.classList.remove("hidden");
  resultContent.innerHTML = `
    <div class="feedback-box writing-loading">
      Correcting your English...
      <br><br>
      Please wait a few seconds.
    </div>
  `;

  try {
    const response = await fetch("/ai/correct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (data.error) {
      renderCorrectionError(data.error);
      return;
    }

    const progress = await saveCorrectionProgress();
    renderCorrectionComplete(data.result, progress);
  } catch (error) {
    console.error(error);
    renderCorrectionError("Error connecting to the local AI route.");
  } finally {
    correctBtn.disabled = false;
    correctBtn.textContent = "Correct";
  }
});

async function saveCorrectionProgress() {
  if (correctionSaveInProgress) {
    return {
      streakDays: null,
      saved: false
    };
  }

  correctionSaveInProgress = true;

  try {
    const response = await fetch("/ai/save-lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        xpEarned: correctionXp,
        correctAnswers: 1,
        wrongAnswers: 0,
        unitId: 3
      })
    });

    const data = await response.json();

    if (data.success) {
      return {
        streakDays: data.streakDays,
        saved: true
      };
    }
  } catch (error) {
    console.error(error);
  }

  return {
    streakDays: null,
    saved: false
  };
}

function renderCorrectionComplete(feedback, progress) {
  correctionCompleted = true;
  localStorage.removeItem(correctionDraftKey);
  correctForm.classList.add("hidden");
  const streakText = progress && progress.streakDays ? `${progress.streakDays} day` : "Saved";

  resultContent.innerHTML = `
    <div class="lesson-complete writing-complete">
      <div class="success-badge">✓</div>
      <h2>Feedback complete!</h2>
      <p class="motivation-message">Small corrections build natural professional English. Nice work.</p>

      <div class="completion-stats">
        <div>
          <span>${correctionXp}</span>
          <small>XP earned</small>
        </div>
        <div>
          <span>${streakText}</span>
          <small>Current streak</small>
        </div>
      </div>

      <div class="writing-feedback-card">
        <h3>AI Feedback</h3>
        <pre>${escapeHtml(feedback)}</pre>
      </div>

      <a href="/units" class="primary-link continue-mission-link">Continue</a>
      <button type="button" class="secondary-btn" id="startCorrectionAgainBtn">Start Again</button>
    </div>
  `;

  document.getElementById("startCorrectionAgainBtn").addEventListener("click", () => {
    correctionCompleted = false;
    correctionSaveInProgress = false;
    textInput.value = "";
    localStorage.removeItem(correctionDraftKey);
    correctForm.classList.remove("hidden");
    resultSection.classList.add("hidden");
    resultContent.innerHTML = "";
  });
}

function renderCorrectionError(message) {
  resultContent.innerHTML = `
    <div class="feedback-box">${escapeHtml(message)}</div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
