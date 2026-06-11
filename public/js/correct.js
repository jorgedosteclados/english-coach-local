const correctBtn = document.getElementById("correctBtn");
const textInput = document.getElementById("text");
const resultSection = document.getElementById("result");
const resultContent = document.getElementById("resultContent");

correctBtn.addEventListener("click", async () => {
  const text = textInput.value.trim();

  if (!text) {
    alert("Please write a sentence first.");
    return;
  }

  resultSection.classList.remove("hidden");
  resultContent.innerHTML = `
    <div class="feedback-box">
      🤖 Correcting your English...
      <br><br>
      Please wait a few seconds.
    </div>
  `;

  try {
    const response = await fetch("/ai/correct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    resultContent.innerHTML = `
      <div class="feedback-box">${data.result || data.error}</div>
    `;
  } catch (error) {
    resultContent.innerHTML = `
      <div class="feedback-box">Error connecting to the local AI route.</div>
    `;
  }
});