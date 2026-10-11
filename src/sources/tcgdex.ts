import type { Card, PriceSource } from "./types";
import { searchViaBackend } from "./backend";

// TCGdex: free, no key, TCGplayer prices updated hourly. Replaces pokemontcg.io, which is
// being retired. A search is one list call plus one detail call per card, so the backend
// does it and caches the result; the app only does it itself as a fallback.
const BASE = "https://api.tcgdex.net/v2/en";
const MAX_DETAILS = 20;

/** "charizard 199" → { name: "charizard", number: "199" } */
export function splitPokemonQuery(input: string): { name: string; number: string | null } {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const number = words.find((w) => /^\d+[a-z]?$/i.test(w) || /^[a-z]{1,4}\d+$/i.test(w)) ?? null;
  const name = words.filter((w) => w !== number).join(" ");
  return { name, number };
}

/** TCG Pocket cards are digital-only; they can't be traded. */
export function isPhysical(brief: { id?: string; image?: string }): boolean {
  return !(brief.image ?? "").includes("/tcgp/");
}

/** Turns one TCGdex card into one priced entry per TCGplayer variant. */
export function parseTcgdexCard(c: any): Card[] {
  const tp = c.pricing?.tcgplayer ?? {};
  const base = {
    game: "pokemon" as const,
    name: c.name,
    setName: c.set?.name ?? "",
    number: c.localId,
    imageUrl: c.image ? `${c.image}/low.png` : null,
    priceUpdatedAt: tp.updated ?? null,
    source: "TCGplayer via TCGdex" as const,
  };
  const variants = Object.keys(tp).filter((k) => tp[k] && typeof tp[k] === "object");
  if (variants.length === 0) return [{ ...base, id: c.id, variant: "normal", price: null }];
  return variants.map((v) => ({
    ...base,
    id: variants.length === 1 ? c.id : `${c.id}:${v}`,
    variant: v,
    price: tp[v].marketPrice ?? tp[v].midPrice ?? null,
  }));
}

/** Highest price first, unpriced last — matches the Magic ordering. */
export function byPriceDesc(a: Card, b: Card): number {
  return (b.price ?? -1) - (a.price ?? -1);
}

async function searchDirect(input: string, signal?: AbortSignal): Promise<Card[]> {
  const { name, number } = splitPokemonQuery(input);
  const params = new URLSearchParams({ "pagination:itemsPerPage": "60" });
  if (name) params.set("name", name);
  if (number) params.set("localId", number);
  const res = await fetch(`${BASE}/cards?${params}`, { signal });
  if (!res.ok) throw new Error(`Pokémon card search failed (${res.status}). Try again in a moment.`);
  const briefs: any[] = (await res.json()).filter(isPhysical).slice(0, MAX_DETAILS);
  const details = await Promise.all(
    briefs.map((b) => fetch(`${BASE}/cards/${encodeURIComponent(b.id)}`, { signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null)),
  );
  return details.filter(Boolean).flatMap(parseTcgdexCard).sort(byPriceDesc);
}

export const tcgdex: PriceSource = {
  game: "pokemon",
  async search(query, signal) {
    const q = query.trim().replace(/\s+/g, " ");
    if (q.length < 2) return [];
    const cached = await searchViaBackend("pokemon", q, signal);
    if (cached) return (cached.body.data ?? []).flatMap(parseTcgdexCard).sort(byPriceDesc);
    return searchDirect(q, signal);
  },
};
