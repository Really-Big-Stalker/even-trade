-- Trades a signed-in user saves. Each person can only see and change their own.
create table if not exists public.saved_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Trade',
  trade jsonb not null,            -- { give: Line[], get: Line[] } as the app stores it
  give_total numeric(12, 2) not null default 0,
  get_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.saved_trades enable row level security;

create policy "read own trades" on public.saved_trades
  for select using (auth.uid() = user_id);
create policy "add own trades" on public.saved_trades
  for insert with check (auth.uid() = user_id);
create policy "delete own trades" on public.saved_trades
  for delete using (auth.uid() = user_id);

create index if not exists saved_trades_user_created on public.saved_trades (user_id, created_at desc);
