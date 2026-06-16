const scenarioText = document.getElementById("conversationScenario").textContent.trim();
const conversationProgress = document.getElementById("conversationProgress");
const conversationThread = document.getElementById("conversationThread");
const conversationText = document.getElementById("conversationText");
const sendConversationBtn = document.getElementById("sendConversationBtn");
const conversationForm = document.getElementById("conversationForm");
const conversationResult = document.getElementById("conversationResult");
const conversationResultContent = document.getElementById("conversationResultContent");

const maxUserReplies = 4;
const conversationXp = 15;
const messages = [
  {
    role: "customer",
    content:
      "Hi, I am trying to save a transaction in SAP, but I receive an error and cannot continue."
  }
];

let userReplyCount = 0;
let conversationCompleted = false;
let sendInProgress = false;

sendConversationBtn.addEventListener("click", () => {
  sendUserReply();
});

conversationText.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    sendUserReply();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (conversationCompleted || userReplyCount === 0) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

function renderConversation() {
  conversationThread.innerHTML = messages
    .map(
      (message) => `
        <article class="conversation-message ${message.role}">
          <span>${message.role === "customer" ? "Customer" : "You"}</span>
          <p>${escapeHtml(message.content)}</p>
        </article>
      `
    )
    .join("");

  conversationProgress.textContent = `Reply ${Math.min(userReplyCount + 1, maxUserReplies)} of ${maxUserReplies}`;
  conversationThread.scrollTop = conversationThread.scrollHeight;
}

async function sendUserReply() {
  const text = conversationText.value.trim();

  if (!text) {
    alert("Please write a reply first.");
    return;
  }

  if (sendInProgress || conversationCompleted) {
    return;
  }

  sendInProgress = true;
  sendConversationBtn.disabled = true;
  sendConversationBtn.textContent = "Sending...";

  messages.push({
    role: "support",
    content: text
  });

  userReplyCount++;
  conversationText.value = "";
  renderConversation();

  if (userReplyCount >= maxUserReplies) {
    await finishConversation();
    return;
  }

  try {
    const response = await fetch("/ai/conversation-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scenario: scenarioText,
        messages
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    messages.push({
      role: "customer",
      content: data.reply
    });
  } catch (error) {
    console.error(error);
    messages.push({
      role: "customer",
      content: "Thank you. Could you please continue checking and let me know what you need from my side?"
    });
  } finally {
    sendInProgress = false;
    sendConversationBtn.disabled = false;
    sendConversationBtn.textContent = "Send Reply";
    renderConversation();
  }
}

async function finishConversation() {
  conversationCompleted = true;
  conversationForm.classList.add("hidden");
  conversationProgress.textContent = "Conversation complete";
  conversationResult.classList.remove("hidden");
  conversationResultContent.innerHTML = `
    <div class="feedback-box writing-loading">
      Preparing your conversation feedback...
      <br><br>
      Please wait a few seconds.
    </div>
  `;

  try {
    const [feedbackResponse, progress] = await Promise.all([
      fetchConversationFeedback(),
      saveConversationProgress()
    ]);

    renderConversationComplete(feedbackResponse.result, progress);
  } catch (error) {
    console.error(error);
    renderConversationComplete(
      [
        "Original:",
        messages.filter((message) => message.role === "support").map((message) => message.content).join("\n"),
        "",
        "Corrected:",
        "Your replies were understandable. Review them and try to keep each message clear, polite, and specific.",
        "",
        "More natural:",
        "Could you please share the exact error message and the transaction code so I can investigate further?",
        "",
        "Professional version:",
        "Thank you for the information. I will investigate this issue and update you as soon as I have more details.",
        "",
        "Explanation in Portuguese:",
        "Mantenha as respostas curtas, educadas e específicas. Peça detalhes como mensagem de erro, transação e passos para reproduzir.",
        "",
        "Useful alternatives:",
        "- Could you please share the exact error message?",
        "- I will investigate this issue and keep you updated.",
        "- Thank you for your patience while I check this."
      ].join("\n"),
      { streakDays: null, saved: false }
    );
  }
}

async function fetchConversationFeedback() {
  const response = await fetch("/ai/conversation-feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      scenario: scenarioText,
      messages
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

async function saveConversationProgress() {
  try {
    const response = await fetch("/ai/save-lesson-progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        xpEarned: conversationXp,
        correctAnswers: 1,
        wrongAnswers: 0,
        unitId: 4
      })
    });

    const data = await response.json();

    if (data.success) {
      return {
        streakDays: data.streakDays,
        saved: true
      };
    }
  } catch (error) {
    console.error(error);
  }

  return {
    streakDays: null,
    saved: false
  };
}

function renderConversationComplete(feedback, progress) {
  const streakText = progress && progress.streakDays ? `${progress.streakDays} day` : "Saved";

  conversationResultContent.innerHTML = `
    <div class="lesson-complete writing-complete">
      <div class="success-badge">✓</div>
      <h2>Conversation complete!</h2>
      <p class="motivation-message">Great work. You practiced responding in a real support conversation.</p>

      <div class="completion-stats">
        <div>
          <span>${conversationXp}</span>
          <small>XP earned</small>
        </div>
        <div>
          <span>${userReplyCount}</span>
          <small>Replies</small>
        </div>
        <div>
          <span>${streakText}</span>
          <small>Current streak</small>
        </div>
      </div>

      ${renderStructuredFeedback(feedback)}

      <a href="/units" class="primary-link continue-mission-link">Continue</a>
      <button type="button" class="secondary-btn" id="restartConversationBtn">Start Again</button>
    </div>
  `;

  document.getElementById("restartConversationBtn").addEventListener("click", () => {
    window.location.reload();
  });
}

renderConversation();
