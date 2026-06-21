# English Coach Local

Local English practice app focused on professional customer and technical support, writing, conversation, speaking, and visual/audio review.

Project decisions, implemented features, current work, and roadmap are maintained in
[`PROJECT_STATUS.md`](PROJECT_STATUS.md). Update that file with every relevant change.

## Requirements

- Node.js
- npm
- Git

## Setup on a New PC

```powershell
git clone https://github.com/jorgedosteclados/english-coach-local.git
cd english-coach-local
npm install
copy .env.example .env
```

Open `.env` and add your AI provider keys:

```env
GEMINI_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
```

Then start the app:

```powershell
node app.js
```

Open:

```text
http://localhost:3000
```

## Mobile Testing

To test from a phone on the same network, use the computer IP:

```text
http://YOUR_PC_IP:3000
```

For microphone features on mobile, use HTTPS through a tunnel such as Cloudflare Tunnel:

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

## Data

The local SQLite database is created automatically as `english_coach.db`.

This file is ignored by Git because it can contain local progress/history. To move your exact progress to another PC, copy `english_coach.db` manually into the project folder.

## Tests

```powershell
npm run test:e2e
```

## Reusable Progress States

The first destructive command creates a local backup automatically. Use these
commands to test the path repeatedly without losing real progress:

```bash
npm run progress -- status
npm run progress -- fresh
npm run progress -- checkpoint 1
npm run progress -- checkpoint 2
npm run progress -- restore
```

Use `npm run progress -- backup` only when you intentionally want to replace the
saved original snapshot with the current progress.
