(function initializeSoundManager() {
  const STORAGE_KEY = "englishCoach.sound.settings";
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const soundPatterns = {
    correct: [
      { frequency: 659.25, start: 0, duration: 0.08, volume: 0.34 },
      { frequency: 783.99, start: 0.07, duration: 0.11, volume: 0.3 }
    ],
    incorrect: [
      { frequency: 293.66, start: 0, duration: 0.1, volume: 0.22 },
      { frequency: 246.94, start: 0.09, duration: 0.14, volume: 0.18 }
    ],
    complete: [
      { frequency: 523.25, start: 0, duration: 0.1, volume: 0.28 },
      { frequency: 659.25, start: 0.09, duration: 0.1, volume: 0.3 },
      { frequency: 783.99, start: 0.18, duration: 0.12, volume: 0.32 },
      { frequency: 1046.5, start: 0.29, duration: 0.2, volume: 0.3 }
    ],
    checkpoint: [
      { frequency: 392, start: 0, duration: 0.12, volume: 0.3 },
      { frequency: 523.25, start: 0.11, duration: 0.12, volume: 0.3 },
      { frequency: 659.25, start: 0.22, duration: 0.15, volume: 0.34 },
      { frequency: 783.99, start: 0.36, duration: 0.24, volume: 0.32 }
    ],
    unlock: [
      { frequency: 440, start: 0, duration: 0.08, volume: 0.22 },
      { frequency: 659.25, start: 0.08, duration: 0.1, volume: 0.27 },
      { frequency: 880, start: 0.18, duration: 0.18, volume: 0.28 }
    ]
  };

  let audioContext = null;
  let settings = loadSettings();

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {
        muted: Boolean(saved?.muted),
        volume: clampVolume(saved?.volume ?? 0.45)
      };
    } catch (error) {
      return { muted: false, volume: 0.45 };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    updateControls();
  }

  function clampVolume(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
  }

  function getAudioContext() {
    if (!AudioContextClass) return null;
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }

  function play(name) {
    if (settings.muted || settings.volume === 0 || window.speechSynthesis?.speaking) return;
    const pattern = soundPatterns[name];
    const context = getAudioContext();
    if (!pattern || !context) return;

    const baseTime = context.currentTime + 0.015;
    pattern.forEach((note) => playNote(context, baseTime, note));
  }

  function playNote(context, baseTime, note) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = baseTime + note.start;
    const end = start + note.duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, note.volume * settings.volume),
      start + 0.018
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  function setMuted(muted) {
    settings.muted = Boolean(muted);
    saveSettings();
  }

  function setVolume(volume) {
    settings.volume = clampVolume(volume);
    if (settings.volume > 0) settings.muted = false;
    saveSettings();
  }

  function createControls() {
    const wrapper = document.createElement("div");
    wrapper.className = `sound-control ${document.querySelector(".coach-bottom-nav") ? "above-nav" : ""}`;
    wrapper.innerHTML = `
      <button type="button" class="sound-toggle" aria-expanded="false" aria-controls="soundPanel">Sound on</button>
      <div class="sound-panel hidden" id="soundPanel">
        <label for="soundVolume">Sound volume</label>
        <input id="soundVolume" type="range" min="0" max="100" step="5" />
        <button type="button" class="sound-mute">Mute effects</button>
      </div>
    `;
    document.body.appendChild(wrapper);

    const toggle = wrapper.querySelector(".sound-toggle");
    const panel = wrapper.querySelector(".sound-panel");
    const volume = wrapper.querySelector("#soundVolume");
    const mute = wrapper.querySelector(".sound-mute");

    toggle.addEventListener("click", () => {
      const willOpen = panel.classList.contains("hidden");
      panel.classList.toggle("hidden", !willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
      getAudioContext();
    });
    volume.addEventListener("input", () => setVolume(Number(volume.value) / 100));
    mute.addEventListener("click", () => setMuted(!settings.muted));
    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) {
        panel.classList.add("hidden");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    updateControls();
  }

  function updateControls() {
    const toggle = document.querySelector(".sound-toggle");
    const volume = document.querySelector("#soundVolume");
    const mute = document.querySelector(".sound-mute");
    if (!toggle || !volume || !mute) return;

    toggle.textContent = settings.muted ? "Sound off" : "Sound on";
    toggle.setAttribute("aria-label", settings.muted ? "Sound effects are off" : "Sound effects are on");
    volume.value = String(Math.round(settings.volume * 100));
    mute.textContent = settings.muted ? "Turn effects on" : "Mute effects";
  }

  window.EnglishCoachSound = {
    play,
    setMuted,
    setVolume,
    getSettings: () => ({ ...settings })
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createControls);
  } else {
    createControls();
  }
})();
