# Business: cf-simple-skills

> A free, usable web chat for running my productivity commands. It shows off the skills to friends and teaches me how to build on Cloudflare.

## Why build it

- **Problem:** The productivity commands at `github.com/smarchone/skills` only run inside a local Claude Code. A friend who doesn't have it set up can't try `/feel` or `/product-panel` on a real idea of their own.
- **Positioning:** Run the commands in a browser, for free, with no install. The GitHub repo is credited as the source and is the place to take them further.
- **For whom:** The owner's friends, through a shared link. It isn't promoted publicly.
- **Second payoff:** The owner learns how to build agents on Cloudflare (Workers, Workers AI, SSE streaming) through a real deployment.

## Constraints that shape it

- **Free to run.** Workers' free plan, Workers AI's daily free allowance and a `*.workers.dev` domain. There's no paid service and no custom domain.
- **Budget:** About 5–10 full sessions a day is enough. When the daily allowance runs out, the app says so plainly.

## Risks

1. **Open models flatten the commands.** These multi-voice persona prompts were written for Claude. Signal: replies merge the voices or ignore the turn format. Accepted for now, so the app uses the best free model and keeps the model easy to swap.
2. **The free budget runs out mid-session.** Signal: friends hit "back tomorrow" often. If they do, revisit the model size or the turn cap.
3. **The endpoint is open.** Anyone with the link spends the owner's allowance. This is accepted while the link is only shared with friends; there's no rate limiting or auth.
