export const CONDITIONS = ["Asleep", "Confused", "Paralyzed", "Poisoned", "Burned"] as const;
export type SpecialCondition = (typeof CONDITIONS)[number];
/** Only one of these can apply at a time; a new one replaces the old (Pokémon TCG rules). */
const ROTATION: SpecialCondition[] = ["Asleep", "Confused", "Paralyzed"];
export const FLAGS = ["energy", "supporter", "retreat"] as const;
export type TurnFlag = (typeof FLAGS)[number];
export const BENCH_SIZE = 5;

export interface PokemonPlayer {
  name: string;
  prizes: number;
  active: number;          // damage on the Active Pokémon
  bench: number[];         // damage on each Benched Pokémon
  conditions: SpecialCondition[];
  flags: Record<TurnFlag, boolean>;
}

export interface PokemonGame { players: [PokemonPlayer, PokemonPlayer]; turn: number; current: 0 | 1 }

const freshFlags = (): Record<TurnFlag, boolean> => ({ energy: false, supporter: false, retreat: false });
const player = (name: string): PokemonPlayer =>
  ({ name, prizes: 6, active: 0, bench: Array(BENCH_SIZE).fill(0), conditions: [], flags: freshFlags() });

export function newPokemonGame(names: [string, string] = ["Player 1", "Player 2"], first: 0 | 1 = 0): PokemonGame {
  return { players: [player(names[0]), player(names[1])], turn: 1, current: first };
}

const withPlayer = (g: PokemonGame, i: 0 | 1, f: (p: PokemonPlayer) => PokemonPlayer): PokemonGame => {
  const players = [...g.players] as [PokemonPlayer, PokemonPlayer];
  players[i] = f(players[i]);
  return { ...g, players };
};

export function takePrize(g: PokemonGame, i: 0 | 1, n = 1): PokemonGame {
  return withPlayer(g, i, (p) => ({ ...p, prizes: Math.min(6, Math.max(0, p.prizes - n)) }));
}

/** slot: "active" or a bench index. Damage moves in steps of 10 and never goes below zero. */
export function addDamage(g: PokemonGame, i: 0 | 1, slot: "active" | number, delta: number): PokemonGame {
  return withPlayer(g, i, (p) => slot === "active"
    ? { ...p, active: Math.max(0, p.active + delta) }
    : { ...p, bench: p.bench.map((d, j) => (j === slot ? Math.max(0, d + delta) : d)) });
}

/** Knock Out or retreat clears the Active's damage and conditions. */
export function clearActive(g: PokemonGame, i: 0 | 1): PokemonGame {
  return withPlayer(g, i, (p) => ({ ...p, active: 0, conditions: [] }));
}

/** Promote a Benched Pokémon: its damage moves to the Active spot, conditions clear. */
export function promote(g: PokemonGame, i: 0 | 1, benchIndex: number): PokemonGame {
  return withPlayer(g, i, (p) => {
    const bench = [...p.bench];
    const moving = bench[benchIndex];
    bench[benchIndex] = p.active;
    return { ...p, active: moving, bench, conditions: [] };
  });
}

export function toggleCondition(g: PokemonGame, i: 0 | 1, c: SpecialCondition): PokemonGame {
  return withPlayer(g, i, (p) => {
    if (p.conditions.includes(c)) return { ...p, conditions: p.conditions.filter((x) => x !== c) };
    const kept = ROTATION.includes(c) ? p.conditions.filter((x) => !ROTATION.includes(x)) : p.conditions;
    return { ...p, conditions: [...kept, c] };
  });
}

export function toggleFlag(g: PokemonGame, i: 0 | 1, f: TurnFlag): PokemonGame {
  return withPlayer(g, i, (p) => ({ ...p, flags: { ...p.flags, [f]: !p.flags[f] } }));
}

/** What Pokémon Checkup asks for between turns, for both Active Pokémon. */
export function checkupReminders(g: PokemonGame): string[] {
  const out: string[] = [];
  g.players.forEach((p) => {
    if (p.conditions.includes("Poisoned")) out.push(`${p.name}: Poisoned, put 1 damage counter (10).`);
    if (p.conditions.includes("Burned")) out.push(`${p.name}: Burned, put 2 damage counters (20), then flip; heads removes Burned.`);
    if (p.conditions.includes("Asleep")) out.push(`${p.name}: Asleep, flip; heads wakes up.`);
  });
  return out;
}

/** Ends the current turn: the next player starts with fresh per-turn flags. */
export function endTurn(g: PokemonGame): PokemonGame {
  const next = (g.current === 0 ? 1 : 0) as 0 | 1;
  const ended = withPlayer(g, g.current, (p) => ({ ...p, flags: freshFlags() }));
  return { ...withPlayer(ended, next, (p) => ({ ...p, flags: freshFlags() })), turn: g.turn + 1, current: next };
}

export function winner(g: PokemonGame): 0 | 1 | null {
  if (g.players[0].prizes === 0) return 0;
  if (g.players[1].prizes === 0) return 1;
  return null;
}

export const flipCoin = (rand = Math.random): "Heads" | "Tails" => (rand() < 0.5 ? "Heads" : "Tails");
