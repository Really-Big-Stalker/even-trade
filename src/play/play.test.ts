import { describe, expect, test } from "bun:test";
import * as M from "./magic";
import * as P from "./pokemon";

describe("Magic tracker", () => {
  test("starting life by format and player count clamp", () => {
    expect(M.newMagicGame("standard", 2).players.map((p) => p.life)).toEqual([20, 20]);
    expect(M.newMagicGame("commander", 9).players).toHaveLength(4);
    expect(M.newMagicGame("commander", 4).players[0].life).toBe(40);
  });
  test("life can go negative; counters and mana stop at zero", () => {
    let g = M.newMagicGame("standard", 2);
    g = M.changeLife(g, 0, -25);
    g = M.changeCounter(g, 0, "poison", -1);
    g = M.changeMana(g, 0, "G", -1);
    expect(g.players[0].life).toBe(-5);
    expect(g.players[0].poison).toBe(0);
    expect(g.players[0].mana.G).toBe(0);
    expect(M.lossReason(g, 0)).toBe("Out of life");
    expect(M.lossReason(g, 1)).toBeNull();
  });
  test("10 poison loses", () => {
    let g = M.newMagicGame("standard", 2);
    for (let i = 0; i < 10; i++) g = M.changeCounter(g, 1, "poison", 1);
    expect(M.lossReason(g, 1)).toBe("10 poison");
  });
  test("commander damage comes off life and 21 from one commander loses", () => {
    let g = M.newMagicGame("commander", 3);
    g = M.commanderDamage(g, 0, 1, 21);
    expect(g.players[0].life).toBe(19);
    expect(M.lossReason(g, 0)).toBe("21 commander damage");
    g = M.commanderDamage(g, 0, 1, -5);
    expect(g.players[0].life).toBe(24);
    expect(g.players[0].cmdDamage).toEqual([0, 16, 0]);
  });
  test("clearing the mana pool", () => {
    let g = M.changeMana(M.newMagicGame("standard", 2), 1, "U", 3);
    expect(M.clearMana(g, 1).players[1].mana).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  });
  test("dice", () => {
    expect(M.rollDie(20, () => 0)).toBe(1);
    expect(M.rollDie(20, () => 0.9999)).toBe(20);
  });
});

describe("Pokémon tracker", () => {
  test("prizes count down to a winner", () => {
    let g = P.newPokemonGame();
    g = P.takePrize(g, 1, 2);
    expect(g.players[1].prizes).toBe(4);
    g = P.takePrize(g, 1, 9);
    expect(g.players[1].prizes).toBe(0);
    expect(P.winner(g)).toBe(1);
  });
  test("damage on active and bench, never negative", () => {
    let g = P.addDamage(P.newPokemonGame(), 0, "active", 50);
    g = P.addDamage(g, 0, 2, 30);
    g = P.addDamage(g, 0, 2, -40);
    expect(g.players[0].active).toBe(50);
    expect(g.players[0].bench[2]).toBe(0);
  });
  test("Asleep, Confused, Paralyzed replace each other; Poisoned and Burned stack", () => {
    let g = P.newPokemonGame();
    g = P.toggleCondition(g, 0, "Asleep");
    g = P.toggleCondition(g, 0, "Poisoned");
    g = P.toggleCondition(g, 0, "Burned");
    g = P.toggleCondition(g, 0, "Paralyzed");
    expect(g.players[0].conditions.sort()).toEqual(["Burned", "Paralyzed", "Poisoned"]);
    expect(P.checkupReminders(g)).toHaveLength(2);
  });
  test("promote swaps damage and clears conditions", () => {
    let g = P.addDamage(P.newPokemonGame(), 0, "active", 90);
    g = P.addDamage(g, 0, 1, 20);
    g = P.toggleCondition(g, 0, "Confused");
    g = P.promote(g, 0, 1);
    expect(g.players[0].active).toBe(20);
    expect(g.players[0].bench[1]).toBe(90);
    expect(g.players[0].conditions).toEqual([]);
  });
  test("ending a turn passes play and resets per-turn flags", () => {
    let g = P.toggleFlag(P.newPokemonGame(), 0, "supporter");
    g = P.endTurn(g);
    expect(g.current).toBe(1);
    expect(g.turn).toBe(2);
    expect(g.players[0].flags.supporter).toBe(false);
  });
  test("coin", () => {
    expect(P.flipCoin(() => 0.1)).toBe("Heads");
    expect(P.flipCoin(() => 0.9)).toBe("Tails");
  });
});
