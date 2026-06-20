const learningPathSections = [
  {
    id: 1,
    title: "Support Foundations",
    description: "Build the core language for clear and polite customer support.",
    units: [
      unit(1, "Support Basics", "Practice useful phrases for everyday support.", "lesson", "/lesson?unit=1&category=request-info"),
      unit(2, "Ask for Details", "Write clear requests for the information you need.", "writing", "/writing?unit=2"),
      unit(3, "Correct and Improve", "Turn common mistakes into natural English.", "correction", "/correct?unit=3"),
      unit(4, "Customer Conversation", "Handle a short conversation with a customer.", "conversation", "/conversation?unit=4"),
      unit(5, "Speaking Practice", "Build confidence for your first live support calls.", "speaking", "/speaking?unit=5")
    ]
  },
  {
    id: 2,
    title: "Ticket Mastery",
    description: "Gather evidence, troubleshoot issues, and keep customers updated.",
    units: [
      unit(6, "Case Updates", "Explain what you investigated and what happens next.", "lesson", "/lesson?unit=6&category=case-update"),
      unit(7, "Troubleshooting", "Practice clear instructions and diagnostic questions.", "lesson", "/lesson?unit=7&category=troubleshooting"),
      unit(8, "Follow-up Writing", "Write a concise follow-up without sounding repetitive.", "writing", "/writing?unit=8"),
      unit(9, "Difficult Customer", "Stay calm and helpful in a challenging conversation.", "conversation", "/conversation?unit=9"),
      unit(10, "Call Confidence", "Speak troubleshooting phrases with a steady rhythm.", "speaking", "/speaking?unit=10")
    ]
  },
  {
    id: 3,
    title: "Technical Problem Solving",
    description: "Use precise English for systems, integrations, impact, and technical scope.",
    units: [
      unit(11, "Systems and Integrations", "Practice technical phrases for connected systems and data flows.", "lesson", "/lesson?unit=11&category=systems"),
      unit(12, "Explain the Impact", "Describe business impact clearly and objectively.", "lesson", "/lesson?unit=12&category=impact"),
      unit(13, "Clarify the Scope", "Separate product issues from configuration questions.", "lesson", "/lesson?unit=13&category=scope"),
      unit(14, "Technical Correction", "Improve the accuracy of a technical explanation.", "correction", "/correct?unit=14"),
      unit(15, "Integration Conversation", "Guide a customer through a system integration case.", "conversation", "/conversation?unit=15")
    ]
  },
  {
    id: 4,
    title: "Confident Communicator",
    description: "Polish your tone and handle complete support interactions naturally.",
    units: [
      unit(16, "Professional Tone", "Choose language that sounds confident and respectful.", "lesson", "/lesson?unit=16&category=tone"),
      unit(17, "Email Excellence", "Use natural structure and phrases in support emails.", "lesson", "/lesson?unit=17&category=email"),
      unit(18, "Close the Ticket", "Confirm resolution and close cases professionally.", "lesson", "/lesson?unit=18&category=closure"),
      unit(19, "Fluent Support Call", "Deliver longer support phrases clearly and naturally.", "speaking", "/speaking?unit=19"),
      unit(20, "Final Support Simulation", "Complete an end-to-end customer conversation.", "conversation", "/conversation?unit=20")
    ]
  }
];

function unit(id, title, description, activityType, href) {
  return {
    id,
    title,
    description,
    unitOrder: id,
    activityType,
    href,
    isLockedDefault: 0
  };
}

const learningPathUnits = learningPathSections.flatMap((section) =>
  section.units.map((pathUnit) => ({
    ...pathUnit,
    sectionId: section.id,
    sectionTitle: section.title,
    sectionDescription: section.description
  }))
);

module.exports = {
  learningPathSections,
  learningPathUnits
};
