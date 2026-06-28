# English Coach Local - Project Status

Last updated: 2026-06-27

This file is the persistent project record. Update it whenever a relevant feature,
technical decision, data change, test, or roadmap item changes.

## Product Vision

English Coach Local is a local-first English practice app for professional customer
and technical support. Its main focus is broadly useful language for service teams,
customer conversations, professional messages, pronunciation, and daily review.

## Evidence-Based Learning Principle

The product must translate learning methods supported by real educational and
cognitive-science research into practical features. The goal is not to claim that
English Coach Local itself is "scientifically proven". The goal is to make its
pedagogical decisions traceable to methods that credible studies have found effective.

This principle must remain part of future product decisions:

- Prioritize retrieval practice, spaced practice, corrective feedback, progressive
  difficulty, interleaving, mastery checks, and meaningful contextual practice when
  the evidence supports their use.
- Before adding a major learning mechanic, identify the learning problem, the
  research-supported method, and how the feature implements that method.
- Prefer primary studies, systematic reviews, and established educational frameworks
  over trends, competitor imitation, or unsupported engagement claims.
- Keep evidence about a learning method separate from evidence about this product.
  Do not describe the app itself as scientifically validated without an appropriate
  study of the app and its learners.
- Use product data such as retention, delayed recall, error recurrence, completion,
  and skill improvement to verify whether the implementation is producing the intended
  learning behavior.
- Gamification should support practice frequency and persistence without replacing
  learning quality or encouraging empty repetition.

The research-to-feature mapping and starting bibliography are maintained in
`docs/LEARNING_EVIDENCE.md` and must be updated with major pedagogical mechanics.

## Current Stack

- Node.js and Express 5
- EJS server-rendered views
- SQLite local database (`english_coach.db`)
- Vanilla JavaScript and CSS
- Gemini, Groq, and optional OpenRouter AI providers
- Optional local LibreTranslate service for reading lookups without AI tokens
- Optional Edge TTS command-line provider for more natural experimental reading audio
- Playwright end-to-end tests

## Implemented Features

- Learning path with sequential unit unlocking
- Categorized multiple-choice lessons
- CSV question import
- Writing missions with AI feedback
- English correction with structured feedback
- Simulated customer conversations
- Speaking practice with browser speech recognition
- Visual, listening, and speaking daily review
- Adaptive mistake review with spaced scheduling
- A1–B2 placement diagnostic with phase recommendation and skill breakdown
- Interactive reading mode in the learning path with sentence playback and word lookup
- Imported book library with PDF/TXT support and free reading mode
- Immersive reading display with a calmer long-reading layout and saved preference
- Natural online reading voice option through Edge TTS with cached MP3 generation
- Reading vocabulary, personal dictionary, local dictionary, and translation cache
- Optional visual word lookup with Openverse images cached locally
- Local progress, XP, streak, achievements, and history
- Responsive UI and Mini Beagle Coach mascot
- Setup instructions for moving the app to another computer

## Question Bank

- `questions_seed.csv` contains 72 imported questions.
- The database also has 16 unique built-in questions, for 88 total after import.
- A saved question is selected only while `times_used = 0`.
- AI generates a new question only after unused saved questions in the selected
  category are exhausted.
- AI-generated questions are saved with `times_used = 1` because they are returned
  to the learner immediately.
- `/question-bank` shows question inventory, unused/used counts, AI-generated counts,
  category coverage, weak phrases, and recent AI-generated questions.
- New AI-generated lesson questions are saved with `source = ai:<category>` so the app
  can distinguish generated content from CSV/imported content. Older generated
  questions created before this change may not be distinguishable if they used a CSV
  source value.

## Pedagogical Matrix and Placement

`data/pedagogy.js` records the learning methods, skill objectives, approximate CEFR
levels, and learning-path phase mapping used by the product. Major learning mechanics
should remain traceable to this matrix and to credible research.

The placement diagnostic uses 12 progressively harder, deterministic questions:
three each at A1, A2, B1, and B2. It measures meaning and comprehension, grammar and
structure, professional tone, and problem-solving language. A level band is considered
demonstrated with at least two correct answers out of three, progressing from the
lowest band upward.

