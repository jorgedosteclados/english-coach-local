function parseAIFeedback(feedback) {
  const sections = {
    original: "",
    errorType: "",
    corrected: "",
    moreNatural: "",
    professional: "",
    explanation: "",
    reusablePattern: "",
    alternatives: []
  };

  const labelMap = {
    "original": "original",
    "error type": "errorType",
    "tipo de erro": "errorType",
    "corrected": "corrected",
    "more natural": "moreNatural",
    "professional version": "professional",
    "explanation in portuguese": "explanation",
    "useful alternatives": "alternatives",
    "reusable pattern": "reusablePattern",
    "pattern": "reusablePattern"
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
    renderFeedbackDetail("Error type", sections.errorType),
    renderFeedbackDetail("Corrected", sections.corrected, "highlight"),
    renderFeedbackDetail("More natural", sections.moreNatural),
    renderFeedbackDetail("Professional version", sections.professional),
    renderFeedbackDetail("Explanation in Portuguese", sections.explanation, "full-width"),
    renderFeedbackDetail("Reusable pattern", sections.reusablePattern, "full-width")
  ].join("");

  const hasStructuredFeedback =
    sections.original ||
    sections.errorType ||
    sections.corrected ||
    sections.moreNatural ||
    sections.professional ||
    sections.explanation ||
    sections.reusablePattern ||
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

function parseCallFeedback(feedback) {
  const blocks = [];
  let currentBlock = createCallFeedbackBlock();
  let currentKey = null;

  const labelMap = {
    "original": "original",
    "error type": "errorType",
    "tipo de erro": "errorType",
    "explanation in portuguese": "explanation",
    "explicacao em portugues": "explanation",
    "corrected": "corrected",
    "more natural": "moreNatural",
    "professional version": "professional",
    "reusable pattern": "reusablePattern",
    "pattern": "reusablePattern",
    "useful alternatives": "alternatives"
  };

  String(feedback || "")
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line || /^-[-\s]*$/.test(line)) {
        return;
      }

      const labelMatch = line.match(/^([^:]+):\s*(.*)$/);
      const normalizedLabel = labelMatch ? labelMatch[1].trim().toLowerCase() : "";
      const mappedKey = labelMap[normalizedLabel];

      if (mappedKey) {
        if (mappedKey === "original" && hasCallFeedbackBlockContent(currentBlock)) {
          blocks.push(currentBlock);
          currentBlock = createCallFeedbackBlock();
        }

        currentKey = mappedKey;

        if (labelMatch[2]) {
          appendCallFeedbackValue(currentBlock, currentKey, labelMatch[2]);
        }

        return;
      }

      appendCallFeedbackValue(currentBlock, currentKey, line);
    });

  if (hasCallFeedbackBlockContent(currentBlock)) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function createCallFeedbackBlock() {
  return {
    original: "",
    errorType: "",
    explanation: "",
    corrected: "",
    moreNatural: "",
    professional: "",
    reusablePattern: "",
    alternatives: []
  };
}

function hasCallFeedbackBlockContent(block) {
  return Boolean(
    block.original ||
      block.errorType ||
      block.explanation ||
      block.corrected ||
      block.moreNatural ||
      block.professional ||
      block.reusablePattern ||
      block.alternatives.length
  );
}

function appendCallFeedbackValue(block, key, value) {
  if (!key || !value) {
    return;
  }

  if (key === "alternatives") {
    block.alternatives.push(value.replace(/^[-*]\s*/, ""));
    return;
  }

  block[key] = block[key] ? `${block[key]}\n${value}` : value;
}

function renderCallFeedback(feedback) {
  const blocks = parseCallFeedback(feedback);
  const hasCallSpecificFeedback = blocks.some((block) => block.errorType || block.reusablePattern);

  if (!blocks.length || !hasCallSpecificFeedback) {
    return renderStructuredFeedback(feedback);
  }

  const cardsHtml = blocks
    .map((block, index) => {
      const alternativesHtml = block.alternatives
        .map((alternative) => `<li>${escapeHtml(alternative)}</li>`)
        .join("");

      return `
        <article class="call-feedback-card">
          <div class="call-feedback-card-heading">
            <span>Phrase ${index + 1}</span>
            <strong>${escapeHtml(block.errorType || "Call structure")}</strong>
          </div>
          <div class="feedback-grid">
            ${renderFeedbackDetail("Original", block.original)}
            ${renderFeedbackDetail("Corrected", block.corrected, "highlight")}
            ${renderFeedbackDetail("More natural", block.moreNatural)}
            ${renderFeedbackDetail("Professional version", block.professional)}
            ${renderFeedbackDetail("Explanation in Portuguese", block.explanation, "full-width")}
            ${renderFeedbackDetail("Reusable pattern", block.reusablePattern, "full-width")}
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
        </article>
      `;
    })
    .join("");

  return `
    <div class="feedback-summary call-feedback-summary">
      <h3>Call Phrase Feedback</h3>
      ${cardsHtml}
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
