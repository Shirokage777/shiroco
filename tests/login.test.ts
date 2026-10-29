import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";
import { createSession, SESSION_COOKIE, verifySession } from "@/lib/session";
import { checkPassword, hashPassword, parseUsers } from "@/lib/users";

const SECRET = "test-secret-not-used-anywhere-else";
const PASSWORD = "correct horse battery";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}));

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("APP_USERS", hashPassword("sean", PASSWORD));
  cookieValue = undefined;
});
afterEach(() => vi.unstubAllEnvs());

const request = (path: string, token?: string) =>
  new NextRequest(`http://localhost${path}`, { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} });
const passes = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("session tokens", () => {
  it("accept a fresh token and return the user", async () => {
    expect(await verifySession(await createSession("sean", SECRET), SECRET)).toBe("sean");
  });

  it("reject tampered, expired, foreign or missing tokens", async () => {
    const token = await createSession("sean", SECRET);
    expect(await verifySession(token.replace("sean", "anna"), SECRET)).toBeNull();
    expect(await verifySession(token, "another-secret")).toBeNull();
    expect(await verifySession(await createSession("sean", SECRET, 0), SECRET)).toBeNull();
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession(token, undefined)).toBeNull();
  });
});

describe("passwords", () => {
  it("store only a salted hash and check it", () => {
    const line = hashPassword("sean", PASSWORD);
    expect(line).not.toContain(PASSWORD);
    const users = parseUsers(line);
    expect(checkPassword(users, "sean", PASSWORD)).toBe(true);
    expect(checkPassword(users, "sean", "wrong password")).toBe(false);
    expect(checkPassword(users, "nobody", PASSWORD)).toBe(false);
  });
});

describe("nothing before login", () => {
  it("sends pages to the login without a session", async () => {
    const res = await middleware(request("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });

  it("refuses the card endpoint without a session", async () => {
    expect((await middleware(request("/api/cards"))).status).toBe(401);
    expect((await middleware(request("/api/cards", "sean.99999999999999.forged"))).status).toBe(401);
  });

  it("still serves the login and robots.txt", async () => {
    expect(passes(await middleware(request("/login")))).toBe(true);
    expect(passes(await middleware(request("/api/login")))).toBe(true);
    expect(passes(await middleware(request("/robots.txt")))).toBe(true);
  });

  it("lets a valid session through", async () => {
    const token = await createSession("sean", SECRET);
    expect(passes(await middleware(request("/", token)))).toBe(true);
    expect(passes(await middleware(request("/api/cards", token)))).toBe(true);
  });

  it("names nothing about the game on the login page", () => {
    const source = readFileSync("app/login/page.tsx", "utf8");
    expect(source).not.toMatch(/dead of winter|crossroads|zombie|survivor|colony/i);
  });
});

describe("login and card endpoints", () => {
  const login = async (name: string, password: string) => {
    const { POST } = await import("@/app/api/login/route");
    return POST(new Request("http://localhost/api/login", { method: "POST", body: JSON.stringify({ name, password }) }));
  };

  it("sets a session cookie for the right password", async () => {
    const res = await login("Sean", PASSWORD);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("refuses everyone when no accounts are set up", async () => {
    vi.stubEnv("APP_USERS", "");
    vi.stubEnv("APP_USERS_FILE", "does/not/exist");
    expect((await login("sean", PASSWORD)).status).toBe(401);
  });

  it("refuses a wrong password", async () => {
    const res = await login("sean", "wrong password");
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("serves the cards only with a valid session", async () => {
    const { GET } = await import("@/app/api/cards/route");
    expect((await GET()).status).toBe(401);
    cookieValue = await createSession("sean", SECRET);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).cards.length).toBeGreaterThan(0);
  });
});