The result is explicitly presented as an estimate rather than an official CEFR
certification. It recommends a learning-path phase, saves the assessment for the
progress dashboard, and never changes or deletes completed progress. After the result,
the learner can explicitly start at the recommended phase or keep the current path.
Earlier incomplete nodes become placement-skipped rather than completed: they grant no
XP and are not included in completion metrics.

## Current UX Direction

The home page is organized around a learning path:

- Desktop: fixed navigation on the left, learning path in the center, progress and
  quick practice on the right.
- Mobile: compact progress at the top, path nodes as the main focus, and fixed
  navigation at the bottom.
- Selecting a path node opens a contextual card with the activity description and
  a clear start/practice action.
- The design takes interaction and information-hierarchy inspiration from learning
  apps, while retaining the English Coach identity and original visual assets.
- The home page is the only learning-path screen. The former `/units` page was
  removed; its route permanently redirects old links to `/`.

## Learning Path Structure

The home path contains 24 sequential nodes grouped into four phases: 20 learning
activities and one checkpoint after each group of five activities.

1. **Support Foundations**: support basics, asking for details, correction,
   customer conversation, and speaking practice.
2. **Ticket Mastery**: case updates, troubleshooting, follow-up writing,
   difficult conversations, and call confidence.
3. **Technical Problem Solving**: systems and integrations, business impact,
   technical scope, technical correction, and integration conversation.
4. **Confident Communicator**: professional tone, email, ticket closure,
   fluent support calls, and a final customer simulation.

Each path URL carries its own `unit` identifier. Lesson nodes also carry a category,
for example `/lesson?unit=11&category=systems`. Activity clients send that unit ID
when saving progress, so repeated activity types unlock the correct next node.

Unlocking is enforced in both places:

- The home path exposes only the first incomplete step after completed steps.
- The progress service rejects attempts to save a locked unit until every previous
  unit is complete.

Each phase checkpoint contains eight mixed exercises drawn from three categories in
that phase. A learner needs at least 7/8 correct answers (80%) to complete the
checkpoint and unlock the next phase. Failed checkpoint answers still enter adaptive
review, but the checkpoint node is not marked complete. Existing users who had
already reached later phases receive the required earlier checkpoints automatically.

## Lesson Experience

Lessons must use varied active-recall exercises instead of repeating only multiple
choice. A five-question session should mix:

- Translate a support phrase by choosing the best English option.
- Listen to an English phrase and assemble it from a word bank.
- Listen to an English phrase and type what was heard.
- Read and speak an English phrase using microphone recognition.
- Audio playback in normal and slow speeds for listening exercises.

The same saved question data can supply all formats: `question_pt` is the Portuguese
prompt and `correct_answer` is the English listening/speaking target.

Current five-question sequence:

1. Translate by selecting the best English option.
2. Listen and assemble the phrase from shuffled word tokens.
3. Listen and type the complete English phrase.
4. Read and speak the phrase with microphone recognition and typed fallback.
5. Finish with another contextual multiple-choice challenge.

## Adaptive Review

Every saved lesson question includes a stable `questionId`. Each answer records:

- question and learning-path unit;
- exercise type and submitted answer;
- whether the answer was correct;
- total correct/wrong attempts and current correct streak.

Wrong answers become due immediately in `/mistakes`. Correct reviews use spaced
intervals of 1, 3, 7, and 14 days as the learner builds a correct streak. The
Mistakes screen loads only questions due now and reschedules them after review.

## Important Decisions

- Keep the app local-first; the SQLite database is not committed.
- Never commit `.env` or API keys.
- Prefer saved questions over AI to control cost and avoid unnecessary generation.
- Store AI-generated questions so the question bank grows over time.
- Keep core practice flows usable even when an AI provider is unavailable.
- Reading word translation must not use AI providers or paid model tokens. The lookup
  order is personal dictionary, local dictionary, cached translation, optional local
  LibreTranslate, then manual entry.
