const checkWritingBtn = document.getElementById("checkWritingBtn");
const writingText = document.getElementById("writingText");
const writingForm = document.getElementById("writingForm");
const writingResult = document.getElementById("writingResult");
const writingResultContent = document.getElementById("writingResultContent");
const requestedWritingUnitId = Number(new URLSearchParams(window.location.search).get("unit"));

const missionId = Number(writingForm.dataset.missionId) || null;
const missionUnitId =
  requestedWritingUnitId > 0 ? requestedWritingUnitId : Number(writingForm.dataset.unitId) || 2;
const missionXp = Number(writingForm.dataset.xpReward) || 10;
const writingDraftKey = `englishCoach.writingMission.${missionUnitId}.${missionId || "default"}.draft`;

let missionCompleted = false;
let missionSaveInProgress = false;

writingText.value = localStorage.getItem(writingDraftKey) || "";

writingText.addEventListener("input", () => {
  if (missionCompleted) {
    return;
  }

  localStorage.setItem(writingDraftKey, writingText.value);
});

window.addEventListener("beforeunload", (event) => {
  if (missionCompleted || !writingText.value.trim()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

checkWritingBtn.addEventListener("click", async () => {
  const text = writingText.value.trim();

  if (!text) {
    alert("Please write your message first.");
    return;
  }

  checkWritingBtn.disabled = true;
  checkWritingBtn.textContent = "Checking...";
  writingResult.classList.remove("hidden");
  writingResultContent.innerHTML = `
    <div class="feedback-box writing-loading">
      Checking your writing...
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
      renderMissionError(data.error);
      return;
    }

    const progress = await saveMissionProgress();
    renderMissionComplete(data.result, progress);
  } catch (error) {
    console.error(error);
    renderMissionError("Error connecting to the local AI route.");
  } finally {
    checkWritingBtn.disabled = false;
    checkWritingBtn.textContent = "Check My Writing";
  }
});

async function saveMissionProgress() {
  if (missionSaveInProgress) {
    return {
      streakDays: null,
      saved: false
    };
  }

  missionSaveInProgress = true;

  try {
    const response = await fetch("/ai/save-lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        xpEarned: missionXp,
        correctAnswers: 1,
        wrongAnswers: 0,
        unitId: missionUnitId,
        missionId
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

function renderMissionComplete(feedback, progress) {
  missionCompleted = true;
  localStorage.removeItem(writingDraftKey);
  writingForm.classList.add("hidden");
  const streakText = progress && progress.streakDays ? `${progress.streakDays} day` : "Saved";

  writingResultContent.innerHTML = `
    <div class="lesson-complete writing-complete">
      <div class="success-badge">✓</div>
      <h2>Mission complete!</h2>
      <p class="motivation-message">Nice work. This is exactly the kind of message you will use in real support conversations.</p>

      <div class="completion-stats">
        <div>
          <span>${missionXp}</span>
          <small>XP earned</small>
        </div>
        <div>
          <span>Done</span>
          <small>Writing task</small>
        </div>
        <div>
          <span>${streakText}</span>
          <small>Current streak</small>
        </div>
      </div>

      ${renderStructuredFeedback(feedback)}

      <a href="/" class="primary-link continue-mission-link">Continue</a>
      <button type="button" class="secondary-btn" id="startWritingAgainBtn">Start Again</button>
    </div>
  `;

  document.getElementById("startWritingAgainBtn").addEventListener("click", () => {
    missionCompleted = false;
    missionSaveInProgress = false;
    writingText.value = "";
    localStorage.removeItem(writingDraftKey);
    writingForm.classList.remove("hidden");
    writingResult.classList.add("hidden");
    writingResultContent.innerHTML = "";
  });
}

function renderMissionError(message) {
  writingResultContent.innerHTML = `
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
