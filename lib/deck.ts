import type { Card } from "./types";

// Game rules for the deck, kept pure so they can be tested without a browser.

export type GameOptions = { leaveOutMature: boolean; coop: boolean };

export type GameState = {
  draw: Card[]; // face down, top card first
  discard: Card[];
  current: Card | null;
  revealed: boolean; // false: only the trigger shows
  chosen: number | null; // index of the picked option
};

export type Random = () => number; // [0, 1)

export const cryptoRandom: Random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

// Cards mark printed game symbols like {weapon}. Split the text so the symbols can be drawn.
export type TextPart = { text: string } | { symbol: string };

export function splitSymbols(text: string): TextPart[] {
  return text
    .split(/(\{[a-z0-9-]+\})/)
    .filter(Boolean)
    .map((part) => (/^\{[a-z0-9-]+\}$/.test(part) ? { symbol: part.slice(1, -1) } : { text: part }));
}

export function playable(cards: Card[], options: GameOptions): Card[] {
  return cards.filter((c) => !(options.leaveOutMature && c.mature) && !(options.coop && c.noCoop));
}

// Fisher-Yates: every order is equally likely.
export function shuffle<T>(items: T[], random: Random = cryptoRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newGame(cards: Card[], options: GameOptions, random: Random = cryptoRandom): GameState {
  return { draw: shuffle(playable(cards, options), random), discard: [], current: null, revealed: false, chosen: null };
}

// Discards the current card (if any) and turns up the next one.
// When the draw pile is empty, the discards are shuffled into a new draw pile.
export function drawCard(state: GameState, random: Random = cryptoRandom): GameState {
  let draw = state.draw;
  let discard = state.current ? [...state.discard, state.current] : state.discard;
  if (draw.length === 0) {
    draw = shuffle(discard, random);
    discard = [];
  }
  const [current = null, ...rest] = draw;
  return { draw: rest, discard, current, revealed: false, chosen: null };
}

// Puts the current card on the discard pile without drawing a new one.
export function discardCurrent(state: GameState): GameState {
  if (!state.current) return state;
  return { ...state, discard: [...state.discard, state.current], current: null, revealed: false, chosen: null };
}

export function reveal(state: GameState): GameState {
  return state.current ? { ...state, revealed: true } : state;
}

// Picks an option. Players may change their mind: picking another option switches to it,
// picking the chosen one again takes the choice back.
export function choose(state: GameState, index: number): GameState {
  const valid = state.current && state.revealed && index >= 0 && index < state.current.options.length;
  if (!valid) return state;
  return { ...state, chosen: state.chosen === index ? null : index };
}
