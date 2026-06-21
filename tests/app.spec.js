const { test, expect } = require("@playwright/test");

const mockQuestions = [
  {
    questionPt: "Eu vou verificar internamente.",
    options: [
      "I will check internally.",
      "I will verify in the internal.",
      "I go check internal.",
      "I will look inside."
    ],
    correctAnswer: "I will check internally.",
    explanationPt: "Use 'check internally' para uma frase natural."
  },
  {
    questionPt: "Voce poderia fornecer mais detalhes?",
    options: [
      "Could you please provide more details?",
      "Can you give more details to me?",
      "You can provide more details?",
      "Could you please provide more detailings?"
    ],
    correctAnswer: "Could you please provide more details?",
    explanationPt: "Esta e uma forma educada de pedir informacoes."
  },
  {
    questionPt: "Obrigado pela sua paciencia.",
    options: [
      "Thank you for your patience.",
      "Thanks for your pacient.",
      "Thank you by your patience.",
      "Thanks for wait me."
    ],
    correctAnswer: "Thank you for your patience.",
    explanationPt: "Usamos 'for your patience'."
  },
  {
    questionPt: "Vou continuar investigando este caso.",
    options: [
      "I will continue investigating this case.",
      "I will keep investigate this case.",
      "I will still investigating this case.",
      "I will continue to this case."
    ],
    correctAnswer: "I will continue investigating this case.",
    explanationPt: "Depois de 'continue', podemos usar o verbo com -ing."
  },
  {
    questionPt: "Assim que eu tiver uma atualizacao, avisarei voce.",
    options: [
      "As soon as I have an update, I will let you know.",
      "When I will have an update, I advise you.",
      "As soon I have update, I tell you.",
      "When I have updating, I will inform."
    ],
    correctAnswer: "As soon as I have an update, I will let you know.",
    explanationPt: "Esta frase e natural em suporte profissional."
  }
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test("home and learning path render the main navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/Phase \d of 4/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Support Basics/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quick review" })).toHaveAttribute("href", "/review");

  await page.goto("/units");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Phase \d of 4/)).toBeVisible();
});

test("placement diagnostic completes and returns an estimated level", async ({ page }) => {
  await page.route("**/placement/submit", async (route) => {
    const body = route.request().postDataJSON();
    expect(Object.keys(body.answers)).toHaveLength(12);
    await route.fulfill({
      json: {
        totalCorrect: 12,
        totalQuestions: 12,
        assessmentId: 42,
        estimatedLevel: "B2",
        recommendedPhase: 4,
        objective: "Manage nuanced professional interactions.",
        skills: [
          { label: "Meaning and comprehension", correct: 3, total: 3, percent: 100 },
          { label: "Grammar and structure", correct: 3, total: 3, percent: 100 }
        ]
      }
    });
  });

  await page.route("**/placement/apply", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ assessmentId: 42 });
    await route.fulfill({
      json: { success: true, recommendedPhase: 4, startHref: "/lesson?unit=16&category=tone" }
    });
  });

  await page.goto("/placement");
  if (process.env.CAPTURE_PLACEMENT === "1") {
    await page.screenshot({ path: "/tmp/placement-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "/tmp/placement-mobile.png", fullPage: true });
  }
  await page.getByRole("button", { name: "Start level check" }).click();
  for (let index = 0; index < 12; index++) {
    const optionCount = await page.locator(".placement-option").count();
    await page.locator(".placement-option").nth(index % optionCount).click();
    await page.getByRole("button", { name: index === 11 ? "See my result" : "Continue" }).click();
  }

  await expect(page.getByText("Start around Phase 4")).toBeVisible();
  await expect(page.getByText("12/12")).toBeVisible();
  await expect(
    page.locator("#placementResult").getByText(/not an official CEFR certification/)
  ).toBeVisible();
  await page.getByRole("button", { name: "Start Phase 4" }).click();
  await expect(page).toHaveURL(/\/lesson\?unit=16&category=tone$/);
});

