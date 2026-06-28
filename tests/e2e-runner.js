const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const sqlite3 = require("sqlite3").verbose();
const placementQuestions = require("../data/placementQuestions");

const rootDir = path.resolve(__dirname, "..");
const testPort = 3100;
const baseURL = `http://127.0.0.1:${testPort}`;
const sourceDbPath = path.join(rootDir, "english_coach.db");
const dbPath = path.join(os.tmpdir(), `english-coach-e2e-${process.pid}.db`);
const headed = process.env.PLAYWRIGHT_HEADED === "1";
const visualDelay = headed ? 1200 : 0;

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

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({
    headless: !headed,
    slowMo: headed ? 700 : 0
  });
  const results = [];

  try {
    await run(results, "home and learning path render", async () => {
      await clearLearningPreference();
      await seedUserProgress({
        totalXp: 80,
        activitiesCompleted: 3,
        streakDays: 3
      });
      await seedUnitProgress([1, 25, 2, 3]);

      const page = await newPage(browser);
      await page.goto(baseURL);
      await pause();
      await expectVisibleText(page, "Support Foundations");
      await expectVisibleText(page, "Customer Conversation");
      await expectVisibleText(page, "Daily Review");
      await expectVisibleText(page, "4 of 25 units completed");
      await expectVisibleText(page, "Your badges");
      await page.getByRole("button", { name: "Sound effects are on" }).click();
      await page.locator("#soundVolume").fill("25");
      await page.getByRole("button", { name: "Mute effects" }).click();
      await page.reload();
      await page.getByRole("button", { name: "Sound effects are off" }).waitFor();
      assert.equal(await page.evaluate(() => window.EnglishCoachSound.getSettings().volume), 0.25);
      const conversationStep = page.getByRole("button", { name: /Customer Conversation/ });
      await conversationStep.click();
      const practiceLink = conversationStep.getByRole("link", { name: "Start lesson +10 XP" });
      await practiceLink.waitFor({ state: "visible" });
      assert.equal(await practiceLink.getAttribute("href"), "/conversation?unit=4");
      await expectVisibleText(page, "Ticket Mastery");
      assert.equal(await page.getByRole("link", { name: "Quick review" }).getAttribute("href"), "/review");

      const lockedSaveResponse = await page.request.post(`${baseURL}/ai/save-lesson-progress`, {
        data: {
          xpEarned: 10,
          correctAnswers: 1,
          wrongAnswers: 0,
          unitId: 6
        }
      });
      assert.equal(lockedSaveResponse.status(), 409);
      assert.equal(
        (await lockedSaveResponse.json()).error,
        "Complete the previous learning path steps first."
      );

      await page.goto(`${baseURL}/units`);
      await page.waitForURL(`${baseURL}/`);
      await expectVisibleText(page, "Support Foundations");
      await pause();
      await page.close();
    });

    await run(results, "interactive reading opens trail text and imports a book", async () => {
      const page = await newPage(browser);

      await page.goto(`${baseURL}/reading?unit=25`);
      await expectVisibleText(page, "A Clear First Reply");
      await expectVisibleText(page, "Unit 2 Reading");
      const localPronounResponse = await page.request.get(`${baseURL}/reading/translate?word=his`);
      assert.equal(localPronounResponse.status(), 200);
      assert.deepEqual(await localPronounResponse.json(), {
        word: "his",
        translation: "dele / seu",
        source: "local"
      });
      await page.getByRole("button", { name: "issue", exact: true }).first().click();
      await expectVisibleText(page, "problema");
      const translationResponse = await page.request.post(`${baseURL}/reading/translation`, {
        data: { word: "muggleword", translation: "palavra teste" }
      });
      assert.equal(translationResponse.status(), 200);
      const savedTranslationResponse = await page.request.get(
        `${baseURL}/reading/translate?word=muggleword`
      );
      assert.equal(savedTranslationResponse.status(), 200);
      assert.deepEqual(await savedTranslationResponse.json(), {
        word: "muggleword",
        translation: "palavra teste",
        source: "user"
      });
      await page.getByRole("button", { name: "Save word" }).click();
      await expectVisibleText(page, "Saved");
      await page.getByRole("button", { name: "Close translation" }).click();
      await page.locator(".reading-sentence").nth(2).click();
      assert.equal(
        await page.locator(".reading-sentence.active").textContent(),
        "Could you please send me more details about the problem?"
      );
      await page.locator("#readingRate").fill("1.4");
      assert.equal(
        await page.evaluate(() => localStorage.getItem("englishCoach.reading.rate")),
        "1.4"
      );
      if (await page.locator("#wordSheet").isVisible()) {
        await page.getByRole("button", { name: "Close translation" }).click();
      }

      const progressResponse = await page.request.post(`${baseURL}/reading/progress`, {
        data: {
          sourceType: "trail",
          sourceId: "25",
          chapterIndex: 0,
          sentenceIndex: 2
        }
      });
      assert.equal(progressResponse.status(), 200);

      await page.getByRole("button", { name: "Complete reading" }).click();
      await expectVisibleText(page, "Reading complete");
      await expectVisibleText(page, "Progress saved. You earned 10 XP.");
      assert.equal(
        await page.getByRole("link", { name: "Continue to next lesson" }).getAttribute("href"),
        "/conversation?unit=4"
      );

      await page.goto(`${baseURL}/library`);
      await expectVisibleText(page, "Your Library");
      await page.getByLabel("Title").fill("Support Stories");
      await page.getByLabel("PDF or TXT file").setInputFiles({
        name: "support-stories.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(
          [
          "Chapter 1",
          "The customer opened a new support ticket. I checked the error message and asked for more details.",
          "",
          "Chapter 2",
          "The team reviewed the logs. We found the cause and shared a clear update with the customer."
          ].join("\n")
        )
      });
      await page.getByRole("button", { name: "Import and read" }).click();
      await page.waitForURL("**/reading/book/*");
      await expectVisibleText(page, "Support Stories");
      await expectVisibleText(page, "Chapter 1");
      await expectVisibleText(page, "1/2");
      await page.getByRole("button", { name: "customer", exact: true }).first().click();
      await expectVisibleText(page, "cliente");

      await page.goto(`${baseURL}/library`);
      await expectVisibleText(page, "Support Stories");
      await expectVisibleText(page, "2 chapters");
      await page.close();
    });

    await run(results, "placement diagnostic estimates and saves a level", async () => {
      const page = await newPage(browser);
      const invalidResponse = await page.request.post(`${baseURL}/placement/submit`, {
        data: { answers: {} }
      });
      assert.equal(invalidResponse.status(), 400);

      await page.goto(`${baseURL}/placement`);
      await expectVisibleText(page, "Find your starting level");
      const correctPositions = await page.evaluate(
        (correctAnswers) =>
          window.placementQuestions.map((question, index) =>
            question.options.indexOf(correctAnswers[index])
          ),
        placementQuestions.map((question) => question.correctAnswer)
      );
      assert.deepEqual(
        [0, 1, 2, 3].map(
          (position) => correctPositions.filter((answerPosition) => answerPosition === position).length
        ),
        [3, 3, 3, 3]
      );
      await page.getByRole("button", { name: "Start level check" }).click();

      for (let index = 0; index < 12; index++) {
        await page
          .getByRole("button", { name: placementQuestions[index].correctAnswer, exact: true })
          .click();
        await page.getByRole("button", { name: index === 11 ? "See my result" : "Continue" }).click();
      }

      await expectVisibleText(page, "Estimated current range");
      await expectVisibleText(page, "Start around Phase 4");
      await expectVisibleText(page, "12/12");
      await page
        .locator("#placementResult")
        .getByText("not an official CEFR certification", { exact: false })
        .waitFor({ state: "visible" });

      await page.goto(`${baseURL}/progress`);
      await expectVisibleText(page, "Estimated B2 · Phase 4");
      await expectVisibleText(page, "12/12 correct on your latest level check");

      await page.goto(`${baseURL}/placement`);
      await page.getByRole("button", { name: "Start level check" }).click();
      for (let index = 0; index < placementQuestions.length; index++) {
        await page
          .getByRole("button", { name: placementQuestions[index].correctAnswer, exact: true })
          .click();
        await page.getByRole("button", { name: index === 11 ? "See my result" : "Continue" }).click();
      }
      await page.getByRole("button", { name: "Start Phase 4" }).click();
      await page.waitForURL("**/lesson?unit=16&category=tone");
      await page.goto(baseURL);
      assert.equal(await page.locator(".coach-step.placement-skipped").count(), 15);
      await expectVisibleText(page, "4 of 25 units completed");
      await clearLearningPreference();
      await page.close();
    });

    await run(results, "question bank tracks inventory and delays AI generation", async () => {
      await resetQuestionUsage("csv:request-info", 0);
      process.env.DATABASE_PATH = dbPath;
      const { getLessonQuestion } = require("../services/questionService");

      const page = await newPage(browser);
      await page.goto(`${baseURL}/question-bank`);
      await expectVisibleText(page, "Question bank");
      await expectVisibleText(page, "Saved questions first");
      await expectVisibleText(page, "Request information");
      await expectVisibleText(page, "AI generated");
      await page.close();

      let aiCalls = 0;
      const savedQuestion = await getLessonQuestion("request-info", {
        generateAIResponse: async () => {
          aiCalls += 1;
          throw new Error("AI should not be called while saved questions are unused.");
        }
      });

      assert.equal(aiCalls, 0);
      assert.equal(savedQuestion.source, "csv:request-info");
      assert.ok(savedQuestion.questionId);

      await resetQuestionUsage("csv:request-info", 1);
      const generatedQuestion = await getLessonQuestion("request-info", {
        generateAIResponse: async () => {
          aiCalls += 1;
          return JSON.stringify({
            questionPt: "Confirme que voce vai acompanhar o caso.",
            options: [
              "I will keep monitoring the case.",
              "I will keep monitor the case.",
              "I keep to monitoring the case.",
              "I will follow the case monitored."
            ],
            correctAnswer: "I will keep monitoring the case.",
            explanationPt: "Use 'keep monitoring' para expressar acompanhamento continuo."
          });
        }
      });

      assert.equal(aiCalls, 1);
      assert.equal(generatedQuestion.source, "ai:request-info");
      assert.ok(generatedQuestion.questionId);
    });

    await run(results, "lesson completes and saves progress", async () => {
      const page = await newPage(browser);
      let categoryQuestionIndex = 0;
      const requestedCategories = [];
      const correctOptionPositions = [];

      await page.route("**/ai/generate-lesson-question", async (route) => {
        const body = route.request().postDataJSON();
        const category = body.category || "all";
        requestedCategories.push(category);

        const question =
          category === "request-info"
            ? mockQuestions[categoryQuestionIndex] || mockQuestions[mockQuestions.length - 1]
            : mockQuestions[0];

        if (category === "request-info") {
          categoryQuestionIndex += 1;
        }

        await route.fulfill({
          json: {
            ...question,
            questionId: mockQuestions.indexOf(question) + 1
          }
        });
      });

      const savedAttempts = [];
      await page.route("**/ai/save-question-attempt", async (route) => {
        savedAttempts.push(route.request().postDataJSON());
        await route.fulfill({ json: { success: true } });
      });

      await page.route("**/ai/save-lesson-progress", async (route) => {
        const body = route.request().postDataJSON();

        assert.deepEqual(body, {
          xpEarned: 50,
          correctAnswers: 5,
          wrongAnswers: 0,
          unitId: 6
        });

        await route.fulfill({
          json: {
            success: true,
            totalXpAdded: 50,
            correctAdded: 5,
            wrongAdded: 0,
            streakDays: 3,
            unitProgress: { unitId: 6, status: "completed" },
            nextUnit: { id: 7, title: "Troubleshooting", href: "/lesson?unit=7&category=troubleshooting" }
          }
        });
      });

      await page.goto(`${baseURL}/lesson?unit=6&category=request-info`);
      await page.evaluate(() => {
        window.testSoundEvents = [];
        window.EnglishCoachSound.play = (name) => window.testSoundEvents.push(name);
      });
      await pause();
      await expectVisibleText(page, "Practice focus");
      const categorySelected = await page.evaluate(() => {
        const select = document.getElementById("lessonCategory");
        return select?.value === "request-info";
      });

      assert.equal(categorySelected, true);
      await pause();

      for (const [questionIndex, question] of mockQuestions.entries()) {
        if (questionIndex === 0 || questionIndex === 4) {
          await expectVisibleText(page, question.questionPt);
          const optionTexts = await page.locator(".option-btn").allTextContents();
          correctOptionPositions.push(optionTexts.indexOf(question.correctAnswer));
        } else if (questionIndex === 1) {
          await expectVisibleText(page, "Listen and build the phrase");
          await page.getByRole("button", { name: "Play phrase", exact: true }).waitFor();
        } else if (questionIndex === 2) {
          await expectVisibleText(page, "Listen and type what you hear");
          await page.getByRole("button", { name: "Play phrase slowly" }).waitFor();
        } else {
          await expectVisibleText(page, "Speak this phrase");
          await expectVisibleText(page, question.correctAnswer);
        }
        await pause();

        if (questionIndex === 0 || questionIndex === 4) {
          await page.getByRole("button", { name: question.correctAnswer }).click();
        } else if (questionIndex === 1) {
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

        await pause();
        await page.getByRole("button", { name: "Check answer" }).click();
        await expectVisibleText(page, "Correct! +10 XP.");
        await pause();
        await page.getByRole("button", { name: "Continue" }).click();
      }

      await expectVisibleText(page, "Lesson complete!");
      await expectVisibleText(page, "Progress saved successfully.");
      await expectVisibleText(page, "XP earned");
      const soundEvents = await page.evaluate(() => window.testSoundEvents);
      assert.equal(soundEvents.filter((event) => event === "correct").length, 5);
      assert.ok(soundEvents.includes("complete"));
      await page.getByRole("button", { name: "Continue to next lesson" }).click();
      await page.waitForURL("**/lesson?unit=7&category=troubleshooting");
      assert.ok(requestedCategories.includes("request-info"));
      assert.equal(savedAttempts.length, 5);
      assert.deepEqual(
        savedAttempts.map((attempt) => attempt.exerciseType),
        ["multiple-choice", "listen-build", "listen-type", "speak", "multiple-choice"]
      );
      assert.equal(savedAttempts.every((attempt) => attempt.isCorrect), true);
      assert.equal(new Set(correctOptionPositions).size, 2);
      await pause();
      await page.close();
    });

    await run(results, "adaptive review schedules mistakes", async () => {
      const reviewQuestion = await getReviewTestQuestion();
      const page = await newPage(browser);

      for (let attempt = 0; attempt < 2; attempt++) {
        const wrongResponse = await page.request.post(`${baseURL}/ai/save-question-attempt`, {
          data: {
            questionId: reviewQuestion.questionId,
            exerciseType: "multiple-choice",
            userAnswer: "Incorrect review answer",
            isCorrect: false
          }
        });
        assert.equal(wrongResponse.status(), 200);
      }

      const activityResponse = await page.request.post(`${baseURL}/ai/save-lesson-progress`, {
        data: {
          xpEarned: 12,
          correctAnswers: 1,
          wrongAnswers: 0,
          unitId: null
        }
      });
      assert.equal(activityResponse.status(), 200);
      const activityData = await activityResponse.json();
      assert.equal(activityData.nextUnit.href, "/conversation?unit=4");

      await page.goto(`${baseURL}/progress`);
      await expectVisibleText(page, "Progress & mastery");
      await expectVisibleText(page, "1 review due");
      await expectVisibleText(page, reviewQuestion.questionPt);
      await expectVisibleText(page, "12");

      await page.goto(`${baseURL}/mistakes`);
      await expectVisibleText(page, "Review your mistakes");
      await expectVisibleText(page, reviewQuestion.questionPt);
      await expectVisibleText(page, "2 mistakes");
      await page.getByRole("button", { name: reviewQuestion.correctAnswer }).click();
      const saveResponsePromise = page.waitForResponse("**/ai/save-question-attempt");
      await page.getByRole("button", { name: "Check answer" }).click();
      const saveResponse = await saveResponsePromise;
      assert.equal(saveResponse.status(), 200);
      await expectVisibleText(page, "Correct.");
      await page.getByRole("button", { name: "Continue" }).click();
      await expectVisibleText(page, "Review complete!");
      await pause();
      await page.close();
    });

    await run(results, "phase checkpoint requires 80 percent mastery", async () => {
      await seedUnitProgress([1, 2, 3, 4, 5]);
      const page = await newPage(browser);
      let questionIndex = 0;
      const requestedCategories = [];
      const savedCheckpoints = [];

      await page.route("**/ai/generate-lesson-question", async (route) => {
        requestedCategories.push(route.request().postDataJSON().category);
        const question = mockQuestions[questionIndex % mockQuestions.length];
        questionIndex++;
        await route.fulfill({
          json: {
            ...question,
            questionId: mockQuestions.indexOf(question) + 1
          }
        });
      });
      await page.route("**/ai/save-question-attempt", async (route) => {
        await route.fulfill({ json: { success: true } });
      });
      await page.route("**/ai/save-lesson-progress", async (route) => {
        savedCheckpoints.push(route.request().postDataJSON());
        await route.fulfill({
          json: {
            success: true,
            streakDays: 4,
            unitProgress: { unitId: 21, status: "completed" }
          }
        });
      });

      const checkpointUrl = `${baseURL}/lesson?unit=21&checkpoint=1&categories=request-info,tone,phrases`;
      await page.goto(checkpointUrl);
      await expectVisibleText(page, "Foundation Checkpoint");
      await page.evaluate(() => {
        correctAnswers = 6;
        wrongAnswers = 2;
        xpEarned = 60;
        finishLesson();
      });
      await expectVisibleText(page, "Review and try again");
      await expectVisibleText(page, "You need 7 correct answers");
      assert.equal(savedCheckpoints.length, 0);

      questionIndex = 0;
      await page.goto(checkpointUrl);
      const checkpointExerciseTypes = [
        "multiple-choice",
        "listen-build",
        "listen-type",
        "speak",
        "multiple-choice",
        "listen-type",
        "listen-build",
        "multiple-choice"
      ];

      for (let index = 0; index < checkpointExerciseTypes.length; index++) {
        const exerciseType = checkpointExerciseTypes[index];
        await expectVisibleText(page, `Question ${index + 1} of 8`);

        if (exerciseType === "multiple-choice") {
          await page.locator(".option-btn").first().waitFor();
        } else if (exerciseType === "listen-build") {
          await page.locator("#wordBank .word-token").first().waitFor();
        } else if (exerciseType === "listen-type") {
          await page.locator("#lessonTypedAnswer").waitFor();
        } else {
          await page.locator("#lessonSpokenAnswer").waitFor();
        }

        const correctAnswer = await page.evaluate(() => currentQuestion.correctAnswer);

        if (exerciseType === "multiple-choice") {
          await page.getByRole("button", { name: correctAnswer }).click();
        } else if (exerciseType === "listen-build") {
          await page.evaluate((answer) => {
            answer.split(/\s+/).forEach((word) => {
              const token = [...document.querySelectorAll("#wordBank .word-token")].find(
                (button) => button.textContent === word
              );
              token.click();
            });
          }, correctAnswer);
        } else if (exerciseType === "listen-type") {
          await page.locator("#lessonTypedAnswer").fill(correctAnswer);
        } else {
          await page.locator("#lessonSpokenAnswer").fill(correctAnswer);
        }

        await page.getByRole("button", { name: "Check answer" }).click();
        await expectVisibleText(page, "Correct! +10 XP.");
        await page.getByRole("button", { name: "Continue" }).click();
      }

      await expectVisibleText(page, "Checkpoint complete!");
      await expectVisibleText(page, "The next phase is now unlocked.");
      assert.equal(savedCheckpoints.length, 1);
      assert.deepEqual(savedCheckpoints[0], {
        xpEarned: 80,
        correctAnswers: 8,
        wrongAnswers: 0,
        unitId: 21
      });
      assert.deepEqual(
        requestedCategories.slice(-8),
        ["request-info", "tone", "phrases", "request-info", "tone", "phrases", "request-info", "tone"]
      );
      await pause();
      await page.close();
    });

    await run(results, "writing mission submits and shows feedback", async () => {
      const page = await newPage(browser);

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

        assert.equal(body.correctAnswers, 1);
        assert.ok(body.xpEarned > 0);
        assert.equal(body.unitId, 8);

        await route.fulfill({
          json: {
            success: true,
            streakDays: 4,
            unitProgress: { unitId: body.unitId, status: "completed" },
            nextUnit: { id: 9, title: "Difficult Customer", href: "/conversation?unit=9" }
          }
        });
      });

      await page.goto(`${baseURL}/writing?unit=8`);
      await pause();
      await expectVisibleText(page, "Follow Up Clearly");
      await page.getByLabel("Your message").fill("Hi Ana, could you please share more details?");
      await pause();
      await page.getByRole("button", { name: "Check My Writing" }).click();
      await expectVisibleText(page, "Mission complete!");
      await expectVisibleText(page, "Could you please share more details?");
      assert.equal(
        await page.getByRole("link", { name: "Continue to next lesson" }).getAttribute("href"),
        "/conversation?unit=9"
      );
      await pause();
      await page.close();
    });

    await run(results, "correction validates input and shows feedback", async () => {
      const page = await newPage(browser);
      let sawEmptyInputDialog = false;

      page.on("dialog", async (dialog) => {
        sawEmptyInputDialog = true;
        assert.equal(dialog.message(), "Please write a sentence first.");
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

      await page.goto(`${baseURL}/correct`);
      await pause();
      await page.getByRole("button", { name: "Correct" }).click();
      assert.equal(sawEmptyInputDialog, true);

      await page.getByLabel("Your sentence").fill("I have doubt.");
      await pause();
      await page.getByRole("button", { name: "Correct" }).click();
      await expectVisibleText(page, "Feedback complete!");
      await expectVisibleText(page, "I have a question.");
      assert.equal(
        await page.getByRole("link", { name: "Continue to next lesson" }).getAttribute("href"),
        "/conversation?unit=4"
      );
      await page.getByRole("button", { name: "Start Again" }).waitFor();
      await pause();
      await page.close();
    });

    await run(results, "conversation completes with customer replies and feedback", async () => {
      const page = await newPage(browser);
      const customerReplies = [
        "The source system shows the record as sent, but the destination never receives it.",
        "The request identifier is 48271, and the last successful sync was yesterday.",
        "I can send the integration logs and the timestamp of the failure.",
        "Thank you, I will wait for your update."
      ];
      let customerReplyIndex = 0;

      await page.route("**/ai/conversation-message", async (route) => {
        const reply = customerReplies[customerReplyIndex] || customerReplies[customerReplies.length - 1];
        customerReplyIndex += 1;
        await route.fulfill({ json: { reply } });
      });

      await page.route("**/ai/conversation-feedback", async (route) => {
        await route.fulfill({
          json: {
            result: [
              "Original:",
              "I will check this for you.",
              "",
              "Corrected:",
              "I will check this issue for you.",
              "",
              "More natural:",
              "I will investigate this issue and keep you updated.",
              "",
              "Professional version:",
              "Thank you for the details. I will investigate this issue and update you as soon as possible.",
              "",
              "Explanation in Portuguese:",
              "A resposta esta clara, mas pode soar mais profissional com 'investigate' e 'keep you updated'.",
              "",
              "Useful alternatives:",
              "- Could you please share the exact error message?",
              "- I will investigate this issue and keep you updated.",
              "- Thank you for your patience while I check this."
            ].join("\n")
          }
        });
      });

      await page.route("**/ai/save-lesson-progress", async (route) => {
        const body = route.request().postDataJSON();

        assert.deepEqual(body, {
          xpEarned: 15,
          correctAnswers: 1,
          wrongAnswers: 0,
          unitId: 15
        });

        await route.fulfill({
          json: {
            success: true,
            streakDays: 6,
            unitProgress: { unitId: 15, status: "completed" },
            nextUnit: { id: 16, title: "Professional Tone", href: "/lesson?unit=16&category=tone" }
          }
        });
      });

      await page.goto(`${baseURL}/conversation?unit=15`);
      await pause();
      await expectVisibleText(page, "Integration Conversation");

      const supportReplies = [
        "Hi, thank you for contacting us. Could you please share the exact error message?",
        "Thanks. Could you please confirm the request identifier and the last successful synchronization?",
        "Please send the integration logs and timestamp so I can investigate further.",
        "Thank you for the details. I will investigate this issue and keep you updated."
      ];

      for (const reply of supportReplies) {
        await page.getByLabel("Your support reply").fill(reply);
        await pause();
        await page.getByRole("button", { name: "Send Reply" }).click();
      }

      await expectVisibleText(page, "Conversation complete!");
      await expectVisibleText(page, "Thank you for the details. I will investigate this issue");
      await expectVisibleText(page, "XP earned");
      assert.equal(
        await page.getByRole("link", { name: "Continue to next lesson" }).getAttribute("href"),
        "/lesson?unit=16&category=tone"
      );
      await pause();
      await page.close();
    });

    await run(results, "speaking practice shows recognition flow and saves progress", async () => {
      const page = await newPage(browser);

      await page.route("**/ai/speaking-feedback", async (route) => {
        const body = route.request().postDataJSON();

        assert.ok(body.transcript);
        assert.ok(body.targetPhrase);
        assert.equal(body.score, 100);

        await route.fulfill({
          json: {
            result: [
              "Original:",
              body.transcript,
              "",
              "Corrected:",
              body.targetPhrase,
              "",
              "More natural:",
              "Thank you for your patience. I will investigate this issue and keep you updated.",
              "",
              "Professional version:",
              "Thank you for your patience. I am investigating this issue and will update you as soon as I have more information.",
              "",
              "Explanation in Portuguese:",
              "A fala esta clara. Para soar mais natural em call, use ritmo calmo e destaque 'keep you updated'.",
              "",
              "Useful alternatives:",
              "- I will keep you updated.",
              "- I am checking this internally.",
              "- I will get back to you as soon as possible."
            ].join("\n")
          }
        });
      });

      await page.route("**/ai/save-lesson-progress", async (route) => {
        const body = route.request().postDataJSON();

        assert.deepEqual(body, {
          xpEarned: 20,
          correctAnswers: 1,
          wrongAnswers: 0,
          unitId: 19
        });

        await route.fulfill({
          json: {
            success: true,
            streakDays: 7,
            unitProgress: { unitId: 19, status: "completed" },
            nextUnit: { id: 20, title: "Final Support Simulation", href: "/conversation?unit=20" }
          }
        });
      });

      await page.goto(`${baseURL}/speaking?unit=19`);
      await pause();
      await expectVisibleText(page, "Speaking Practice");
      await expectVisibleText(page, "Say this aloud");
      await expectVisibleText(page, "coordinate with the relevant team");
      await page.getByRole("button", { name: "Listen to phrase" }).waitFor();
      await page.getByRole("button", { name: "Listen slowly" }).waitFor();
      await page.getByText("See a more natural version").click();
      await expectVisibleText(page, "More natural version");

      const reorderedScore = await page.evaluate(() =>
        calculateScore("please try another browser", "browser another try please")
      );
      assert.ok(reorderedScore < 100);

      await page.evaluate(() => {
        renderFeedback(document.getElementById("targetPhrase").textContent);
      });

      await expectVisibleText(page, "100%");
      await expectVisibleText(page, "word match");
      await expectVisibleText(page, "Target comparison");
      await page.getByText("View detailed AI feedback").click();
      await expectVisibleText(page, "AI Feedback");
      await expectVisibleText(page, "I will keep you updated.");
      await page.getByRole("button", { name: "I Practiced This" }).click();
      await expectVisibleText(page, "Speaking complete!");
      await expectVisibleText(page, "Progress saved successfully.");
      assert.equal(
        await page.getByRole("link", { name: "Continue to next lesson" }).getAttribute("href"),
        "/conversation?unit=20"
      );
      await page.getByRole("button", { name: "Practice again" }).waitFor();
      assert.equal(await page.locator("#speakingCard").isHidden(), true);
      await pause();
      await page.close();
    });

    await run(results, "daily review uses visual listening cards and saves progress", async () => {
      const page = await newPage(browser);

      await page.route("**/ai/save-lesson-progress", async (route) => {
        const body = route.request().postDataJSON();

        assert.equal(body.xpEarned, 32);
        assert.equal(body.correctAnswers, 4);
        assert.equal(body.wrongAnswers, 0);
        assert.equal(body.unitId, null);

        await route.fulfill({
          json: {
            success: true,
            streakDays: 8,
            unitProgress: null,
            nextUnit: { id: 4, title: "Customer Conversation", href: "/conversation?unit=4" }
          }
        });
      });

      await page.goto(`${baseURL}/review`);
      await pause();
      await expectVisibleText(page, "Daily Review");
      await expectVisibleText(page, "Card 1 of 4");

      for (let index = 0; index < 4; index++) {
        const targetPhrase = await page.locator("#reviewTargetPhrase").textContent();

        await page.getByRole("button", { name: "Listen" }).click();
        await page.getByLabel("Your English phrase").fill(targetPhrase.trim());
        await page.getByRole("button", { name: "Check Answer" }).click();
        await expectVisibleText(page, "Good recall.");
        await expectVisibleText(page, "Target phrase");
        await expectVisibleText(page, "Professional version:");
        await page.getByRole("button", { name: "Next Card" }).click();
      }

      await expectVisibleText(page, "Review complete!");
      await expectVisibleText(page, "Progress saved successfully.");
      assert.equal(
        await page.getByRole("link", { name: "Continue to next lesson" }).getAttribute("href"),
        "/conversation?unit=4"
      );
      await pause();
      await page.close();
    });

    await run(results, "history searches, expands details, and starts practice again", async () => {
      await seedHistoryCorrection();

      const page = await newPage(browser);

      await page.goto(`${baseURL}/history`);
      await pause();
      await expectVisibleText(page, "History");
      await expectVisibleText(page, "I have doubt in this ticket.");

      await page.getByLabel("Search history").fill("ticket");
      await expectVisibleText(page, "I have a question about this ticket.");

      await page.getByRole("button", { name: "View details" }).first().click();
      await expectVisibleText(page, "Explanation in Portuguese");
      await expectVisibleText(page, "Use 'question' para soar mais natural.");

      await page.getByRole("button", { name: "Practice again" }).first().click();
      await page.waitForURL("**/correct");
      assert.equal(await page.getByLabel("Your sentence").inputValue(), "I have doubt in this ticket.");
      await pause();
      await page.close();
    });
  } finally {
    await browser.close();
    stopServer(server);
    restoreDatabase();
  }

  printResults(results);

  if (results.some((result) => result.status === "failed")) {
    process.exit(1);
  }
}

