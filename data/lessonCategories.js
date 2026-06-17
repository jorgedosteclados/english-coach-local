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
  }
];

function getLessonCategory(categoryId) {
  return lessonCategories.find((category) => category.id === categoryId) || lessonCategories[0];
}

module.exports = {
  lessonCategories,
  getLessonCategory
};
