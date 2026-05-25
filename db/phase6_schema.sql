-- Phase 6 schema: AI 股票研究與自動化操盤實驗平台
-- 可重複執行。前端只開放 select，寫入由 service_role jobs 執行。

alter table if exists public.daily_signals
  add column if not exists volume_price_score numeric,
  add column if not exists volume_price_tags jsonb default '[]'::jsonb,
  add column if not exists risk_flags jsonb default '[]'::jsonb;

create table if not exists public.strategy_definitions (
  id text primary key,
  name text not null,
  description text,
  conditions jsonb default '[]'::jsonb,
  risk_rules jsonb default '[]'::jsonb,
  enabled boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.strategy_results (
  id bigserial primary key,
  strategy_id text not null,
  strategy_name text not null,
  symbol text not null,
  name text,
  date date not null,
  score numeric,
  hit_type text,
  reason text,
  risk_note text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(strategy_id, symbol, date)
);

create table if not exists public.strategy_backtests (
  id bigserial primary key,
  strategy_id text not null,
  strategy_name text not null,
  date date not null,
  sample_count integer default 0,
  win_rate numeric,
  avg_return numeric,
  max_drawdown numeric,
  summary text,
  created_at timestamptz default now(),
  unique(strategy_id, date)
);

create table if not exists public.detected_patterns (
  id bigserial primary key,
  symbol text not null,
  name text,
  date date not null,
  pattern_type text not null,
  confidence_score numeric,
  support numeric,
  resistance numeric,
  breakout_price numeric,
  stop_loss numeric,
  target_price numeric,
  reason text,
  risk_note text,
  created_at timestamptz default now(),
  unique(symbol, date, pattern_type)
);

create table if not exists public.mainforce_behaviors (
  id bigserial primary key,
  symbol text not null,
  name text,
  date date not null,
  behavior_type text not null,
  confidence_score numeric,
  evidence text,
  risk_level text,
  suggested_action text,
  created_at timestamptz default now(),
  unique(symbol, date, behavior_type)
);

create table if not exists public.ai_trade_journal (
  id bigserial primary key,
  trade_id bigint not null,
  agent_id bigint,
  symbol text,
  name text,
  trade_date date,
  trade_type text,
  review_date date not null,
  result_summary text,
  mistake_type text,
  improvement_suggestion text,
  strategy_adjustment text,
  created_at timestamptz default now(),
  unique(trade_id, review_date)
);

create table if not exists public.generated_daily_reports (
  id bigserial primary key,
  report_date date unique not null,
  title text,
  market_summary text,
  strong_themes jsonb default '[]'::jsonb,
  capital_flow_industries jsonb default '[]'::jsonb,
  breakout_watch jsonb default '[]'::jsonb,
  support_retest_watch jsonb default '[]'::jsonb,
  high_risk_warnings jsonb default '[]'::jsonb,
  ai_actions jsonb default '[]'::jsonb,
  tomorrow_focus text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.strategy_definitions enable row level security;
alter table public.strategy_results enable row level security;
alter table public.strategy_backtests enable row level security;
alter table public.detected_patterns enable row level security;
alter table public.mainforce_behaviors enable row level security;
alter table public.ai_trade_journal enable row level security;
alter table public.generated_daily_reports enable row level security;

drop policy if exists "phase6_strategy_definitions_select" on public.strategy_definitions;
create policy "phase6_strategy_definitions_select"
on public.strategy_definitions for select
to anon, authenticated
using (true);

drop policy if exists "phase6_strategy_results_select" on public.strategy_results;
create policy "phase6_strategy_results_select"
on public.strategy_results for select
to anon, authenticated
using (true);

drop policy if exists "phase6_strategy_backtests_select" on public.strategy_backtests;
create policy "phase6_strategy_backtests_select"
on public.strategy_backtests for select
to anon, authenticated
using (true);

drop policy if exists "phase6_detected_patterns_select" on public.detected_patterns;
create policy "phase6_detected_patterns_select"
on public.detected_patterns for select
to anon, authenticated
using (true);

drop policy if exists "phase6_mainforce_behaviors_select" on public.mainforce_behaviors;
create policy "phase6_mainforce_behaviors_select"
on public.mainforce_behaviors for select
to anon, authenticated
using (true);

drop policy if exists "phase6_ai_trade_journal_select" on public.ai_trade_journal;
create policy "phase6_ai_trade_journal_select"
on public.ai_trade_journal for select
to anon, authenticated
using (true);

drop policy if exists "phase6_generated_daily_reports_select" on public.generated_daily_reports;
create policy "phase6_generated_daily_reports_select"
on public.generated_daily_reports for select
to anon, authenticated
using (true);
