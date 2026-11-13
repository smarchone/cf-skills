# cf-simple-skills

A browser chat that runs the productivity **Commands** from
[smarchone/skills](https://github.com/smarchone/skills) on Cloudflare's free tier.
Type `/feel <your idea>`, have a streamed **Session** of up to 7 **Turns**, copy the result.

- `public/index.html` — the whole UI (one static page). Sessions live in `localStorage`.
- `src/worker.js` — stateless Worker. `GET /api/commands`, `POST /api/turn` (`{command, messages}` → SSE).
  Builds the system prompt from the Command + Turn cap note, refuses an 8th Turn, maps the
  Workers AI daily-limit error to a "back tomorrow" message. Visitors pick the model from every
  free Workers AI chat model (`MODELS`, default `DEFAULT_MODEL`); the choice is remembered per browser.
- `src/commands.js` + `commands/*.md` — the showcased Commands (chatxy, few-shot, intuition-panel, origin-story, report-panel), copied from the skills repo. The Worker never fetches; report-panel works on a topic or pasted text.

## Run

```sh
npm install
npm run dev:mock    # no Cloudflare login needed: fake streamed replies; type "#budget" to simulate the daily limit
npx wrangler login
npm run dev         # real Workers AI (remote binding)
npm run deploy      # → https://skills.<you>.workers.dev
```

To add a Command: drop its `.md` into `commands/` and add an import line in `src/commands.js`.
