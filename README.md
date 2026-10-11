# Even Trade (Stage 2 start)

Trade fairness checker for Pokémon and Magic: The Gathering.

## What's here

- `App.tsx` — the app: Pokémon / Magic switch, two trade sides, card search, condition and quantity, verdict bar.
- `src/sources/scryfall.ts` — Magic cards and prices from Scryfall (no key; free for everyone, never behind Pro).
- `src/sources/pokemontcg.ts` — Pokémon cards and TCGplayer prices from pokemontcg.io (works without a key at 1,000 searches a day).
- `src/trade.ts` — trade math: condition discounts, totals, the 5% "even" rule, Pro gating.
- `src/trade.test.ts` — 13 tests for the math and both data sources (run with `bun test`).

## Run it on your phone (no computer needed)

Every push to `main` runs the **Publish to Expo Go** workflow on GitHub, which tests the code, builds it, and publishes it to Expo.

One-time setup:
1. On expo.dev, sign in, open **Account settings > Access tokens**, and create a token.
2. In this repository on GitHub, open **Settings > Secrets and variables > Actions** and add a repository secret named `EXPO_TOKEN` with that token.

To open the app: in the repository's **Actions** tab, open the latest **Publish to Expo Go** run. Its summary has a link; open it on your phone and tap **Preview** to load the app in Expo Go.

## Not done yet

- Pro purchase (Stage 4): `IS_PRO` in `App.tsx` is a placeholder set to `false`.
- Backend price cache (Stage 3): the app calls the price sources directly for now.
- Pokémon API key: add it to `POKEMON_API_KEY` in `src/sources/pokemontcg.ts` only for local testing; it moves to the backend in Stage 3.
