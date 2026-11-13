# cf-skills

A browser chat that runs the productivity **Commands** from
[smarchone/skills](https://github.com/smarchone/skills) on Cloudflare's free tier.

- `public/index.html` — the whole UI (one static page). Sessions live in `localStorage`.
- `src/worker.js` — stateless Worker. `GET /api/commands`, `POST /api/turn` (`{command, model, messages}` → SSE).
- Builds the system prompt from the Command + Turn cap note, refuses an 8th Turn (at limit), and streams the chosen **Model**'s reply in one shape whatever its kind:
  - **Claude** (`CLAUDE_MODELS`: Haiku 5.5 default, Sonnet 5.5) through the Anthropic Messages API with the owner's key; the Command's system prompt is prompt-cached. Out of credits / rate-limited → "Claude's budget is used up — start a new session on a Workers AI model or come back later."
  - **Workers AI** (every free chat model) through the `AI` binding. Daily limit → "back tomorrow".
- The Model is picked in the dropdown before a Session starts and locked for it (stored on the Session). Claude models are listed only when the key is set.
- `src/commands.js` + `commands/*.md` — the showcased Commands (chatxy, few-shot, intuition-panel, origin-story, report-panel), copied from the skills repo. 
- The Worker never fetches; report-panel works on a topic or pasted text.

## Run

```sh
npm install
npm run dev:mock    # no Cloudflare login needed: fake streamed replies; type "#budget" to simulate the Model's Budget running out
npx wrangler login
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .dev.vars   # local Claude (gitignored)
npm run dev         # real Workers AI (remote binding) + Claude
npx wrangler secret put ANTHROPIC_API_KEY        # once, for the deployed Worker
npm run deploy      # → https://skills.<you>.workers.dev
```

To add a Command: drop its `.md` into `commands/` and add an import line in `src/commands.js`.

## Run off Cloudflare (any server)

`server/server.mjs` runs the same `src/worker.js` on plain Node (22+, no extra dependencies). It stands in
for what Cloudflare provides: the runtime (node:http ↔ `fetch(request, env)`), static assets (`public/`),
the Workers AI binding (its REST API, with a Cloudflare token) and the `.md` text imports (`server/md-text.mjs`).

```sh
cat > .env <<'ENV'          # gitignored; set either kind, or both
ANTHROPIC_API_KEY=sk-ant-...
CF_ACCOUNT_ID=...           # Workers AI models (still the free daily allowance)
CF_API_TOKEN=...            # token with "Workers AI: Read"
ENV
npm start                   # → http://localhost:8787 (PORT to change)
npm run start:mock          # fake replies, no keys

docker build -t skills . && docker run -p 8787:8787 --env-file .env skills
```

Only the Models with credentials are offered. Put it behind a TLS proxy (Caddy, nginx) that doesn't buffer
`text/event-stream` responses and allows long idle times, so replies stream token by token.

