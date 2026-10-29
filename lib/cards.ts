import "server-only";
import deck from "@/data/cards.json";

export type Option = { label: string; text: string };

export type Card = {
  id: string;
  set: string;
  title: string;
  trigger: string;
  text: string;
  options: Option[];
  mature: boolean;
  noCoop: boolean;
  notes?: string;
};

export type Deck = { set: string; count: number; cards: Card[] };

export { validateDeck } from "./validate";

// The deck is bundled into server code only. Never import this from a client component.
export function getCards(): Card[] {
  return (deck as Deck).cards;
}
