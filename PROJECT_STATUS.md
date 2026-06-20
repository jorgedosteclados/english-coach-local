# English Coach Local - Project Status

Last updated: 2026-06-19

This file is the persistent project record. Update it whenever a relevant feature,
technical decision, data change, test, or roadmap item changes.

## Product Vision

English Coach Local is a local-first English practice app for professional customer
and technical support. Its main focus is broadly useful language for service teams,
customer conversations, professional messages, pronunciation, and daily review.

## Current Stack

- Node.js and Express 5
- EJS server-rendered views
- SQLite local database (`english_coach.db`)
- Vanilla JavaScript and CSS
- Gemini, Groq, and optional OpenRouter AI providers
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
- Local progress, XP, streak, achievements, and history
- Responsive UI and Mini Beagle Coach mascot
- Setup instructions for moving the app to another computer

## Question Bank

- `questions_seed.csv` contains 72 imported questions.
- The database also has 14 built-in seed questions, for 86 total after import.
- A saved question is selected only while `times_used = 0`.
- AI generates a new question only after unused saved questions in the selected
  category are exhausted.
- AI-generated questions are saved with `times_used = 1` because they are returned
  to the learner immediately.

## Current UX Direction

The home page is being redesigned around a learning path:

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

The home path contains 20 sequential steps grouped into four phases:

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

## Important Decisions

- Keep the app local-first; the SQLite database is not committed.
- Never commit `.env` or API keys.
- Prefer saved questions over AI to control cost and avoid unnecessary generation.
- Store AI-generated questions so the question bank grows over time.
- Keep core practice flows usable even when an AI provider is unavailable.
- All relevant behavior changes must include focused test coverage.
- Keep the curriculum vendor-neutral. Use generic products, systems, integrations,
  and service scenarios instead of centering the course on one company or platform.

## Next Work

1. Review the learning-path home with real users and refine spacing or interactions
   from their feedback.
2. Validate audio voices and microphone permissions on the target desktop and phone browsers.
3. Add a question-bank dashboard with unused, used, and AI-generated counts.
4. Add a focused automated test for saved-question exhaustion before AI generation.
5. Improve speaking feedback with word-level pronunciation guidance and reference audio.
6. Add export/import for progress, history, and question data.
7. Add access control before exposing the app through a public tunnel.

## Verification

Run the full browser suite with:

```bash
npm test
```

Expected coverage includes home/path, lessons, writing, correction, conversation,
speaking, daily review, and history.

## Change Log

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
