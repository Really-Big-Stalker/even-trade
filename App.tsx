import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useColorScheme, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Card, Game, PriceSource } from "./src/sources/types";
import { scryfall } from "./src/sources/scryfall";
import { tcgdex } from "./src/sources/tcgdex";
import {
  addCard, CONDITIONS, Condition, freshness, Line, lineConditionsOn, lineValue,
  money, sideTotal, Trade, verdict,
} from "./src/trade";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/supabase";
import { signInWithGoogle, signOut } from "./src/auth";
import { deleteTrade, listTrades, saveTrade, SavedTrade } from "./src/history";

const SOURCES: Record<Game, PriceSource> = { pokemon: tcgdex, magic: scryfall };
const STORE_KEY = "even-trade:trade-v2";
const GAME_LABEL: Record<Game, string> = { pokemon: "Pokémon", magic: "Magic" };
// Stage 4 replaces this with the RevenueCat entitlement check.
const IS_PRO = false;

type Side = "give" | "get";
const EMPTY: Trade = { give: [], get: [] };

export default function App() {
  return (
    <SafeAreaProvider>
      <TradeScreen />
    </SafeAreaProvider>
  );
}

function TradeScreen() {
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const c = dark ? DARK : LIGHT;
  const [trade, setTrade] = useState<Trade>(EMPTY);
  const [game, setGame] = useState<Game>("pokemon");
  const [picking, setPicking] = useState<Side | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 3500); return () => clearTimeout(t); }, [note]);

  const doSignIn = async () => {
    setBusy(true);
    try { if ((await signInWithGoogle()) === "signed-in") setNote("Signed in"); }
    catch (e: any) { setNote(e?.message ?? "Sign-in failed. Try again."); }
    finally { setBusy(false); }
  };
  const doSave = async () => {
    if (!session) { setNote("Sign in with Google to save trades."); return; }
    if (!trade.give.length && !trade.get.length) { setNote("Add a card before saving."); return; }
    setBusy(true);
    try { await saveTrade(trade, IS_PRO); setNote("Trade saved"); }
    catch (e: any) { setNote(e?.message ?? "Couldn't save the trade."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((s) => { if (s) setTrade(JSON.parse(s)); }).catch(() => {});
  }, []);
  const update = (t: Trade) => {
    setTrade(t);
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(t)).catch(() => {});
  };

  const give = sideTotal(trade.give, IS_PRO);
  const get = sideTotal(trade.get, IS_PRO);
  const v = verdict(give, get);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[s.root, { backgroundColor: c.bg }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.headRow}>
          <Text style={[s.h1, { color: c.fg }]}>Even Trade</Text>
          <View style={s.actions}>
            <Pressable onPress={() => (session ? setShowSaved(true) : setNote("Sign in with Google to see saved trades."))} accessibilityRole="button">
              <Text style={{ color: c.accent }}>Saved</Text>
            </Pressable>
            <Pressable onPress={doSave} disabled={busy} accessibilityRole="button">
              <Text style={{ color: c.accent }}>Save</Text>
            </Pressable>
            <Pressable onPress={() => update(EMPTY)} accessibilityRole="button">
              <Text style={{ color: c.accent }}>New</Text>
            </Pressable>
          </View>
        </View>

        <View style={[s.account, { borderColor: c.line, backgroundColor: c.surface }]}>
          {session ? (
            <>
              <Text style={{ color: c.muted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                Signed in as {session.user.email ?? "your Google account"}
              </Text>
              <Pressable onPress={() => signOut().then(() => setNote("Signed out"))} accessibilityRole="button">
                <Text style={{ color: c.accent, fontSize: 13 }}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ color: c.muted, fontSize: 13, flex: 1 }}>Sign in to save trades and see them on any device.</Text>
              <Pressable onPress={doSignIn} disabled={busy} style={[s.googleBtn, { borderColor: c.line }]} accessibilityRole="button">
                {busy ? <ActivityIndicator /> : <Text style={{ color: c.fg, fontWeight: "600", fontSize: 13 }}>Sign in with Google</Text>}
              </Pressable>
            </>
          )}
        </View>

        {note ? <Text style={{ color: c.fg, fontWeight: "600" }} accessibilityLiveRegion="polite">{note}</Text> : null}

        <Text style={{ color: c.muted, fontSize: 13 }}>Mix Magic and Pokémon cards on either side.</Text>

        {(["give", "get"] as Side[]).map((side) => (
          <SideBlock key={side} side={side} lines={trade[side]} total={side === "give" ? give : get}
            colors={c}
            onAdd={() => setPicking(side)}
            onChange={(lines) => update({ ...trade, [side]: lines })} />
        ))}
      </ScrollView>

      <View style={[s.verdict, { backgroundColor: c.surface, borderColor: c.line, paddingBottom: 16 + insets.bottom }]}>
        <View style={[s.bar, { backgroundColor: c.line }]}>
          <View style={{ flex: give || 1, backgroundColor: c.give }} />
          <View style={{ flex: get || 1, backgroundColor: c.get }} />
        </View>
        <View style={s.totals}>
          <Text style={[s.mono, { color: c.give }]}>Give {money(give)}</Text>
          <Text style={[s.mono, { color: c.get }]}>Get {money(get)}</Text>
        </View>
        <Text style={[s.vMain, { color: c.fg }]}>
          {v.kind === "incomplete" ? "Add cards to both sides"
            : v.kind === "even" ? `Even trade, ${money(v.gap)} apart`
            : v.kind === "you-ahead" ? `You come out ${money(v.gap)} ahead`
            : `You give ${money(v.gap)} more`}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {v.kind === "incomplete" ? "Within 5% counts as even."
            : v.kind === "even" ? "Fair at today's prices."
            : v.kind === "you-ahead" ? `Add about ${money(v.gap)} in cards or cash to even it.`
            : `Ask them to add about ${money(v.gap)} in cards or cash.`}
        </Text>
      </View>

      <SavedModal visible={showSaved} colors={c} onClose={() => setShowSaved(false)}
        onOpen={(t) => { update(t.trade); setShowSaved(false); setNote("Loaded saved trade"); }} />

      <SearchModal visible={picking !== null} game={game} onGame={setGame} colors={c}
        onClose={() => setPicking(null)}
        onPick={(card) => { if (picking) update({ ...trade, [picking]: addCard(trade[picking], card) }); setPicking(null); }} />
    </SafeAreaView>
  );
}

