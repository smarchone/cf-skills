# Model: cf-simple-skills

> Commands run as Sessions. The browser owns them, a stateless Worker turns each Turn into a streamed reply, and a Budget bounds it all.

## The shape

The product runs a **Command** inside a **Session**. The browser owns every Session. For each **Turn**, the stateless Worker builds the prompt from the Command and the Session's history and streams back the reply. Two limits close a Session: the **Turn cap** ends it with a conclusion, and the daily **Budget** can stop it early with a clear message.

## Core abstractions

**Command.** We need a word for the unit friends choose and run, because the app is built around invoking one, not around open chat. A Command is one prompt copied from `commands/productivity/` in the skills repo into this repo. It has a name, a description, a source link back to GitHub, and a body that becomes the system prompt. Seven are in: chatxy, feel, few-shot, intuition, intuition-panel, nail-on-the-head, product-panel. A Command must work as pure inference, with no scripts, files or fetching. Its frontmatter is removed, and its `$ARGUMENTS` placeholder is filled with the user's prompt.

**Session.** A conversation with exactly one Command, started by `/<command> <prompt>`. It needs its own name because the Command it runs is locked, it counts its Turns, and it ends. The Command is locked on both sides: the UI won't switch it, and the Worker uses only the Command from the first Turn and ignores any Command named later. It lives only in the browser's `localStorage`. The sidebar lists recent Sessions, and a Session can be reopened or copied as markdown.

**Turn.** One user message and the streamed reply to it. Each Turn sends the whole Session to the Worker. The Worker never stores anything; it rebuilds the context from the Command and the history every time and streams Workers AI's reply as SSE.

**Turn cap.** A Session has at most 7 user Turns. The Command is told about the limit in its prompt so it concludes on the last Turn, which makes the cap an ending rather than a cut-off. The Worker enforces it by refusing an eighth Turn. Because the client owns the history, this is a guardrail, not security.

**Budget.** Workers AI's daily free allowance is the only real limit (about 5–10 full Sessions a day). When it runs out, the Turn fails with a polite "free budget used up for today, back tomorrow", and the Session is kept so it can continue later. The model is the best free Workers AI model and is set in one place so it can be swapped.

## How they compose

```
 browser (localStorage)                         Worker (stateless)
 ┌──────────────────────────┐   Turn: {command, ┌───────────────────────────┐
 │ Sessions ─ sidebar       │   history}        │ system = Command body     │
 │ Session: Command (locked)├──────────────────▶│   + Turn cap note         │
 │   history, turn n / 7    │                   │ refuse turn > 7           │
 │                          │◀── SSE stream ────│ env.AI.run(model, stream) │
 └──────────────────────────┘   or "budget out" └───────────────────────────┘
```

A friend types `/`, picks a Command, and sends a prompt, which starts a Session. Each Turn sends the Session to the Worker, which wraps the history in the Command and the Turn cap and streams the reply into the page. On Turn 7 the Command concludes and the Session closes with copy-as-markdown. If the Budget runs out first, the Session pauses with a clear message instead.