async function newPage(browser) {
  const page = await browser.newPage();

  page.setDefaultTimeout(5000);

  return page;
}

async function run(results, name, fn) {
  try {
    await fn();
    results.push({ name, status: "passed" });
  } catch (error) {
    results.push({ name, status: "failed", error });
  }
}

async function expectVisibleText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible" });
}

function pause() {
  if (!visualDelay) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, visualDelay));
}

function startServer() {
  prepareTestDatabase();

  const server = spawn(process.execPath, ["app.js"], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(testPort), DATABASE_PATH: dbPath },
    stdio: "ignore",
    windowsHide: true
  });

  return waitForServer().then(() => server);
}

function prepareTestDatabase() {
  cleanupTestDatabase();
  fs.copyFileSync(sourceDbPath, dbPath);
}

function restoreDatabase() {
  cleanupTestDatabase();
}

function cleanupTestDatabase() {
  for (const suffix of ["", "-shm", "-wal"]) {
    const filePath = `${dbPath}${suffix}`;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

function waitForServer() {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function check() {
      http
        .get(baseURL, (response) => {
          response.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - startedAt > 15000) {
            reject(new Error("Server did not start within 15 seconds."));
            return;
          }

          setTimeout(check, 250);
        });
    }

    check();
  });
}

function stopServer(server) {
  if (server && !server.killed) {
    server.kill();
  }
}

