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
