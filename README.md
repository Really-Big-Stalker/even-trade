# Even Trade

Trade fairness checker for Pokémon and Magic: The Gathering.

## What's here

- `App.tsx` — the app: two trade sides that can mix Pokémon and Magic cards, card search, condition and quantity, verdict bar.
- `src/sources/scryfall.ts` — Magic cards and prices from Scryfall (no key; free for everyone, never behind Pro).
- `src/sources/tcgdex.ts` — Pokémon cards from TCGdex with TCGplayer prices (free, no key). Replaces pokemontcg.io, which is being retired.
- `src/sources/backend.ts` + `supabase/` — the search cache (Supabase edge function and table), deployed by the **Deploy backend** workflow.
- `src/trade.ts` — trade math: condition discounts, totals, the 5% "even" rule, Pro gating.
- `src/trade.test.ts` — tests for the trade math, both data sources, and the cache fallback (run with `bun test`).

## Run it on your phone (no computer needed)

Run the **Live preview** workflow (Actions tab → Live preview → Run workflow). In about two minutes an `exp://` link is posted in the "Live preview link" issue. In Expo Go, tap **Enter URL manually** and paste it. The server stays up for an hour.

The **Publish to Expo Go** workflow also runs on every push and doubles as the test and type-check run. It needs an `EXPO_TOKEN` repository secret.

## Not done yet

- Pro purchase (Stage 4): `IS_PRO` in `App.tsx` is a placeholder set to `false`.
