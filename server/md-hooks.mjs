// Module loader hook (registered by md-text.mjs): `import body from "x.md"` → the file's text.
import { readFile } from "node:fs/promises";

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".md")) return nextLoad(url, context);
  const text = await readFile(new URL(url), "utf8");
  return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(text)};` };
}
