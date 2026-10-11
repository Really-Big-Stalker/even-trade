import { describe, expect, test } from "bun:test";
import { addCard, canUseConditions, freshness, lineValue, sideTotal, verdict } from "./trade";
import { parseScryfallCard } from "./sources/scryfall";
import { byPriceDesc, isPhysical, parseTcgdexCard, splitPokemonQuery } from "./sources/tcgdex";
import type { Card } from "./sources/types";
import { searchViaBackend } from "./sources/backend";

const card = (id: string, price: number | null): Card => ({
  id, game: "pokemon", name: id, setName: "Test", number: "1", variant: "normal",
  imageUrl: null, price, priceUpdatedAt: null, source: "TCGplayer via TCGdex",
});

describe("trade math", () => {
  test("condition factor applies only when on", () => {
    const l = { card: card("a", 100), condition: "LP" as const, qty: 2 };
    expect(lineValue(l, true)).toBe(170);
    expect(lineValue(l, false)).toBe(200);
  });
  test("missing price counts as zero", () => {
    expect(sideTotal([{ card: card("a", null), condition: "NM", qty: 1 }], true)).toBe(0);
  });
  test("mixed-game side: Magic condition always applies, Pokémon only with Pro", () => {
    const magic: Card = { ...card("m", 100), game: "magic", source: "Scryfall" };
    const lines = [
      { card: magic, condition: "LP" as const, qty: 1 },
      { card: card("p", 100), condition: "LP" as const, qty: 1 },
    ];
    expect(sideTotal(lines, false)).toBe(185);
    expect(sideTotal(lines, true)).toBe(170);
  });
  test("verdict thresholds", () => {
    expect(verdict(0, 10).kind).toBe("incomplete");
    expect(verdict(100, 96).kind).toBe("even");
    expect(verdict(100, 94).kind).toBe("you-behind");
    const v = verdict(80, 100);
    expect(v.kind).toBe("you-ahead");
    if (v.kind !== "incomplete") expect(v.gap).toBe(20);
  });
  test("float sums round to cents", () => {
    const lines = [0.1, 0.2].map((p, i) => ({ card: card("c" + i, p), condition: "NM" as const, qty: 1 }));
    expect(sideTotal(lines, true)).toBe(0.3);
  });
  test("adding the same NM card bumps quantity", () => {
    const c = card("x", 5);
    expect(addCard(addCard([], c), c)).toEqual([{ card: c, condition: "NM", qty: 2 }]);
  });
  test("Magic never gated; Pokémon conditions need Pro", () => {
    expect(canUseConditions("magic", false)).toBe(true);
    expect(canUseConditions("pokemon", false)).toBe(false);
    expect(canUseConditions("pokemon", true)).toBe(true);
  });
  test("freshness labels", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(freshness("2026/10/07", now)).toBe("updated 3 days ago");
    expect(freshness(null, now)).toBe("price as of today");
  });
});

describe("Scryfall parsing", () => {
  test("normal and foil prices become two entries", () => {
    const out = parseScryfallCard({
      id: "abc", name: "Sol Ring", set_name: "Commander Masters", collector_number: "400",
      artist: "Mike Bierek", prices: { usd: "1.25", usd_foil: "4.50" },
      image_uris: { small: "https://img/x.jpg" },
    });
    expect(out.map((c) => [c.variant, c.price])).toEqual([["normal", 1.25], ["foil", 4.5]]);
    expect(out[1].id).toBe("abc:foil");
    expect(out[0].artist).toBe("Mike Bierek");
  });
  test("double-faced card uses front face image; foil-only keeps just foil", () => {
    const out = parseScryfallCard({
      id: "d", name: "Delver of Secrets // Insectile Aberration", set_name: "Innistrad", collector_number: "51",
      prices: { usd: null, usd_foil: "9.00" }, card_faces: [{ image_uris: { small: "front.jpg" } }, {}],
    });
    expect(out).toHaveLength(1);
    expect(out[0].imageUrl).toBe("front.jpg");
    expect(out[0].variant).toBe("foil");
  });
  test("no prices still yields one unpriced entry", () => {
    expect(parseScryfallCard({ id: "n", name: "X", set_name: "S", collector_number: "1", prices: {} })[0].price).toBeNull();
  });
});

