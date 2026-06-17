const seedLessonQuestions = [
  {
    source: "csv:request-info",
    questionPt: "Voce poderia enviar o print do erro?",
    options: [
      "Could you please send a screenshot of the error?",
      "Could you please send a print of the error?",
      "Can you send to me the error image?",
      "Please send the error printed."
    ],
    correctAnswer: "Could you please send a screenshot of the error?",
    explanationPt:
      "Em ingles profissional, usamos 'screenshot' para print de tela e 'could you please' para pedir de forma educada."
  },
  {
    source: "csv:request-info",
    questionPt: "Voce pode confirmar qual transacao esta usando?",
    options: [
      "Could you confirm which transaction you are using?",
      "Can you confirm what transaction are you using?",
      "Could you confirm which transaction are using?",
      "Can you confirm the transaction that you use it?"
    ],
    correctAnswer: "Could you confirm which transaction you are using?",
    explanationPt:
      "Em pergunta indireta, a ordem correta e 'which transaction you are using', sem inverter 'are you'."
  },
  {
    source: "csv:case-update",
    questionPt: "Ainda estou investigando este caso.",
    options: [
      "I am still investigating this case.",
      "I still investigating this case.",
      "I am still verify this case.",
      "I continue still this case."
    ],
    correctAnswer: "I am still investigating this case.",
    explanationPt:
      "Use 'I am still investigating' para dizer que a investigacao continua agora."
  },
  {
    source: "csv:case-update",
    questionPt: "Assim que eu tiver novidades, aviso voce.",
    options: [
      "I will let you know as soon as I have an update.",
      "I will advise you when I will have news.",
      "I let you know when I have update.",
      "I will tell you as soon I have new."
    ],
    correctAnswer: "I will let you know as soon as I have an update.",
    explanationPt:
      "A estrutura natural e 'as soon as I have an update'. Depois de 'as soon as', nao usamos 'will'."
  },
  {
    source: "csv:troubleshooting",
    questionPt: "Por favor, tente limpar o cache e acessar novamente.",
    options: [
      "Please try clearing the cache and accessing it again.",
      "Please try to clean the cache and access again it.",
      "Please make clean cache and access again.",
      "Please try clear cache and access it again."
    ],
    correctAnswer: "Please try clearing the cache and accessing it again.",
    explanationPt:
      "Depois de 'try', o gerundio soa natural para uma sugestao: 'try clearing' e 'accessing'."
  },
  {
    source: "csv:troubleshooting",
    questionPt: "Voce consegue reproduzir o problema em outro navegador?",
    options: [
      "Can you reproduce the issue in another browser?",
      "Can you reproduce the problem on other browser?",
      "Do you can reproduce the issue in another navigator?",
      "Can you make the issue again in other browser?"
    ],
    correctAnswer: "Can you reproduce the issue in another browser?",
    explanationPt:
      "'Reproduce the issue' e uma frase comum em suporte tecnico. Use 'another browser' para outro navegador."
  },
  {
    source: "csv:closure",
    questionPt: "Podemos encerrar este chamado?",
    options: [
      "Can we close this ticket?",
      "Can we finish this called?",
      "Can we closure this ticket?",
      "Can we close this request of support?"
    ],
    correctAnswer: "Can we close this ticket?",
    explanationPt:
      "Em suporte, 'close this ticket' e a forma simples e natural para encerrar um chamado."
  },
  {
    source: "csv:closure",
    questionPt: "Fico feliz que o problema tenha sido resolvido.",
    options: [
      "I am glad the issue has been resolved.",
      "I am happy that the problem was solve.",
      "I glad the issue has resolved.",
      "I am glad the issue has been solutioned."
    ],
    correctAnswer: "I am glad the issue has been resolved.",
    explanationPt:
      "'Has been resolved' indica que o problema foi resolvido. 'Solutioned' nao e natural."
  },
  {
    source: "csv:tone",
    questionPt: "Obrigado pela sua paciencia enquanto verifico isso.",
    options: [
      "Thank you for your patience while I check this.",
      "Thank you by your patience while I verify this.",
      "Thanks for your pacient while I see this.",
      "Thank you for wait while I check this."
    ],
    correctAnswer: "Thank you for your patience while I check this.",
    explanationPt:
      "Use 'thank you for your patience'. 'Patience' e o substantivo; 'patient' e paciente/adjetivo."
  },
  {
    source: "csv:tone",
    questionPt: "Entendo a urgencia deste problema.",
    options: [
      "I understand the urgency of this issue.",
      "I understand the urgency from this issue.",
      "I know this problem is urgency.",
      "I understand this issue urgent."
    ],
    correctAnswer: "I understand the urgency of this issue.",
    explanationPt:
      "A forma natural e 'the urgency of this issue'. Isso soa profissional e empatico."
  },
  {
    source: "csv:sap-ics",
    questionPt: "O erro ocorre ao salvar o pedido no SAP.",
    options: [
      "The error occurs when saving the order in SAP.",
      "The error happens when save the order on SAP.",
      "The error occur to save the order in SAP.",
      "The error is happening in save the order at SAP."
    ],
    correctAnswer: "The error occurs when saving the order in SAP.",
    explanationPt:
      "'Occurs when saving' e natural para descrever em que momento o erro acontece."
  },
  {
    source: "csv:sap-ics",
    questionPt: "Por favor, informe o codigo da transacao.",
    options: [
      "Please provide the transaction code.",
      "Please inform the transaction code.",
      "Please provide me the code of transaction.",
      "Please say the transaction code."
    ],
    correctAnswer: "Please provide the transaction code.",
    explanationPt:
      "Em ingles profissional, 'provide the transaction code' soa mais natural que 'inform the code'."
  },
  {
    source: "csv:email",
    questionPt: "Segue abaixo a atualizacao do caso.",
    options: [
      "Please find the case update below.",
      "Follow below the update of the case.",
      "Below follows the case actualization.",
      "See following the update case below."
    ],
    correctAnswer: "Please find the case update below.",
    explanationPt:
      "'Please find ... below' e uma formula comum em emails profissionais."
  },
  {
    source: "csv:email",
    questionPt: "Fico no aguardo do seu retorno.",
    options: [
      "I look forward to hearing from you.",
      "I stay waiting your return.",
      "I wait your comeback.",
      "I am in the await of your return."
    ],
    correctAnswer: "I look forward to hearing from you.",
    explanationPt:
      "Essa e a forma natural e profissional para encerrar um email aguardando resposta."
  }
];

module.exports = seedLessonQuestions;
