const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const cacheDir = path.join(os.tmpdir(), "english-coach-tts");
const defaultEdgeTtsCommand = path.join(os.homedir(), "Library/Python/3.9/bin/edge-tts");
const defaultVoice = "Samantha";
const defaultEdgeVoice = "en-US-JennyNeural";
const preferredEdgeVoices = [
  "en-US-JennyNeural",
  "en-US-AriaNeural",
  "en-US-AvaNeural",
  "en-US-EmmaNeural",
  "en-US-GuyNeural",
  "en-US-AndrewNeural",
  "en-US-BrianNeural"
];
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

async function generateSpeechFile({ text, rate, voice, provider }) {
  const cleanText = normalizeSpeechText(text);
  if (!cleanText) {
    const error = new Error("Text is required for speech.");
    error.statusCode = 400;
    throw error;
  }

  if (normalizeProvider(provider) === "edge") {
    return generateEdgeSpeechFile({ text: cleanText, rate, voice });
  }

  return generateLocalSpeechFile({ text: cleanText, rate, voice });
}

async function generateLocalSpeechFile({ text, rate, voice }) {
  await fs.mkdir(cacheDir, { recursive: true });
  const selectedVoice = await resolveVoice(voice);
  const wordsPerMinute = clamp(Math.round(180 * (Number(rate) || 0.9)), 90, 290);
  const cacheKey = crypto
    .createHash("sha256")
    .update(`local|${selectedVoice}|${wordsPerMinute}|${text}`)
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
    text
  ]);

  return {
    filePath,
    contentType: "audio/mp4",
    provider: "local",
    voice: selectedVoice
  };
}

async function generateEdgeSpeechFile({ text, rate, voice }) {
  await fs.mkdir(cacheDir, { recursive: true });
  const selectedVoice = await resolveEdgeVoice(voice);
  const edgeRate = toEdgeRate(rate);
  const cacheKey = crypto
    .createHash("sha256")
    .update(`edge|${selectedVoice}|${edgeRate}|${text}`)
    .digest("hex");
  const filePath = path.join(cacheDir, `${cacheKey}.mp3`);

  try {
    await fs.access(filePath);
    return {
      filePath,
      contentType: "audio/mpeg",
      provider: "edge",
      voice: selectedVoice
    };
  } catch (error) {
    // Cache miss; generate below.
  }

  await execFileAsync(await resolveEdgeTtsCommand(), [
    "--voice",
    selectedVoice,
    `--rate=${edgeRate}`,
    "--text",
    text,
    "--write-media",
    filePath
  ], 45000);

  return {
    filePath,
    contentType: "audio/mpeg",
    provider: "edge",
    voice: selectedVoice
  };
}

async function getAvailableVoices(provider) {
  if (normalizeProvider(provider) === "edge") {
    return getAvailableEdgeVoices();
  }

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

async function getAvailableEdgeVoices() {
  try {
    const output = await execFileOutputAsync(await resolveEdgeTtsCommand(), ["--list-voices"], 30000);
    return output
      .split("\n")
      .map(parseEdgeVoiceLine)
      .filter(Boolean)
      .map((voice) => ({
        ...voice,
        recommended: voice.name === defaultEdgeVoice,
        score: scoreEdgeVoice(voice.name)
      }))
      .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name))
      .map(({ score, ...voice }) => voice);
  } catch (error) {
    return preferredEdgeVoices.map((voiceName) => ({
      name: voiceName,
      lang: "en-US",
      sample: voiceName,
      recommended: voiceName === defaultEdgeVoice
    }));
  }
}

async function resolveVoice(voiceName) {
  const voices = await getAvailableVoices();
  const requested = String(voiceName || "").trim();
  const selected = voices.find((voice) => voice.name === requested) || voices[0];

  return selected?.name || defaultVoice;
}

async function resolveEdgeVoice(voiceName) {
  const voices = await getAvailableEdgeVoices();
  const requested = String(voiceName || "").trim();
  const selected = voices.find((voice) => voice.name === requested) || voices[0];

  return selected?.name || defaultEdgeVoice;
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

function parseEdgeVoiceLine(line) {
  const cleanLine = String(line || "").trim();
  if (!cleanLine || cleanLine.startsWith("Name ") || cleanLine.startsWith("-")) {
    return null;
  }

  const match = cleanLine.match(/^(en-US-[^\s]+)\s+(Male|Female)\s+(.*?)\s{2,}(.+)$/);
  if (!match) {
    return null;
  }

  return {
    name: match[1],
    lang: "en-US",
    sample: `${match[2]} · ${match[3].trim()} · ${match[4].trim()}`
  };
}

function scoreVoice(name) {
  const preferredIndex = preferredVoices.indexOf(name);
  if (preferredIndex >= 0) {
    return 100 - preferredIndex;
  }

  return 10;
}

function scoreEdgeVoice(name) {
  const preferredIndex = preferredEdgeVoices.indexOf(name);
  if (preferredIndex >= 0) {
    return 100 - preferredIndex;
  }

  return String(name || "").includes("Neural") ? 25 : 10;
}

function normalizeProvider(provider) {
  return String(provider || "local").toLowerCase() === "edge" ? "edge" : "local";
}

async function resolveEdgeTtsCommand() {
  const configuredCommand = String(process.env.EDGE_TTS_COMMAND || "").trim();
  if (configuredCommand) {
    return configuredCommand;
  }

  try {
    await fs.access(defaultEdgeTtsCommand);
    return defaultEdgeTtsCommand;
  } catch (error) {
    return "edge-tts";
  }
}

function toEdgeRate(rate) {
  const normalizedRate = clamp(Number(rate) || 0.9, 0.5, 1.6);
  const percentage = Math.round((normalizedRate - 1) * 100);
  if (percentage === 0) {
    return "+0%";
  }

  return `${percentage > 0 ? "+" : ""}${percentage}%`;
}

function normalizeSpeechText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function execFileAsync(command, args, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function execFileOutputAsync(command, args, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout }, (error, stdout) => {
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
