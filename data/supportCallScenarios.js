const supportCallScenarios = [
  {
    id: "save-error",
    title: "Save Error",
    level: "A2-B1",
    scenario:
      "A customer cannot save changes in a business application and needs help collecting the right information.",
    customerProfile:
      "Polite but busy. The customer can share the exact error, browser, timing, and reproduction steps when asked.",
    initialMessage:
      "Hi, I am trying to save my changes, but the system keeps showing an error and I cannot continue."
  },
  {
    id: "urgent-blocker",
    title: "Urgent Blocker",
    level: "B1",
    scenario:
      "A frustrated customer says an issue is blocking their team and wants a clear update.",
    customerProfile:
      "Frustrated but reasonable. The customer wants empathy, ownership, and a clear next step.",
    initialMessage:
      "This issue is blocking my team. We reported it already, and we need to know what is happening."
  },
  {
    id: "integration-sync",
    title: "Integration Sync",
    level: "B1-B2",
    scenario:
      "A customer reports that records are not syncing between two systems and needs troubleshooting guidance.",
    customerProfile:
      "Technical customer. They can provide timestamps, record IDs, logs, and the last successful sync if asked.",
    initialMessage:
      "The records exist in our source system, but they are not appearing in the destination system."
  }
];

function getSupportCallScenario(id) {
  return supportCallScenarios.find((scenario) => scenario.id === id) || supportCallScenarios[0];
}

module.exports = {
  supportCallScenarios,
  getSupportCallScenario
};
