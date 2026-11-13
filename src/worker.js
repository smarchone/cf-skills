// Stateless Worker: turns one Turn (Command + Session history) into a streamed reply.
// It stores nothing; the browser owns every Session.
import { COMMANDS, COMMAND_LIST } from "./commands.js";

// The models a visitor can pick from: every Workers AI chat model that runs on the free daily allowance
// (no Workers Paid plan needed) and isn't scheduled for deprecation. Refresh the list with
// `npx wrangler ai models list --task "Text Generation" --json` (skip `require_workers_paid` and
// `planned_deprecation_date` entries, LoRA bases, guard/evaluator models).
// Each model's quirks live in its entry, so the rest of the pipeline never checks model names:
//   label:        name shown in the picker.
//   instructions: "system" → command instructions go in a system prompt;
//                 "user"   → they open the first user message (for models that follow a system prompt weakly).
//   maxTokens:    reply cap; reasoning models need room for their thinking too, which counts against it.
//   inlineThinking: the model streams its reasoning inside the answer text (<think>…</think>), so the
//                 browser hides text until the reasoning ends. false = no reasoning, or sent in a separate field.
//   verified:     replies checked live in this app. Unverified entries follow the catalog schema only.
const MODELS = {
  "@cf/zai-org/glm-4.7-flash": { label: "GLM 4.7 Flash", instructions: "system", maxTokens: 8192, inlineThinking: false, verified: true },
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": { label: "Llama 3.3 70B", instructions: "system", maxTokens: 2048, inlineThinking: false, verified: true },
  "@cf/openai/gpt-oss-120b": { label: "gpt-oss 120B", instructions: "system", maxTokens: 8192, inlineThinking: false },
  "@cf/openai/gpt-oss-20b": { label: "gpt-oss 20B", instructions: "system", maxTokens: 8192, inlineThinking: false },
  "@cf/qwen/qwen3.8-27b": { label: "Qwen 3.8 27B", instructions: "system", maxTokens: 8192, inlineThinking: false },
  "@cf/google/gemma-4-26b-a4b-it": { label: "Gemma 4 26B", instructions: "system", maxTokens: 8192, inlineThinking: false },
  "@cf/meta/llama-4-scout-17b-16e-instruct": { label: "Llama 4 Scout 17B", instructions: "system", maxTokens: 4096, inlineThinking: false },
  "@cf/mistralai/mistral-small-3.1-24b-instruct": { label: "Mistral Small 3.1 24B", instructions: "system", maxTokens: 4096, inlineThinking: false },
  "@cf/aisingapore/gemma-sea-lion-v4-27b-it": { label: "SEA-LION v4 27B", instructions: "system", maxTokens: 4096, inlineThinking: false },
  "@cf/qwen/qwen2.5-coder-32b-instruct": { label: "Qwen 2.5 Coder 32B", instructions: "system", maxTokens: 4096, inlineThinking: false },
  "@cf/meta/llama-3.2-11b-vision-instruct": { label: "Llama 3.2 11B", instructions: "system", maxTokens: 4096, inlineThinking: false },
  "@cf/ibm-granite/granite-4.0-h-micro": { label: "Granite 4.0 Micro", instructions: "system", maxTokens: 4096, inlineThinking: false },
  "@cf/utter-project/eurollm-9b-it": { label: "EuroLLM 9B", instructions: "system", maxTokens: 4096, inlineThinking: false },
  "@cf/swiss-ai/apertus-v1.5-8b": { label: "Apertus 1.5 8B", instructions: "system", maxTokens: 4096, inlineThinking: false },
};
const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";
if (!MODELS[DEFAULT_MODEL]) throw new Error(`No MODELS entry for ${DEFAULT_MODEL}`);
const MODEL_LIST = Object.entries(MODELS).map(([id, p]) => ({ id, label: p.label, inlineThinking: p.inlineThinking, verified: !!p.verified }));
const TURN_CAP = 7;
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
      return Response.json({ commands: COMMAND_LIST, turnCap: TURN_CAP, models: MODEL_LIST, defaultModel: DEFAULT_MODEL });
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

  // The picked model applies per Turn, so a visitor can switch mid-Session.
  const model = payload.model ?? DEFAULT_MODEL;
  const profile = MODELS[model];
  if (!profile) return sseError("bad_request", `Unknown model "${model}".`, 400);

  const instructions = systemPrompt(command, history[0].content, turnNo);
  const messages = profile.instructions === "user" ? inUserMessages(instructions, command, history, turnNo) : [{ role: "system", content: instructions }, ...history];

  let stream;
  try {
    stream = env.AI
      ? await env.AI.run(model, { messages, stream: true, max_tokens: profile.maxTokens })
      : mockStream(command, history, turnNo);
  } catch (err) {
    return aiError(err);
  }
  return new Response(stream, { headers: SSE_HEADERS });
}