- Reading audio keeps the local macOS voice as the stable fallback. The Edge TTS
  provider is experimental, uses the `edge-tts` CLI, caches generated MP3 files, and
  may break if Microsoft changes the unofficial endpoint.
- Reading word images should use public/licensed sources and must be cached locally.
  The reader should show only learner-approved images by default. Automatic search is
  used only to suggest candidates after an explicit action, because unapproved images
  can teach the wrong association.
- Voice-call simulations should prefer local Ollama models for customer roleplay and
  feedback so practice does not consume online AI tokens by default.
- All relevant behavior changes must include focused test coverage.
- Keep the curriculum vendor-neutral. Use generic products, systems, integrations,
  and service scenarios instead of centering the course on one company or platform.
- Base pedagogical mechanics on credible learning research and document how each major
  mechanic turns that evidence into product behavior.

## Next Work

1. Review the learning-path home with real users and refine spacing or interactions
   from their feedback.
2. Validate audio voices and microphone permissions on the target desktop and phone browsers.
3. Improve speaking feedback with word-level pronunciation guidance and reference audio.
4. Add export/import for progress, history, and question data.
5. Add access control before exposing the app through a public tunnel.
6. Add a question-bank maintenance flow for importing, disabling, editing, or resetting
   specific questions.
7. Add a one-command local startup helper for the Node app plus LibreTranslate.
8. Validate the voice-call flow on a phone through HTTPS, because mobile browsers may
   block microphone access on plain local network URLs.

## Verification

Run the full browser suite with:

```bash
npm test
```

Expected coverage includes home/path, lessons, writing, correction, conversation,
speaking, adaptive review, daily review, and history.

## Change Log

### 2026-06-23

- Added `/question-bank` to monitor total, unused, used, AI-generated, due-review,
  weak-question, and category coverage counts.
- Changed future AI-generated lesson questions to use `ai:<category>` sources so they
  can be reported separately from imported CSV questions.
- Added E2E coverage proving saved questions are used before AI generation is called,
  and that AI is only requested after a category is exhausted.

### 2026-06-27

- Added interactive reading mode to the learning path with sentence navigation,
  server-generated local audio playback, speed control, and word selection.
- Reading audio now uses selectable macOS `say` voices from the local TTS route, with
  the picker limited to American English voices and novelty/effect voices filtered out.
- Added an experimental Natural Online audio provider using the Python `edge-tts` CLI.
  The reader can switch between Local Mac and Natural Online voices, and generated
  Edge audio is cached as MP3 so repeated playback does not call the online service.
- Added a separate library/free-reading mode for importing whole books from TXT/PDF
  files, splitting large books into readable parts, and preserving reading progress.
- Added reading vocabulary saving with sentence context and a personal dictionary for
  learner-supplied translations.
- Added local word translations for common support and reading vocabulary, including
  core pronouns, possessives, auxiliaries, and high-frequency function words.
- Added optional LibreTranslate integration for reading word lookups without AI/model
  tokens. Missing words can be translated through a local LibreTranslate server and
  saved in `reading_translation_cache` so future lookups are instant.
- Added optional Openverse image lookup for concrete reading words. Images and source
  attribution are saved in `reading_image_cache`, while abstract/function words skip
  image lookup. The reader now shows only approved images automatically; unapproved
  search results appear as selectable candidates through `Find image`, then the chosen
  image is stored as approved for future lookups.
- Documented `LIBRETRANSLATE_URL` in `.env.example` and README. The local machine
  currently uses `http://127.0.0.1:5001` because port `5000` is occupied by macOS.
- Expanded E2E coverage for local dictionary lookup, user dictionary lookup, optional
  LibreTranslate lookup, Openverse image lookup, abstract-word image skipping, and
  cache reuse.
- Added `/voice-call` for simulated professional support calls with browser speech
  recognition, local Ollama customer replies, Edge TTS customer audio, scenario
  selection, and end-of-call feedback.
- Added voice-call fallbacks: if browser speech recognition is unavailable, the learner
  can send a typed reply; if generated customer audio does not play, the app falls back
  to the browser's built-in speech synthesis.
- Added Ollama configuration to `.env.example` and README. The recommended local model
  for a 16 GB MacBook Air M3 is `qwen3:8b`.

