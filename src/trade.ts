import type { Card, Game } from "./sources/types";

export const CONDITIONS = {
  NM: { label: "Near Mint", factor: 1 },
  LP: { label: "Lightly Played", factor: 0.85 },
  MP: { label: "Moderately Played", factor: 0.7 },
  HP: { label: "Heavily Played", factor: 0.5 },
  DMG: { label: "Damaged", factor: 0.35 },
} as const;
export type Condition = keyof typeof CONDITIONS;

export interface Line { card: Card; condition: Condition; qty: number }
/** A trade can mix games: Magic cards on one side, Pokémon on the other, or both. */
export interface Trade { give: Line[]; get: Line[] }

/** Even if the gap is within this share of the larger side. */
export const FAIR_SHARE = 0.05;

/** Magic is always free. Pokémon condition pricing is a Pro feature. */
export function canUseConditions(game: Game, isPro: boolean): boolean {
  return game === "magic" || isPro;
}

export function lineValue(l: Line, conditionsOn: boolean): number {
  const f = conditionsOn ? CONDITIONS[l.condition].factor : 1;
  return round((l.card.price ?? 0) * f * l.qty);
}

/** Condition discounts apply per card: always for Magic, for Pokémon only with Pro. */
export function lineConditionsOn(l: Line, isPro: boolean): boolean {
  return canUseConditions(l.card.game, isPro);
}

export function sideTotal(lines: Line[], isPro: boolean): number {
  return round(lines.reduce((t, l) => t + lineValue(l, lineConditionsOn(l, isPro)), 0));
}

export type Verdict =
  | { kind: "incomplete" }
  | { kind: "even"; gap: number; pct: number }
  | { kind: "you-ahead" | "you-behind"; gap: number; pct: number };

export function verdict(give: number, get: number): Verdict {
  if (give <= 0 || get <= 0) return { kind: "incomplete" };
  const gap = round(Math.abs(give - get));
  const pct = gap / Math.max(give, get);
  if (pct <= FAIR_SHARE) return { kind: "even", gap, pct };
  return { kind: get > give ? "you-ahead" : "you-behind", gap, pct };
}

export function addCard(lines: Line[], card: Card): Line[] {
  const i = lines.findIndex((l) => l.card.id === card.id && l.condition === "NM");
  if (i >= 0) return lines.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
  return [...lines, { card, condition: "NM", qty: 1 }];
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "updated 3 hours ago" style label for a source date. */
export function freshness(iso: string | null, now = new Date()): string {
  if (!iso) return "price as of today";
  const d = new Date(iso.replace(/\//g, "-"));
  if (isNaN(d.getTime())) return "price as of today";
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "updated today";
  if (days === 1) return "updated yesterday";
  return `updated ${days} days ago`;
}
