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
