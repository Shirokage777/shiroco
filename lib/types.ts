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
