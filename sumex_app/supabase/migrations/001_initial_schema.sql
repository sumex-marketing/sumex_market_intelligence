-- ============================================================
-- Sumex Market Intelligence — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CLEANUP / IDEMPOTENCY (FOR RE-RUNS IN SQL EDITOR)
-- ============================================================

DROP VIEW IF EXISTS etf_daily_totals CASCADE;
DROP VIEW IF EXISTS source_health CASCADE;
DROP VIEW IF EXISTS open_signals CASCADE;
DROP VIEW IF EXISTS latest_market_metrics CASCADE;
DROP VIEW IF EXISTS latest_market_snapshots CASCADE;

DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS job_runs CASCADE;
DROP TABLE IF EXISTS content_drafts CASCADE;
DROP TABLE IF EXISTS research_cards CASCADE;
DROP TABLE IF EXISTS signal_evidence CASCADE;
DROP TABLE IF EXISTS signals CASCADE;
DROP TABLE IF EXISTS news_items CASCADE;
DROP TABLE IF EXISTS etf_flows CASCADE;
DROP TABLE IF EXISTS macro_observations CASCADE;
DROP TABLE IF EXISTS macro_events CASCADE;
DROP TABLE IF EXISTS market_metrics CASCADE;
DROP TABLE IF EXISTS market_snapshots CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS sources CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS etf_confidence CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS news_status CASCADE;
DROP TYPE IF EXISTS editorial_decision CASCADE;
DROP TYPE IF EXISTS content_status CASCADE;
DROP TYPE IF EXISTS content_format CASCADE;
DROP TYPE IF EXISTS macro_importance CASCADE;
DROP TYPE IF EXISTS macro_event_status CASCADE;
DROP TYPE IF EXISTS macro_event_type CASCADE;
DROP TYPE IF EXISTS evidence_type CASCADE;
DROP TYPE IF EXISTS signal_status CASCADE;
DROP TYPE IF EXISTS signal_severity CASCADE;
DROP TYPE IF EXISTS signal_type CASCADE;
DROP TYPE IF EXISTS trust_level CASCADE;
DROP TYPE IF EXISTS source_type CASCADE;
DROP TYPE IF EXISTS asset_category CASCADE;

-- ============================================================
-- CUSTOM TYPES / ENUMS
-- ============================================================

CREATE TYPE asset_category AS ENUM ('crypto', 'fiat', 'commodity', 'index');
CREATE TYPE source_type AS ENUM ('market_data', 'macro', 'etf', 'news', 'on_chain');
CREATE TYPE trust_level AS ENUM ('primary', 'structured', 'specialized', 'news_social', 'ai_output');
CREATE TYPE signal_type AS ENUM ('price_move', 'dominance_shift', 'volume_spike', 'market_cap_move', 'etf_flow', 'macro_event', 'sector_rotation', 'manual_catalyst');
CREATE TYPE signal_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE signal_status AS ENUM ('new', 'investigating', 'validated', 'content_ready', 'published', 'rejected');
CREATE TYPE evidence_type AS ENUM ('market_metric', 'macro_data', 'etf_flow', 'news', 'on_chain', 'manual');
CREATE TYPE macro_event_type AS ENUM ('CPI', 'CORE_CPI', 'PCE', 'CORE_PCE', 'FOMC', 'NFP', 'PPI', 'GDP', 'RATE_DECISION', 'FOMC_MINUTES', 'FOMC_PRESSER', 'OTHER');
CREATE TYPE macro_event_status AS ENUM ('planned', 'upcoming', 'released', 'reaction_recorded', 'archived');
CREATE TYPE macro_importance AS ENUM ('high', 'medium', 'low');
CREATE TYPE content_format AS ENUM ('market_pulse', 'why_it_moved', 'macro_to_crypto', 'etf_watch', 'week_ahead', 'weekly_intelligence', 'narrative_watch', 'chart_insight');
CREATE TYPE content_status AS ENUM ('draft', 'editor_review', 'approved', 'rejected');
CREATE TYPE editorial_decision AS ENUM ('publish_now', 'research_further', 'monitor', 'reject');
CREATE TYPE news_status AS ENUM ('discovered', 'reviewed', 'used', 'dismissed');
CREATE TYPE job_status AS ENUM ('running', 'success', 'failed', 'partial');
CREATE TYPE etf_confidence AS ENUM ('high', 'medium', 'low', 'manual_corrected');
-- Roles: admin (full access), editor (create/edit research & content), viewer (read-only)
CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');

-- ============================================================
-- SOURCES
-- ============================================================

