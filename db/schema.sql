-- ============================================================
-- stock-lab 資料庫 Schema（Supabase / PostgreSQL）
-- 用法：Supabase 專案 → 左側 SQL Editor → 貼上全部 → Run
-- 可重複執行（已用 if not exists / drop policy if exists 防呆）
-- ============================================================

-- ---------- 基礎資料 ----------
create table if not exists stocks(
  id serial primary key,
  symbol text unique,
  name text,
  market text,                 -- TWSE / TPEX
  industry text,
  theme_tags text[],
  is_leader bool default false,
  is_active bool default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists daily_prices(
  date date,
  symbol text,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  change numeric,
  change_percent numeric,
  volume bigint,
  amount bigint,
  turnover_rate numeric,
  market text,
  primary key(date,symbol)
);
create index if not exists idx_daily_prices_symbol on daily_prices(symbol);
create index if not exists idx_daily_prices_date on daily_prices(date);

-- ---------- 即時盤中報價 ----------
-- 盤中資料獨立存放，避免 09:15 / 整點資料覆蓋正式日 K。
-- 收盤後的 MIS job 仍會寫入 daily_prices。
create table if not exists realtime_quotes(
  symbol text,
  name text,
  market text,                 -- TWSE / TPEX / TWSE_INDEX / TPEX_INDEX / TAIFEX
  quote_date date,
  quote_time text,
  open numeric,
  high numeric,
  low numeric,
  price numeric,
  prev_close numeric,
  change numeric,
  change_percent numeric,
  volume bigint,
  amount bigint,
  source text default 'TWSE_MIS',
  updated_at timestamptz default now(),
  primary key(symbol,market)
);
create index if not exists idx_realtime_quotes_updated on realtime_quotes(updated_at desc);
create index if not exists idx_realtime_quotes_symbol on realtime_quotes(symbol);

create table if not exists institutional_trades(
  date date,
  symbol text,
  foreign_buy_sell bigint,
  investment_trust_buy_sell bigint,
  dealer_buy_sell bigint,
  total_buy_sell bigint,
  market text,
  primary key(date,symbol)
);
create index if not exists idx_inst_symbol on institutional_trades(symbol);

create table if not exists margin_trades(
  date date,
  symbol text,
  margin_balance bigint,
  short_balance bigint,
  margin_change bigint,
  short_change bigint,
  short_margin_ratio numeric,
  market text,
  primary key(date,symbol)
);

create table if not exists mops_announcements(
  id serial primary key,
  date date,
  symbol text,
  company_name text,
  title text,
  content text,
  category text,
  source_url text
);
create index if not exists idx_mops_date on mops_announcements(date);
create index if not exists idx_mops_symbol on mops_announcements(symbol);

create table if not exists monthly_revenue(
  year_month text,             -- 例 2026-04
  symbol text,
  revenue bigint,
  mom_percent numeric,
  yoy_percent numeric,
  accumulated_revenue bigint,
  accumulated_yoy_percent numeric,
  primary key(year_month,symbol)
);

-- ---------- 題材與訊號 ----------
create table if not exists themes(
  id serial primary key,
  theme_name text,
  description text,
  heat_score int,
  trend_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists theme_stocks(
  theme_id int,
  symbol text,
  role text,
  supply_chain_level text,
  relevance_score int,
  note text,
  primary key(theme_id,symbol)
);

create table if not exists daily_signals(
  date date,
  symbol text,
  price_score int,
  volume_score int,
  technical_score int,
  chip_score int,
  theme_score int,
  final_score int,
  signal_tags text[],
  summary text,
  primary key(date,symbol)
);
create index if not exists idx_signals_date on daily_signals(date);

create table if not exists candidate_pool(
  id serial primary key,
  date date,
  symbol text,
  name text,
  source_module text,
  candidate_type text,
  reason text,
  score int,
  created_at timestamptz default now()
);
create index if not exists idx_candidate_date on candidate_pool(date);

-- ---------- AI 實驗室（8 張）----------
create table if not exists ai_agents(
  id serial primary key,
  name text,
  strategy_type text,
  description text,
  initial_cash bigint,
  current_cash bigint,
  current_asset_value bigint,
  status text,
  strategy_version text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ai_candidates(
  id serial primary key,
  agent_id int,
  candidate_pool_id int,
  date date,
  symbol text,
  accepted_by_agent bool,
  agent_reason text,
  created_at timestamptz default now()
);

create table if not exists ai_backtests(
  id serial primary key,
  agent_id int,
  ai_candidate_id int,
  symbol text,
  matched_conditions text,
  sample_count int,
  win_rate numeric,
  avg_return_3d numeric,
  avg_return_5d numeric,
  avg_return_10d numeric,
  max_drawdown numeric,
  profit_factor numeric,
  passed bool,
  failed_reason text,
  created_at timestamptz default now()
);

create table if not exists ai_deep_analysis(
  id serial primary key,
  agent_id int,
  ai_candidate_id int,
  symbol text,
  finmind_data_used jsonb,
  technical_summary text,
  chip_summary text,
  fundamental_summary text,
  risk_summary text,
  final_score int,
  decision text,
  decision_reason text,
  created_at timestamptz default now()
);

create table if not exists ai_positions(
  id serial primary key,
  agent_id int,
  symbol text,
  name text,
  buy_date date,
  buy_price numeric,
  quantity int,
  current_price numeric,
  market_value bigint,
  unrealized_pnl bigint,
  unrealized_return numeric,
  buy_reason text,
  status text
);

create table if not exists ai_trades(
  id serial primary key,
  agent_id int,
  symbol text,
  trade_date date,
  trade_type text,
  price numeric,
  quantity int,
  amount bigint,
  reason text,
  strategy_version text
);
create index if not exists idx_ai_trades_agent_date on ai_trades(agent_id,trade_date);
create index if not exists idx_ai_trades_agent_symbol on ai_trades(agent_id,symbol);

create table if not exists ai_reviews(
  id serial primary key,
  agent_id int,
  trade_id int,
  review_date date,
  self_review text,
  chatgpt_review text,
  gemini_review text,
  final_review text,
  improvement_suggestion text,
  applied_to_strategy bool
);

create table if not exists ai_strategy_versions(
  id serial primary key,
  agent_id int,
  version text,
  change_summary text,
  old_rules text,
  new_rules text,
  reason text,
  created_at timestamptz default now()
);
create index if not exists idx_ai_strategy_versions_agent on ai_strategy_versions(agent_id,created_at desc);

-- ---------- 系統 ----------
create table if not exists data_status(
  id serial primary key,
  source text,
  ok bool,
  finished_at timestamptz,
  error text,
  run_date date
);

-- ---------- 會員自選股 ----------
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
create index if not exists idx_app_watchlist_account on app_watchlist(account,sort_order,updated_at desc);
alter table app_watchlist enable row level security;
drop policy if exists "public_read" on app_watchlist;

-- ---------- 前台板塊維修狀態 ----------
create table if not exists app_page_maintenance(
  page_id text primary key,
  name text,
  maintenance bool default false,
  message text,
  updated_at timestamptz default now()
);

-- ============================================================
-- RLS（Row Level Security）權限設定
-- 目標：anon key 只能「讀」，寫入只能用 service_role（繞過 RLS）
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'stocks','daily_prices','institutional_trades','margin_trades',
    'mops_announcements','monthly_revenue','themes','theme_stocks',
    'daily_signals','candidate_pool','ai_agents','ai_candidates',
    'ai_backtests','ai_deep_analysis','ai_positions','ai_trades',
    'ai_reviews','ai_strategy_versions','data_status',
    'realtime_quotes','app_page_maintenance'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "public_read" on %I;', t);
    execute format(
      'create policy "public_read" on %I for select using (true);', t);
  end loop;
end $$;
-- 註：未建立任何 insert/update/delete policy，
-- 因此 anon 無法寫入；service_role 會自動繞過 RLS，可正常寫入。

-- ============================================================
-- 種子資料：3 個 AI 機器人（初始資金各 100 萬）
-- ============================================================
insert into ai_agents(name,strategy_type,description,initial_cash,current_cash,current_asset_value,status,strategy_version)
select * from (values
  ('題材量化 AI','theme_quant','以強勢題材熱度＋量能為主的選股機器人',1000000,1000000,0,'active','v1.0'),
  ('技術突破 AI','tech_breakout','以均線多頭＋帶量突破為主的機器人',1000000,1000000,0,'active','v1.0'),
  ('成長基本面 AI','growth_fundamental','以月營收年增＋法人連買為主的機器人',1000000,1000000,0,'active','v1.0')
) as v
where not exists (select 1 from ai_agents);
