import type { Trade } from "./trade";

/** "Charizard ex + 1 more ↔ Sol Ring" */
export function tradeTitle(t: Trade): string {
  const side = (lines: Trade["give"]) =>
    lines.length === 0 ? "nothing" : lines[0].card.name + (lines.length > 1 ? ` + ${lines.length - 1} more` : "");
  return `${side(t.give)} ↔ ${side(t.get)}`;
}
