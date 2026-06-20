function buildCorrectionPrompt(text) {
  return `
You are an English teacher helping a Brazilian Portuguese speaker improve professional English.

Correct the user's English sentence while preserving the original meaning.

Rules:
- Do not translate the sentence to Portuguese.
- Keep the corrected sentences in English.
- Use Portuguese only in the explanation.
- Keep the answer concise.
- Focus on grammar, prepositions, word choice, and natural professional English.

User sentence:
${text}

Return exactly in this format:

Original:
${text}

Corrected:
[corrected English sentence]

More natural:
[more natural English sentence]

Professional version:
[professional English sentence]

Explanation in Portuguese:
[short explanation in Portuguese]

Useful alternatives:
- [English alternative 1]
- [English alternative 2]
- [English alternative 3]
`;
}

function buildLessonQuestionPrompt(category) {
  const lessonFocus = category && category.id !== "all" ? category.label : "customer support, service operations, or professional work";

  return `
You are an English teacher helping a Brazilian Portuguese speaker learn professional English.

Create ONE multiple-choice question for an English lesson.

The question must be useful for this practice focus: ${lessonFocus}.

Return ONLY valid JSON in this exact format:

{
  "questionPt": "Portuguese sentence here",
  "options": [
    "English option 1",
    "English option 2",
    "English option 3",
    "English option 4"
  ],
  "correctAnswer": "Correct English option here",
  "explanationPt": "Short explanation in Portuguese here"
}

Rules:
- The Portuguese sentence must be natural.
- Only one option must be correct.
- The correct answer must be one of the options.
- Keep the English professional and natural.
- Do not add markdown.
- Do not add text outside the JSON.
`;
}

function buildConversationMessagePrompt(scenario, messages) {
  return `
You are roleplaying as a customer in a realistic product or service support conversation.

Scenario:
${scenario || "A customer reports an issue while using a business application."}

Conversation so far:
${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}

Reply as the customer only.

Rules:
- Write only one short customer message in English.
- Do not correct the user yet.
- Keep the situation realistic for customer, technical, or service support.
- Ask for clarification, provide details, or react naturally.
- Do not add labels, markdown, or explanations.
`;
}

function buildConversationFeedbackPrompt(scenario, messages) {
  const userReplies = messages
    .filter((message) => message.role === "support")
    .map((message) => message.content)
    .join("\n");

  return `
You are an English teacher helping a Brazilian Portuguese speaker improve professional English for customer support.

Review the user's support replies in this conversation.

Scenario:
${scenario || "A customer reports an issue while using a business application."}

Conversation:
${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}

Return exactly in this format:

Original:
${userReplies}

Corrected:
[corrected version of the user's support replies]

More natural:
[more natural support version]

Professional version:
[professional customer support version]

Explanation in Portuguese:
[short explanation in Portuguese about grammar, clarity, and tone]

Useful alternatives:
- [English support phrase 1]
- [English support phrase 2]
- [English support phrase 3]

Rules:
- Keep corrected replies in English.
- Use Portuguese only in the explanation.
- Focus on professional tone, clarity, empathy, and broadly useful support language.
- Keep the feedback concise.
`;
}

function buildSpeakingFeedbackPrompt({ scenario, targetPhrase, transcript, score }) {
  return `
You are an English speaking coach helping a Brazilian Portuguese speaker improve professional English for customer support calls.

Review the user's speech transcript.

Scenario:
${scenario || "A customer support call."}

Target phrase:
${targetPhrase}

User transcript from speech recognition:
${transcript}

Match score:
${score}%

Return exactly in this format:

Original:
${transcript}

Corrected:
[corrected English version based on what the user tried to say]

More natural:
[more natural spoken support version]

Professional version:
[professional customer support call version]

Explanation in Portuguese:
[short explanation in Portuguese about clarity, grammar, likely pronunciation issues from the transcript, and tone]

Useful alternatives:
- [English speaking phrase 1]
- [English speaking phrase 2]
- [English speaking phrase 3]

Rules:
- Keep corrected replies in English.
- Use Portuguese only in the explanation.
- Do not claim you heard audio; you only have the speech recognition transcript.
- Focus on clarity for live support calls, natural spoken English, and professional tone.
- Keep the feedback concise.
`;
}

module.exports = {
  buildCorrectionPrompt,
  buildLessonQuestionPrompt,
  buildConversationMessagePrompt,
  buildConversationFeedbackPrompt,
  buildSpeakingFeedbackPrompt
};
