const visualReviewCards = [
  {
    id: "screenshot-error",
    image: "/images/review/error-screen.svg",
    category: "Request information",
    contextPt: "O cliente recebeu um erro no SAP e voce precisa pedir o print.",
    promptPt: "Peca o print do erro de forma profissional.",
    targetPhrase: "Could you please send a screenshot of the error?",
    professionalVersion:
      "Could you please send a screenshot of the error so I can investigate it further?",
    tipPt:
      "Use 'screenshot' para print de tela. 'Could you please' deixa o pedido educado e profissional."
  },
  {
    id: "case-update",
    image: "/images/review/case-update.svg",
    category: "Case update",
    contextPt: "Voce ainda esta analisando o chamado e precisa atualizar o cliente.",
    promptPt: "Avise que voce esta investigando e retornara com novidades.",
    targetPhrase:
      "I am still investigating this issue and will update you as soon as I have more information.",
    professionalVersion:
      "Thank you for your patience. I am still investigating this issue and will update you as soon as I have more information.",
    tipPt:
      "'I am still investigating' soa natural para trabalho em andamento. Evite prometer prazo se voce ainda nao tem a resposta."
  },
  {
    id: "transaction-code",
    image: "/images/review/transaction-code.svg",
    category: "SAP support",
    contextPt: "Voce precisa saber qual transacao SAP o cliente estava usando.",
    promptPt: "Peca o codigo da transacao.",
    targetPhrase: "Could you please provide the transaction code?",
    professionalVersion:
      "Could you please provide the transaction code and the steps you followed before the error occurred?",
    tipPt:
      "'Provide the transaction code' e mais natural que traduzir diretamente como 'inform the code'."
  },
  {
    id: "ticket-closure",
    image: "/images/review/ticket-closure.svg",
    category: "Closing tickets",
    contextPt: "O cliente confirmou que o problema foi resolvido.",
    promptPt: "Pergunte se o chamado pode ser encerrado.",
    targetPhrase: "Can we proceed with closing this ticket?",
    professionalVersion:
      "I am glad the issue has been resolved. Can we proceed with closing this ticket?",
    tipPt:
      "Em suporte, 'closing this ticket' e a forma natural para falar sobre encerrar um chamado."
  }
];

module.exports = visualReviewCards;
