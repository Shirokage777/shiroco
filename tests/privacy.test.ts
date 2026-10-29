import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { metadata } from "@/app/layout";
import nextConfig, { robotsHeader } from "@/next.config";

// Every file git would commit: tracked plus new, minus ignored.
const repoFiles = () =>
  execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" }).split("\n").filter((f) => f && existsSync(f));

describe("card data stays private", () => {
  it("keeps the fetched deck out of git", () => {
    expect(() => execSync("git check-ignore -q data/cards.json")).not.toThrow();
  });

  it("has no real card text in any file that would be committed", () => {
    const deck = JSON.parse(readFileSync("data/cards.json", "utf8"));
    if (deck.set === "example") return; // only the example deck is present
    const snippets: string[] = deck.cards.map((c: { text: string }) => c.text.slice(0, 60));
    const leaks = repoFiles().filter((file) => {
      const content = readFileSync(file, "utf8");
      return snippets.some((s) => content.includes(s));
    });
    expect(leaks).toEqual([]);
  });

  it("serves no data files publicly", () => {
    const publicFiles = existsSync("public") ? readdirSync("public", { recursive: true }).map(String) : [];
    expect(publicFiles.filter((f) => /\.json$|card/i.test(f))).toEqual([]);
  });
});

describe("search engines stay out", () => {
  it("disallows everything in robots.txt", () => {
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("sends X-Robots-Tag on every response", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toContainEqual({ source: "/:path*", headers: [robotsHeader] });
    expect(robotsHeader.value).toBe("noindex, nofollow");
  });

  it("marks every page noindex and names nothing", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(metadata)).not.toMatch(/dead of winter|crossroads|zombie/i);
  });
});
