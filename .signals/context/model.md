# Model: cf-simple-skills

> Commands run as Sessions. The browser owns them, a stateless Worker turns each Turn into a streamed reply, and a Budget bounds it all.

## The shape

The product runs a **Command** on a **Model** inside a **Session**. The browser owns every Session. For each **Turn**, the stateless Worker builds the prompt from the Command and the Session's history and streams back the chosen Model's reply. Two limits close a Session: the **Turn cap** ends it with a conclusion, and the Model's **Budget** can stop it early with a clear message.

## Core abstractions

**Command.** We need a word for the unit friends choose and run, because the app is built around invoking one, not around open chat. A Command is one prompt copied from `commands/productivity/` in the skills repo into this repo. It has a name, a description, a source link back to GitHub, and a body that becomes the system prompt. Seven are in: chatxy, feel, few-shot, intuition, intuition-panel, nail-on-the-head, product-panel. A Command must work as pure inference, with no scripts, files or fetching. Its frontmatter is removed, and its `$ARGUMENTS` placeholder is filled with the user's prompt.

**Model.** We need a word for what answers, because the same Command sounds very different on Claude than on an open model. It's chosen in the existing dropdown before a Session starts. The options are Claude models, called directly through the Anthropic Messages API with the owner's key, and Workers AI models. A Claude model is the default. Each Model kind has its own Budget. The Worker hides the difference behind one seam: whichever Model is chosen, the reply streams back in the same shape.

**Session.** A conversation with exactly one Command on one Model, started by `/<command> <prompt>`. It needs its own name because what it runs is locked, it counts its Turns, and it ends. The Command and Model are locked on both sides: the UI won't switch them, and the Worker uses only the ones from the first Turn and ignores any named later. A Session never switches Model mid-way, because the voice would change before the conclusion lands. It lives only in the browser's `localStorage`. The sidebar lists recent Sessions, and a Session can be reopened or copied as markdown.

**Turn.** One user message and the streamed reply to it. Each Turn sends the whole Session to the Worker. The Worker never stores anything; it rebuilds the context from the Command and the history every time and streams the Model's reply as SSE. On Claude, the Command's system prompt is cached, because every Turn resends it.

**Turn cap.** A Session has at most 7 user Turns. The Command is told about the limit in its prompt so it concludes on the last Turn, which makes the cap an ending rather than a cut-off. The Worker enforces it by refusing an eighth Turn. Because the client owns the history, this is a guardrail, not security.

**Budget.** What a Model can still spend. There are two: the low credit balance on the owner's Anthropic key for Claude, and Workers AI's daily free allowance. When a Session's Budget runs out, the Turn fails with a polite message. On Claude it says "Claude's budget is used up — start a new session on a Workers AI model or come back later." On Workers AI it says "back tomorrow." Either way the Session is kept so it can continue later. Anthropic's credit and rate-limit errors count as Budget out, not as failures.

## How they compose

```
 browser (localStorage)                         Worker (stateless)
 ┌──────────────────────────┐   Turn: {command, ┌───────────────────────────┐
 │ Sessions ─ sidebar       │   model, history} │ system = Command body     │
 │ Session: Command + Model ├──────────────────▶│   + Turn cap note         │
 │   (locked), turn n / 7   │                   │ refuse turn > 7           │
 │                          │◀── SSE stream ────│ Model seam ─┬─ Claude API │
 └──────────────────────────┘   or "budget out" └─────────────┴─ Workers AI ┘
```

A user picks a Model (Claude by default), types `/`, picks a Command, and sends a prompt, which starts a Session. Each Turn sends the Session to the Worker, which wraps the history in the Command and the Turn cap and streams the reply into the page. On Turn 7 the Command concludes and the Session closes with copy-as-markdown. If the Budget runs out first, the Session pauses with a clear message instead.
