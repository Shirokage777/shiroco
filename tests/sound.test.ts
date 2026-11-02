import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/lib/session";
import { growlDelay, narrationUrl, parseSettings } from "@/app/sound";

const SECRET = "test-secret-not-used-anywhere-else";
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}));
beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  cookieValue = undefined;
});
afterEach(() => vi.unstubAllEnvs());

describe("sound switches", () => {
  it("remember only real on/off values, and start all off", () => {
    const off = { narrate: false, ambience: false, music: false, zombies: false };
    expect(parseSettings(null)).toEqual(off);
    expect(parseSettings("not json")).toEqual(off);
    expect(parseSettings('{"narrate":true,"ambience":"yes","music":true,"zombies":true}')).toEqual({
      narrate: true,
      ambience: false,
      music: true,
      zombies: true,
    });
  });

  it("space the zombie growls between 14 and 40 seconds", () => {
    expect(growlDelay(0)).toBe(14);
    expect(growlDelay(0.999)).toBeLessThan(40);
  });

  it("ships the ambience, music and growls the app plays", () => {
    const files = readdirSync("public/sounds");
    expect(files).toContain("ambience-wind.mp3");
    expect(files).toContain("music-flags.mp3");
    for (let n = 1; n <= 7; n++) expect(files).toContain(`zombie-${n}.mp3`);
  });
});

describe("narration", () => {
  it("asks for the card text, then each option", () => {
    expect(narrationUrl("base-001", "text")).toBe("/api/narration/base-001/text");
    expect(narrationUrl("base-001", 0)).toBe("/api/narration/base-001/option-1");
    expect(narrationUrl("base-001", 2)).toBe("/api/narration/base-001/option-3");
  });

  it("keeps the spoken cards out of git", () => {
    expect(() => execSync("git check-ignore -q data/audio/base-001/text.mp3")).not.toThrow();
  });

  it("is served only with a valid session, and only for real names", async () => {
    const { GET } = await import("@/app/api/narration/[card]/[clip]/route");
    const ask = (card: string, clip: string) =>
      GET(new Request(`http://localhost/api/narration/${card}/${clip}`), { params: Promise.resolve({ card, clip }) });
    expect((await ask("base-001", "text")).status).toBe(401);
    cookieValue = await createSession("sean", SECRET);
    expect((await ask("..%2F..%2Fcards", "text")).status).toBe(404);
    expect((await ask("base-001", "../secret")).status).toBe(404);
    expect((await ask("base-001", "option-x")).status).toBe(404);
    if (existsSync("data/audio/base-001/text.mp3")) {
      const res = await ask("base-001", "text");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("audio/mpeg");
      expect(res.headers.get("cache-control")).toMatch(/private/);
    }
  });
});