function seedHistoryCorrection() {
  const feedback = [
    "Original:",
    "I have doubt in this ticket.",
    "",
    "Corrected:",
    "I have a question about this ticket.",
    "",
    "More natural:",
    "I have a question about this support ticket.",
    "",
    "Professional version:",
    "I have a question regarding this ticket.",
    "",
    "Explanation in Portuguese:",
    "Use 'question' para soar mais natural.",
    "",
    "Useful alternatives:",
    "- I have a concern about this ticket.",
    "- I need clarification about this ticket.",
    "- I have a question regarding this case."
  ].join("\n");

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.run(
      "INSERT INTO corrections (original_text, ai_feedback) VALUES (?, ?)",
      ["I have doubt in this ticket.", feedback],
      (error) => {
        db.close();

        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

function getReviewTestQuestion() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      db.run("DELETE FROM question_attempts");
      db.run("DELETE FROM question_mastery");
      db.get(
        "SELECT id, question_pt, correct_answer FROM lesson_questions ORDER BY id LIMIT 1",
        [],
        (selectError, question) => {
          if (selectError || !question) {
            db.close();
            reject(selectError || new Error("No lesson question available for review test."));
            return;
          }

          db.close();
          resolve({
            questionId: question.id,
            questionPt: question.question_pt,
            correctAnswer: question.correct_answer
          });
        }
      );
    });
  });
}

