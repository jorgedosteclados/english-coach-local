const writingMissionsByUnit = {
  2: {
    id: 2002,
    unit_id: 2,
    title: "Ask for Details",
    scenario: "A customer reported an issue but did not include enough information to investigate it.",
    task: "Write a polite message asking for the error, steps, and affected users.",
    placeholder: "Example: Could you please share the exact error message and the steps you followed?",
    xp_reward: 10
  },
  8: {
    id: 2008,
    unit_id: 8,
    title: "Follow Up Clearly",
    scenario: "You asked for diagnostic information two days ago and have not received a response.",
    task: "Write a concise follow-up that explains what you still need and why.",
    placeholder: "Example: I am following up because we still need the requested logs to continue our investigation.",
    xp_reward: 12
  }
};

const conversationContentByUnit = {
  4: {
    title: "Customer Conversation",
    subtitle: "Practice gathering the basic information needed to start an investigation.",
    scenario: "A customer cannot complete a task because an unexpected error appears after clicking Save.",
    initialMessage: "Hi, I receive an error every time I try to save my changes, and I cannot continue.",
    placeholder: "Example: Could you please share the exact error message and a screenshot?"
  },
  9: {
    title: "Difficult Customer",
    subtitle: "Practice empathy, calm language, and clear next steps.",
    scenario: "A frustrated customer says the issue is urgent and complains that it has taken too long.",
    initialMessage: "This issue is blocking my whole team. I already sent the details yesterday. Why is it not fixed yet?",
    placeholder: "Acknowledge the impact, avoid blame, and explain your next action."
  },
  15: {
    title: "Integration Conversation",
    subtitle: "Clarify ownership and collect evidence from connected systems.",
    scenario: "Data is not synchronizing between two business systems, and the customer does not know where the failure occurs.",
    initialMessage: "The record exists in our source system, but it never appears in the destination system.",
    placeholder: "Ask about timestamps, logs, identifiers, and the last successful synchronization."
  },
  20: {
    title: "Final Support Simulation",
    subtitle: "Handle a complete support interaction using everything from the course.",
    scenario: "A customer reports an intermittent issue affecting several users and needs a clear investigation plan.",
    initialMessage: "Several users are seeing the same error today, but it only happens sometimes. We need help urgently.",
    placeholder: "Respond with empathy, clarify impact, request evidence, and set expectations."
  }
};

const speakingPromptsByUnit = {
  5: [
    prompt(
      "You need to ask a customer for the exact error and reproduction steps.",
      "Could you please share the exact error message and the steps you followed?",
      "Could you please share the exact error message and the steps you followed before the issue occurred?",
      "Fale em blocos: 'exact error message' e depois 'the steps you followed'."
    )
  ],
  10: [
    prompt(
      "You are explaining the next troubleshooting action during a call.",
      "Please try the same action in another browser and let me know whether the issue continues.",
      "Please try the same action in another browser and let me know whether you can reproduce the issue.",
      "Mantenha um ritmo calmo nas instrucoes e destaque 'another browser'."
    )
  ],
  19: [
    prompt(
      "You need to summarize a complex case and set expectations clearly.",
      "I understand the impact of this issue, and I will coordinate with the relevant team and keep you updated.",
      "I understand the impact this issue is having on your team. I will coordinate with the relevant specialists and keep you updated on our progress.",
      "Pratique a ligacao entre 'coordinate with' e 'the relevant team' sem acelerar o final."
    )
  ]
};

function prompt(scenario, targetPhrase, betterVersion, tipPt) {
  return { scenario, targetPhrase, betterVersion, tipPt };
}

function getWritingMission(unitId) {
  return writingMissionsByUnit[unitId] || null;
}

function getConversationContent(unitId) {
  return conversationContentByUnit[unitId] || conversationContentByUnit[4];
}

function getSpeakingPrompts(unitId, fallbackPrompts) {
  return speakingPromptsByUnit[unitId] || fallbackPrompts;
}

module.exports = {
  getWritingMission,
  getConversationContent,
  getSpeakingPrompts
};
