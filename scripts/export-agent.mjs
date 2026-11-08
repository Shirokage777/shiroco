// Refreshes the public copy of the builder agent's knowledge (agent/) from the owner's private
// working copy, and checks the whole public agent (CLAUDE.md, .claude/, agent/) for anything
// personal before it can be committed.
//
//   node scripts/export-agent.mjs <private knowledge folder> <owner name> [deny list]
//
// The private folder holds preferences.md and crossroads-companion/privacy.md. Lines marked
// `<!-- private -->` are left out, and the owner's name (given on the command line, never stored
// here) becomes "the owner". The optional deny
// list (one word per line, `#` for comments) names words that must never appear in public; it
// stays private too. A hit stops the export with exit code 1 and changes nothing.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [source, owner, denyFile] = process.argv.slice(2);
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain && (!source || !owner)) {
  console.error("usage: node scripts/export-agent.mjs <private knowledge folder> <owner name> [deny list]");
  process.exit(2);
}

const FILES = { "agent/preferences.md": "preferences.md", "agent/privacy.md": "crossroads-companion/privacy.md" };
const HEADER = "<!-- The original owner refreshes this file with scripts/export-agent.mjs. In your own copy, edit it freely. -->\n\n";

export function clean(text, owner) {
  const kept = text.split(/\r?\n/).filter((line) => !line.includes("<!-- private -->")).join("\n");
  return kept
    .replace(new RegExp(`(^|[.!?]\\s+|\\*\\*\\s*|^#\\s*|^-\\s+)${owner}'s`, "gm"), "$1The owner's")
    .replace(new RegExp(`(^|[.!?]\\s+|\\*\\*\\s*|^#\\s*|^-\\s+)${owner}\\b`, "gm"), "$1The owner")
    .replace(new RegExp(`\\b${owner}'s`, "g"), "the owner's")
    .replace(new RegExp(`\\b${owner}\\b`, "g"), "the owner")
    .replace(/\n{3,}/g, "\n\n");
}

// Built-in checks, plus the private deny list.
const PATTERNS = [
  [/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i, "an ID (Notion or similar)"],
  [/[A-Z]:[\\/]Users[\\/]/i, "a local user path"],
  [/<!-- private/, "a private marker"],
  [/@[a-z0-9-]+\.[a-z]{2,}/i, "an e-mail address"],
];

export function leaks(files, deny = [], owner = "") {
  const found = [];
  for (const [file, text] of Object.entries(files)) {
    for (const [re, what] of PATTERNS) if (re.test(text)) found.push(`${file}: ${what}`);
    for (const word of deny) if (text.toLowerCase().includes(word.toLowerCase())) found.push(`${file}: "${word}"`);
    if (owner && new RegExp(`\\b${owner}\\b`).test(text)) found.push(`${file}: the owner's name`);
  }
  return found;
}

const publicAgentFiles = () => {
  const out = { "CLAUDE.md": readFileSync("CLAUDE.md", "utf8") };
  for (const dir of [".claude", "agent"]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir, { recursive: true }).map(String)) {
      const path = join(dir, f).replaceAll("\\", "/");
      if (/\.(md|json|txt)$/.test(path)) out[path] = readFileSync(path, "utf8");
    }
  }
  return out;
};

if (isMain) {
  const deny = denyFile
    ? readFileSync(denyFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : [];
  const fresh = Object.fromEntries(
    Object.entries(FILES).map(([to, from]) => [to, HEADER + clean(readFileSync(join(source, from), "utf8"), owner).trim() + "\n"]),
  );
  const all = { ...publicAgentFiles(), ...fresh };
  const found = leaks(all, deny, owner);
  if (found.length) {
    console.error("Not exported, the public agent would leak:\n  " + found.join("\n  "));
    process.exit(1);
  }
  for (const [to, text] of Object.entries(fresh)) writeFileSync(to, text);
  console.log(`Exported ${Object.keys(fresh).join(", ")}; checked ${Object.keys(all).length} public agent files, nothing personal.`);
}
