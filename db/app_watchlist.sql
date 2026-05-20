-- Member watchlist storage.
-- Run this once in Supabase SQL Editor.

create table if not exists app_watchlist(
  account text not null,
  symbol text not null,
  name text,
  note text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key(account,symbol)
);

create index if not exists idx_app_watchlist_account
  on app_watchlist(account,sort_order,updated_at desc);

alter table app_watchlist enable row level security;

-- Keep member watchlists private. The website reads/writes through the
-- admin-write Edge Function with service_role after verifying the user's token.
drop policy if exists "public_read" on app_watchlist;
