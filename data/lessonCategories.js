const lessonCategories = [
  {
    id: "all",
    label: "All support questions",
    source: null
  },
  {
    id: "request-info",
    label: "Request information",
    source: "csv:request-info"
  },
  {
    id: "case-update",
    label: "Case updates",
    source: "csv:case-update"
  },
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    source: "csv:troubleshooting"
  },
  {
    id: "closure",
    label: "Closing tickets",
    source: "csv:closure"
  },
  {
    id: "tone",
    label: "Professional tone",
    source: "csv:tone"
  },
  {
    id: "sap-ics",
    label: "SAP support",
    source: "csv:sap-ics"
  },
  {
    id: "email",
    label: "Email phrases",
    source: "csv:email"
  },
  {
    id: "impact",
    label: "Explain impact",
    source: "csv:impact"
  },
  {
    id: "phrases",
    label: "Useful support phrases",
    source: "csv:phrases"
  },
  {
    id: "routing",
    label: "Case routing",
    source: "csv:routing"
  },
  {
    id: "scope",
    label: "Clarify scope",
    source: "csv:scope"
  }
];

function getLessonCategory(categoryId) {
  return lessonCategories.find((category) => category.id === categoryId) || lessonCategories[0];
}

module.exports = {
  lessonCategories,
  getLessonCategory
};
