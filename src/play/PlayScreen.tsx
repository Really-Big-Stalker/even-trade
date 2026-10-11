import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Colors } from "../theme";
import * as M from "./magic";
import * as P from "./pokemon";

type PlayGame = "magic" | "pokemon";
const KEY = "even-trade:play-v1";

interface Saved { game: PlayGame; magic: M.MagicGame; pokemon: P.PokemonGame }
const fresh = (): Saved => ({ game: "magic", magic: M.newMagicGame("standard", 2), pokemon: P.newPokemonGame() });

export function PlayScreen({ colors: c }: { colors: Colors }) {
  const [state, setState] = useState<Saved>(fresh);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((s) => { if (s) setState({ ...fresh(), ...JSON.parse(s) }); })
      .catch(() => {}).finally(() => setLoaded(true));
  }, []);
  useEffect(() => { if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); }, [state, loaded]);

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <View style={[st.switch, { borderColor: c.line, backgroundColor: c.surface }]}>
        {(["magic", "pokemon"] as PlayGame[]).map((g) => (
          <Pressable key={g} onPress={() => setState({ ...state, game: g })}
            style={[st.seg, state.game === g && { backgroundColor: c.accent }]}
            accessibilityRole="tab" accessibilityState={{ selected: state.game === g }}>
            <Text style={{ color: state.game === g ? c.onAccent : c.fg, fontWeight: "600" }}>{g === "magic" ? "Magic" : "Pokémon"}</Text>
          </Pressable>
        ))}
      </View>
      {state.game === "magic"
        ? <MagicTable g={state.magic} c={c} set={(magic) => setState((s) => ({ ...s, magic }))} />
        : <PokemonTable g={state.pokemon} c={c} set={(pokemon) => setState((s) => ({ ...s, pokemon }))} />}
    </ScrollView>
  );
}

/* ---------- shared bits ---------- */

function Btn(p: { label: string; onPress: () => void; onLongPress?: () => void; c: Colors; big?: boolean; a11y?: string; active?: boolean }) {
  return (
    <Pressable onPress={p.onPress} onLongPress={p.onLongPress} accessibilityRole="button" accessibilityLabel={p.a11y ?? p.label}
      style={({ pressed }) => [p.big ? st.bigBtn : st.btn, { borderColor: p.c.line, backgroundColor: p.active ? p.c.accent : pressed ? p.c.line : p.c.bg }]}>
      <Text style={{ color: p.active ? p.c.onAccent : p.c.fg, fontWeight: "700", fontSize: p.big ? 22 : 13 }}>{p.label}</Text>
    </Pressable>
  );
}

function Stepper(p: { label: string; value: number; onChange: (d: number) => void; c: Colors; warn?: boolean }) {
  return (
    <View style={st.stepper}>
      <Text style={{ color: p.warn ? p.c.warn : p.c.muted, fontSize: 12, minWidth: 74 }}>{p.label}</Text>
      <Btn label="−" c={p.c} onPress={() => p.onChange(-1)} a11y={`${p.label} minus one`} />
      <Text style={[st.num, { color: p.warn ? p.c.warn : p.c.fg }]}>{p.value}</Text>
      <Btn label="+" c={p.c} onPress={() => p.onChange(1)} a11y={`${p.label} plus one`} />
    </View>
  );
}

/* ---------- Magic ---------- */

