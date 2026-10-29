import "server-only";
import deck from "@/data/cards.json";
import type { Card, Deck } from "./types";

export type { Card, Deck, Option } from "./types";
export { validateDeck } from "./validate";

// The deck is bundled into server code only. Never import this from a client component.
export function getCards(): Card[] {
  return (deck as Deck).cards;
}
