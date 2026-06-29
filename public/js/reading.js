(function () {
  const payload = window.readingPayload;
  const textEl = document.getElementById("readingText");
  const playButton = document.getElementById("playReading");
  const previousButton = document.getElementById("previousSentence");
  const nextButton = document.getElementById("nextSentence");
  const providerSelect = document.getElementById("ttsProvider");
  const rateInput = document.getElementById("readingRate");
  const voiceSelect = document.getElementById("readingVoice");
  const resetSpeechButton = document.getElementById("resetSpeech");
  const speechStatus = document.getElementById("speechStatus");
  const immersiveToggle = document.getElementById("immersiveToggle");
  const readingThemeToggle = document.getElementById("readingThemeToggle");
  const sheet = document.getElementById("wordSheet");
  const closeSheetButton = document.getElementById("closeWordSheet");
  const wordLabel = document.getElementById("selectedWordLabel");
  const translationLabel = document.getElementById("selectedTranslation");
  const translationSource = document.getElementById("translationSource");
  const customTranslationInput = document.getElementById("customTranslation");
  const saveTranslationButton = document.getElementById("saveTranslation");
  const wordImageCard = document.getElementById("wordImageCard");
  const wordImage = document.getElementById("wordImage");
  const wordImageTitle = document.getElementById("wordImageTitle");
  const wordImageCredit = document.getElementById("wordImageCredit");
  const findWordImageButton = document.getElementById("findWordImage");
  const wordImageCandidates = document.getElementById("wordImageCandidates");
  const sentenceLabel = document.getElementById("selectedSentence");
  const speakWordButton = document.getElementById("speakWord");
  const saveWordButton = document.getElementById("saveWord");
  const completeReadingButton = document.getElementById("completeReading");
  const completionEl = document.getElementById("readingCompletion");
  const contextTranslateButton = document.getElementById("contextTranslate");
  const contextSheet = document.getElementById("contextSheet");
  const closeContextSheetButton = document.getElementById("closeContextSheet");
  const contextTranslationSource = document.getElementById("contextTranslationSource");
  const contextOriginalText = document.getElementById("contextOriginalText");
  const contextTranslatedText = document.getElementById("contextTranslatedText");
  const contextExplanation = document.getElementById("contextExplanation");
  const contextExpressions = document.getElementById("contextExpressions");

  let currentSentenceIndex =
    payload.sourceType === "trail"
      ? 0
      : Math.min(payload.progress?.sentenceIndex || 0, Math.max(payload.sentences.length - 1, 0));
  let selectedWord = null;
  let selectedSentence = null;
  let selectedTranslation = null;
  let isPlaying = false;
  let availableVoices = [];
  let browserVoices = [];
  let speechRunId = 0;
  let speechStartTimer = null;
  let speechFallbackTimer = null;
  let audioPlayer = null;

  function setImmersiveMode(enabled) {
    document.body.classList.toggle("immersive-reading", enabled);
    if (immersiveToggle) {
      immersiveToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
      immersiveToggle.textContent = enabled ? "Classic" : "Immersive";
    }
    localStorage.setItem("englishCoach.reading.immersive", enabled ? "1" : "0");
  }

  function setDarkReadingMode(enabled) {
    document.body.classList.toggle("reading-dark", enabled);
    if (readingThemeToggle) {
      readingThemeToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
      readingThemeToggle.textContent = enabled ? "Light" : "Dark";
    }
    localStorage.setItem("englishCoach.reading.darkMode", enabled ? "1" : "0");
  }

  function render() {
    textEl.innerHTML = "";

    payload.sentences.forEach((sentence) => {
      const sentenceEl = document.createElement("p");
      sentenceEl.className = "reading-sentence";
      sentenceEl.dataset.sentenceIndex = sentence.id;
      if (sentence.id === currentSentenceIndex) {
        sentenceEl.classList.add("active");
      }
      sentenceEl.addEventListener("click", () => {
        selectSentence(sentence.id, isPlaying);
      });

      sentence.tokens.forEach((token, tokenIndex) => {
        const previousToken = sentence.tokens[tokenIndex - 1];
        if (tokenIndex > 0 && shouldAddSpaceBefore(token, previousToken)) {
          sentenceEl.appendChild(document.createTextNode(" "));
        }

        if (/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(token)) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "reading-word";
          button.textContent = token;
          button.dataset.word = token;
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            selectSentence(sentence.id, isPlaying);
            openWord(token, sentence.text);
          });
          sentenceEl.appendChild(button);
        } else {
          sentenceEl.appendChild(document.createTextNode(token));
        }
      });

      textEl.appendChild(sentenceEl);
    });

    scrollCurrentSentenceIntoView();
    saveProgress();
  }

  function openWord(word, sentence) {
    selectedWord = normalizeWord(word);
    selectedSentence = sentence;
    const localHint = payload.translationHints[selectedWord];

    wordLabel.textContent = word;
    translationLabel.textContent = localHint || "Looking up...";
    translationSource.textContent = localHint ? "Local dictionary" : "Looking up";
    customTranslationInput.value = localHint || "";
    sentenceLabel.textContent = sentence;
    selectedTranslation = localHint || null;
    resetWordImage();
    sheet.hidden = false;

    fetch(`/reading/translate?word=${encodeURIComponent(selectedWord)}`)
      .then((response) => response.json())
      .then((result) => {
        if (selectedWord !== result.word) {
          return;
        }

        selectedTranslation = result.translation || null;
        translationLabel.textContent = selectedTranslation || "No translation saved yet";
        translationSource.textContent =
          result.source === "user"
            ? "Your dictionary"
            : result.source === "local"
              ? "Local dictionary"
              : result.source === "libretranslate"
                ? "LibreTranslate local"
                : "Add your translation";
        customTranslationInput.value = selectedTranslation || "";
      })
      .catch(() => {
        selectedTranslation = localHint || null;
        translationLabel.textContent = selectedTranslation || "No translation saved yet";
        translationSource.textContent = selectedTranslation ? "Local dictionary" : "Add your translation";
      });

    fetch(`/reading/image?word=${encodeURIComponent(selectedWord)}`)
      .then((response) => response.json())
      .then((result) => {
        if (selectedWord !== result.word || !result.image) {
          return;
        }

        showWordImage(result.image);
      })
      .catch(() => {});
  }

  function resetWordImage() {
    wordImageCard.hidden = true;
    findWordImageButton.hidden = false;
    findWordImageButton.disabled = false;
    findWordImageButton.textContent = "Find image";
    wordImageCandidates.hidden = true;
    wordImageCandidates.innerHTML = "";
    wordImage.removeAttribute("src");
    wordImage.alt = "";
    wordImageTitle.textContent = "";
    wordImageCredit.href = "#";
  }

  function showWordImage(image) {
    const imageUrl = image.thumbnailUrl || image.imageUrl;
    if (!imageUrl) {
      return;
    }

    wordImage.src = imageUrl;
    wordImage.alt = image.title || selectedWord;
    wordImageTitle.textContent = image.title || selectedWord;
    wordImageCredit.href = image.sourceUrl || image.imageUrl;
    wordImageCredit.textContent = image.creator
      ? `${image.provider || "image"} · ${image.creator}`
      : image.provider || "image source";
    wordImageCard.hidden = false;
    findWordImageButton.hidden = true;
    wordImageCandidates.hidden = true;
    wordImageCandidates.innerHTML = "";
  }

  async function findWordImages() {
    if (!selectedWord) {
      return;
    }

    findWordImageButton.disabled = true;
    findWordImageButton.textContent = "Finding...";
    wordImageCandidates.hidden = true;
    wordImageCandidates.innerHTML = "";

    try {
      const response = await fetch(`/reading/image/candidates?word=${encodeURIComponent(selectedWord)}`);
      const result = await response.json();
      if (selectedWord !== result.word) {
        return;
      }

      renderImageCandidates(result.images || []);
    } catch (error) {
      findWordImageButton.textContent = "Try again";
    } finally {
      findWordImageButton.disabled = false;
      if (findWordImageButton.textContent === "Finding...") {
        findWordImageButton.textContent = "Find image";
      }
    }
  }

  function renderImageCandidates(images) {
    if (!images.length) {
      wordImageCandidates.hidden = false;
      wordImageCandidates.innerHTML = '<p class="word-image-empty">No useful image found.</p>';
      findWordImageButton.textContent = "Try again";
      return;
    }

    wordImageCandidates.hidden = false;
    wordImageCandidates.innerHTML = "";
    images.forEach((image) => {
      const candidate = document.createElement("button");
      candidate.type = "button";
      candidate.className = "word-image-candidate";
      candidate.innerHTML = `
        <img src="${escapeAttribute(image.thumbnailUrl || image.imageUrl)}" alt="${escapeAttribute(image.title || selectedWord)}" loading="lazy" />
        <span>${escapeHtml(image.title || selectedWord)}</span>
        <small>${escapeHtml(image.creator || image.provider || "image source")}</small>
      `;
      candidate.addEventListener("click", () => approveWordImage(image, candidate));
      wordImageCandidates.appendChild(candidate);
    });
  }

  async function approveWordImage(image, candidateEl) {
    candidateEl.disabled = true;
    try {
      const response = await fetch("/reading/image/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: selectedWord,
          image
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save image.");
      }

      showWordImage(result.image);
    } catch (error) {
      candidateEl.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function getSelectedReadingText() {
    const selection = window.getSelection?.();
    const selectedText = selection?.toString().replace(/\s+/g, " ").trim();

    if (selectedText && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container =
        range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentElement
          : range.commonAncestorContainer;

      if (container && textEl.contains(container)) {
        return selectedText;
      }
    }

    return payload.sentences[currentSentenceIndex]?.text || "";
  }

  async function translateContext() {
    const selectedText = getSelectedReadingText();
    if (!selectedText.trim()) {
      return;
    }

    sheet.hidden = true;
    contextSheet.hidden = false;
    contextTranslationSource.textContent = "Local AI translation";
    contextOriginalText.textContent = selectedText;
    contextTranslatedText.textContent = "Translating with your local AI...";
    contextExplanation.textContent = "";
    contextExplanation.closest(".context-result").hidden = true;
    contextExpressions.innerHTML = "";
    contextTranslateButton.disabled = true;
    contextTranslateButton.textContent = "Translating...";

    try {
      const response = await fetch("/reading/context-translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: payload.sourceType,
          sourceId: payload.sourceType === "book" ? payload.bookId : payload.unitId,
          chapterIndex: payload.chapterIndex || 0,
          title: payload.title,
          chapterTitle: payload.chapterTitle || payload.summary,
          text: selectedText
        })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to translate this passage.");
      }

      contextTranslationSource.textContent =
        result.source === "cache" ? "Saved local AI translation" : "Local AI translation";
      contextTranslatedText.textContent = result.translation || "No translation returned.";
      contextExplanation.textContent = result.explanation || "";
      contextExplanation.closest(".context-result").hidden = !result.explanation;
      renderContextExpressions(result.expressions || []);
      window.getSelection?.().removeAllRanges();
    } catch (error) {
      contextTranslatedText.textContent = error.message || "Local AI is unavailable. Make sure Ollama is running.";
      contextExplanation.textContent = "";
      contextExplanation.closest(".context-result").hidden = true;
      contextExpressions.innerHTML = "";
    } finally {
      contextTranslateButton.disabled = false;
      contextTranslateButton.textContent = "AI translate";
    }
  }

  function renderContextExpressions(expressions) {
    contextExpressions.innerHTML = "";

    if (!expressions.length) {
      return;
    }

    const title = document.createElement("span");
    title.textContent = "Useful expressions";
    contextExpressions.appendChild(title);

    expressions.forEach((expression) => {
      const item = document.createElement("p");
      const english = document.createElement("strong");
      const portuguese = document.createElement("small");

      english.textContent = expression.english || "Expression";
      portuguese.textContent = expression.portuguese || "";
      item.appendChild(english);
      item.appendChild(portuguese);
      contextExpressions.appendChild(item);
    });
  }

  function speak(text, options = {}) {
    if (!options.forceBrowserSpeech) {
      playServerSpeech(text, options);
      return;
    }

    if (!("speechSynthesis" in window)) {
      return;
    }

    const shouldAdvance = options.advance !== false;
    const usingDefaultVoice = options.useDefaultVoice === true;
    speechRunId += 1;
    const currentRunId = speechRunId;
    let didStart = false;
    clearTimeout(speechStartTimer);
    clearTimeout(speechFallbackTimer);
    window.speechSynthesis.cancel();
    setSpeechStatus("Starting audio...");

    const startSpeech = () => {
      if (currentRunId !== speechRunId) {
        return;
      }

      window.speechSynthesis.resume();
      const utterance = createUtterance(text, {
        currentRunId,
        shouldAdvance,
        voice: usingDefaultVoice ? null : getSelectedVoice(),
        markStarted: () => {
          didStart = true;
        }
      });
      window.speechSynthesis.speak(utterance);

      speechFallbackTimer = setTimeout(() => {
        if (currentRunId !== speechRunId || !isPlaying || didStart) {
          return;
        }

        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        if (!usingDefaultVoice) {
          localStorage.removeItem("englishCoach.reading.voice");
          setSpeechStatus("Trying the browser default voice...");
          speak(text, { advance: shouldAdvance, useDefaultVoice: true });
          return;
        }

        isPlaying = false;
        playButton.textContent = "Play";
        setSpeechStatus("Audio did not start. Try another voice or press Reset.");
      }, 1000);
    };

    if (options.delayMs > 0) {
      speechStartTimer = setTimeout(startSpeech, options.delayMs);
    } else {
      startSpeech();
    }
  }

  function playServerSpeech(text, options = {}) {
    const shouldAdvance = options.advance !== false;
    speechRunId += 1;
    const currentRunId = speechRunId;
    clearTimeout(speechStartTimer);
    clearTimeout(speechFallbackTimer);
    stopBrowserSpeech();

    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.removeAttribute("src");
      audioPlayer.load();
    }

    audioPlayer = new Audio(buildTtsUrl(text));
    audioPlayer.preload = "auto";
    setSpeechStatus("Loading audio...");

    audioPlayer.onplaying = () => {
      if (currentRunId === speechRunId) {
        setSpeechStatus("");
      }
    };
    audioPlayer.onended = () => {
      if (currentRunId === speechRunId && isPlaying && shouldAdvance) {
        goToSentence(currentSentenceIndex + 1, true);
      }
    };
    audioPlayer.onerror = () => {
      if (currentRunId !== speechRunId) {
        return;
      }

      setSpeechStatus("Local audio failed. Trying browser voice...");
      speak(text, { ...options, forceBrowserSpeech: true });
    };

    audioPlayer.play().catch(() => {
      if (currentRunId !== speechRunId) {
        return;
      }

      isPlaying = false;
      playButton.textContent = "Play";
      setSpeechStatus("Audio was blocked. Press Play again.");
    });
  }

  function buildTtsUrl(text) {
    const params = new URLSearchParams({
      text,
      rate: rateInput?.value || "0.9",
      provider: getSelectedProvider()
    });
    if (voiceSelect?.value) {
      params.set("voice", voiceSelect.value);
    }

    return `/reading/tts?${params.toString()}`;
  }

  function stopServerSpeech() {
    if (!audioPlayer) {
      return;
    }

    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
  }

  function stopBrowserSpeech() {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
  }

  function createUtterance(text, { currentRunId, shouldAdvance, voice, markStarted }) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.voice = voice;
    utterance.rate = Number(rateInput.value) || 0.9;
    utterance.pitch = 1;
    utterance.onstart = () => {
      if (currentRunId === speechRunId) {
        markStarted?.();
        setSpeechStatus("");
      }
    };
    utterance.onend = () => {
      if (currentRunId === speechRunId && isPlaying && shouldAdvance) {
        goToSentence(currentSentenceIndex + 1, true);
      }
    };
    utterance.onerror = () => {
      if (currentRunId === speechRunId && voice) {
        setSpeechStatus("Voice failed. Trying browser default...");
        window.speechSynthesis.cancel();
        speak(text, { advance: shouldAdvance, useDefaultVoice: true });
        return;
      }

      if (currentRunId === speechRunId) {
        isPlaying = false;
        playButton.textContent = "Play";
        setSpeechStatus("Audio did not start. Press Reset, then Play.");
        window.speechSynthesis.cancel();
      }
    };

    return utterance;
  }

  function togglePlayback() {
    isPlaying = !isPlaying;
    playButton.textContent = isPlaying ? "Pause" : "Play";

    if (isPlaying) {
      speak(payload.sentences[currentSentenceIndex]?.text || "");
    } else {
      speechRunId += 1;
      clearTimeout(speechStartTimer);
      clearTimeout(speechFallbackTimer);
      stopServerSpeech();
      stopBrowserSpeech();
      setSpeechStatus("");
    }
  }

  function selectSentence(index, readNow) {
    goToSentence(index, readNow);
  }

  function goToSentence(index, continuePlaying) {
    const nextIndex = Math.min(Math.max(index, 0), payload.sentences.length - 1);
    if (nextIndex === currentSentenceIndex && index >= payload.sentences.length) {
      isPlaying = false;
      playButton.textContent = "Play";
      return;
    }

    currentSentenceIndex = nextIndex;
    render();

    if (continuePlaying) {
      speak(payload.sentences[currentSentenceIndex]?.text || "");
    }
  }

  function saveProgress() {
    fetch("/reading/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: payload.sourceType,
        sourceId: payload.sourceType === "book" ? payload.bookId : payload.unitId,
        chapterIndex: payload.chapterIndex || 0,
        sentenceIndex: currentSentenceIndex
      })
    }).catch(() => {});
  }

  function scrollCurrentSentenceIntoView() {
    const active = textEl.querySelector(".reading-sentence.active");
    if (active) {
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function normalizeWord(word) {
    return String(word || "")
      .toLowerCase()
      .replace(/[^a-z']/g, "");
  }

  function shouldAddSpaceBefore(token, previousToken) {
    if (!previousToken) {
      return false;
    }

    if (/^[,.;:!?)]$/.test(token)) {
      return false;
    }

    if (/^[(]$/.test(previousToken)) {
      return false;
    }

    return true;
  }

  async function loadVoices() {
    if (!voiceSelect) {
      return;
    }

    const provider = getSelectedProvider();
    voiceSelect.innerHTML = "";
    const loadingOption = document.createElement("option");
    loadingOption.value = "";
    loadingOption.textContent = provider === "edge" ? "Loading natural voices..." : "Loading local voices...";
    voiceSelect.appendChild(loadingOption);

    if ("speechSynthesis" in window) {
      browserVoices = window.speechSynthesis
        .getVoices()
        .filter((voice) => /^en(-|_)/i.test(voice.lang || ""))
        .sort((first, second) => scoreVoice(second) - scoreVoice(first));
    }

    try {
      const response = await fetch(`/reading/tts/voices?provider=${encodeURIComponent(provider)}`);
      const payload = await response.json();
      availableVoices = payload.voices || [];
    } catch (error) {
      availableVoices = browserVoices;
    }

    voiceSelect.innerHTML = "";
    availableVoices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${formatVoiceLang(voice.lang)})${
        voice.recommended || index === 0 ? provider === "edge" ? " · natural" : " · recommended" : ""
      }`;
      voiceSelect.appendChild(option);
    });

    if (availableVoices.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Default browser voice";
      voiceSelect.appendChild(option);
      return;
    }

    const savedVoice = localStorage.getItem(`englishCoach.reading.voice.${provider}`);
    const selectedVoice = availableVoices.find((voice) => voice.name === savedVoice) || availableVoices[0];
    voiceSelect.value = selectedVoice.name;
  }

  function getSelectedProvider() {
    return providerSelect?.value === "edge" ? "edge" : "local";
  }

  function formatVoiceLang(lang) {
    return String(lang || "en_US").replace("_", "-");
  }

  function getSelectedVoice() {
    const voicePool = browserVoices.length ? browserVoices : availableVoices;
    if (!voicePool.length) {
      return null;
    }

    return (
      voicePool.find((voice) => voice.name === voiceSelect?.value) ||
      voicePool[0] ||
      null
    );
  }

  function scoreVoice(voice) {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    const lang = String(voice.lang || "").toLowerCase();
    let score = 0;

    if (lang === "en-us") score += 18;
    if (lang === "en-gb") score += 14;
    if (name.includes("natural")) score += 28;
    if (name.includes("neural")) score += 28;
    if (name.includes("enhanced")) score += 24;
    if (name.includes("premium")) score += 20;
    if (name.includes("google")) score += 16;
    if (name.includes("microsoft")) score += 16;
    if (["samantha", "ava", "allison", "joanna", "karen", "daniel"].some((label) => name.includes(label))) {
      score += 18;
    }
    if (voice.localService) score += 4;
    if (name.includes("compact")) score -= 18;
    if (name.includes("default")) score -= 4;

    return score;
  }

  function resetSpeech() {
    isPlaying = false;
    speechRunId += 1;
    clearTimeout(speechStartTimer);
    clearTimeout(speechFallbackTimer);
    stopServerSpeech();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    }
    playButton.textContent = "Play";
    setSpeechStatus("Audio reset. Press Play again.");
  }

  function setSpeechStatus(message) {
    if (speechStatus) {
      speechStatus.textContent = message;
    }
  }

  playButton.addEventListener("click", togglePlayback);
  previousButton.addEventListener("click", () => goToSentence(currentSentenceIndex - 1, false));
  nextButton.addEventListener("click", () => goToSentence(currentSentenceIndex + 1, false));
  resetSpeechButton?.addEventListener("click", resetSpeech);
  contextTranslateButton?.addEventListener("click", translateContext);
  immersiveToggle?.addEventListener("click", () => {
    setImmersiveMode(!document.body.classList.contains("immersive-reading"));
  });

  readingThemeToggle?.addEventListener("click", () => {
    setDarkReadingMode(!document.body.classList.contains("reading-dark"));
  });
  providerSelect?.addEventListener("change", async () => {
    localStorage.setItem("englishCoach.reading.ttsProvider", getSelectedProvider());
    setSpeechStatus("Loading voices...");
    await loadVoices();
    setSpeechStatus("");
    if (isPlaying) {
      speak(payload.sentences[currentSentenceIndex]?.text || "");
    }
  });
  rateInput?.addEventListener("input", () => {
    localStorage.setItem("englishCoach.reading.rate", rateInput.value);
    if (isPlaying) {
      speak(payload.sentences[currentSentenceIndex]?.text || "");
    }
  });
  completeReadingButton?.addEventListener("click", completeTrailReading);
  voiceSelect?.addEventListener("change", () => {
    localStorage.setItem(`englishCoach.reading.voice.${getSelectedProvider()}`, voiceSelect.value);
    if (isPlaying) {
      speak(payload.sentences[currentSentenceIndex]?.text || "");
    }
  });
  closeSheetButton.addEventListener("click", () => {
    sheet.hidden = true;
  });
  closeContextSheetButton?.addEventListener("click", () => {
    contextSheet.hidden = true;
  });
  speakWordButton.addEventListener("click", () => {
    if (selectedWord) {
      speak(selectedWord, { advance: false });
    }
  });
  findWordImageButton.addEventListener("click", findWordImages);
  saveTranslationButton.addEventListener("click", async () => {
    if (!selectedWord) {
      return;
    }

    const translation = customTranslationInput.value.trim();
    if (!translation) {
      customTranslationInput.focus();
      return;
    }

    saveTranslationButton.disabled = true;
    saveTranslationButton.textContent = "Saving...";
    try {
      const response = await fetch("/reading/translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: selectedWord,
          translation
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save translation.");
      }

      selectedTranslation = result.translation;
      translationLabel.textContent = result.translation;
      translationSource.textContent = "Your dictionary";
      saveTranslationButton.textContent = "Saved";
      setTimeout(() => {
        saveTranslationButton.textContent = "Save translation";
      }, 900);
    } catch (error) {
      saveTranslationButton.textContent = "Try again";
    } finally {
      saveTranslationButton.disabled = false;
    }
  });
  saveWordButton.addEventListener("click", async () => {
    if (!selectedWord) {
      return;
    }

    const typedTranslation = customTranslationInput.value.trim();
    saveWordButton.disabled = true;
    saveWordButton.textContent = "Saved";
    await fetch("/reading/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: payload.sourceType,
        sourceId: payload.sourceType === "book" ? payload.bookId : payload.unitId,
        word: selectedWord,
        sentence: selectedSentence,
        translation: selectedTranslation || typedTranslation || null
      })
    }).catch(() => {});
    setTimeout(() => {
      saveWordButton.disabled = false;
      saveWordButton.textContent = "Save word";
    }, 900);
  });

  async function completeTrailReading() {
    const activeButton =
      document.getElementById("completeReading") || document.getElementById("completeReadingRetry");
    if (activeButton) {
      activeButton.disabled = true;
      activeButton.textContent = "Saving...";
    }

    try {
      const response = await fetch("/ai/save-lesson-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xpEarned: 10,
          correctAnswers: 1,
          wrongAnswers: 0,
          unitId: payload.unitId
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save reading progress.");
      }

      window.EnglishCoachSound?.play("complete");
      const nextHref = data.nextUnit?.href || "/progress";
      const continueLabel = data.nextUnit ? "Continue to next lesson" : "View progress";

      completionEl.innerHTML = `
        <div>
          <span>Reading complete</span>
          <strong>Progress saved. You earned 10 XP.</strong>
        </div>
        <a href="${nextHref}">${continueLabel}</a>
      `;
    } catch (error) {
      completionEl.innerHTML = `
        <div>
          <span>Could not save</span>
          <strong>${error.message}</strong>
        </div>
        <button type="button" id="completeReadingRetry">Try again</button>
      `;
      document.getElementById("completeReadingRetry")?.addEventListener("click", completeTrailReading);
    }
  }

  loadVoices();
  const savedRate = localStorage.getItem("englishCoach.reading.rate");
  if (savedRate && rateInput) {
    rateInput.value = savedRate;
  }
  const savedProvider = localStorage.getItem("englishCoach.reading.ttsProvider");
  if (providerSelect && savedProvider) {
    providerSelect.value = savedProvider === "edge" ? "edge" : "local";
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  setImmersiveMode(localStorage.getItem("englishCoach.reading.immersive") === "1");
  setDarkReadingMode(localStorage.getItem("englishCoach.reading.darkMode") === "1");
  render();
})();
