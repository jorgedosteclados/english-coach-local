const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const historySearch = document.getElementById("historySearch");
const historyFilters = document.querySelectorAll(".history-filter");
const correctionDraftKey = "englishCoach.correction.draft";

let activeFilter = "all";
let corrections = [];

try {
  corrections = JSON.parse(document.getElementById("historyData").textContent) || [];
} catch (error) {
  console.error(error);
  corrections = [];
}

historySearch.addEventListener("input", () => {
  renderHistory();
});

historyFilters.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;

    historyFilters.forEach((filterButton) => {
      filterButton.classList.toggle("active", filterButton === button);
    });

    renderHistory();
  });
});

function renderHistory() {
  const filteredCorrections = getFilteredCorrections();

  historyList.innerHTML = filteredCorrections.map(renderHistoryCard).join("");
  historyEmpty.classList.toggle("hidden", filteredCorrections.length > 0);

  document.querySelectorAll(".history-detail-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".history-card");
      const details = card.querySelector(".history-details");
      const isHidden = details.classList.toggle("hidden");

      button.textContent = isHidden ? "View details" : "Hide details";
    });
  });

  document.querySelectorAll(".practice-again-btn").forEach((button) => {
    button.addEventListener("click", () => {
      localStorage.setItem(correctionDraftKey, button.dataset.original);
      window.location.href = "/correct";
    });
  });
}

function getFilteredCorrections() {
  const query = historySearch.value.trim().toLowerCase();

  return corrections.filter((correction) => {
    const searchableText = `${correction.original_text} ${correction.ai_feedback}`.toLowerCase();

    if (query && !searchableText.includes(query)) {
      return false;
    }

    return matchesDateFilter(correction.created_at);
  });
}

function matchesDateFilter(createdAt) {
  if (activeFilter === "all") {
    return true;
  }

  const correctionDate = new Date(createdAt);

  if (Number.isNaN(correctionDate.getTime())) {
    return false;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (activeFilter === "today") {
    return correctionDate >= startOfToday;
  }

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 6);

  return correctionDate >= startOfWeek;
}

function renderHistoryCard(correction) {
  const feedback = parseAIFeedback(correction.ai_feedback);
  const correctedPreview = feedback.corrected || feedback.moreNatural || "Open details to review the feedback.";
  const professionalPreview = feedback.professional || "";

  return `
    <article class="history-card" data-id="${correction.id}">
      <div class="history-card-header">
        <div>
          <p class="unit-label">Saved correction</p>
          <h2>${escapeHtml(correction.original_text)}</h2>
        </div>
        <time>${formatHistoryDate(correction.created_at)}</time>
      </div>

      <div class="history-preview">
        <article>
          <h3>Corrected</h3>
          <p>${escapeHtml(correctedPreview)}</p>
        </article>
        ${
          professionalPreview
            ? `
              <article>
                <h3>Professional</h3>
                <p>${escapeHtml(professionalPreview)}</p>
              </article>
            `
            : ""
        }
      </div>

      <div class="history-actions">
        <button type="button" class="secondary-btn history-detail-btn">View details</button>
        <button
          type="button"
          class="practice-again-btn"
          data-original="${escapeHtml(correction.original_text)}"
        >
          Practice again
        </button>
      </div>

      <div class="history-details hidden">
        ${renderStructuredFeedback(correction.ai_feedback)}
      </div>
    </article>
  `;
}

function formatHistoryDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

renderHistory();
