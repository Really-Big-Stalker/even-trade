// Caching proxy for card searches.
// GET /functions/v1/search?game=magic|pokemon&q=<upstream query>
// Magic results are kept 20 hours (Scryfall refreshes prices daily); Pokémon 6 hours (TCGdex).
// If the upstream API fails, the last cached result is returned with stale: true.
import { createClient } from "jsr:@supabase/supabase-js@2";

type Game = "magic" | "pokemon";
const TTL_MS: Record<Game, number> = { magic: 20 * 3600_000, pokemon: 6 * 3600_000 };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function upstream(game: Game, q: string): Promise<unknown> {
  if (game === "magic") {
    const url = `https://api.scryfall.com/cards/search?unique=prints&order=usd&dir=desc&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "EvenTrade/0.1" } });
    if (res.status === 404) return { data: [] };
    if (!res.ok) throw new Error(`Scryfall ${res.status}`);
    return res.json();
  }
  // Pokémon via TCGdex: list matching cards, skip digital TCG Pocket cards, then fetch
  // details (which carry TCGplayer prices) for up to 20 of them.
  const words = q.split(/\s+/).filter(Boolean);
  const number = words.find((w) => /^\d+[a-z]?$/i.test(w) || /^[a-z]{1,4}\d+$/i.test(w));
  const name = words.filter((w) => w !== number).join(" ");
  const params = new URLSearchParams({ "pagination:itemsPerPage": "60" });
  if (name) params.set("name", name);
  if (number) params.set("localId", number);
  const res = await fetch(`https://api.tcgdex.net/v2/en/cards?${params}`);
  if (!res.ok) throw new Error(`TCGdex ${res.status}`);
  const briefs = ((await res.json()) as any[])
    .filter((b) => !(b.image ?? "").includes("/tcgp/"))
    .slice(0, 20);
  const details = await Promise.all(briefs.map((b) =>
    fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(b.id)}`)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ));
  return { data: details.filter(Boolean) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const params = new URL(req.url).searchParams;
  const game = params.get("game") as Game;
  const q = (params.get("q") ?? "").trim();
  if (game !== "magic" && game !== "pokemon") return json({ error: "game must be magic or pokemon" }, 400);
  if (q.length < 2 || q.length > 120) return json({ error: "q must be 2–120 characters" }, 400);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const key = `${game}:${q.toLowerCase().replace(/\s+/g, " ")}`;
  const { data: hit } = await db.from("price_cache").select("body, fetched_at").eq("key", key).maybeSingle();
  const age = hit ? Date.now() - Date.parse(hit.fetched_at) : Infinity;
  if (hit && age < TTL_MS[game]) return json({ cached: true, stale: false, fetchedAt: hit.fetched_at, body: hit.body });

  try {
    const body = await upstream(game, q);
    const fetchedAt = new Date().toISOString();
    await db.from("price_cache").upsert({ key, game, body, fetched_at: fetchedAt });
    return json({ cached: false, stale: false, fetchedAt, body });
  } catch (e) {
    if (hit) return json({ cached: true, stale: true, fetchedAt: hit.fetched_at, body: hit.body });
    return json({ error: `Card search is unavailable right now (${(e as Error).message}).` }, 502);
  }
});
