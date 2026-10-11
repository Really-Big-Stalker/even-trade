-- Cached card search results, filled by the `search` edge function.
create table if not exists public.price_cache (
  key text primary key,          -- "<game>:<normalized query>"
  game text not null check (game in ('magic', 'pokemon')),
  body jsonb not null,           -- raw upstream response
  fetched_at timestamptz not null default now()
);

-- Only the edge function (service role) reads or writes this table.
alter table public.price_cache enable row level security;

create index if not exists price_cache_fetched_at on public.price_cache (fetched_at);