CREATE TABLE sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  base_url      TEXT,
  type          source_type NOT NULL,
  trust_level   trust_level NOT NULL DEFAULT 'structured',
  active        BOOLEAN NOT NULL DEFAULT true,
  parser_version TEXT,
  last_success_at TIMESTAMPTZ,
  last_error_at   TIMESTAMPTZ,
  last_http_status INTEGER,
  records_received INTEGER,
  data_timestamp  TIMESTAMPTZ,
  data_age_minutes NUMERIC,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSETS
-- ============================================================

CREATE TABLE assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol      TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    asset_category NOT NULL DEFAULT 'crypto',
  active      BOOLEAN NOT NULL DEFAULT true,
  coingecko_id TEXT,
  source_id   UUID REFERENCES sources(id),
  sort_order  INTEGER DEFAULT 999,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default watchlist
INSERT INTO assets (symbol, name, category, coingecko_id, sort_order) VALUES
  ('BTC',  'Bitcoin',  'crypto', 'bitcoin',  1),
  ('ETH',  'Ethereum', 'crypto', 'ethereum', 2),
  ('SOL',  'Solana',   'crypto', 'solana',   3);

-- ============================================================
-- MARKET SNAPSHOTS
-- ============================================================

CREATE TABLE market_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price_usd       NUMERIC(20, 8),
  change_1h       NUMERIC(10, 4),
  change_24h      NUMERIC(10, 4),
  change_7d       NUMERIC(10, 4),
  market_cap_usd  NUMERIC(24, 2),
  volume_24h_usd  NUMERIC(24, 2),
  source          TEXT,
  source_timestamp TIMESTAMPTZ,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_snapshots_asset_time ON market_snapshots (asset_id, timestamp DESC);

-- ============================================================
-- MARKET METRICS (global)
-- ============================================================

CREATE TABLE market_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_market_cap_usd NUMERIC(28, 2),
  btc_dominance       NUMERIC(6, 3),
  eth_dominance       NUMERIC(6, 3),
  total_volume_24h_usd NUMERIC(28, 2),
  source              TEXT,
  source_timestamp    TIMESTAMPTZ,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_metrics_time ON market_metrics (timestamp DESC);

-- ============================================================
-- MACRO EVENTS
-- ============================================================

CREATE TABLE macro_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            macro_event_type NOT NULL,
  title           TEXT NOT NULL,
  event_time_utc  TIMESTAMPTZ NOT NULL,
  importance      macro_importance NOT NULL DEFAULT 'medium',
  forecast        TEXT,
  previous        TEXT,
  actual          TEXT,
  actual_released_at TIMESTAMPTZ,
  official_url    TEXT,
  status          macro_event_status NOT NULL DEFAULT 'planned',
  market_reaction_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_macro_events_time ON macro_events (event_time_utc ASC);
CREATE INDEX idx_macro_events_status ON macro_events (status);

-- ============================================================
-- MACRO OBSERVATIONS
-- ============================================================

CREATE TABLE macro_observations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES macro_events(id) ON DELETE SET NULL,
  metric          TEXT NOT NULL,
  value           NUMERIC,
  unit            TEXT,
  period          TEXT,
  source          TEXT,
  source_timestamp TIMESTAMPTZ,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ETF FLOWS
-- ============================================================

CREATE TABLE etf_flows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  asset           TEXT NOT NULL, -- 'BTC' or 'ETH'
  fund_ticker     TEXT NOT NULL,
  fund_name       TEXT,
  flow_usd        NUMERIC(20, 2),
  total_flow_usd  NUMERIC(20, 2), -- running total for that date across all funds
  corrected_flow_usd NUMERIC(20, 2), -- manual correction field
  source_url      TEXT,
  source_timestamp TIMESTAMPTZ,
  confidence      etf_confidence NOT NULL DEFAULT 'medium',
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, asset, fund_ticker)
);

CREATE INDEX idx_etf_flows_date ON etf_flows (date DESC, asset);

-- ============================================================
-- NEWS ITEMS
-- ============================================================

CREATE TABLE news_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  url             TEXT NOT NULL UNIQUE,
  publisher       TEXT,
  published_at    TIMESTAMPTZ,
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary         TEXT,
  category        TEXT,
  relevance_score NUMERIC(4, 2),
  status          news_status NOT NULL DEFAULT 'discovered',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news_items_discovered ON news_items (discovered_at DESC);

-- ============================================================
-- SIGNALS
-- ============================================================

