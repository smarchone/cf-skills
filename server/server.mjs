// Runs the same stateless Worker (src/worker.js) on a plain Node server, for hosting off Cloudflare.
// It stands in for the three things Cloudflare provides:
//   - the runtime: node:http requests become web Requests for worker.fetch(), and Responses stream back;
//   - static assets: public/ is served for every non-/api path;
//   - the Workers AI binding: env.AI.run() calls the Workers AI REST API with a Cloudflare token.
// The Commands' .md imports are handled by md-text.mjs (see the `start` script). No dependencies.
//
// Env (from the process, or a .env file via `npm start`):
//   PORT                   default 8787
//   ANTHROPIC_API_KEY      enables the Claude Models
//   CF_ACCOUNT_ID, CF_API_TOKEN   enable the Workers AI Models (token needs "Workers AI: Read")
//   MOCK_AI=1              fake streamed replies for every Model, no keys needed
import http from "node:http";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };

const env = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
  MOCK_AI: process.env.MOCK_AI,
  AI: process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN ? workersAiRest(process.env.CF_ACCOUNT_ID, process.env.CF_API_TOKEN) : undefined,
};

// Same shape as the AI binding's run(): resolves to the SSE byte stream, or throws with Cloudflare's error
// text (which carries code 4006 when the daily free allowance is used up, so the Worker's Budget check still works).
function workersAiRest(accountId, token) {
  return {
    async run(model, input) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Workers AI ${res.status}: ${await res.text()}`);
      return res.body;
    },
  };
}

async function serveStatic(pathname) {
  const rel = normalize(decodeURIComponent(pathname === "/" ? "/index.html" : pathname)).replace(/^([/\\])+/, "");
  const file = join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR) || rel.split(sep).includes("..")) return new Response("Not found", { status: 404 });
  try {
    return new Response(await readFile(file), { headers: { "content-type": TYPES[extname(file)] || "application/octet-stream" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const aborter = new AbortController();
  res.on("close", () => aborter.abort());
  let response;
  try {
    if (url.pathname.startsWith("/api/")) {
      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      const request = new Request(url, {
        method: req.method,
        headers: Object.entries(req.headers).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])),
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: hasBody ? "half" : undefined,
        signal: aborter.signal,
      });
      response = await worker.fetch(request, env);
    } else {
      response = await serveStatic(url.pathname);
    }
  } catch (err) {
    console.error(err);
    response = new Response("Internal error", { status: 500 });
  }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) return res.end();
  // Stream as it arrives (SSE). If the visitor leaves, cancel the body so the Model call is aborted too.
  const body = Readable.fromWeb(response.body);
  res.on("close", () => body.destroy());
  body.on("error", () => res.end());
  body.pipe(res);
});

server.listen(PORT, () => {
  const models = [env.ANTHROPIC_API_KEY && "Claude", env.AI && "Workers AI", env.MOCK_AI && "mock"].filter(Boolean).join(" + ") || "none (set ANTHROPIC_API_KEY and/or CF_ACCOUNT_ID + CF_API_TOKEN)";
  console.log(`skills on http://localhost:${PORT} · models: ${models}`);
});
