import { describe, expect, test } from "bun:test";
import { addCard, canUseConditions, freshness, lineValue, sideTotal, verdict } from "./trade";
import { parseScryfallCard } from "./sources/scryfall";
import { buildPokemonQuery, parsePokemonCard } from "./sources/pokemontcg";
import type { Card } from "./sources/types";

const card = (id: string, price: number | null): Card => ({
  id, game: "pokemon", name: id, setName: "Test", number: "1", variant: "normal",
  imageUrl: null, price, priceUpdatedAt: null, source: "TCGplayer via pokemontcg.io",
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
      image_uris: { normal: "https://img/x.jpg" },
    });
    expect(out.map((c) => [c.variant, c.price])).toEqual([["normal", 1.25], ["foil", 4.5]]);
    expect(out[1].id).toBe("abc:foil");
    expect(out[0].artist).toBe("Mike Bierek");
  });
  test("double-faced card uses front face image; foil-only keeps just foil", () => {
    const out = parseScryfallCard({
      id: "d", name: "Delver of Secrets // Insectile Aberration", set_name: "Innistrad", collector_number: "51",
      prices: { usd: null, usd_foil: "9.00" }, card_faces: [{ image_uris: { normal: "front.jpg" } }, {}],
    });
    expect(out).toHaveLength(1);
    expect(out[0].imageUrl).toBe("front.jpg");
    expect(out[0].variant).toBe("foil");
  });
  test("no prices still yields one unpriced entry", () => {
    expect(parseScryfallCard({ id: "n", name: "X", set_name: "S", collector_number: "1", prices: {} })[0].price).toBeNull();
  });
});

describe("pokemontcg.io parsing", () => {
  test("one entry per TCGplayer variant, market price preferred", () => {
    const out = parsePokemonCard({
      id: "sv3pt5-199", name: "Charizard ex", number: "199", set: { name: "151" },
      images: { small: "s.png" },
      tcgplayer: { updatedAt: "2026/10/09", prices: { holofoil: { market: 148, mid: 150 }, reverseHolofoil: { mid: 20 } } },
    });
    expect(out.map((c) => [c.id, c.price])).toEqual([["sv3pt5-199:holofoil", 148], ["sv3pt5-199:reverseHolofoil", 20]]);
    expect(out[0].priceUpdatedAt).toBe("2026/10/09");
  });
  test("card with no tcgplayer block is unpriced", () => {
    expect(parsePokemonCard({ id: "z", name: "Z", number: "1", set: { name: "S" } })[0].price).toBeNull();
  });
  test("query builder", () => {
    expect(buildPokemonQuery("charizard 199")).toBe("name:charizard* number:199");
    expect(buildPokemonQuery("charizard ex")).toBe('name:"charizard ex*"');
    expect(buildPokemonQuery("gengar TG06")).toBe("name:gengar* number:TG06");
  });
});