function SideBlock(p: {
  side: Side; lines: Line[]; total: number; colors: Colors;
  onAdd: () => void; onChange: (l: Line[]) => void;
}) {
  const { colors: c } = p;
  const tint = p.side === "give" ? c.give : c.get;
  const set = (i: number, patch: Partial<Line>) => p.onChange(p.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <View style={s.side}>
      <View style={s.headRow}>
        <Text style={[s.h2, { color: c.fg }]}>{p.side === "give" ? "You give" : "You get"}</Text>
        <Text style={[s.mono, { color: c.fg, fontWeight: "700" }]}>{money(p.total)}</Text>
      </View>
      {p.lines.map((l, i) => { const condOn = lineConditionsOn(l, IS_PRO); return (
        <View key={`${l.card.id}-${i}`} style={[s.item, { backgroundColor: c.surface, borderColor: c.line, borderLeftColor: tint }]}>
          <View style={s.itemTop}>
            {l.card.imageUrl ? <Image source={{ uri: l.card.imageUrl }} style={s.thumb} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.fg, fontWeight: "600" }}>{l.card.name}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {GAME_LABEL[l.card.game]} · {l.card.setName} #{l.card.number}{l.card.variant !== "normal" ? ` · ${l.card.variant}` : ""}
              </Text>
              {l.card.artist ? <Text style={{ color: c.muted, fontSize: 11 }}>Illus. {l.card.artist}</Text> : null}
              <Text style={{ color: c.muted, fontSize: 11 }}>{l.card.source} · {freshness(l.card.priceUpdatedAt)}</Text>
            </View>
            <Text style={[s.mono, { color: c.fg, fontWeight: "700" }]}>
              {l.card.price === null ? "No price" : money(lineValue(l, condOn))}
            </Text>
          </View>
          <View style={s.controls}>
            {condOn ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(Object.keys(CONDITIONS) as Condition[]).map((k) => (
                  <Pressable key={k} onPress={() => set(i, { condition: k })}
                    style={[s.chip, { borderColor: c.line }, l.condition === k && { backgroundColor: tint, borderColor: tint }]}
                    accessibilityLabel={CONDITIONS[k].label}>
                    <Text style={{ color: l.condition === k ? c.onAccent : c.fg, fontSize: 12 }}>{k}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ color: c.muted, fontSize: 12, flex: 1 }}>Pokémon condition pricing is in Pro</Text>
            )}
            <View style={s.qty}>
              <Pressable onPress={() => (l.qty > 1 ? set(i, { qty: l.qty - 1 }) : p.onChange(p.lines.filter((_, j) => j !== i)))}
                style={[s.qBtn, { borderColor: c.line }]} accessibilityLabel={l.qty > 1 ? "One fewer" : "Remove"}>
                <Text style={{ color: c.fg }}>{l.qty > 1 ? "−" : "✕"}</Text>
              </Pressable>
              <Text style={[s.mono, { color: c.fg, minWidth: 20, textAlign: "center" }]}>{l.qty}</Text>
              <Pressable onPress={() => set(i, { qty: l.qty + 1 })} style={[s.qBtn, { borderColor: c.line }]} accessibilityLabel="One more">
                <Text style={{ color: c.fg }}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ); })}
      <Pressable onPress={p.onAdd} style={[s.add, { borderColor: tint }]} accessibilityRole="button">
        <Text style={{ color: tint, fontWeight: "600" }}>+ Add a card</Text>
      </Pressable>
    </View>
  );
}

