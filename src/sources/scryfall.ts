import type { Card, PriceSource } from "./types";
import { searchViaBackend } from "./backend";

// Scryfall terms: no key, 50–100 ms between requests, prices refresh once a day,
// and Magic data must never sit behind a paywall or required account.
const BASE = "https://api.scryfall.com";
const GAP_MS = 100;
let lastRequest = 0;

async function politeFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const wait = lastRequest + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  return fetch(url, {
    signal,
    headers: { Accept: "application/json", "User-Agent": "EvenTrade/0.1" },
  });
}

/** Turns one Scryfall card object into one or two priced printings (normal and foil). */
export function parseScryfallCard(c: any): Card[] {
  const image =
    c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small ?? null;
  const base = {
    game: "magic" as const,
    name: c.name,
    setName: c.set_name,
    number: c.collector_number,
    imageUrl: image,
    priceUpdatedAt: null,
    artist: c.artist,
    source: "Scryfall" as const,
  };
  const out: Card[] = [];
  const usd = c.prices?.usd ? Number(c.prices.usd) : null;
  const foil = c.prices?.usd_foil ? Number(c.prices.usd_foil) : null;
  if (usd !== null || foil === null) out.push({ ...base, id: c.id, variant: "normal", price: usd });
  if (foil !== null) out.push({ ...base, id: c.id + ":foil", variant: "foil", price: foil });
  return out;
}

export const scryfall: PriceSource = {
  game: "magic",
  async search(query, signal) {
    const q = query.trim();
    if (q.length < 2) return [];
    const cached = await searchViaBackend("magic", q, signal);
    if (cached) {
      return (cached.body.data ?? []).slice(0, 25).flatMap(parseScryfallCard)
        .map((c: Card) => ({ ...c, priceUpdatedAt: cached.fetchedAt }));
    }
    const url = `${BASE}/cards/search?unique=prints&order=usd&dir=desc&q=${encodeURIComponent(q)}`;
    const res = await politeFetch(url, signal);
    if (res.status === 404) return []; // Scryfall answers "no cards found" with 404
    if (!res.ok) throw new Error(`Magic card search failed (${res.status}). Try again in a moment.`);
    const json = await res.json();
    const now = new Date().toISOString();
    return (json.data ?? []).slice(0, 25).flatMap(parseScryfallCard).map((c: Card) => ({ ...c, priceUpdatedAt: now }));
  },
};
