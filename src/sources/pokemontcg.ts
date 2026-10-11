import type { Card, PriceSource } from "./types";
import { searchViaBackend } from "./backend";

// Searches go through the backend cache when it's configured (the key lives there);
// otherwise the app calls pokemontcg.io directly, which works without a key at 1,000 a day.
const BASE = "https://api.pokemontcg.io/v2";
export const POKEMON_API_KEY: string | undefined = undefined;

/** Turns one pokemontcg.io card into one priced entry per TCGplayer variant. */
export function parsePokemonCard(c: any): Card[] {
  const base = {
    game: "pokemon" as const,
    name: c.name,
    setName: c.set?.name ?? "",
    number: c.number,
    imageUrl: c.images?.small ?? null,
    priceUpdatedAt: c.tcgplayer?.updatedAt ?? null,
    source: "TCGplayer via pokemontcg.io" as const,
  };
  const prices = c.tcgplayer?.prices ?? {};
  const variants = Object.keys(prices);
  if (variants.length === 0) return [{ ...base, id: c.id, variant: "normal", price: null }];
  return variants.map((v) => ({
    ...base,
    id: variants.length === 1 ? c.id : `${c.id}:${v}`,
    variant: v,
    price: prices[v]?.market ?? prices[v]?.mid ?? null,
  }));
}

export function buildPokemonQuery(input: string): string {
  // "charizard 199" → name starts with charizard and number 199
  const words = input.trim().split(/\s+/).filter(Boolean);
  const num = words.find((w) => /^\d+[a-z]?$/i.test(w) || /^[a-z]{1,3}\d+$/i.test(w));
  const name = words.filter((w) => w !== num).join(" ").replace(/"/g, "");
  const parts: string[] = [];
  if (name) parts.push(name.includes(" ") ? `name:"${name}*"` : `name:${name}*`);
  if (num) parts.push(`number:${num}`);
  return parts.join(" ");
}

export const pokemontcg: PriceSource = {
  game: "pokemon",
  async search(query, signal) {
    const q = buildPokemonQuery(query);
    if (q.length < 8) return []; // needs at least two letters of a name, or a number
    const cached = await searchViaBackend("pokemon", q, signal);
    if (cached) return (cached.body.data ?? []).flatMap(parsePokemonCard);
    const url = `${BASE}/cards?pageSize=25&orderBy=-set.releaseDate&q=${encodeURIComponent(q)}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (POKEMON_API_KEY) headers["X-Api-Key"] = POKEMON_API_KEY;
    const res = await fetch(url, { signal, headers });
    if (!res.ok) throw new Error(`Pokémon card search failed (${res.status}). Try again in a moment.`);
    const json = await res.json();
    return (json.data ?? []).flatMap(parsePokemonCard);
  },
};