test("lesson can be completed from question to saved progress", async ({ page }) => {
  let questionIndex = 0;
  const correctOptionPositions = [];

  await page.route("**/ai/generate-lesson-question", async (route) => {
    const question = mockQuestions[questionIndex] || mockQuestions[mockQuestions.length - 1];
    questionIndex += 1;
    await route.fulfill({ json: question });
  });

  await page.route("**/ai/save-lesson-progress", async (route) => {
    const body = route.request().postDataJSON();

    expect(body).toMatchObject({
      xpEarned: 50,
      correctAnswers: 5,
      wrongAnswers: 0,
      unitId: 1
    });

    await route.fulfill({
      json: {
        success: true,
        totalXpAdded: 50,
        correctAdded: 5,
        wrongAdded: 0,
        streakDays: 3,
        unitProgress: { unitId: 1, status: "completed" },
        nextUnit: { id: 2, title: "Ask for Details", href: "/writing?unit=2" }
      }
    });
  });

  await page.goto("/lesson");

  for (const [questionIndex, question] of mockQuestions.entries()) {
    if (questionIndex === 0 || questionIndex === 4) {
      await expect(page.getByText(question.questionPt)).toBeVisible();
      const optionTexts = await page.locator(".option-btn").allTextContents();
      correctOptionPositions.push(optionTexts.indexOf(question.correctAnswer));
      await page.getByRole("button", { name: question.correctAnswer }).click();
    } else if (questionIndex === 1) {
      await expect(page.getByText("Listen and build the phrase")).toBeVisible();
      await page.evaluate((answer) => {
        answer.split(/\s+/).forEach((word) => {
          const token = [...document.querySelectorAll("#wordBank .word-token")].find(
            (button) => button.textContent === word
          );

          if (!token) {
            throw new Error(`Word token not found: ${word}`);
          }

          token.click();
        });
      }, question.correctAnswer);
    } else if (questionIndex === 2) {
      await page.locator("#lessonTypedAnswer").fill(question.correctAnswer);
    } else {
      await page.locator("#lessonSpokenAnswer").fill(question.correctAnswer);
    }

    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText(/Correct! \+10 XP/)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
  }

  await expect(page.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  await expect(page.getByText("Progress saved successfully.")).toBeVisible();
  await expect(page.locator(".completion-stats").getByText("50", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to next lesson" })).toBeVisible();
  expect(new Set(correctOptionPositions).size).toBe(2);
});

test("writing mission submits text and shows feedback completion", async ({ page }) => {
  await page.route("**/ai/correct", async (route) => {
    await route.fulfill({
      json: {
        result:
          "Original:\nI need details.\n\nCorrected:\nCould you please share more details?\n\nExplanation in Portuguese:\nUse uma pergunta educada."
      }
    });
  });

  await page.route("**/ai/save-lesson-progress", async (route) => {
    const body = route.request().postDataJSON();

    expect(body.xpEarned).toBeGreaterThan(0);
    expect(body.correctAnswers).toBe(1);

    await route.fulfill({
      json: {
        success: true,
        streakDays: 4,
        unitProgress: { unitId: body.unitId, status: "completed" },
        nextUnit: { id: 3, title: "Correct and Improve", href: "/correct?unit=3" }
      }
    });
  });

  await page.goto("/writing");
  await page.getByLabel("Your message").fill("Hi Ana, could you please share more details?");
  await page.getByRole("button", { name: "Check My Writing" }).click();

  await expect(page.getByRole("heading", { name: "Mission complete!" })).toBeVisible();
  await expect(page.getByText("Could you please share more details?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to next lesson" })).toHaveAttribute(
    "href",
    "/correct?unit=3"
  );
});

test("correction page validates empty input and shows AI feedback", async ({ page }) => {
  page.on("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Please write a sentence first.");
    await dialog.accept();
  });

  await page.route("**/ai/correct", async (route) => {
    await route.fulfill({
      json: {
        result:
          "Original:\nI have doubt.\n\nCorrected:\nI have a question.\n\nExplanation in Portuguese:\n'Doubt' nao e natural aqui."
      }
    });
  });

  await page.route("**/ai/save-lesson-progress", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        streakDays: 5,
        unitProgress: { unitId: 3, status: "completed" },
        nextUnit: { id: 4, title: "Customer Conversation", href: "/conversation?unit=4" }
      }
    });
  });

  await page.goto("/correct");
  await page.getByRole("button", { name: "Correct" }).click();

  await page.getByLabel("Your sentence").fill("I have doubt.");
  await page.getByRole("button", { name: "Correct" }).click();

  await expect(page.getByRole("heading", { name: "Feedback complete!" })).toBeVisible();
  await expect(page.getByText("I have a question.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to next lesson" })).toHaveAttribute(
    "href",
    "/conversation?unit=4"
  );
  await expect(page.getByRole("button", { name: "Start Again" })).toBeVisible();
});