describe("TCGdex parsing", () => {
  const charizard = {
    id: "sv03.5-199", localId: "199", name: "Charizard ex", image: "https://assets.tcgdex.net/en/sv/sv03.5/199",
    set: { id: "sv03.5", name: "151" },
    pricing: {
      cardmarket: { unit: "EUR", avg: 370.41 },
      tcgplayer: { unit: "USD", updated: "2026-10-10T22:55:13.113Z",
        holofoil: { lowPrice: 296, midPrice: 362.21, marketPrice: 322.08 } },
    },
  };
  test("one priced entry per TCGplayer variant, ignoring unit and updated", () => {
    const out = parseTcgdexCard(charizard);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "sv03.5-199", variant: "holofoil", price: 322.08, setName: "151", number: "199",
      imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/199/low.png", priceUpdatedAt: "2026-10-10T22:55:13.113Z" });
  });
  test("several variants get distinct ids; mid price when no market price", () => {
    const out = parseTcgdexCard({ ...charizard, pricing: { tcgplayer: { unit: "USD", normal: { midPrice: 2 }, "reverse-holofoil": { marketPrice: 5 } } } });
    expect(out.map((c) => [c.id, c.price])).toEqual([["sv03.5-199:normal", 2], ["sv03.5-199:reverse-holofoil", 5]]);
  });
  test("no TCGplayer pricing is unpriced, sorted last", () => {
    const unpriced = parseTcgdexCard({ ...charizard, pricing: { cardmarket: { avg: 1 } } })[0];
    expect(unpriced.price).toBeNull();
    expect([unpriced, ...parseTcgdexCard(charizard)].sort(byPriceDesc).map((c) => c.price)).toEqual([322.08, null]);
  });
  test("TCG Pocket cards are filtered out", () => {
    expect(isPhysical({ image: "https://assets.tcgdex.net/en/tcgp/A2b/010" })).toBe(false);
    expect(isPhysical({ image: "https://assets.tcgdex.net/en/sv/sv03.5/006" })).toBe(true);
  });
  test("query splitting", () => {
    expect(splitPokemonQuery("charizard 199")).toEqual({ name: "charizard", number: "199" });
    expect(splitPokemonQuery("charizard ex")).toEqual({ name: "charizard ex", number: null });
    expect(splitPokemonQuery("gengar TG06")).toEqual({ name: "gengar", number: "TG06" });
  });
});

describe("backend cache", () => {
  const ok = (data: unknown) => (async () => new Response(JSON.stringify(data), { status: 200 })) as unknown as typeof fetch;
  test("not configured returns null so the app calls the source directly", async () => {
    expect(await searchViaBackend("magic", "sol ring", undefined, null)).toBeNull();
  });
  test("returns cached body and date", async () => {
    const r = await searchViaBackend("magic", "sol ring", undefined, "https://x.supabase.co",
      ok({ body: { data: [1] }, fetchedAt: "2026-10-11T00:00:00Z", stale: true }));
    expect(r).toEqual({ body: { data: [1] }, fetchedAt: "2026-10-11T00:00:00Z", stale: true });
  });
  test("server error or network failure falls back", async () => {
    const bad = (async () => new Response("no", { status: 502 })) as unknown as typeof fetch;
    const down = (async () => { throw new TypeError("Network request failed"); }) as unknown as typeof fetch;
    expect(await searchViaBackend("pokemon", "name:pika*", undefined, "https://x", bad)).toBeNull();
    expect(await searchViaBackend("pokemon", "name:pika*", undefined, "https://x", down)).toBeNull();
  });
});

describe("sign-in and history helpers", () => {
  test("reads the auth code or error from the return URL", async () => {
    const { codeFromUrl, errorFromUrl } = await import("./auth-url");
    expect(codeFromUrl("exp://x.exp.direct/--/auth-callback?code=abc%2D1")).toBe("abc-1");
    expect(codeFromUrl("exp://x/--/auth-callback#error=access_denied")).toBeNull();
    expect(errorFromUrl("exp://x/--/auth-callback?error=access_denied&error_description=User+cancelled")).toBe("User cancelled");
  });
  test("saved trade titles", async () => {
    const { tradeTitle } = await import("./trade-title");
    const c = (n: string): Card => ({ ...card(n, 1), name: n });
    expect(tradeTitle({ give: [{ card: c("Charizard ex"), condition: "NM", qty: 1 }, { card: c("Mew ex"), condition: "NM", qty: 1 }],
      get: [{ card: c("Sol Ring"), condition: "NM", qty: 1 }] })).toBe("Charizard ex + 1 more ↔ Sol Ring");
    expect(tradeTitle({ give: [], get: [] })).toBe("nothing ↔ nothing");
  });
});
