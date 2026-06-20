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
    source: "csv:systems",
    questionPt: "O erro ocorre ao enviar os dados para o sistema externo.",
    options: [
      "The error occurs when sending the data to the external system.",
      "The error happens when send the data for the external system.",
      "The error occur while sending data at the external system.",
      "The error is happening to send the data on the external system."
    ],
    correctAnswer: "The error occurs when sending the data to the external system.",
    explanationPt:
      "'Occurs when sending' e natural para descrever em que momento o erro acontece."
  },
  {
    source: "csv:systems",
    questionPt: "Por favor, informe o identificador da solicitacao.",
    options: [
      "Please provide the request identifier.",
      "Please inform the identifier of request.",
      "Please provide me the request identification.",
      "Please say the identifier request."
    ],
    correctAnswer: "Please provide the request identifier.",
    explanationPt:
      "Em ingles profissional, 'provide the request identifier' e uma forma clara de pedir o dado."
  },
  {
    source: "csv:systems",
    questionPt: "A integracao nao recebeu uma resposta do sistema de destino.",
    options: [
      "The integration did not receive a response from the destination system.",
      "The integration did not received a response of the destination system.",
      "The integration has not receive an answer from destination system.",
      "The integration did not get response by the system destination."
    ],
    correctAnswer: "The integration did not receive a response from the destination system.",
    explanationPt: "Depois de 'did not', usamos o verbo base: 'receive'."
  },
  {
    source: "csv:systems",
    questionPt: "Voce pode compartilhar os logs do momento da falha?",
    options: [
      "Could you share the logs from the time of the failure?",
      "Could you share the logs in the failure time?",
      "Can you share the loggings when the failure happened?",
      "Could you send logs of when failed?"
    ],
    correctAnswer: "Could you share the logs from the time of the failure?",
    explanationPt: "'Logs from the time of the failure' indica claramente o periodo necessario."
  },
  {
    source: "csv:systems",
    questionPt: "Os dados foram enviados, mas ainda nao foram processados.",
    options: [
      "The data was sent but has not been processed yet.",
      "The data was sent but was not process yet.",
      "The data has sent but did not processed yet.",
      "The data was sending but is not processed already."
    ],
    correctAnswer: "The data was sent but has not been processed yet.",
    explanationPt: "A voz passiva 'was sent' e 'has not been processed yet' descreve o estado atual."
  },
  {
    source: "csv:systems",
    questionPt: "Precisamos confirmar onde o fluxo esta falhando.",
    options: [
      "We need to confirm where the flow is failing.",
      "We need confirm where is the flow failing.",
      "We need to confirm where the flow does fail.",
      "We need confirming in which place the flow fails."
    ],
    correctAnswer: "We need to confirm where the flow is failing.",
    explanationPt: "Em pergunta indireta, mantemos a ordem 'where the flow is failing'."
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
