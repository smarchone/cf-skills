# Product: cf-simple-skills

> A slick browser chat where a friend runs one of my commands on their own idea, for a short session, and leaves with the result.

## One-liner

Type `/feel <your idea>` in the browser, have a short streamed conversation with that command, and copy the result.

## For whom

A friend of the owner who has an idea or a question, and who doesn't run Claude Code. They want what the command produces, not a demo of it.

## Core loop

```
 type "/" ──▶ pick a command ──▶ prompt ──▶ streamed reply ──▶ … up to 7 turns
                                                                 │
                         command concludes on turn 7 ◀──────────┘
                         [copy as markdown] [new session]
```

1. Typing `/` opens a popover with the **Commands**. Each one shows its description and a "view source" link to GitHub, and the list is navigable with the keyboard.
2. The chosen command becomes a highlighted chip in the input. The first message (`/<command> <prompt>`) starts a **Session**, and that session's command can't change: one command per session. Once a session has started, typing `/` shows a hint ("this session runs /feel — start a new session to switch") instead of opening the picker. Anything else typed is sent as an ordinary message (assumed).
3. The browser sends the whole session to a stateless Worker. The Worker uses the command as the system prompt and streams Workers AI's reply back as SSE, rendered as markdown token by token.
4. The header shows the command and a turn counter (`turn 3 / 7`).
5. On the 7th user turn, the command has been told the length of the session and concludes. A closing card offers copy-as-markdown, a new session, and a small link: "these commands run locally too → GitHub".
6. A sidebar lists recent sessions (the command plus the first line), stored in the browser, so a friend can reopen one.

## Feel

- **Like running a command, not chatting.** The `/` popover, the command chip, and the command name in the header.
- **Fast and alive.** Replies stream immediately and render as clean markdown.
- **Finished.** A session ends with a conclusion and something to keep, not a cut-off.
- **Polished and calm.** Dark by default, one static page, nothing extra.

## The moment

On turn 7 the command delivers its conclusion about the friend's own idea, and they copy it out.

## Non-goals

- **No server-side state.** The Worker is stateless, and sessions and history live only in the browser's `localStorage` (they're lost if browser data is cleared).
- **No paid services.** No AI Gateway, Durable Objects, database, custom domain or paid model (Workers AI only).
- **No rate limiting, auth or branding.** It's shared by link with friends.
- **No skills machinery.** Commands are plain prompts. Anything that runs scripts or fetches sources (`golden`, `report-panel`) is out.
- **No plain chat (assumed).** A first message without a `/` opens the command picker.

## Open questions

- Should the turn cap stay at 7 for every command, or should each command set its own (short for `/nail-on-the-head`, longer for `/product-panel`)? It's 7 for all of them until this is decided.
