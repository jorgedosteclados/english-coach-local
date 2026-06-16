function parseAIFeedback(feedback) {
  const sections = {
    original: "",
    corrected: "",
    moreNatural: "",
    professional: "",
    explanation: "",
    alternatives: []
  };

  const labelMap = {
    "original": "original",
    "corrected": "corrected",
    "more natural": "moreNatural",
    "professional version": "professional",
    "explanation in portuguese": "explanation",
    "useful alternatives": "alternatives"
  };

  let currentKey = null;

  String(feedback || "")
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line) {
        return;
      }

      const labelMatch = line.match(/^([^:]+):\s*(.*)$/);
      const normalizedLabel = labelMatch ? labelMatch[1].trim().toLowerCase() : "";

      if (labelMap[normalizedLabel]) {
        currentKey = labelMap[normalizedLabel];

        if (labelMatch[2]) {
          appendFeedbackValue(sections, currentKey, labelMatch[2]);
        }

        return;
      }

      appendFeedbackValue(sections, currentKey, line);
    });

  return sections;
}

function appendFeedbackValue(sections, key, value) {
  if (!key || !value) {
    return;
  }

  if (key === "alternatives") {
    sections.alternatives.push(value.replace(/^[-*]\s*/, ""));
    return;
  }

  sections[key] = sections[key] ? `${sections[key]}\n${value}` : value;
}

function renderStructuredFeedback(feedback) {
  const sections = parseAIFeedback(feedback);
  const alternativesHtml = sections.alternatives
    .map((alternative) => `<li>${escapeHtml(alternative)}</li>`)
    .join("");

  const fallbackHtml = `
    <article class="feedback-detail full-width">
      <h4>AI Feedback</h4>
      <p>${escapeHtml(feedback)}</p>
    </article>
  `;

  const detailsHtml = [
    renderFeedbackDetail("Original", sections.original),
    renderFeedbackDetail("Corrected", sections.corrected, "highlight"),
    renderFeedbackDetail("More natural", sections.moreNatural),
    renderFeedbackDetail("Professional version", sections.professional),
    renderFeedbackDetail("Explanation in Portuguese", sections.explanation, "full-width")
  ].join("");

  const hasStructuredFeedback =
    sections.original ||
    sections.corrected ||
    sections.moreNatural ||
    sections.professional ||
    sections.explanation ||
    sections.alternatives.length > 0;

  return `
    <div class="feedback-summary">
      <h3>AI Feedback</h3>
      <div class="feedback-grid">
        ${hasStructuredFeedback ? detailsHtml : fallbackHtml}
        ${
          alternativesHtml
            ? `
              <article class="feedback-detail full-width">
                <h4>Useful alternatives</h4>
                <ul class="alternatives-list">${alternativesHtml}</ul>
              </article>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function renderFeedbackDetail(title, value, className) {
  if (!value) {
    return "";
  }

  return `
    <article class="feedback-detail ${className || ""}">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(value)}</p>
    </article>
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
