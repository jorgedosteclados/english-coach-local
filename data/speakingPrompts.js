const speakingPrompts = [
  {
    scenario: "A customer asks for an update on a critical support ticket.",
    targetPhrase:
      "I am still investigating this issue and will update you as soon as I have more information.",
    betterVersion:
      "Thank you for your patience. I am still investigating this issue and will update you as soon as I have more information.",
    tipPt:
      "Fale devagar e una 'will update you' como uma ideia unica. Essa frase soa profissional em calls de suporte."
  },
  {
    scenario: "You need to ask the customer for the exact error message.",
    targetPhrase:
      "Could you please share the exact error message and the steps you followed?",
    betterVersion:
      "Could you please share the exact error message and the steps you followed before the issue occurred?",
    tipPt:
      "Use 'could you please' para soar educado. 'Exact error message' e uma expressao muito comum em suporte."
  },
  {
    scenario: "You are closing a ticket after the customer confirms the fix.",
    targetPhrase:
      "I am glad the issue has been resolved. Can we proceed with closing this ticket?",
    betterVersion:
      "I am glad the issue has been resolved. With your confirmation, we can proceed with closing this ticket.",
    tipPt:
      "A palavra 'resolved' deve soar como 'ri-zolvd'. A frase completa e boa para encerramento de chamado."
  },
  {
    scenario: "You need to explain that you will check internally.",
    targetPhrase:
      "I will check this internally and get back to you as soon as possible.",
    betterVersion:
      "I will check this internally with the relevant team and get back to you as soon as possible.",
    tipPt:
      "'Get back to you' e natural para dizer que voce retornara com uma resposta."
  }
];

module.exports = speakingPrompts;
