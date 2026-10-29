import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

// Accounts are lines "name:scrypt:<salt>:<hash>" (base64), one per person.
// They come from APP_USERS (Vercel) or the file named in APP_USERS_FILE (local dev).

type Account = { salt: Buffer; hash: Buffer };

export function hashPassword(name: string, password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${name}:scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function parseUsers(raw: string): Map<string, Account> {
  const users = new Map<string, Account>();
  for (const line of raw.split(/[\n,;]/).map((l) => l.trim()).filter(Boolean)) {
    const [name, kind, salt, hash] = line.split(":");
    if (kind === "scrypt" && name && salt && hash) {
      users.set(name, { salt: Buffer.from(salt, "base64"), hash: Buffer.from(hash, "base64") });
    }
  }
  return users;
}

export function loadUsers(env = process.env): Map<string, Account> {
  if (env.APP_USERS) return parseUsers(env.APP_USERS);
  if (env.APP_USERS_FILE && existsSync(env.APP_USERS_FILE)) return parseUsers(readFileSync(env.APP_USERS_FILE, "utf8"));
  return new Map();
}

export function checkPassword(users: Map<string, Account>, name: string, password: string): boolean {
  const account = users.get(name);
  // Hash even for unknown names, so a wrong name takes as long as a wrong password.
  const salt = account?.salt ?? Buffer.alloc(16);
  const hash = scryptSync(password, salt, 32);
  return account !== undefined && timingSafeEqual(hash, account.hash);
}