function SearchModal(p: {
  visible: boolean; game: Game; onGame: (g: Game) => void; colors: Colors;
  onClose: () => void; onPick: (c: Card) => void;
}) {
  const { colors: c } = p;
  const source = SOURCES[p.game];
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => { if (!p.visible) { setQ(""); setResults([]); setError(null); } }, [p.visible]);
  useEffect(() => {
    const t = setTimeout(async () => {
      abort.current?.abort();
      if (q.trim().length < 2) { setResults([]); return; }
      const ctl = new AbortController(); abort.current = ctl;
      setLoading(true); setError(null);
      try { setResults(await source.search(q, ctl.signal)); }
      catch (e: any) { if (e?.name !== "AbortError") setError(e?.message ?? "Search failed. Check your connection."); }
      finally { if (abort.current === ctl) setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, source]);

  const label = useMemo(() => (p.game === "magic" ? "Search Magic cards, e.g. sol ring" : "Search Pokémon cards, e.g. charizard 199"), [p.game]);
  return (
    <Modal visible={p.visible} animationType="slide" onRequestClose={p.onClose}>
      <SafeAreaProvider>
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <View style={[s.page, { flex: 1 }]}>
          <View style={s.headRow}>
            <Text style={[s.h2, { color: c.fg }]}>Add a card</Text>
            <Pressable onPress={p.onClose}><Text style={{ color: c.accent }}>Cancel</Text></Pressable>
          </View>
          <View style={[s.switch, { borderColor: c.line, backgroundColor: c.surface }]}>
            {(["pokemon", "magic"] as Game[]).map((g) => (
              <Pressable key={g} onPress={() => p.onGame(g)} style={[s.seg, p.game === g && { backgroundColor: c.accent }]}
                accessibilityRole="tab" accessibilityState={{ selected: p.game === g }}>
                <Text style={{ color: p.game === g ? c.onAccent : c.fg, fontWeight: "600" }}>{GAME_LABEL[g]}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput autoFocus value={q} onChangeText={setQ} placeholder={label} placeholderTextColor={c.muted}
            autoCorrect={false} style={[s.input, { color: c.fg, borderColor: c.line, backgroundColor: c.surface }]} />
          {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
          {error ? <Text style={{ color: c.warn, marginTop: 8 }}>{error}</Text> : null}
          {!loading && !error && q.trim().length >= 2 && results.length === 0
            ? <Text style={{ color: c.muted, marginTop: 8 }}>No cards found. Check the spelling or try fewer words.</Text> : null}
          <FlatList data={results} keyExtractor={(r) => r.id} keyboardShouldPersistTaps="handled" style={{ marginTop: 8 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => p.onPick(item)} style={[s.result, { borderColor: c.line }]}>
                {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={s.thumb} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.fg, fontWeight: "600" }}>{item.name}</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    {item.setName} #{item.number}{item.variant !== "normal" ? ` · ${item.variant}` : ""}
                  </Text>
                </View>
                <Text style={[s.mono, { color: c.fg }]}>{item.price === null ? "—" : money(item.price)}</Text>
              </Pressable>
            )} />
          <Text style={{ color: c.muted, fontSize: 11, marginTop: 6 }}>
            {p.game === "magic"
              ? "Card data and images from Scryfall. Not affiliated with Wizards of the Coast."
              : "Card data from TCGdex, prices from TCGplayer. Not affiliated with Nintendo or The Pokémon Company."}
          </Text>
        </View>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function SavedModal(p: { visible: boolean; colors: Colors; onClose: () => void; onOpen: (t: SavedTrade) => void }) {
  const { colors: c } = p;
  const [items, setItems] = useState<SavedTrade[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => { setError(null); listTrades().then(setItems).catch((e) => setError(e.message)); };
  useEffect(() => { if (p.visible) load(); else setItems(null); }, [p.visible]);
  const remove = async (id: string) => {
    try { await deleteTrade(id); setItems((xs) => (xs ?? []).filter((x) => x.id !== id)); }
    catch (e: any) { setError(e.message); }
  };
  return (
    <Modal visible={p.visible} animationType="slide" onRequestClose={p.onClose}>
      <SafeAreaProvider>
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <View style={[s.page, { flex: 1, paddingBottom: 16 }]}>
          <View style={s.headRow}>
            <Text style={[s.h2, { color: c.fg }]}>Saved trades</Text>
            <Pressable onPress={p.onClose}><Text style={{ color: c.accent }}>Done</Text></Pressable>
          </View>
          {error ? <Text style={{ color: c.warn }}>{error}</Text> : null}
          {items === null && !error ? <ActivityIndicator /> : null}
          {items?.length === 0 ? <Text style={{ color: c.muted }}>No saved trades yet. Build a trade and tap Save.</Text> : null}
          <FlatList data={items ?? []} keyExtractor={(t) => t.id}
            renderItem={({ item }) => (
              <View style={[s.result, { borderColor: c.line }]}>
                <Pressable style={{ flex: 1 }} onPress={() => p.onOpen(item)} accessibilityRole="button">
                  <Text style={{ color: c.fg, fontWeight: "600" }}>{item.title}</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    {new Date(item.created_at).toLocaleDateString()} · give {money(Number(item.give_total))} · get {money(Number(item.get_total))}
                  </Text>
                </Pressable>
                <Pressable onPress={() => remove(item.id)} style={[s.qBtn, { borderColor: c.line, width: 64 }]} accessibilityLabel="Delete saved trade">
                  <Text style={{ color: c.fg, fontSize: 12 }}>Delete</Text>
                </Pressable>
              </View>
            )} />
        </View>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

type Colors = typeof LIGHT;
const LIGHT = {
  bg: "#F3F4F8", surface: "#FFFFFF", line: "#DADDE8", fg: "#161A2E", muted: "#5D6382",
  accent: "#3550D6", onAccent: "#FFFFFF", give: "#C7741A", get: "#0E8C7E", warn: "#B4541A",
};
const DARK: Colors = {
  bg: "#0F1120", surface: "#181B2E", line: "#2C3150", fg: "#ECEEF8", muted: "#9BA1C2",
  accent: "#8EA2FF", onAccent: "#0F1120", give: "#F0A050", get: "#4FD1BF", warn: "#F39A5E",
};

const s = StyleSheet.create({
  root: { flex: 1 },
  page: { padding: 16, paddingBottom: 200, gap: 16 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  actions: { flexDirection: "row", gap: 16 },
  account: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 10 },
  googleBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, minWidth: 140, alignItems: "center" },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  h2: { fontSize: 19, fontWeight: "700" },
  mono: { fontVariant: ["tabular-nums"], fontFamily: undefined },
  switch: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 3 },
  seg: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  side: { gap: 8 },
  item: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 10, padding: 10, gap: 8 },
  itemTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  thumb: { width: 44, height: 61, borderRadius: 3 },
  controls: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  qty: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  qBtn: { borderWidth: 1, borderRadius: 7, width: 32, height: 30, alignItems: "center", justifyContent: "center" },
  add: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 10, padding: 12, alignItems: "center" },
  verdict: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 16, gap: 6 },
  bar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden" },
  totals: { flexDirection: "row", justifyContent: "space-between" },
  vMain: { fontSize: 20, fontWeight: "800" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  result: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
});
