const evidenceBasedMethods = [
  {
    id: "retrieval-practice",
    label: "Retrieval practice",
    productBehavior: "Learners produce or select an answer before seeing feedback."
  },
  {
    id: "spaced-practice",
    label: "Spaced practice",
    productBehavior: "Incorrect answers return after increasing review intervals."
  },
  {
    id: "corrective-feedback",
    label: "Corrective feedback",
    productBehavior: "Every checked answer receives an immediate correction and explanation."
  },
  {
    id: "interleaving",
    label: "Interleaving",
    productBehavior: "Sessions mix language categories and exercise formats."
  },
  {
    id: "mastery-learning",
    label: "Mastery checks",
    productBehavior: "Checkpoints require a defined performance threshold before progression."
  }
];

const skillMatrix = [
  {
    id: "comprehension",
    label: "Meaning and comprehension",
    objective: "Understand the intended meaning of common professional support phrases."
  },
  {
    id: "grammar",
    label: "Grammar and structure",
    objective: "Choose structures that communicate time, conditions, and actions accurately."
  },
  {
    id: "professional-tone",
    label: "Professional tone",
    objective: "Select language that is clear, respectful, and appropriately cautious."
  },
  {
    id: "problem-solving",
    label: "Problem-solving language",
    objective: "Explain evidence, impact, scope, and next actions in realistic support contexts."
  }
];

const levelMatrix = [
  {
    level: "A1",
    phase: 1,
    objective: "Recognize and use short, direct phrases for basic support needs."
  },
  {
    level: "A2",
    phase: 2,
    objective: "Handle routine requests, updates, and simple troubleshooting exchanges."
  },
  {
    level: "B1",
    phase: 3,
    objective: "Explain causes, conditions, impact, and technical next steps clearly."
  },
  {
    level: "B2",
    phase: 4,
    objective: "Manage nuanced professional interactions with precise and natural language."
  }
];

module.exports = {
  evidenceBasedMethods,
  skillMatrix,
  levelMatrix
};
