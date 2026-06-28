const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const cacheDir = path.join(os.tmpdir(), "english-coach-tts");
const defaultVoice = "Samantha";
const preferredVoices = [
  "Samantha",
  "Eddy (English (US))",
  "Flo (English (US))",
  "Sandy (English (US))",
  "Shelley (English (US))",
  "Reed (English (US))",
  "Kathy",
  "Fred",
  "Ralph"
];
const noveltyVoiceNames = new Set([
  "Albert",
  "Bad News",
  "Bahh",
  "Bells",
  "Boing",
  "Bubbles",
  "Cellos",
  "Good News",
  "Jester",
  "Junior",
  "Organ",
  "Superstar",
  "Trinoids",
  "Whisper",
  "Wobble",
  "Zarvox"
]);

async function generateSpeechFile({ text, rate, voice }) {
  const cleanText = normalizeSpeechText(text);
  if (!cleanText) {
    const error = new Error("Text is required for speech.");
    error.statusCode = 400;
    throw error;
  }

  await fs.mkdir(cacheDir, { recursive: true });
  const selectedVoice = await resolveVoice(voice);
  const wordsPerMinute = clamp(Math.round(180 * (Number(rate) || 0.9)), 90, 290);
  const cacheKey = crypto
    .createHash("sha256")
    .update(`${selectedVoice}|${wordsPerMinute}|${cleanText}`)
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
    selectedVoice,
    "-r",
    String(wordsPerMinute),
    "-o",
    filePath,
    "--file-format=m4af",
    cleanText
  ]);

  return filePath;
}

async function getAvailableVoices() {
  const output = await execFileOutputAsync("say", ["-v", "?"]);
  const voices = output
    .split("\n")
    .map(parseSayVoiceLine)
    .filter(Boolean)
    .filter((voice) => voice.lang === "en_US")
    .filter((voice) => !noveltyVoiceNames.has(voice.name))
    .map((voice) => ({
      ...voice,
      recommended: voice.name === defaultVoice,
      score: scoreVoice(voice.name)
    }))
    .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name));

  return voices.map(({ score, ...voice }) => voice);
}

async function resolveVoice(voiceName) {
  const voices = await getAvailableVoices();
  const requested = String(voiceName || "").trim();
  const selected = voices.find((voice) => voice.name === requested) || voices[0];

  return selected?.name || defaultVoice;
}

function parseSayVoiceLine(line) {
  const match = String(line || "").match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#\s*(.*)$/);
  if (!match) {
    return null;
  }

  return {
    name: match[1].trim(),
    lang: match[2].trim(),
    sample: match[3].trim()
  };
}

function scoreVoice(name) {
  const preferredIndex = preferredVoices.indexOf(name);
  if (preferredIndex >= 0) {
    return 100 - preferredIndex;
  }

  return 10;
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

function execFileOutputAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15000 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout || "");
    });
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  generateSpeechFile,
  getAvailableVoices
};
