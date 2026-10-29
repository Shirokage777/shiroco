// Adds or replaces an account in the users file: node scripts/add-user.mjs <name>
// Asks for the password without showing it and stores only a salted scrypt hash.
// File: APP_USERS_FILE, default ~/.config/crossroads-companion/users. Same format as lib/users.ts.
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

const name = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
  console.error("Usage: npm run add-user -- <name>   (letters, digits, - and _ only)");
  process.exit(1);
}
const file = process.env.APP_USERS_FILE ?? join(homedir(), ".config", "crossroads-companion", "users");

function askHidden(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  rl._writeToOutput = (s) => { if (!muted) rl.output.write(s); };
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); });
    muted = true;
  });
}

const password = await askHidden(`Password for ${name}: `);
const again = await askHidden("Same password again: ");
if (password !== again) { console.error("The passwords do not match. Nothing changed."); process.exit(1); }
if (password.length < 10) { console.error("Use at least 10 characters. Nothing changed."); process.exit(1); }

const salt = randomBytes(16);
const line = `${name}:scrypt:${salt.toString("base64")}:${scryptSync(password, salt, 32).toString("base64")}`;
const others = existsSync(file) ? readFileSync(file, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith(`${name}:`)) : [];
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, [...others, line].join("\n"), { mode: 0o600 });
console.log(`Saved ${name} in ${file} (${others.length + 1} account(s)).`);
