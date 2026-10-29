import { existsSync, readFileSync } from "node:fs";

// SESSION_SECRET on Vercel; locally the file named in SESSION_SECRET_FILE.
export function sessionSecret(env = process.env): string | undefined {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.SESSION_SECRET_FILE && existsSync(env.SESSION_SECRET_FILE)) return readFileSync(env.SESSION_SECRET_FILE, "utf8").trim();
  return undefined;
}
