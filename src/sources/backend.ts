import type { Game } from "./types";

/**
 * The Supabase project that caches searches. Filled in once the project is linked;
 * while it's null the app calls Scryfall and TCGdex directly.
 */
export const BACKEND_URL: string | null = "https://vmccvftiewrklrmzgczx.supabase.co";

export interface BackendResult {
  body: any;
  fetchedAt: string;
  stale: boolean;
}

/**
 * Searches through the cache. Returns null when the backend isn't configured or can't be
 * reached, so the caller falls back to calling the source directly.
 */
export async function searchViaBackend(
  game: Game,
  upstreamQuery: string,
  signal?: AbortSignal,
  base: string | null = BACKEND_URL,
  doFetch: typeof fetch = fetch,
): Promise<BackendResult | null> {
  if (!base) return null;
  try {
    const url = `${base}/functions/v1/search?game=${game}&q=${encodeURIComponent(upstreamQuery)}`;
    const res = await doFetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !json.body) return null;
    return { body: json.body, fetchedAt: json.fetchedAt, stale: !!json.stale };
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    return null;
  }
}
