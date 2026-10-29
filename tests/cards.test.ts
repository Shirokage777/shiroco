import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCards, validateDeck } from "@/lib/cards";

const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));

describe("card database", () => {
  it("loads the deck the build fetched", () => {
    expect(getCards().length).toBeGreaterThan(0);
  });

  it("has a valid deck in data/cards.json", () => {
    expect(validateDeck(read("data/cards.json"))).toEqual([]);
  });

  it("ships a valid example deck for anyone who clones the repo", () => {
    expect(validateDeck(read("data/example-cards.json"))).toEqual([]);
  });

  it("finds broken cards", () => {
    const broken = { count: 2, cards: [{ id: "a", set: "x", title: "", trigger: "t", text: "t", options: [], mature: false, noCoop: false }, { id: "a" }] };
    const problems = validateDeck(broken);
    expect(problems.some((p) => p.includes("missing title"))).toBe(true);
    expect(problems.some((p) => p.includes("no options"))).toBe(true);
    expect(problems.some((p) => p.includes("duplicate id"))).toBe(true);
  });
});