function MagicTable({ g, c, set }: { g: M.MagicGame; c: Colors; set: (g: M.MagicGame) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [roll, setRoll] = useState<string | null>(null);
  const names = g.players.map((p) => p.name);
  const restart = (format = g.format, count = g.players.length) => { set(M.newMagicGame(format, count, names)); setRoll(null); };

  return (
    <View style={st.stack}>
      <View style={st.row}>
        <Btn label="Standard (20)" c={c} active={g.format === "standard"} onPress={() => restart("standard")} />
        <Btn label="Commander (40)" c={c} active={g.format === "commander"} onPress={() => restart("commander")} />
      </View>
      <View style={st.row}>
        {[2, 3, 4].map((n) => <Btn key={n} label={`${n} players`} c={c} active={g.players.length === n} onPress={() => restart(g.format, n)} />)}
      </View>
      <View style={st.row}>
        <Btn label="Roll d20" c={c} onPress={() => setRoll(g.players.map((p) => `${p.name}: ${M.rollDie(20)}`).join("   "))} />
        <Btn label="New game" c={c} onPress={() => restart()} />
      </View>
      {roll ? <Text style={{ color: c.fg }}>{roll}</Text> : null}

      {g.players.map((p, i) => {
        const out = M.lossReason(g, i);
        return (
          <View key={i} style={[st.card, { backgroundColor: c.surface, borderColor: out ? c.warn : c.line }]}>
            <TextInput value={p.name} onChangeText={(t) => set(M.rename(g, i, t))} style={[st.name, { color: c.fg }]}
              accessibilityLabel={`Player ${i + 1} name`} />
            <View style={st.lifeRow}>
              <Btn big label="−" c={c} onPress={() => set(M.changeLife(g, i, -1))} onLongPress={() => set(M.changeLife(g, i, -5))} a11y="Lose 1 life (hold for 5)" />
              <View style={{ alignItems: "center", flex: 1 }}>
                <Text style={[st.life, { color: out ? c.warn : c.fg }]}>{p.life}</Text>
                <Text style={{ color: out ? c.warn : c.muted, fontSize: 12 }}>{out ?? "life · hold ± for 5"}</Text>
              </View>
              <Btn big label="+" c={c} onPress={() => set(M.changeLife(g, i, 1))} onLongPress={() => set(M.changeLife(g, i, 5))} a11y="Gain 1 life (hold for 5)" />
            </View>
            <Pressable onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button">
              <Text style={{ color: c.accent, fontSize: 13 }}>
                {open === i ? "Hide counters" : `Counters · poison ${p.poison}${g.format === "commander" ? ` · tax ${p.tax}` : ""} · mana ${M.MANA.reduce((t, m) => t + p.mana[m], 0)}`}
              </Text>
            </Pressable>
            {open === i ? (
              <View style={st.stack}>
                <Stepper label="Poison" value={p.poison} c={c} warn={p.poison >= 10} onChange={(d) => set(M.changeCounter(g, i, "poison", d))} />
                <Stepper label="Energy" value={p.energy} c={c} onChange={(d) => set(M.changeCounter(g, i, "energy", d))} />
                <Stepper label="Experience" value={p.experience} c={c} onChange={(d) => set(M.changeCounter(g, i, "experience", d))} />
                {g.format === "commander" ? (
                  <>
                    <Stepper label="Cmdr tax" value={p.tax} c={c} onChange={(d) => set(M.changeCounter(g, i, "tax", d * 2))} />
                    <Text style={{ color: c.muted, fontSize: 12 }}>Commander damage taken (also comes off life)</Text>
                    {g.players.map((q, j) => j === i ? null : (
                      <Stepper key={j} label={`From ${q.name}`} value={p.cmdDamage[j]} c={c} warn={p.cmdDamage[j] >= 21}
                        onChange={(d) => set(M.commanderDamage(g, i, j, d))} />
                    ))}
                  </>
                ) : null}
                <Text style={{ color: c.muted, fontSize: 12 }}>Mana pool</Text>
                <View style={st.manaGrid}>
                  {M.MANA.map((m) => (
                    <Pressable key={m} onPress={() => set(M.changeMana(g, i, m, 1))} onLongPress={() => set(M.changeMana(g, i, m, -1))}
                      style={[st.mana, { borderColor: c.line }]} accessibilityLabel={`${m} mana ${p.mana[m]}, tap to add, hold to spend`}>
                      <Text style={{ color: c.fg, fontWeight: "700" }}>{m}</Text>
                      <Text style={[st.num, { color: c.fg }]}>{p.mana[m]}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={{ color: c.muted, fontSize: 11 }}>Tap a mana symbol to add one, hold to spend one.</Text>
                <Btn label="Empty mana pool" c={c} onPress={() => set(M.clearMana(g, i))} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/* ---------- Pokémon ---------- */

function PokemonTable({ g, c, set }: { g: P.PokemonGame; c: Colors; set: (g: P.PokemonGame) => void }) {
  const [coin, setCoin] = useState<string | null>(null);
  const [checkup, setCheckup] = useState<string[]>([]);
  const win = P.winner(g);
  const names: [string, string] = [g.players[0].name, g.players[1].name];

  return (
    <View style={st.stack}>
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={{ color: c.fg, fontWeight: "700" }}>
          {win !== null ? `${g.players[win].name} took all 6 prizes and wins!` : `Turn ${g.turn} · ${g.players[g.current].name}`}
        </Text>
        <View style={st.row}>
          {P.FLAGS.map((f) => (
            <Btn key={f} c={c} active={g.players[g.current].flags[f]}
              label={f === "energy" ? "Energy attached" : f === "supporter" ? "Supporter played" : "Retreated"}
              onPress={() => set(P.toggleFlag(g, g.current, f))} />
          ))}
        </View>
        <View style={st.row}>
          <Btn label="End turn" c={c} onPress={() => { setCheckup(P.checkupReminders(g)); set(P.endTurn(g)); }} />
          <Btn label="Flip coin" c={c} onPress={() => setCoin(P.flipCoin())} />
          <Btn label="New game" c={c} onPress={() => { set(P.newPokemonGame(names)); setCoin(null); setCheckup([]); }} />
        </View>
        {coin ? <Text style={{ color: c.fg, fontSize: 18, fontWeight: "800" }}>{coin}</Text> : null}
        {checkup.length ? (
          <View>
            <Text style={{ color: c.warn, fontWeight: "700", fontSize: 13 }}>Pokémon Checkup</Text>
            {checkup.map((t) => <Text key={t} style={{ color: c.fg, fontSize: 13 }}>{t}</Text>)}
          </View>
        ) : null}
      </View>

      {([0, 1] as const).map((i) => {
        const p = g.players[i];
        return (
          <View key={i} style={[st.card, { backgroundColor: c.surface, borderColor: g.current === i ? c.accent : c.line }]}>
            <TextInput value={p.name} accessibilityLabel={`Player ${i + 1} name`} style={[st.name, { color: c.fg }]}
              onChangeText={(t) => {
                const players = [...g.players] as [P.PokemonPlayer, P.PokemonPlayer];
                players[i] = { ...p, name: t };
                set({ ...g, players });
              }} />
            <Text style={{ color: c.muted, fontSize: 12 }}>Prize cards left · tap one to take it</Text>
            <View style={st.row}>
              {Array.from({ length: 6 }, (_, k) => (
                <Pressable key={k} accessibilityLabel={k < p.prizes ? "Take a prize card" : "Prize taken, tap to put back"}
                  onPress={() => set(P.takePrize(g, i, k < p.prizes ? 1 : -1))}
                  style={[st.prize, { borderColor: c.line, backgroundColor: k < p.prizes ? c.accent : "transparent" }]} />
              ))}
              <Text style={[st.num, { color: c.fg }]}>{p.prizes}</Text>
            </View>

            <Text style={{ color: c.muted, fontSize: 12 }}>Active Pokémon damage</Text>
            <View style={st.lifeRow}>
              <Btn label="−10" c={c} onPress={() => set(P.addDamage(g, i, "active", -10))} />
              <Text style={[st.life, { color: c.fg, flex: 1, textAlign: "center" }]}>{p.active}</Text>
              <Btn label="+10" c={c} onPress={() => set(P.addDamage(g, i, "active", 10))} />
              <Btn label="+50" c={c} onPress={() => set(P.addDamage(g, i, "active", 50))} />
            </View>
            <View style={st.row}>
              <Btn label="Knocked Out / clear" c={c} onPress={() => set(P.clearActive(g, i))} />
            </View>
            <View style={st.row}>
              {P.CONDITIONS.map((cond) => (
                <Btn key={cond} label={cond} c={c} active={p.conditions.includes(cond)} onPress={() => set(P.toggleCondition(g, i, cond))} />
              ))}
            </View>

            <Text style={{ color: c.muted, fontSize: 12 }}>Bench damage · tap +10, hold to promote to Active</Text>
            <View style={st.row}>
              {p.bench.map((d, k) => (
                <View key={k} style={[st.benchSlot, { borderColor: c.line }]}>
                  <Pressable onPress={() => set(P.addDamage(g, i, k, 10))} onLongPress={() => set(P.promote(g, i, k))}
                    accessibilityLabel={`Bench ${k + 1}, ${d} damage. Tap to add 10, hold to promote`}>
                    <Text style={[st.num, { color: c.fg, textAlign: "center" }]}>{d}</Text>
                  </Pressable>
                  <Pressable onPress={() => set(P.addDamage(g, i, k, -10))} accessibilityLabel={`Bench ${k + 1} minus 10`}>
                    <Text style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>−10</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40, gap: 14 },
  stack: { gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  switch: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 3 },
  seg: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  name: { fontSize: 17, fontWeight: "700", paddingVertical: 2 },
  lifeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  life: { fontSize: 52, fontWeight: "800", fontVariant: ["tabular-nums"] },
  num: { fontSize: 16, fontWeight: "700", minWidth: 28, textAlign: "center", fontVariant: ["tabular-nums"] },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  bigBtn: { borderWidth: 1, borderRadius: 12, width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  manaGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  mana: { borderWidth: 1, borderRadius: 10, width: 48, paddingVertical: 6, alignItems: "center" },
  prize: { width: 26, height: 36, borderRadius: 4, borderWidth: 1 },
  benchSlot: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, width: 54, gap: 2 },
});