CREATE TABLE signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signal_type     signal_type NOT NULL,
  subject         TEXT NOT NULL, -- e.g. "BTC", "ETH/USD", "FOMC"
  title           TEXT NOT NULL,
  severity        signal_severity NOT NULL DEFAULT 'medium',
  score           NUMERIC(4, 1) CHECK (score >= 0 AND score <= 10),
  score_magnitude NUMERIC(3, 1),
  score_abnormality NUMERIC(3, 1),
  score_confirmation NUMERIC(3, 1),
  score_relevance NUMERIC(3, 1),
  score_content_value NUMERIC(3, 1),
  status          signal_status NOT NULL DEFAULT 'new',
  evidence_summary TEXT,
  trigger_detail  TEXT, -- human-readable explanation of why it fired
  is_duplicate    BOOLEAN NOT NULL DEFAULT false,
  duplicate_of    UUID REFERENCES signals(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signals_status ON signals (status, created_at DESC);
CREATE INDEX idx_signals_score ON signals (score DESC);

-- ============================================================
-- SIGNAL EVIDENCE
-- ============================================================

CREATE TABLE signal_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id       UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  metric_name     TEXT NOT NULL,
  value           NUMERIC,
  comparison_value NUMERIC,
  value_text      TEXT, -- for non-numeric evidence
  source_url      TEXT,
  source_timestamp TIMESTAMPTZ,
  evidence_type   evidence_type NOT NULL DEFAULT 'market_metric',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signal_evidence_signal ON signal_evidence (signal_id);

-- ============================================================
-- RESEARCH CARDS
-- ============================================================

CREATE TABLE research_cards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id             UUID REFERENCES signals(id) ON DELETE SET NULL,
  created_by            UUID, -- auth.users FK (optional, can be null if system-created)
  question              TEXT,
  observation           TEXT,
  verified_facts        JSONB, -- array of {fact, source, source_url, timestamp}
  market_data_snapshot  JSONB, -- point-in-time market data used
  macro_context         JSONB,
  etf_context           JSONB,
  context_news          JSONB, -- array of {title, url, publisher, published_at}
  on_chain_data         JSONB, -- optional supporting on-chain observations
  ai_analysis           JSONB, -- full structured AI output JSON
  ai_analyzed_at        TIMESTAMPTZ,
  contradicting_evidence TEXT,
  thesis                TEXT,
  confidence            INTEGER CHECK (confidence >= 0 AND confidence <= 10),
  invalidation_conditions TEXT,
  next_watch            TEXT,
  editorial_decision    editorial_decision,
  editorial_note        TEXT,
  decided_by            UUID, -- auth.users FK
  decided_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_cards_signal ON research_cards (signal_id);
CREATE INDEX idx_research_cards_created ON research_cards (created_at DESC);

-- ============================================================
-- CONTENT DRAFTS
-- ============================================================

CREATE TABLE content_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id     UUID REFERENCES research_cards(id) ON DELETE SET NULL,
  format          content_format NOT NULL,
  title           TEXT,
  body            TEXT,
  source_list     JSONB, -- array of {title, url, source_type}
  status          content_status NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  approved_by     UUID, -- auth.users FK
  rejected_at     TIMESTAMPTZ,
  rejected_by     UUID,
  rejection_note  TEXT,
  generation_prompt TEXT -- the prompt used to generate this draft (for debugging)
);

CREATE INDEX idx_content_drafts_status ON content_drafts (status, created_at DESC);

-- ============================================================
-- JOB RUNS
-- ============================================================

CREATE TABLE job_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name          TEXT NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  status            job_status NOT NULL DEFAULT 'running',
  records_processed INTEGER,
  error_message     TEXT,
  metadata          JSONB -- any extra context
);

CREATE INDEX idx_job_runs_job ON job_runs (job_name, started_at DESC);

-- ============================================================
-- USER PROFILES (linked to auth.users)
-- ============================================================

CREATE TABLE user_profiles (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role     user_role NOT NULL DEFAULT 'viewer',
  full_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- APP SETTINGS (key-value store)
-- ============================================================

CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID
);

