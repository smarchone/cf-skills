// Commands: prompts copied from github.com/smarchone/skills/commands/productivity.
// The four showcased here run as pure inference — no scripts, files or fetching.
import chatxy from "../commands/chatxy.md";
import fewShot from "../commands/few-shot.md";
import intuitionPanel from "../commands/intuition-panel.md";
import reportPanel from "../commands/report-panel.md";

const SOURCE_BASE = "https://github.com/smarchone/skills/blob/main/commands/productivity/";

const RAW = {
  chatxy,
  "few-shot": fewShot,
  "intuition-panel": intuitionPanel,
  "report-panel": reportPanel,
};

// Composer placeholder per Command (the repo's argument-hint assumes a local agent that can read files/URLs).
const HINTS = {
  chatxy: "Who X is · the topic · the setting (interview, 1:1, mentoring…)",
  "few-shot": "A concept, tool or system to learn",
  "intuition-panel": "A product idea, in a sentence or two",
  "report-panel": "Paste the talk transcript, article or launch post — and who it's for",
};

// Split "---\nfrontmatter\n---\nbody"; read description (inline or folded `>-`).
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
  return { name, description, hint: HINTS[name] || "", source: `${SOURCE_BASE}${name}.md`, body };
}

export const COMMANDS = Object.fromEntries(
  Object.entries(RAW).map(([name, text]) => [name, parse(name, text)])
);

// Public listing for the "/" picker (no prompt bodies).
export const COMMAND_LIST = Object.values(COMMANDS).map(({ name, description, hint, source }) => ({
  name, description, hint, source,
}));
