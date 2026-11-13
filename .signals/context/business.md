# Business: cf-simple-skills

> A free, usable web chat for running my productivity commands. It shows off the skills, now promoted beyond friends, and teaches me how to build on Cloudflare.

## Why build it

- **Problem:** The productivity commands at `github.com/smarchone/skills` only run inside a local Claude Code. A friend who doesn't have it set up can't try `/feel` or `/product-panel` on a real idea of their own.
- **Positioning:** Run the commands in a browser, for free, with no install. The GitHub repo is credited as the source and is the place to take them further.
- **For whom:** The owner's friends first, and now anyone who finds the link: the owner promotes it.
- **Second payoff:** The owner learns how to build agents on Cloudflare (Workers, Workers AI, SSE streaming) through a real deployment.

## Constraints that shape it

- **Free for users, nearly free to run.** Workers' free plan, Workers AI's daily free allowance and a `*.workers.dev` domain. The one paid service is Claude, through the owner's Anthropic key.
- **Budget:** The Claude key holds a deliberately low credit balance, and that balance is the spending ceiling. When either Claude's credits or Workers AI's allowance runs out, the app says so plainly.

## Risks

1. **The endpoint is open and promoted.** A stranger can drain the Claude credits in an evening. This is accepted: the low credit balance caps the loss, and there's no rate limiting or auth. Signal: credits vanish faster than real sessions explain. If they do, revisit a per-visitor limit.
2. **Open models flatten the commands.** These multi-voice persona prompts were written for Claude, and Workers AI models merged the voices in practice. This is why Claude is offered and is the default. Signal: Workers AI sessions are rarely finished.
3. **Budget runs out mid-session.** Signal: users often hit the "budget used up" message. If they do, revisit the credit balance, the default model or the turn cap.
