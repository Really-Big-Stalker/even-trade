import { supabase } from "./supabase";
import { sideTotal, Trade } from "./trade";
import { tradeTitle } from "./trade-title";
export { tradeTitle };

export interface SavedTrade {
  id: string;
  title: string;
  trade: Trade;
  give_total: number;
  get_total: number;
  created_at: string;
}

export async function saveTrade(t: Trade, isPro: boolean): Promise<void> {
  const { error } = await supabase.from("saved_trades").insert({
    title: tradeTitle(t),
    trade: t,
    give_total: sideTotal(t.give, isPro),
    get_total: sideTotal(t.get, isPro),
  });
  if (error) throw new Error(`Couldn't save the trade (${error.message}).`);
}

export async function listTrades(): Promise<SavedTrade[]> {
  const { data, error } = await supabase
    .from("saved_trades")
    .select("id, title, trade, give_total, get_total, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Couldn't load saved trades (${error.message}).`);
  return (data ?? []) as SavedTrade[];
}

export async function deleteTrade(id: string): Promise<void> {
  const { error } = await supabase.from("saved_trades").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete the trade (${error.message}).`);
}
