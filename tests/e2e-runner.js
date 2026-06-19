const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const sqlite3 = require("sqlite3").verbose();

const rootDir = path.resolve(__dirname, "..");
const baseURL = "http://127.0.0.1:3000";
const dbPath = path.join(rootDir, "english_coach.db");
const backupPath = path.join(rootDir, "english_coach.e2e-backup.db");
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
      await seedUserProgress({
        totalXp: 80,
        activitiesCompleted: 3,
        streakDays: 3
      });
      await seedUnitProgress([1, 2, 3]);

      const page = await newPage(browser);
      await page.goto(baseURL);
      await pause();
      await expectVisibleText(page, "Support Foundations");
      await expectVisibleText(page, "Customer Conversation");
      await expectVisibleText(page, "Daily Review");
      await expectVisibleText(page, "3 of 20 units completed");
      await expectVisibleText(page, "Your badges");
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

    await run(results, "lesson completes and saves progress", async () => {
      const page = await newPage(browser);
      let categoryQuestionIndex = 0;
      const requestedCategories = [];

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

        await route.fulfill({ json: question });
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
            unitProgress: { unitId: 6, status: "completed" }
          }
        });
      });

      await page.goto(`${baseURL}/lesson?unit=6&category=request-info`);
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
      assert.ok(requestedCategories.includes("request-info"));
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

        await route.fulfill({
          json: {
            success: true,
            streakDays: 4,
            unitProgress: { unitId: body.unitId, status: "completed" }
          }
        });
      });

      await page.goto(`${baseURL}/writing`);
      await pause();
      await page.getByLabel("Your message").fill("Hi Ana, could you please share more details?");
      await pause();
      await page.getByRole("button", { name: "Check My Writing" }).click();
      await expectVisibleText(page, "Mission complete!");
      await expectVisibleText(page, "Could you please share more details?");
      assert.equal(await page.getByRole("link", { name: "Continue" }).getAttribute("href"), "/");
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
            unitProgress: { unitId: 3, status: "completed" }
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
      await page.getByRole("button", { name: "Start Again" }).waitFor();
      await pause();
      await page.close();
    });

    await run(results, "conversation completes with customer replies and feedback", async () => {
      const page = await newPage(browser);
      const customerReplies = [
        "The error says that the document cannot be saved because a mandatory field is missing.",
        "The transaction code is VA01, and it happens when I click Save.",
        "I can send a screenshot and the timestamp of the issue.",
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
          unitId: 4
        });

        await route.fulfill({
          json: {
            success: true,
            streakDays: 6,
            unitProgress: { unitId: 4, status: "completed" }
          }
        });
      });

      await page.goto(`${baseURL}/conversation`);
      await pause();
      await expectVisibleText(page, "Customer Conversation");

      const supportReplies = [
        "Hi, thank you for contacting us. Could you please share the exact error message?",
        "Thanks. Could you please confirm the transaction code and when the error appears?",
        "Please send the screenshot and timestamp so I can investigate further.",
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
          unitId: 5
        });

        await route.fulfill({
          json: {
            success: true,
            streakDays: 7,
            unitProgress: { unitId: 5, status: "completed" }
          }
        });
      });

      await page.goto(`${baseURL}/speaking`);
      await pause();
      await expectVisibleText(page, "Speaking Practice");
      await expectVisibleText(page, "Say this aloud");
      await page.getByRole("button", { name: "Show Better Version" }).click();
      await expectVisibleText(page, "More natural version");

      await page.evaluate(() => {
        renderFeedback(document.getElementById("targetPhrase").textContent);
      });

      await expectVisibleText(page, "Match score: 100%");
      await expectVisibleText(page, "AI Feedback");
      await expectVisibleText(page, "I will keep you updated.");
      await page.getByRole("button", { name: "I Practiced This" }).click();
      await expectVisibleText(page, "Speaking complete!");
      await expectVisibleText(page, "Progress saved successfully.");
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
            unitProgress: null
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
  backupDatabase();

  const server = spawn(process.execPath, ["app.js"], {
    cwd: rootDir,
    env: process.env,
    stdio: "ignore",
    windowsHide: true
  });

  return waitForServer().then(() => server);
}

function backupDatabase() {
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
  }
}

function restoreDatabase() {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, dbPath);
    fs.unlinkSync(backupPath);
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
