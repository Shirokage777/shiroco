import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/lib/session";
import { callDelay, flip, growlDelay, narrationUrl, nextVoice, parseSettings, screamClips } from "@/app/sound";

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
    const off = { narrate: false, ambience: false, music: false, intense: false, zombies: false, screams: false };
    expect(parseSettings(null)).toEqual(off);
    expect(parseSettings("not json")).toEqual(off);
    expect(parseSettings('{"narrate":true,"ambience":"yes","music":true,"zombies":true}')).toEqual({
      narrate: true,
      ambience: false,
      music: true,
      intense: false,
      zombies: true,
      screams: false,
    });
    expect(parseSettings('{"intense":true}').intense).toBe(true);
    expect(parseSettings('{"screams":true}').screams).toBe(true);
  });

  it("let only one of Music and Intense music be on", () => {
    const off = parseSettings(null);
    const music = flip(off, "music");
    expect([music.music, music.intense]).toEqual([true, false]);
    const intense = flip(music, "intense");
    expect([intense.music, intense.intense]).toEqual([false, true]);
    const back = flip(intense, "music");
    expect([back.music, back.intense]).toEqual([true, false]);
    // Switching one off leaves the other off too, and other switches are never touched.
    expect(flip(back, "music")).toEqual(off);
    const zombies = flip(flip(off, "zombies"), "intense");
    expect(flip(zombies, "music")).toEqual({ ...off, zombies: true, music: true });
    // Stored settings with both on (from a bug or by hand) come back with the normal music only.
    expect(parseSettings('{"music":true,"intense":true}')).toMatchObject({ music: true, intense: false });
  });

  it("space the zombie growls between 14 and 40 seconds", () => {
    expect(growlDelay(0)).toBe(14);
    expect(growlDelay(0.999)).toBeLessThan(40);
  });

  it("leave 1 to 2 seconds between screams, so they come close together", () => {
    expect(callDelay("screams", 0)).toBe(1);
    expect(callDelay("screams", 0.999)).toBeLessThan(2);
  });

  it("never pick the same voice twice running", () => {
    for (let last = 0; last < 4; last++)
      for (let r = 0; r < 1; r += 0.05) expect(nextVoice(4, last, r)).not.toBe(last);
    expect(nextVoice(1, 0, 0.5)).toBe(0); // one voice only: it may repeat
    // Every voice can come up.
    expect(new Set([0, 0.3, 0.6, 0.9].map((r) => nextVoice(4, -1, r)))).toEqual(new Set([0, 1, 2, 3]));
    // Voices still sounding are left out while others are free, so nobody overlaps with themselves.
    for (let r = 0; r < 1; r += 0.05) expect(nextVoice(4, 0, r, new Set([1, 2]))).toBe(3);
    // All others busy: any voice but the last.
    for (let r = 0; r < 1; r += 0.05) expect(nextVoice(4, 0, r, new Set([1, 2, 3]))).not.toBe(0);
  });

  it("ships the ambience, growls and screams the app plays, and credits each", () => {
    const files = readdirSync("public/sounds");
    const sources = readFileSync("public/sounds/SOURCES.md", "utf8");
    expect(files).toContain("ambience-wind.mp3");
    for (let n = 1; n <= 7; n++) expect(files).toContain(`zombie-${n}.mp3`);
    expect(screamClips).toHaveLength(17);
    for (const url of screamClips) {
      const name = url.replace("/sounds/", "");
      expect(files).toContain(name);
      expect(sources).toContain(name.replace(/-\d+\.mp3$/, ""));
    }
    expect(files.filter((f) => f.startsWith("scream-"))).toHaveLength(17);
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

describe("private music", () => {
  it("is kept out of git and the public folder", () => {
    expect(() => execSync("git check-ignore -q data/music/zombie-music.mp3")).not.toThrow();
    expect(() => execSync("git check-ignore -q data/music/zombie-music-intense2.mp3")).not.toThrow();
    expect(readdirSync("public/sounds").filter((f) => /music/.test(f))).toEqual([]);
  });

  it("is served only with a valid session, and only for real names", async () => {
    const { GET } = await import("@/app/api/music/[name]/route");
    const ask = (name: string) => GET(new Request(`http://localhost/api/music/${name}`), { params: Promise.resolve({ name }) });
    expect((await ask("zombie-music")).status).toBe(401);
    cookieValue = await createSession("sean", SECRET);
    expect((await ask("..%2F..%2Fcards")).status).toBe(404);
    expect((await ask("no-such-track")).status).toBe(404);
    for (const track of ["zombie-music", "zombie-music-intense2"]) {
      if (!existsSync(`data/music/${track}.mp3`)) continue;
      const res = await ask(track);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("audio/mpeg");
      expect(res.headers.get("cache-control")).toMatch(/private/);
    }
  });
});
