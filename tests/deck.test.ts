import { describe, expect, it } from "vitest";
import { choose, discardCurrent, drawCard, newGame, playable, reveal, shuffle, splitSymbols, type GameOptions } from "@/lib/deck";
import type { Card } from "@/lib/types";

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id, set: "test", title: id, trigger: "If:", text: "t", options: [{ label: "Option 1", text: "a" }, { label: "Option 2", text: "b" }],
  mature: false, noCoop: false, ...extra,
});
const deck = [card("a"), card("b", { mature: true }), card("c", { noCoop: true }), card("d", { mature: true, noCoop: true }), card("e")];
const all: GameOptions = { leaveOutMature: false, coop: false };
const ids = (cards: Card[]) => cards.map((c) => c.id).sort();

describe("shuffle", () => {
  it("keeps every card exactly once", () => {
    expect(ids(shuffle(deck))).toEqual(ids(deck));
  });

  it("does not change the input", () => {
    const before = deck.map((c) => c.id);
    shuffle(deck);
    expect(deck.map((c) => c.id)).toEqual(before);
  });

  it("reaches every order about equally often", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      const order = shuffle(["x", "y", "z"]).join("");
      counts.set(order, (counts.get(order) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const n of counts.values()) expect(n).toBeGreaterThan(800); // 1000 expected each
  });
});

describe("filters", () => {
  it("keep everything by default", () => {
    expect(playable(deck, all)).toHaveLength(5);
  });

  it("leave out mature cards", () => {
    expect(ids(playable(deck, { leaveOutMature: true, coop: false }))).toEqual(["a", "c", "e"]);
  });

  it("leave out cards not used in co-op", () => {
    expect(ids(playable(deck, { leaveOutMature: false, coop: true }))).toEqual(["a", "b", "e"]);
  });

  it("combine", () => {
    expect(ids(playable(deck, { leaveOutMature: true, coop: true }))).toEqual(["a", "e"]);
  });
});

describe("draw cycle", () => {
  it("deals each card once before any repeats", () => {
    let game = newGame(deck, all);
    const seen: string[] = [];
    for (let i = 0; i < deck.length; i++) {
      game = drawCard(game);
      seen.push(game.current!.id);
    }
    expect(seen.sort()).toEqual(ids(deck));
  });

  it("reshuffles the discards when the deck runs out", () => {
    let game = newGame(deck, all);
    for (let i = 0; i < deck.length; i++) game = discardCurrent(drawCard(game));
    expect(game.draw).toHaveLength(0);
    expect(game.discard).toHaveLength(5);
    game = drawCard(game);
    expect(game.current).not.toBeNull();
    expect(game.draw.length + 1).toBe(5);
    expect(game.discard).toHaveLength(0);
  });

  it("never loses or duplicates a card over many draws", () => {
    let game = newGame(deck, all);
    for (let i = 0; i < 37; i++) {
      game = drawCard(game);
      const everywhere = [...game.draw, ...game.discard, ...(game.current ? [game.current] : [])];
      expect(ids(everywhere)).toEqual(ids(deck));
    }
  });

  it("shows only the trigger until revealed, then lets one option be picked", () => {
    let game = drawCard(newGame(deck, all));
    expect(game.revealed).toBe(false);
    expect(choose(game, 0).chosen).toBeNull(); // cannot pick before reveal
    game = choose(reveal(game), 1);
    expect(game.revealed).toBe(true);
    expect(game.chosen).toBe(1);
    expect(choose(game, 5).chosen).toBe(1); // out of range is ignored
  });

  it("starts a fresh shuffled game with the chosen filters", () => {
    const game = newGame(deck, { leaveOutMature: true, coop: true });
    expect(ids(game.draw)).toEqual(["a", "e"]);
    expect(game.current).toBeNull();
  });
});

describe("card text", () => {
  it("splits out printed symbols so they can be drawn", () => {
    expect(splitSymbols("If the player uses a {weapon} item card:")).toEqual([
      { text: "If the player uses a " },
      { symbol: "weapon" },
      { text: " item card:" },
    ]);
    expect(splitSymbols("No symbols here.")).toEqual([{ text: "No symbols here." }]);
  });
});
