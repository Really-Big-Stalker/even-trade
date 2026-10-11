# Even Trade (Stage 2 start)

Trade fairness checker for Pokémon and Magic: The Gathering.

## What's here

- `App.tsx` — the app: Pokémon / Magic switch, two trade sides, card search, condition and quantity, verdict bar.
- `src/sources/scryfall.ts` — Magic cards and prices from Scryfall (no key; free for everyone, never behind Pro).
- `src/sources/pokemontcg.ts` — Pokémon cards and TCGplayer prices from pokemontcg.io (works without a key at 1,000 searches a day).
- `src/trade.ts` — trade math: condition discounts, totals, the 5% "even" rule, Pro gating.
- `src/trade.test.ts` — 13 tests for the math and both data sources (run with `bun test`).

## Run it on your phone

1. Install Node.js (the LTS version) from nodejs.org.
2. In a terminal:
   ```
   npx create-expo-app@latest even-trade --template blank-typescript
   cd even-trade
   npx expo install @react-native-async-storage/async-storage
   ```
3. Copy `App.tsx` and the `src` folder from this repository into that `even-trade` folder, replacing the existing `App.tsx`. (Once the full Expo project is committed here, this step becomes a plain `git clone`.)
4. Run `npx expo start` and scan the QR code with the Expo Go app on your phone (same Wi-Fi as the computer).

## Not done yet

- Pro purchase (Stage 4): `IS_PRO` in `App.tsx` is a placeholder set to `false`.
- Backend price cache (Stage 3): the app calls the price sources directly for now.
- Pokémon API key: add it to `POKEMON_API_KEY` in `src/sources/pokemontcg.ts` only for local testing; it moves to the backend in Stage 3.