### 2026-06-19

- Imported all 72 CSV questions into the local database.
- Changed lesson selection to use AI only after saved questions are exhausted.
- Started the simplified learning-path home redesign.
- Added contextual path-node actions and mobile bottom navigation.
- Validated the new home at 1440px desktop and 390px mobile widths.
- Updated the E2E home test to cover opening a path node and its activity CTA.
- Created this persistent project status and roadmap document.
- Added all 11 CSV categories to the lesson focus selector.
- Defined mixed lesson formats for choice, listening, word-building, typing, and speaking.
- Implemented the five-question mixed-format lesson controller with normal/slow audio.
- Added typed fallback when browser speech recognition is unavailable or blocked.
- Redesigned the lesson UI and validated it at desktop and mobile widths.
- Expanded the lesson E2E flow to answer all four exercise formats; 8/8 checks pass.
- Removed the duplicate units page and consolidated all activity returns on the home path.
- Kept `/units` as a permanent redirect for backward compatibility.
- Expanded the learning path from 5 to 20 sequential steps across 4 phases.
- Preserved existing progress for the original first five units during migration.
- Added phase-aware activity URLs and server-side prerequisite enforcement.

### 2026-06-20

- Repositioned the curriculum as general professional support English.
- Replaced the vendor-specific third phase with Technical Problem Solving.
- Added unit-specific writing, conversation, and speaking content.
- Generalized lesson prompts, review cards, and the 72-question CSV bank.
- Made CSV question loading automatic for new and existing installations.
- Added cleanup for legacy branded questions in local databases.
- Added per-question attempt history and mastery tracking.
- Added spaced mistake review at 1, 3, 7, and 14-day intervals.
- Added a dedicated Mistakes screen and navigation entry.
- Expanded the main E2E suite to 9 flows, including real adaptive scheduling.
- Fixed speaking completion to replace the practice form with result actions for
  continuing the path or practicing again.
- Added normal and slow reference audio to speaking practice.
- Replaced unordered speaking scoring with sequential word alignment and visible
  match, missing, different, and extra-word states.
- Collapsed detailed AI speaking feedback behind an optional disclosure.
- Expanded the path from 20 activities to 24 nodes with four phase checkpoints.
- Added eight-question mixed checkpoint sessions with a minimum 80% mastery rule.
- Added retry and adaptive-review guidance when a checkpoint is not passed.
- Added progress migration for users who reached later phases before checkpoints existed.
- Expanded the main E2E suite to 10 flows with checkpoint pass/fail coverage.
- Added a reusable local progress-state tool for fresh starts, checkpoint testing,
  status inspection, and restoring the original snapshot.

### 2026-06-21

- Added a progress and mastery dashboard with phase completion, seven-day XP,
  category accuracy, weak phrases, and due adaptive reviews.
- Added a daily activity log and included it in fresh-start and restore workflows.
- Established evidence-based learning as a permanent product principle, while keeping
  research support for a method distinct from scientific validation of the product.
- Added the pedagogical skill/level matrix and an A1–B2 placement diagnostic with
  server-side scoring, saved results, phase recommendation, and automated coverage.
- Balanced and randomized placement answer positions so A, B, C, and D each contain
  exactly three correct answers per assessment; added an E2E regression assertion.
- Added an explicit post-placement choice to start at the recommended phase or retain
  the current path, without counting skipped units as completed or awarding XP.
- Standardized completion actions across lessons, writing, correction, conversation,
  speaking, checkpoints, and daily review. Successful activities now continue to the
  first incomplete path unit; course completion opens the final progress dashboard.
- Isolated E2E and Playwright databases from `english_coach.db` so automated tests can
  run while the app is open without changing the learner's local progress.
- Randomized common-lesson answer positions with no repeated correct position inside
  the same session cycle; added regression coverage against answer-position patterns.
- Added a shared offline sound manager with distinct correct, incorrect, completion,
  checkpoint, and unlock cues plus persisted mute and volume controls. Sound cues never
  replace visual feedback and are suppressed while reference speech is playing.
