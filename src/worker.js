// Stateless Worker: turns one Turn (Command + Session history) into a streamed reply.
// It stores nothing; the browser owns every Session.
import { COMMANDS, COMMAND_LIST } from "./commands.js";

// The model, set in one place so it can be swapped.
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const TURN_CAP = 7;
const MAX_TOKENS = 2048;
const MAX_MESSAGE_CHARS = 40000; // room for a pasted transcript (report-panel)

const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  "x-accel-buffering": "no",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/commands" && request.method === "GET") {
      return Response.json({ commands: COMMAND_LIST, turnCap: TURN_CAP, model: MODEL });
    }
    if (url.pathname === "/api/turn" && request.method === "POST") {
      return turn(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};

async function turn(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return sseError("bad_request", "That request wasn't valid JSON.", 400);
  }

  // The Session's Command is whatever it started with; any later "/x" is just text.
  const command = COMMANDS[payload?.command];
  if (!command) return sseError("bad_request", `Unknown command "${payload?.command}".`, 400);

  const history = sanitize(payload.messages);
  if (!history.length || history[history.length - 1].role !== "user") {
    return sseError("bad_request", "A Turn must end with a user message.", 400);
  }
  const turnNo = history.filter((m) => m.role === "user").length;
  if (turnNo > TURN_CAP) {
    return sseError("turn_cap", `This session has used all ${TURN_CAP} turns. Start a new session to keep going.`, 409);
  }

  const messages = [{ role: "system", content: systemPrompt(command, history[0].content, turnNo) }, ...history];

  let stream;
  try {
    stream = env.AI
      ? await env.AI.run(MODEL, { messages, stream: true, max_tokens: MAX_TOKENS })
      : mockStream(command, history, turnNo);
  } catch (err) {
    return aiError(err);
  }
  return new Response(stream, { headers: SSE_HEADERS });
}

// Command body (frontmatter already stripped, $ARGUMENTS filled) + the Turn cap note.
function systemPrompt(command, firstPrompt, turnNo) {
  const body = command.body.replaceAll("$ARGUMENTS", firstPrompt);
  const remaining = TURN_CAP - turnNo;
  const pacing =
    turnNo === TURN_CAP
      ? `This is the FINAL turn (${turnNo} of ${TURN_CAP}). Conclude now: deliver the command's final result / conclusion for the user's idea in full, as something they can copy and keep. Do not ask further questions.`
      : turnNo === TURN_CAP - 1
        ? `This is turn ${turnNo} of ${TURN_CAP}. One turn remains after this, so start steering toward the conclusion.`
        : `This is turn ${turnNo} of ${TURN_CAP} (${remaining} remaining). Pace the session so it reaches a real conclusion by turn ${TURN_CAP}.`;

  return `${body}

---

## How this session runs

You are running the /${command.name} command in a browser chat at a friend's request.
- The session is capped at ${TURN_CAP} user turns. ${pacing}
- You have no tools: no web, no files, no scripts, no subagents. If the command says to read a URL, search, or run something, work from your own knowledge and what the user wrote, and say briefly when you are unsure instead of pretending you looked it up. If the command expects a source (a transcript, article or link) and the user gave a topic instead, work from what you know and say so in one line; if they gave only a URL you can't read, say so and work from what you know about it. Never claim to have written files.
- Reply in clean Markdown. Follow the command's turn format and voices exactly.`;
}

function sanitize(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

function aiError(err) {
  const msg = String(err?.message || err);
  // 4006: daily free neuron allocation used up.
  if (/4006|neuron|daily free alloc|quota|capacity/i.test(msg)) {
    return sseError("budget", "The free budget is used up for today. Your session is saved, so come back tomorrow and pick up where you left off.", 429);
  }
  console.error("AI error:", msg);
  return sseError("ai_error", "The model didn't answer this time. Try sending again.", 502);
}

// Errors are sent as an SSE `error` event so the client has one code path.
function sseError(kind, message, status) {
  const body = `event: error\ndata: ${JSON.stringify({ kind, message })}\n\n`;
  return new Response(body, { status, headers: SSE_HEADERS });
}

// Local-only stand-in for Workers AI (dev:mock). Type "#budget" to simulate the daily limit.
function mockStream(command, history, turnNo) {
  const last = history[history.length - 1].content;
  if (last.includes("#budget")) throw new Error("4006: you have used up your daily free allocation of 10,000 neurons");
  const text = turnNo === TURN_CAP
    ? `## Conclusion from /${command.name}\n\nThis is the **final turn** (${turnNo}/${TURN_CAP}). Here is the result about:\n\n> ${history[0].content}\n\n- Point one\n- Point two\n\n\`\`\`\nmock output\n\`\`\``
    : `## ${command.name} · turn ${turnNo} of ${TURN_CAP}\n\nYou said: _${last.slice(0, 200)}_. Here is how a **leader election** round plays out when the old leader's lease expires while a follower is mid-heartbeat.\n\n| Step | Node A | Node B |\n|---|---|---|\n| 1 | term 4, leader | follower |\n| 2 | partitioned | timeout → candidate, term 5 |\n\n- The first vote request wins a majority in about \`150 ms\`.\n- Stale writes from A are rejected by term check.\n\n> Rule to infer: a higher term always wins.\n\n\`\`\`\nraft.election_timeout_ms = 150..300\n\`\`\`\n\nWhat do you want to vary next?`;
  const enc = new TextEncoder();
  const tokens = text.match(/\S+\s*|\s+/g);
  let i = 0;
  return new ReadableStream({
    async pull(ctrl) {
      if (i >= tokens.length) { ctrl.enqueue(enc.encode("data: [DONE]\n\n")); ctrl.close(); return; }
      await new Promise((r) => setTimeout(r, 25));
      ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ response: tokens[i++] })}\n\n`));
    },
  });
}
