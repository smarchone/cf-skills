// `node --import ./server/md-text.mjs …`: lets Node import the Commands' .md files as text,
// the way wrangler's `rules: [{ type: "Text", globs: ["**/*.md"] }]` does on Cloudflare.
import { register } from "node:module";

register("./md-hooks.mjs", import.meta.url);
