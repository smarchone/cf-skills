// Commands: prompts copied from github.com/smarchone/skills/commands/productivity.
// Each one is pure inference — no scripts, files or fetching.
import chatxy from "../commands/chatxy.md";
import feel from "../commands/feel.md";
import fewShot from "../commands/few-shot.md";
import intuition from "../commands/intuition.md";
import intuitionPanel from "../commands/intuition-panel.md";
import nailOnTheHead from "../commands/nail-on-the-head.md";
import productPanel from "../commands/product-panel.md";

const SOURCE_BASE = "https://github.com/smarchone/skills/blob/main/commands/productivity/";

const RAW = {
  chatxy,
  feel,
  "few-shot": fewShot,
  intuition,
  "intuition-panel": intuitionPanel,
  "nail-on-the-head": nailOnTheHead,
  "product-panel": productPanel,
};

// Split "---\nfrontmatter\n---\nbody"; read description (inline or folded `>-`) and argument-hint.
function parse(name, text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const front = m ? m[1] : "";
  const body = (m ? m[2] : text).trim();
  const lines = front.split(/\r?\n/);
  let description = "";
  const i = lines.findIndex((l) => /^description:/.test(l));
  if (i >= 0) {
    const inline = lines[i].replace(/^description:\s*/, "");
    if (/^[>|]-?\s*$/.test(inline)) {
      const parts = [];
      for (let j = i + 1; j < lines.length && /^\s+/.test(lines[j]); j++) parts.push(lines[j].trim());
      description = parts.join(" ");
    } else {
      description = inline.replace(/^["']|["']$/g, "");
    }
  }
  const hint = (front.match(/^argument-hint:\s*"?(.*?)"?\s*$/m) || [])[1] || "";
  return { name, description, hint, source: `${SOURCE_BASE}${name}.md`, body };
}

export const COMMANDS = Object.fromEntries(
  Object.entries(RAW).map(([name, text]) => [name, parse(name, text)])
);

// Public listing for the "/" picker (no prompt bodies).
export const COMMAND_LIST = Object.values(COMMANDS).map(({ name, description, hint, source }) => ({
  name, description, hint, source,
}));