// For models with instructions: "user" (e.g. DeepSeek R1, which follows a system prompt weakly; DeepSeek
// advises putting every instruction in the user message): the instructions open the first user message, and the latest user message
// carries a reminder of the turn pacing (the first message's copy is far back by then).
function inUserMessages(instructions, command, history, turnNo) {
  const msgs = history.map((m) => ({ ...m }));
  // Small reasoning models answer whatever they read last, so the format reminder closes the message.
  // If the command spells out an Output format, name its first line so the reply opens on it.
  const opener = command.body.split(/^## Output format\s*$/m)[1]?.match(/^\s*(\*\*[^*\n]+:\*\*)/m)?.[1];
  const reminder = `You are running /${command.name}. Do not write an essay or a numbered overview of the topic. While thinking, plan your reply in the command's format (its voices, order and length); then write the reply in exactly that format.${opener ? ` Your reply must begin with ${opener}` : ""}`;
  msgs[0].content = `${instructions}\n\n---\n\n## What the user brought to /${command.name}\n\n${msgs[0].content}\n\n---\n\n${reminder}`;
  if (msgs.length > 1) {
    // Later turns: respond to this message and move on; the first-turn "don't answer the topic" would stall it.
    const last = msgs[msgs.length - 1];
    last.content = `${last.content}\n\n(Session note: ${pacingNote(turnNo)} Respond to this message above, building on the earlier turns: answer what was asked and add only new ideas, never repeating earlier points, phrasings or diagrams. Write the reply in the /${command.name} format from the first message.)`;
  }
  return msgs;
}

function pacingNote(turnNo) {
  const remaining = TURN_CAP - turnNo;
  return turnNo === TURN_CAP
    ? `This is the FINAL turn (${turnNo} of ${TURN_CAP}). Conclude now: deliver the command's final result / conclusion for the user's idea in full, as something they can copy and keep. Do not ask further questions.`
    : turnNo === TURN_CAP - 1
      ? `This is turn ${turnNo} of ${TURN_CAP}. One turn remains after this, so start steering toward the conclusion.`
      : `This is turn ${turnNo} of ${TURN_CAP} (${remaining} remaining). Pace the session so it reaches a real conclusion by turn ${TURN_CAP}.`;
}

// Command body (frontmatter already stripped, $ARGUMENTS filled) + how the session runs.
function systemPrompt(command, firstPrompt, turnNo) {
  const body = command.body.replaceAll("$ARGUMENTS", firstPrompt);
  const pacing = pacingNote(turnNo);

  return `${body}

---

## How this session runs

You are running the /${command.name} command in a browser chat at a friend's request.
- The session is capped at ${TURN_CAP} user turns. ${pacing}
- You have no tools: no web, no files, no scripts, no subagents. If the command says to read a URL, search, or run something, work from your own knowledge and what the user wrote, and say briefly when you are unsure instead of pretending you looked it up. If the command expects a source (a transcript, article or link) and the user gave a topic instead, work from what you know and say so in one line; if they gave only a URL you can't read, say so and work from what you know about it. Never claim to have written files.
- Reply in clean Markdown. Follow the command's turn format and voices exactly, every turn.
- On later turns, respond to the user's latest message and build on the earlier turns: add only new ideas, never repeating earlier points, phrasings or diagrams.
- Diagrams: only draw one when it truly helps, inside a fenced \`\`\`text block. Keep it small and simple: prefer a single top-to-bottom or left-to-right chain (\`A --> B --> C\`, or one node per line with \`|\` and \`v\` between) over grids or side-by-side boxes. Use plain ASCII only (no box-drawing characters or emoji, which break monospace alignment), never tabs, and keep every vertical connector in the same column on each line. If you can't keep it aligned, use a short bulleted flow instead.`;
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
  const voices = {
    "intuition-panel": `**CEO:** Kafka isn't a queue, it's a replicated log. Start there and every failure makes sense.\n\n**PM:** Who feels the first failure? The consumer whose lag graph goes vertical at 2 a.m.\n\n**Architect:** The real constraint: \`acks=all\` with \`min.insync.replicas=2\` — lose two brokers and producers stall.\n\n**CEO:** So layer one is the log. Want to break a broker next?`,
    chatxy: `**Steve Jobs:** Most people build agents that do more. The question is what they should refuse to do.\n\n**You:** But users want the agent to handle everything.\n\n**Steve Jobs:** No. They want to feel in control while it handles everything. That's a different product.`,
  };
  if (voices[command.name] && turnNo < TURN_CAP) return mockFrom(voices[command.name]);
  const text = turnNo === TURN_CAP
    ? `## Conclusion from /${command.name}\n\nThis is the **final turn** (${turnNo}/${TURN_CAP}). Here is the result about:\n\n> ${history[0].content}\n\n- Point one\n- Point two\n\n\`\`\`\nmock output\n\`\`\``
    : `## ${command.name} · turn ${turnNo} of ${TURN_CAP}\n\nYou said: _${last.slice(0, 200)}_. Here is how a **leader election** round plays out when the old leader's lease expires while a follower is mid-heartbeat.\n\n| Step | Node A | Node B |\n|---|---|---|\n| 1 | term 4, leader | follower |\n| 2 | partitioned | timeout → candidate, term 5 |\n\n- The first vote request wins a majority in about \`150 ms\`.\n- Stale writes from A are rejected by term check.\n\n> Rule to infer: a higher term always wins.\n\n\`\`\`\nraft.election_timeout_ms = 150..300\n\`\`\`\n\nWhat do you want to vary next?`;
  return mockFrom(text);
}

function mockFrom(text) {
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
