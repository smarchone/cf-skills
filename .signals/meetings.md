# Meetings log

> Every go / no-go call on this repo, oldest first. The context holds what stands; this is how it got there.

## M1 · as per http://127.0.0.1:8080/api/v1/sessions/af7b396b-da77-4 · committed 2026-11-13

Why: interactive showcase of my skills is valueable

**Decided**

- Stateless Worker plus Workers AI streamed as SSE; Sessions live only in browser localStorage
- Seven pure-inference commands copied from commands/productivity; golden and report-panel out
- A real usable tool for friends, not a teaser; GitHub link credits the source
- 7-turn cap is an ending: the command concludes and the session offers copy-as-markdown

**Ruled out**

- AI Gateway and Durable Objects: unnecessary for a free stateless hobby app
- Per-IP rate limiting and auth: shared only with friends for now
- App as a funnel to local install: user wants people to actually use it

**Context**

- business.md: free web chat that runs the owner's commands for friends; open models flattening personas is the accepted risk
- product.md: / picker, locked command chip, streamed turns, turn 7 concludes with copy-as-markdown
- model.md: Command, Session, Turn, Turn cap, Budget; browser owns Sessions, Worker is stateless

## M1 (resumed) · as per http://127.0.0.1:8080/api/v1/sessions/af7b396b-da77-4 · committed 2026-11-13

**Decided**

- One command per Session: the / picker is disabled mid-session and the Worker uses only the first Turn's Command

**Context**

- product.md: mid-session / shows a new-session hint instead of the picker
- model.md: Session's Command is locked in the UI and enforced by the Worker

## M2 · there were some cosmetic changes done so far. · committed 2026-11-13

Why: adding simple claude api

**Decided**

- Claude via the Anthropic Messages API, called directly from the Worker with the owner key as a secret, added alongside Workers AI
- Model picked in the existing dropdown before a Session and locked for it; Claude is the default
- Owner pays and promotes the app; a low credit balance on the key is the only spend ceiling
- Claude Budget out tells the user to start a new Session on Workers AI or come back later

**Ruled out**

- Managed Agents: native skills not worth a second backend path, sandbox cold start and moving Sessions off the browser
- AI Gateway / Unified Billing: unnecessary hop; base-URL change later if logs or $ limits are wanted
- KV per-IP turn quota: owner chose simplicity over a stranger-drain guardrail
- Automatic fallback from Claude to Workers AI mid-Session: the voice would change before turn 7

**Context**

- business.md: promoted beyond friends; Claude is the one paid service, capped by a low credit balance; open endpoint is now the top risk
- product.md: dropdown offers Claude (default Haiku 5.5, assumed) and Workers AI, locked per Session; header shows the model
- model.md: new Model term behind one Worker seam; Budget is per Model kind with distinct out messages

## M3 · we have done some offline development. get context. · killed 2026-11-15

Why: cool idea but not economical.
