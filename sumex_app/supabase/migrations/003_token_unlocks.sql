-- ============================================================
-- 003_token_unlocks.sql
-- Sumex Market Intelligence: Token Unlocks Table
-- ============================================================

CREATE TABLE IF NOT EXISTS token_unlocks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_name              TEXT NOT NULL,
  token_symbol            TEXT NOT NULL,
  unlock_date             DATE NOT NULL,
  unlock_time_utc         TIMESTAMPTZ,
  amount_tokens           NUMERIC,
  est_value_usd           NUMERIC(20, 2) NOT NULL,
  pct_circulating_supply  NUMERIC(6, 2) NOT NULL DEFAULT 0,
  unlock_type             TEXT NOT NULL DEFAULT 'linear', -- 'linear' or 'cliff'
  description             TEXT,
  source                  TEXT DEFAULT 'CoinMarketCap',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_unlocks_date ON token_unlocks (unlock_date ASC);
CREATE INDEX IF NOT EXISTS idx_token_unlocks_symbol ON token_unlocks (token_symbol);
CREATE INDEX IF NOT EXISTS idx_token_unlocks_value ON token_unlocks (est_value_usd DESC);

-- Enable Row Level Security
ALTER TABLE token_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to token_unlocks"
  ON token_unlocks FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to token_unlocks"
  ON token_unlocks FOR ALL USING (true);
