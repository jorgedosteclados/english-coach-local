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

For offline reading translations without AI tokens, run a local LibreTranslate
server and keep this URL in `.env`:

```env
LIBRETRANSLATE_URL=http://127.0.0.1:5799
```

Start the local translation server on that port with:

```bash
/Users/I560982/Library/Python/3.9/bin/libretranslate --host 127.0.0.1 --port 5799
```

Reading word images use Openverse by default and are cached locally:

```env
OPENVERSE_API_URL=https://api.openverse.engineering/v1/images/
```

For more natural experimental reading audio, install the Python Edge TTS CLI:

```bash
python3 -m pip install --user edge-tts
```

If the `edge-tts` command is not on your PATH, set the command location in `.env`:

```env
EDGE_TTS_COMMAND=/Users/YOUR_USER/Library/Python/3.9/bin/edge-tts
```

For local AI voice-call simulations without online AI tokens, install Ollama and
pull the recommended local model:

```bash
brew install ollama
brew services start ollama
ollama pull qwen3:8b
```

Then keep the local API settings in `.env`:

```env
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_TIMEOUT_MS=45000
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