function resetQuestionUsage(source, timesUsed) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.run(
      "UPDATE lesson_questions SET times_used = ? WHERE source = ?",
      [timesUsed, source],
      (error) => {
        db.close();

        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

function seedUnitProgress(unitIds) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      db.run("DELETE FROM user_unit_progress WHERE user_id = 1", (deleteError) => {
        if (deleteError) {
          db.close();
          reject(deleteError);
        }
      });

      const statement = db.prepare(
        `
        INSERT INTO user_unit_progress (
          user_id,
          unit_id,
          status,
          completed_count,
          last_completed_at,
          updated_at
        )
        VALUES (1, ?, 'completed', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
      );

      unitIds.forEach((unitId) => {
        statement.run(unitId);
      });

      statement.finalize((finalizeError) => {
        db.close();

        if (finalizeError) {
          reject(finalizeError);
          return;
        }

        resolve();
      });
    });
  });
}

function seedUserProgress({ totalXp, activitiesCompleted, streakDays }) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.run(
      `
      UPDATE user_progress
      SET
        total_xp = ?,
        lessons_completed = ?,
        streak_days = ?,
        last_study_date = DATE('now'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      `,
      [totalXp, activitiesCompleted, streakDays],
      (error) => {
        db.close();

        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

function clearLearningPreference() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run("DELETE FROM learning_preferences", (error) => {
      db.close();
      if (error) return reject(error);
      resolve();
    });
  });
}

function printResults(results) {
  for (const result of results) {
    if (result.status === "passed") {
      console.log(`PASS ${result.name}`);
    } else {
      console.log(`FAIL ${result.name}`);
      console.error(result.error);
    }
  }

  const passed = results.filter((result) => result.status === "passed").length;
  console.log(`\n${passed}/${results.length} E2E checks passed.`);
}

main().catch((error) => {
  restoreDatabase();
  console.error(error);
  process.exit(1);
});
