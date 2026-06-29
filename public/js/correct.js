const correctBtn = document.getElementById("correctBtn");
const textInput = document.getElementById("text");
const correctForm = document.getElementById("correctForm");
const resultSection = document.getElementById("result");
const resultContent = document.getElementById("resultContent");
const correctionModeTabs = document.querySelectorAll(".correction-mode-tab");
const correctionKicker = document.getElementById("correctionKicker");
const correctionTitle = document.getElementById("correctionTitle");
const correctionIntro = document.getElementById("correctionIntro");
const correctionTextLabel = document.getElementById("correctionTextLabel");
const correctionQuery = new URLSearchParams(window.location.search);
const requestedCorrectionUnitId = Number(correctionQuery.get("unit"));
const correctionUnitId = requestedCorrectionUnitId > 0 ? requestedCorrectionUnitId : 3;

const correctionXp = 5;

let correctionCompleted = false;
let correctionSaveInProgress = false;
let correctionMode = correctionQuery.get("mode") === "call" || correctionUnitId === 14 ? "call" : "general";

applyCorrectionMode(correctionMode);
textInput.value = localStorage.getItem(getCorrectionDraftKey()) || "";

correctionModeTabs.forEach((button) => {
  button.addEventListener("click", () => {
    if (correctionCompleted || button.dataset.mode === correctionMode) {
      return;
    }

    localStorage.setItem(getCorrectionDraftKey(), textInput.value);
    correctionMode = button.dataset.mode === "call" ? "call" : "general";
    applyCorrectionMode(correctionMode);
    textInput.value = localStorage.getItem(getCorrectionDraftKey()) || "";
  });
});

textInput.addEventListener("input", () => {
  if (correctionCompleted) {
    return;
  }

  localStorage.setItem(getCorrectionDraftKey(), textInput.value);
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
    alert(correctionMode === "call" ? "Please add a call phrase first." : "Please write a sentence first.");
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
      body: JSON.stringify({ text, mode: correctionMode })
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
    correctBtn.textContent = getCorrectionButtonLabel();
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
        unitId: correctionUnitId
      })
    });

    const data = await response.json();

    if (data.success) {
      return {
        streakDays: data.streakDays,
        saved: true,
        nextUnit: data.nextUnit || null
      };
    }
  } catch (error) {
    console.error(error);
  }

  return {
    streakDays: null,
    saved: false,
    nextUnit: null
  };
}

function renderCorrectionComplete(feedback, progress) {
  window.EnglishCoachSound?.play("complete");
  correctionCompleted = true;
  localStorage.removeItem(getCorrectionDraftKey());
  correctForm.classList.add("hidden");
  const streakText = progress && progress.streakDays ? `${progress.streakDays} day` : "Saved";
  const nextHref = progress?.nextUnit?.href || "/progress";
  const continueLabel = progress?.nextUnit ? "Continue to next lesson" : "View final progress";
  const feedbackHtml =
    correctionMode === "call" && typeof renderCallFeedback === "function"
      ? renderCallFeedback(feedback)
      : renderStructuredFeedback(feedback);

  resultContent.innerHTML = `
    <div class="lesson-complete writing-complete">
      <div class="success-badge">✓</div>
      <h2>${correctionMode === "call" ? "Call feedback complete!" : "Feedback complete!"}</h2>
      <p class="motivation-message">${
        correctionMode === "call"
          ? "You turned real call language into reusable professional patterns."
          : "Small corrections build natural professional English. Nice work."
      }</p>

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

      ${feedbackHtml}

      <a href="${nextHref}" class="primary-link continue-mission-link">${continueLabel}</a>
      <a href="/" class="secondary-link">Back to learning path</a>
      <button type="button" class="secondary-btn" id="startCorrectionAgainBtn">Start Again</button>
    </div>
  `;

  document.getElementById("startCorrectionAgainBtn").addEventListener("click", () => {
    correctionCompleted = false;
    correctionSaveInProgress = false;
    textInput.value = "";
    localStorage.removeItem(getCorrectionDraftKey());
    correctForm.classList.remove("hidden");
    resultSection.classList.add("hidden");
    resultContent.innerHTML = "";
  });
}

function applyCorrectionMode(mode) {
  correctionModeTabs.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (mode === "call") {
    correctionKicker.textContent = "Technical Call Coach";
    correctionTitle.textContent = "Real Call Phrases";
    correctionIntro.textContent = "Fix technical call phrases and turn them into reusable spoken patterns.";
    correctionTextLabel.textContent = "Call phrase or transcript lines";
    textInput.placeholder =
      "Example: And how much you do expecting to be calculated for the first day?";
  } else {
    correctionKicker.textContent = "Mini Beagle Coach";
    correctionTitle.textContent = "Correct My English";
    correctionIntro.textContent = "Write a sentence in English and get feedback.";
    correctionTextLabel.textContent = "Your sentence";
    textInput.placeholder = "Example: I have doubt about this case.";
  }

  correctBtn.textContent = getCorrectionButtonLabel();

  const nextQuery = new URLSearchParams(window.location.search);
  if (mode === "call") {
    nextQuery.set("mode", "call");
  } else {
    nextQuery.delete("mode");
  }
  const nextUrl = `${window.location.pathname}${nextQuery.toString() ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function getCorrectionDraftKey() {
  return `englishCoach.correction.${correctionMode}.unit${correctionUnitId}.draft`;
}

function getCorrectionButtonLabel() {
  return correctionMode === "call" ? "Analyze Call Phrase" : "Correct";
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
