// Caching proxy for card searches.
// GET /functions/v1/search?game=magic|pokemon&q=<upstream query>
// Magic results are kept 20 hours (Scryfall refreshes prices daily); Pokémon 6 hours.
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
  const url = `https://api.pokemontcg.io/v2/cards?pageSize=25&orderBy=-set.releaseDate&q=${encodeURIComponent(q)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = Deno.env.get("POKEMON_API_KEY");
  if (key) headers["X-Api-Key"] = key;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`pokemontcg.io ${res.status}`);
  return res.json();
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
