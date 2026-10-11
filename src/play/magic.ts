export const MANA = ["W", "U", "B", "R", "G", "C"] as const;
export type Mana = (typeof MANA)[number];
export type MagicFormat = "standard" | "commander";
export const COUNTERS = ["poison", "energy", "experience", "tax"] as const;
export type Counter = (typeof COUNTERS)[number];

export interface MagicPlayer {
  name: string;
  life: number;
  poison: number;
  energy: number;
  experience: number;
  /** Commander tax: +2 mana each time the commander is cast from the command zone. */
  tax: number;
  mana: Record<Mana, number>;
  /** Commander damage taken from each player, by seat. */
  cmdDamage: number[];
}

export interface MagicGame { format: MagicFormat; players: MagicPlayer[] }

export const startingLife = (f: MagicFormat) => (f === "commander" ? 40 : 20);
const emptyMana = (): Record<Mana, number> => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });

export function newMagicGame(format: MagicFormat, count: number, names?: string[]): MagicGame {
  const n = Math.min(4, Math.max(2, count));
  return {
    format,
    players: Array.from({ length: n }, (_, i) => ({
      name: names?.[i] ?? `Player ${i + 1}`,
      life: startingLife(format),
      poison: 0, energy: 0, experience: 0, tax: 0,
      mana: emptyMana(),
      cmdDamage: Array(n).fill(0),
    })),
  };
}

const withPlayer = (g: MagicGame, i: number, f: (p: MagicPlayer) => MagicPlayer): MagicGame =>
  ({ ...g, players: g.players.map((p, j) => (j === i ? f(p) : p)) });

/** Life can go below zero; every other counter stops at zero. */
export function changeLife(g: MagicGame, i: number, delta: number): MagicGame {
  return withPlayer(g, i, (p) => ({ ...p, life: p.life + delta }));
}

export function changeCounter(g: MagicGame, i: number, c: Counter, delta: number): MagicGame {
  return withPlayer(g, i, (p) => ({ ...p, [c]: Math.max(0, p[c] + delta) }));
}

export function changeMana(g: MagicGame, i: number, m: Mana, delta: number): MagicGame {
  return withPlayer(g, i, (p) => ({ ...p, mana: { ...p.mana, [m]: Math.max(0, p.mana[m] + delta) } }));
}

export function clearMana(g: MagicGame, i: number): MagicGame {
  return withPlayer(g, i, (p) => ({ ...p, mana: emptyMana() }));
}

/** Commander damage also comes off life, as the rules require. */
export function commanderDamage(g: MagicGame, target: number, from: number, delta: number): MagicGame {
  const p = g.players[target];
  const next = Math.max(0, p.cmdDamage[from] + delta);
  const applied = next - p.cmdDamage[from];
  return withPlayer(g, target, (q) => ({
    ...q,
    life: q.life - applied,
    cmdDamage: q.cmdDamage.map((d, j) => (j === from ? next : d)),
  }));
}

export function rename(g: MagicGame, i: number, name: string): MagicGame {
  return withPlayer(g, i, (p) => ({ ...p, name }));
}

/** Why a player has lost, or null if they're still in. */
export function lossReason(g: MagicGame, i: number): string | null {
  const p = g.players[i];
  if (p.life <= 0) return "Out of life";
  if (p.poison >= 10) return "10 poison";
  if (g.format === "commander" && p.cmdDamage.some((d) => d >= 21)) return "21 commander damage";
  return null;
}

export const rollDie = (sides: number, rand = Math.random) => 1 + Math.floor(rand() * sides);
