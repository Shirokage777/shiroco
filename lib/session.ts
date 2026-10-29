// Signed session tokens: "<name>.<expires>.<signature>", HMAC-SHA256 with SESSION_SECRET.
// Uses Web Crypto so it runs in middleware, route handlers and tests alike.

export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 30;

const NAME = /^[a-z0-9_-]{1,32}$/;
const encoder = new TextEncoder();

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSession(name: string, secret: string, now = Date.now()): Promise<string> {
  if (!NAME.test(name)) throw new Error("invalid user name");
  const payload = `${name}.${now + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${await sign(payload, secret)}`;
}

// Returns the user name for a valid, unexpired token, otherwise null.
export async function verifySession(token: string | undefined, secret: string | undefined, now = Date.now()): Promise<string | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [name, expires, sig] = parts;
  if (!NAME.test(name) || !(Number(expires) > now)) return null;
  const expected = await sign(`${name}.${expires}`, secret);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? name : null;
}
