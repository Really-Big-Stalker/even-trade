export type Game = "pokemon" | "magic";

/** One printing of a card with its near-mint market price in USD. */
export interface Card {
  id: string;
  game: Game;
  name: string;
  setName: string;
  number: string;
  /** Printing variant the price applies to, e.g. "holofoil", "foil", "normal". */
  variant: string;
  imageUrl: string | null;
  /** Near-mint market price in US dollars, or null when the source has none. */
  price: number | null;
  /** ISO date the price was last updated by the source. */
  priceUpdatedAt: string | null;
  /** Required on screen for Magic images under Scryfall's terms. */
  artist?: string;
  source: "Scryfall" | "TCGplayer via pokemontcg.io";
}

export interface PriceSource {
  game: Game;
  search(query: string, signal?: AbortSignal): Promise<Card[]>;
}
