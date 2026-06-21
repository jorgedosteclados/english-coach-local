module.exports = [
  question(1, "A1", "comprehension", "Como dizer 'Preciso de mais detalhes'?", [
    "I need more details.", "I need detail more.", "I am need details.", "I need many detail."
  ], "I need more details."),
  question(2, "A1", "grammar", "Qual frase informa que o problema foi resolvido?", [
    "The issue is resolved.", "The issue resolve.", "The issue has resolve.", "The issue resolving yesterday."
  ], "The issue is resolved."),
  question(3, "A1", "professional-tone", "Qual é a forma mais educada de pedir para alguém aguardar?", [
    "Please wait a moment.", "You wait now.", "Wait me.", "Stay waiting."
  ], "Please wait a moment."),
  question(4, "A2", "comprehension", "O cliente enviou uma captura de tela. Qual resposta confirma o recebimento?", [
    "Thank you for sending the screenshot.", "Thank you to send the screenshot.", "I thank the screenshot sent.", "Thanks because screenshot."
  ], "Thank you for sending the screenshot."),
  question(5, "A2", "grammar", "Qual frase descreve uma investigação que ainda está acontecendo?", [
    "We are still investigating the issue.", "We still investigate the issue now.", "We are investigate the issue.", "We have still investigate it."
  ], "We are still investigating the issue."),
  question(6, "A2", "problem-solving", "Você precisa confirmar se um teste funcionou. O que pergunta?", [
    "Could you let me know whether the test worked?", "Can you say if the test work?", "Tell me the test is working?", "Could you know the test worked?"
  ], "Could you let me know whether the test worked?"),
  question(7, "B1", "grammar", "Escolha a frase condicional correta.", [
    "If the issue happens again, please send us the logs.", "If the issue will happen again, send the logs.", "If the issue happen again, you sent logs.", "If happens the issue, please sending logs."
  ], "If the issue happens again, please send us the logs."),
  question(8, "B1", "problem-solving", "Qual frase diferencia evidência de conclusão?", [
    "The logs suggest a timeout, but we still need to confirm the cause.", "The logs prove everything, maybe the cause is timeout.", "The timeout is surely caused because logs.", "We confirm the cause before checking the logs."
  ], "The logs suggest a timeout, but we still need to confirm the cause."),
  question(9, "B1", "professional-tone", "Qual atualização evita prometer um prazo que ainda não foi confirmado?", [
    "We are investigating this as a priority and will share the next update by 3 p.m.", "We guarantee this will be fixed very soon.", "It should probably be fixed at some point today.", "We cannot tell you anything until it is fixed."
  ], "We are investigating this as a priority and will share the next update by 3 p.m."),
  question(10, "B2", "professional-tone", "Qual resposta contesta uma suposição do cliente sem soar defensiva?", [
    "I understand why it may appear related; however, the current evidence points to a separate cause.", "You are incorrect because this is clearly unrelated.", "As I already explained, our system is not responsible.", "That assumption makes no sense based on the evidence."
  ], "I understand why it may appear related; however, the current evidence points to a separate cause."),
  question(11, "B2", "problem-solving", "Qual frase comunica impacto e incerteza com precisão?", [
    "The interruption appears limited to new requests, although we are still assessing the full impact.", "The interruption only affects new requests, definitely, but we are not sure.", "Maybe everything is affected, although only new requests failed.", "The full impact is limited and still completely unknown."
  ], "The interruption appears limited to new requests, although we are still assessing the full impact."),
  question(12, "B2", "grammar", "Qual frase apresenta uma ação anterior relevante para a investigação atual?", [
    "The customer had already restarted the service before the logs were collected.", "The customer already restarts the service before we collected logs.", "The customer has restarted before the logs had collect.", "The service was already restart when collecting logs."
  ], "The customer had already restarted the service before the logs were collected.")
];

function question(id, level, skill, prompt, options, correctAnswer) {
  return { id, level, skill, prompt, options, correctAnswer };
}