-- Seed default signal thresholds
INSERT INTO app_settings (key, value, description) VALUES
  ('signal_thresholds', '{
    "btc_24h_pct": 4,
    "eth_24h_pct": 5,
    "sol_24h_pct": 7,
    "btc_dominance_pp": 0.7,
    "market_cap_24h_pct": 3,
    "volume_change_pct": 25,
    "etf_flow_usd_m": 250
  }'::jsonb, 'Default signal trigger thresholds'),
  ('timezone', '"UTC"'::jsonb, 'App default timezone'),
  ('ai_provider', '"openai"'::jsonb, 'AI analysis provider: openai | anthropic | google'),
  ('ai_model', '"gpt-4o"'::jsonb, 'AI model name'),
  ('coingecko_source_id', 'null'::jsonb, 'CoinGecko source row UUID'),
  ('data_freshness_hours', '{
    "market_prices": 2,
    "macro_calendar": 24,
    "etf_flows": 36,
    "news": 12
  }'::jsonb, 'Hours before data is considered stale');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE etf_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- All authenticated users can SELECT most data
CREATE POLICY "Authenticated users can read sources"
  ON sources FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read assets"
  ON assets FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read market snapshots"
  ON market_snapshots FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read market metrics"
  ON market_metrics FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read macro events"
  ON macro_events FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read macro observations"
  ON macro_observations FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read etf flows"
  ON etf_flows FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read news items"
  ON news_items FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read signals"
  ON signals FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read signal evidence"
  ON signal_evidence FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read research cards"
  ON research_cards FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read content drafts"
  ON content_drafts FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read job runs"
  ON job_runs FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read app settings"
  ON app_settings FOR SELECT USING (auth.role() = 'authenticated');

-- Editor/Admin can create/update research cards
CREATE POLICY "Editor can insert research cards"
  ON research_cards FOR INSERT WITH CHECK (
    get_user_role() IN ('editor', 'admin')
  );

CREATE POLICY "Editor can update research cards"
  ON research_cards FOR UPDATE USING (
    get_user_role() IN ('editor', 'admin')
  );

-- Editor can update content draft status
CREATE POLICY "Editor can update content drafts"
  ON content_drafts FOR UPDATE USING (
    get_user_role() IN ('editor', 'admin')
  );

-- Editor can insert content drafts
CREATE POLICY "Editor can insert content drafts"
  ON content_drafts FOR INSERT WITH CHECK (
    get_user_role() IN ('editor', 'admin')
  );

-- Admin can manage sources and settings
CREATE POLICY "Admin can manage sources"
  ON sources FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "Admin can update settings"
  ON app_settings FOR UPDATE USING (get_user_role() = 'admin');

-- Users can read own profile, admin can read all
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (
    id = auth.uid() OR get_user_role() = 'admin'
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admin can manage all profiles"
  ON user_profiles FOR ALL USING (get_user_role() = 'admin');

-- Trigger: auto-create user_profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'viewer'::public.user_role),
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Exception safety handler to guarantee auth.users creation never fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- HELPFUL VIEWS
-- ============================================================

-- Latest snapshot per asset
CREATE VIEW latest_market_snapshots AS
SELECT DISTINCT ON (asset_id)
  ms.*,
  a.symbol,
  a.name,
  a.category
FROM market_snapshots ms
JOIN assets a ON a.id = ms.asset_id
WHERE a.active = true
ORDER BY asset_id, ms.timestamp DESC;

-- Latest global metrics
CREATE VIEW latest_market_metrics AS
SELECT * FROM market_metrics
ORDER BY timestamp DESC
LIMIT 1;

-- Open signals (non-terminal)
CREATE VIEW open_signals AS
SELECT s.*, COUNT(se.id) AS evidence_count
FROM signals s
LEFT JOIN signal_evidence se ON se.signal_id = s.id
WHERE s.status NOT IN ('published', 'rejected')
GROUP BY s.id
ORDER BY s.score DESC, s.created_at DESC;

-- Source health view
CREATE VIEW source_health AS
SELECT
  id,
  name,
  type,
  active,
  last_success_at,
  last_error_at,
  last_http_status,
  CASE WHEN data_timestamp IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - data_timestamp)) / 60 ELSE NULL END AS data_age_minutes,
  error_message,
  CASE
    WHEN last_error_at > last_success_at THEN 'failing'
    WHEN (CASE WHEN data_timestamp IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - data_timestamp)) / 60 ELSE NULL END) > 120 THEN 'stale'
    ELSE 'healthy'
  END AS health_status
FROM sources
WHERE active = true;

-- ETF daily totals
CREATE VIEW etf_daily_totals AS
SELECT
  date,
  asset,
  SUM(COALESCE(corrected_flow_usd, flow_usd)) AS net_flow_usd,
  COUNT(*) AS fund_count,
  MIN(fetched_at) AS first_fetched_at,
  MAX(fetched_at) AS last_fetched_at
FROM etf_flows
GROUP BY date, asset
ORDER BY date DESC, asset;
