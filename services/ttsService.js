const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const cacheDir = path.join(os.tmpdir(), "english-coach-tts");
const defaultVoice = "Samantha";

async function generateSpeechFile({ text, rate }) {
  const cleanText = normalizeSpeechText(text);
  if (!cleanText) {
    const error = new Error("Text is required for speech.");
    error.statusCode = 400;
    throw error;
  }

  await fs.mkdir(cacheDir, { recursive: true });
  const wordsPerMinute = clamp(Math.round(180 * (Number(rate) || 0.9)), 90, 290);
  const cacheKey = crypto
    .createHash("sha256")
    .update(`${defaultVoice}|${wordsPerMinute}|${cleanText}`)
    .digest("hex");
  const filePath = path.join(cacheDir, `${cacheKey}.m4a`);

  try {
    await fs.access(filePath);
    return filePath;
  } catch (error) {
    // Cache miss; generate below.
  }

  await execFileAsync("say", [
    "-v",
    defaultVoice,
    "-r",
    String(wordsPerMinute),
    "-o",
    filePath,
    "--file-format=m4af",
    cleanText
  ]);

  return filePath;
}

function normalizeSpeechText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15000 }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  generateSpeechFile
};
