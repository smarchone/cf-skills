# cf-skills

A browser chat that runs the productivity **Commands** from
[smarchone/skills](https://github.com/smarchone/skills): type `/feel <your idea>`, have a short streamed
conversation (up to 7 turns), and copy the conclusion as markdown.

It runs on **Cloudflare** (Workers free plan) or on **any server with Node 22+**. Both run the same
stateless Worker; sessions live only in the visitor's browser (`localStorage`).

## Models

A Model is picked in the dropdown before a Session starts and is locked for that Session. Only Models whose
credentials are configured are offered.

| Kind | Models | Needs | Budget runs out → |
|---|---|---|---|
| **Claude** (default) | Claude Haiku 5.5 (default), Claude Sonnet 5.5 | `ANTHROPIC_API_KEY` | "Claude's budget is used up — start a new session on a Workers AI model or come back later." (no Workers AI mention when it isn't offered) |
| **Gemini** | Gemini 3.5 Flash, Gemini 3.1 Pro, Gemini 4 Hydrogen | `GEMINI_API_KEY` | "Gemini's budget is used up — start a new session on a Claude or Workers AI model or come back later." (only the kinds actually offered are named) |
| **Workers AI** (free) | GLM 4.7 Flash, Llama 3.3 70B, gpt-oss, Qwen, Gemma, … | the `AI` binding on Cloudflare, or `CF_ACCOUNT_ID` + `CF_API_TOKEN` elsewhere | "come back tomorrow" (daily free allowance) |

Claude is called through the Anthropic Messages API and Gemini through the Gemini API (`streamGenerateContent`,
plain `fetch`, key sent in the `x-goog-api-key` header), each with the owner's key; its credit balance / quota is the
spending ceiling. The default Model is Claude Haiku when Claude is configured, else Gemini 3.5 Flash, else GLM 4.7 Flash. Credit and rate-limit errors are shown as Budget out, not failures, and the Session is
kept so it can continue later.

## Run locally

```sh
npm install
npm run dev:mock      # fake streamed replies for every Model, no keys or login needed
                      # type "#budget" in a message to see the Budget-out message
```

## Deploy on Cloudflare

```sh
npx wrangler login
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .dev.vars   # for local dev (gitignored)
echo 'GEMINI_API_KEY=...' >> .dev.vars            # optional: enables the Gemini Models
npm run dev                                       # real Workers AI (remote binding) + Claude
npx wrangler secret put ANTHROPIC_API_KEY         # once, for the deployed Worker
npx wrangler secret put GEMINI_API_KEY            # optional, for Gemini
npm run deploy                                    # → https://skills.<you>.workers.dev
```

## Deploy on your own server

`server/server.mjs` runs the same `src/worker.js` on plain Node (22+, no extra dependencies). Workers AI is
optional: with only `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY` set, the server offers just those.

```sh
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env        # gitignored
echo 'GEMINI_API_KEY=...' >> .env                 # optional
npm start                                         # → http://localhost:8787
npm run start:mock                                # fake replies, no keys

# or with Docker
docker build -t skills . && docker run -p 8787:8787 --env-file .env skills
```

Put it behind a TLS proxy (Caddy, nginx) that doesn't buffer `text/event-stream` responses and allows long
idle times, otherwise replies arrive all at once or get cut off.

### Server environment

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the Claude Models |
| `GEMINI_API_KEY` | Enables the Gemini Models (`GEMINI_BASE_URL` optionally overrides the API host) |
| `CF_ACCOUNT_ID`, `CF_API_TOKEN` | Optional. Enable the Workers AI Models through Cloudflare's REST API (token needs "Workers AI: Read"); still the free daily allowance |
| `PORT` | Default `8787` |
| `HOST` | Default: all interfaces. Set `127.0.0.1` when nginx/Caddy fronts it, so the port isn't reachable directly |
| `MOCK_AI=1` | Fake streamed replies for every Model |

## How it works

```
 browser (localStorage)                       Worker (stateless)
 Session: Command + Model (locked), turn n/7  ── POST /api/turn {command, model, messages} ──▶
                                              system = Command body + Turn cap note
                                              refuse turn > 7
                                              Model seam ─┬─ Claude (Anthropic Messages API)
                                                          ├─ Gemini (Gemini API)
                          ◀── SSE: data: {"response": "..."} ─┴─ Workers AI
```

- `public/index.html` — the whole UI (one static page): `/` command picker, model dropdown, sessions sidebar, copy as markdown.
- `src/worker.js` — the Worker. `GET /api/commands` (commands, models, turn cap), `POST /api/turn` (→ SSE).
  Builds the system prompt (cached on Claude, since every Turn resends it), enforces the 7-turn cap, and streams
  every Model's reply in the same shape. Models are listed in `CLAUDE_MODELS` and `MODELS`.
- `src/commands.js` + `commands/*.md` — the Commands (chatxy, few-shot, intuition-panel, origin-story,
  report-panel), copied from the skills repo. They run as pure inference: the Worker never fetches, so
  report-panel works on a topic or pasted text.
- `server/` — the self-hosting adapter: `server.mjs` (Node HTTP ↔ the Worker's `fetch`, static files,
  Workers AI over REST) and `md-text.mjs` / `md-hooks.mjs` (import `.md` files as text, as wrangler does).

## Extending

- **Add a Command:** drop its `.md` into `commands/` and add an import line in `src/commands.js`.
- **Add a Claude Model:** add an entry to `CLAUDE_MODELS` in `src/worker.js` (`label`, `maxTokens`, `effort`).
- **Add a Gemini Model:** add an entry to `GEMINI_MODELS` in `src/worker.js` (`label`, `maxTokens`, `thinkingLevel`).
- **Add a Workers AI Model:** add an entry to `MODELS`; refresh the list with
  `npx wrangler ai models list --task "Text Generation" --json`.
