const checkWritingBtn = document.getElementById("checkWritingBtn");
const writingText = document.getElementById("writingText");
const writingResult = document.getElementById("writingResult");
const writingResultContent = document.getElementById("writingResultContent");

checkWritingBtn.addEventListener("click", async () => {
  const text = writingText.value.trim();

  if (!text) {
    alert("Please write your message first.");
    return;
  }

  writingResult.classList.remove("hidden");
  writingResultContent.innerHTML = `
    <div class="feedback-box">
      Checking your writing...
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

    writingResultContent.innerHTML = `
      <div class="feedback-box">${data.result || data.error}</div>
    `;
  } catch (error) {
    writingResultContent.innerHTML = `
      <div class="feedback-box">Error connecting to the local AI route.</div>
    `;
  }
});
