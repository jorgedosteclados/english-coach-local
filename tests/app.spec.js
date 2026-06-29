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
  await page.getByRole("button", { name: "Sound effects are on" }).click();
  await page.locator("#soundVolume").fill("25");
  await page.getByRole("button", { name: "Mute effects" }).click();
  await expect(page.getByRole("button", { name: "Sound effects are off" })).toBeVisible();
  expect(await page.evaluate(() => window.EnglishCoachSound.getSettings().volume)).toBe(0.25);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("englishCoach.sound.settings")))
  ).toEqual({ muted: true, volume: 0.25 });

  await page.goto("/units");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Phase \d of 4/)).toBeVisible();
});

test("reading page saves dark Kindle-style mode", async ({ page }) => {
  await page.route("**/reading/context-translation", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.sourceType).toBe("trail");
    expect(body.text.length).toBeGreaterThan(10);

    await route.fulfill({
      json: {
        text: body.text,
        translation: "O cliente relata um problema que precisa de mais detalhes.",
        explanation: "A frase descreve o contexto inicial de um atendimento.",
        expressions: [
          {
            english: "more details",
            portuguese: "mais detalhes"
          }
        ],
        source: "ollama"
      }
    });
  });

  await page.goto("/reading?unit=25");
  await expect(page.getByRole("heading", { name: "A Clear First Reply" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Dark" }).click();

  await expect(page.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveClass(/reading-dark/);
  expect(await page.evaluate(() => localStorage.getItem("englishCoach.reading.darkMode"))).toBe("1");

  await page.getByRole("button", { name: "AI translate" }).click();
  await expect(page.getByText("Context translation")).toBeVisible();
  await expect(page.getByText("O cliente relata um problema")).toBeVisible();
  await expect(page.locator("#contextExpressions").getByText("more details", { exact: true })).toBeVisible();
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

  await page.addInitScript(() => {
    window.__lessonAudioEvents = [];

    class FakeAudio {
      constructor(src) {
        this.src = src;
        window.__lessonAudioEvents.push({ event: "construct", src });
        this.onplaying = null;
        this.onerror = null;
      }

      play() {
        window.__lessonAudioEvents.push({ event: "play", src: this.src });
        if (this.onplaying) {
          this.onplaying();
        }
        return Promise.resolve();
      }

      pause() {}
      removeAttribute() {}
      load() {}
    }

    Object.defineProperty(window, "Audio", { value: FakeAudio, configurable: true });
  });

  await page.route("**/tts/voices?**", async (route) => {
    await route.fulfill({
      json: {
        voices: [{ name: "en-US-JennyNeural", lang: "en-US", recommended: true }]
      }
    });
  });

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
  await page.evaluate(() => {
    window.testSoundEvents = [];
    window.EnglishCoachSound.play = (name) => window.testSoundEvents.push(name);
  });

  for (const [questionIndex, question] of mockQuestions.entries()) {
    if (questionIndex === 0 || questionIndex === 4) {
      await expect(page.getByText(question.questionPt)).toBeVisible();
      const optionTexts = await page.locator(".option-btn").allTextContents();
      correctOptionPositions.push(optionTexts.indexOf(question.correctAnswer));
      await page.getByRole("button", { name: question.correctAnswer }).click();
    } else if (questionIndex === 1) {
      await expect(page.getByText("Listen and build the phrase")).toBeVisible();
      await page.getByRole("button", { name: "Play phrase", exact: true }).click();
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
  await expect.poll(() => page.evaluate(() => window.testSoundEvents)).toContain("complete");
  expect((await page.evaluate(() => window.testSoundEvents)).filter((event) => event === "correct")).toHaveLength(5);
  expect(
    await page.evaluate(() =>
      window.__lessonAudioEvents.some(
        (event) => event.event === "play" && event.src.includes("/tts?") && event.src.includes("provider=edge")
      )
    )
  ).toBe(true);
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

test("technical call correction sends call mode and renders phrase feedback", async ({ page }) => {
  await page.route("**/ai/correct", async (route) => {
    const body = route.request().postDataJSON();

    expect(body.mode).toBe("call");
    expect(body.text).toContain("do expecting");

    await route.fulfill({
      json: {
        mode: "call",
        result:
          "Original:\nAnd how much you do expecting to be calculated for the first day?\n\nError type:\nQuestion structure\n\nExplanation in Portuguese:\nUse 'were you expecting' para essa pergunta.\n\nCorrected:\nHow much were you expecting to be calculated for the first day?\n\nMore natural:\nWhat amount were you expecting for the first day?\n\nProfessional version:\nCould you confirm the amount you expected for the first day?\n\nReusable pattern:\nWhat were you expecting for...?\n\nUseful alternatives:\n- What should the system calculate?\n- Could you confirm the expected amount?\n- What result were you expecting?"
      }
    });
  });

  await page.route("**/ai/save-lesson-progress", async (route) => {
    const body = route.request().postDataJSON();

    expect(body.unitId).toBe(14);
    expect(body.correctAnswers).toBe(1);

    await route.fulfill({
      json: {
        success: true,
        streakDays: 6,
        unitProgress: { unitId: 14, status: "completed" },
        nextUnit: { id: 15, title: "Integration Conversation", href: "/conversation?unit=15" }
      }
    });
  });

  await page.goto("/correct?unit=14&mode=call");
  await expect(page.getByRole("heading", { name: "Real Call Phrases" })).toBeVisible();
  await page
    .getByLabel("Call phrase or transcript lines")
    .fill("And how much you do expecting to be calculated for the first day?");
  await page.getByRole("button", { name: "Analyze Call Phrase" }).click();

  await expect(page.getByRole("heading", { name: "Call feedback complete!" })).toBeVisible();
  await expect(page.getByText("Question structure")).toBeVisible();
  await expect(page.getByText("What were you expecting for...?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to next lesson" })).toHaveAttribute(
    "href",
    "/conversation?unit=15"
  );
});

test("local AI chat streams messages to Ollama route", async ({ page }) => {
  await page.route("**/ai/local-chat-stream", async (route) => {
    const body = route.request().postDataJSON();

    expect(body.think).toBe(true);
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: "Help me practice a support call."
    });

    await route.fulfill({
      contentType: "text/event-stream",
      body:
        'event: token\ndata: {"token":"Sure. I will be the customer. "}\n\n' +
        'event: token\ndata: {"token":"What is your first question?"}\n\n' +
        "event: done\ndata: {}\n\n"
    });
  });

  await page.goto("/local-ai");
  await expect(page.getByRole("heading", { name: "Local AI Chat" })).toBeVisible();
  await expect(page.getByLabel("Deep thinking")).not.toBeChecked();
  await page.getByLabel("Deep thinking").check();
  await page.getByLabel("Message").fill("Help me practice a support call.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Help me practice a support call.")).toBeVisible();
  await expect(page.getByText("What is your first question?")).toBeVisible();
});
