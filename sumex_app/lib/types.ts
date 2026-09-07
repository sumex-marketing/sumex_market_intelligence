// ============================================================
// Sumex Market Intelligence — Shared TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface AnalysisPackage {
  card_id: string
  created_at: string
  question: string | null
  observation: string | null
  signal: {
    title: string | null
    type: string | null
    subject: string | null
    severity: string | null
    score: number | null
    trigger_detail: string | null
    evidence_summary: string | null
  } | null
  verified_facts: VerifiedFact[] | null
  market_data_snapshot: Record<string, unknown> | null
  macro_context: Record<string, unknown> | null
  etf_context: Record<string, unknown> | null
  context_news: NewsItem[] | null
  on_chain_data: Record<string, unknown> | null
  instruction: string
}

export interface AiAnalysisInput {
  what_changed: string[]
  verified_facts: string[]
  interesting_relationships: string[]
  contradictions: string[]
  possible_explanations: PossibleExplanation[]
  market_thesis: string
  confidence_score: number
  unsupported_claims: string[]
  invalidation_conditions: string[]
  watch_next: string[]
  content_angles: ContentAngle[]
  editorial_recommendation: 'PUBLISH_NOW' | 'RESEARCH_FURTHER' | 'MONITOR' | 'DO_NOT_PUBLISH'
}

export type AssetCategory = 'crypto' | 'fiat' | 'commodity' | 'index'

export type SignalType =
  | 'price_move'
  | 'dominance_shift'
  | 'volume_spike'
  | 'market_cap_move'
  | 'etf_flow'
  | 'macro_event'
  | 'sector_rotation'
  | 'manual_catalyst'

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SignalStatus = 'new' | 'investigating' | 'validated' | 'content_ready' | 'published' | 'rejected'
export type EvidenceType = 'market_metric' | 'macro_data' | 'etf_flow' | 'news' | 'on_chain' | 'manual'

export type MacroEventType =
  | 'CPI' | 'CORE_CPI' | 'PCE' | 'CORE_PCE'
  | 'FOMC' | 'NFP' | 'PPI' | 'GDP'
  | 'RATE_DECISION' | 'FOMC_MINUTES' | 'FOMC_PRESSER' | 'OTHER'

export type MacroEventStatus = 'planned' | 'upcoming' | 'released' | 'reaction_recorded' | 'archived'
export type MacroImportance = 'high' | 'medium' | 'low'

export type ContentFormat =
  | 'market_pulse'
  | 'why_it_moved'
  | 'macro_to_crypto'
  | 'etf_watch'
  | 'week_ahead'
  | 'weekly_intelligence'
  | 'narrative_watch'
  | 'chart_insight'

export type ContentStatus = 'draft' | 'editor_review' | 'approved' | 'rejected'
export type EditorialDecision = 'publish_now' | 'research_further' | 'monitor' | 'reject'
export type NewsStatus = 'discovered' | 'reviewed' | 'used' | 'dismissed'
export type JobStatus = 'running' | 'success' | 'failed' | 'partial'
export type EtfConfidence = 'high' | 'medium' | 'low' | 'manual_corrected'
export type SourceType = 'market_data' | 'macro' | 'etf' | 'news' | 'on_chain'
export type TrustLevel = 'primary' | 'structured' | 'specialized' | 'news_social' | 'ai_output'
export type HealthStatus = 'healthy' | 'stale' | 'failing'

// ============================================================
// DATABASE ENTITIES
// ============================================================

export interface Source {
  id: string
  name: string
  base_url: string | null
  type: SourceType
  trust_level: TrustLevel
  active: boolean
  parser_version: string | null
  last_success_at: string | null
  last_error_at: string | null
  last_http_status: number | null
  records_received: number | null
  data_timestamp: string | null
  data_age_minutes: number | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface SourceHealth extends Source {
  health_status: HealthStatus
}

export interface Asset {
  id: string
  symbol: string
  name: string
  category: AssetCategory
  active: boolean
  coingecko_id: string | null
  source_id: string | null
  sort_order: number
  created_at: string
}

export interface MarketSnapshot {
  id: string
  asset_id: string
  timestamp: string
  price_usd: number | null
  change_1h: number | null
  change_24h: number | null
  change_7d: number | null
  market_cap_usd: number | null
  volume_24h_usd: number | null
  source: string | null
  source_timestamp: string | null
  fetched_at: string
  // Joined fields from latest_market_snapshots view
  symbol?: string
  name?: string
  category?: AssetCategory
}

export interface MarketMetrics {
  id: string
  timestamp: string
  total_market_cap_usd: number | null
  btc_dominance: number | null
  eth_dominance: number | null
  total_volume_24h_usd: number | null
  source: string | null
  source_timestamp: string | null
  fetched_at: string
}

export interface MacroEvent {
  id: string
  type: MacroEventType
  title: string
  event_time_utc: string
  importance: MacroImportance
  forecast: string | null
  previous: string | null
  actual: string | null
  actual_released_at: string | null
  official_url: string | null
  status: MacroEventStatus
  market_reaction_note: string | null
  created_at: string
  updated_at: string
}

export interface EtfFlow {
  id: string
  date: string
  asset: string
  fund_ticker: string
  fund_name: string | null
  flow_usd: number | null
  total_flow_usd: number | null
  corrected_flow_usd: number | null
  source_url: string | null
  source_timestamp: string | null
  confidence: EtfConfidence
  fetched_at: string
}

export interface EtfDailyTotal {
  date: string
  asset: string
  net_flow_usd: number
  fund_count: number
  first_fetched_at: string
  last_fetched_at: string
}

export interface NewsItem {
  id: string
  title: string
  url: string
  publisher: string | null
  published_at: string | null
  discovered_at: string
  summary: string | null
  category: string | null
  relevance_score: number | null
  status: NewsStatus
  created_at: string
}

export interface Signal {
  id: string
  created_at: string
  signal_type: SignalType
  subject: string
  title: string
  severity: SignalSeverity
  score: number | null
  score_magnitude: number | null
  score_abnormality: number | null
  score_confirmation: number | null
  score_relevance: number | null
  score_content_value: number | null
  status: SignalStatus
  evidence_summary: string | null
  trigger_detail: string | null
  is_duplicate: boolean
  duplicate_of: string | null
  updated_at: string
  // Joined
  evidence_count?: number
}

export interface SignalEvidence {
  id: string
  signal_id: string
  metric_name: string
  value: number | null
  comparison_value: number | null
  value_text: string | null
  source_url: string | null
  source_timestamp: string | null
  evidence_type: EvidenceType
  created_at: string
}

export interface VerifiedFact {
  fact: string
  source: string
  source_url?: string
  timestamp?: string
}

export interface ContentAngle {
  hook: string
  insight: string
  format: ContentFormat
  evidence: string[]
}

export interface PossibleExplanation {
  explanation: string
  confidence: number
}

export interface AiAnalysisOutput {
  what_changed: string[]
  verified_facts: string[]
  interesting_relationships: string[]
  contradictions: string[]
  possible_explanations: PossibleExplanation[]
  market_thesis: string
  confidence_score: number
  unsupported_claims: string[]
  invalidation_conditions: string[]
  watch_next: string[]
  content_angles: ContentAngle[]
  editorial_recommendation: 'PUBLISH_NOW' | 'RESEARCH_FURTHER' | 'MONITOR' | 'DO_NOT_PUBLISH'
}

export interface ResearchCard {
  id: string
  signal_id: string | null
  created_by: string | null
  question: string | null
  observation: string | null
  verified_facts: VerifiedFact[] | null
  market_data_snapshot: Record<string, unknown> | null
  macro_context: Record<string, unknown> | null
  etf_context: Record<string, unknown> | null
  context_news: NewsItem[] | null
  on_chain_data: Record<string, unknown> | null
  ai_analysis: AiAnalysisOutput | null
  ai_analyzed_at: string | null
  contradicting_evidence: string | null
  thesis: string | null
  confidence: number | null
  invalidation_conditions: string | null
  next_watch: string | null
  editorial_decision: EditorialDecision | null
  editorial_note: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
}

export interface ContentDraft {
  id: string
  research_id: string | null
  format: ContentFormat
  title: string | null
  body: string | null
  source_list: { title: string; url: string; source_type: string }[] | null
  status: ContentStatus
  created_at: string
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejection_note: string | null
  generation_prompt: string | null
}

export interface JobRun {
  id: string
  job_name: string
  started_at: string
  finished_at: string | null
  status: JobStatus
  records_processed: number | null
  error_message: string | null
  metadata: Record<string, unknown> | null
}

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface AppSettings {
  signal_thresholds: {
    btc_24h_pct: number
    eth_24h_pct: number
    sol_24h_pct: number
    btc_dominance_pp: number
    market_cap_24h_pct: number
    volume_change_pct: number
    etf_flow_usd_m: number
  }
  timezone: string
  ai_provider: 'openai' | 'anthropic' | 'google'
  ai_model: string
  data_freshness_hours: {
    market_prices: number
    macro_calendar: number
    etf_flows: number
    news: number
  }
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}

// ============================================================
// COINGECKO TYPES
// ============================================================

export interface CoinGeckoMarketData {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  total_volume: number
  price_change_percentage_1h_in_currency: number
  price_change_percentage_24h_in_currency: number
  price_change_percentage_7d_in_currency: number
  last_updated: string
}

export interface CoinGeckoGlobal {
  data: {
    total_market_cap: { usd: number }
    total_volume: { usd: number }
    market_cap_percentage: { btc: number; eth: number }
    updated_at: number
  }
}

// ============================================================
// DISPLAY HELPERS
// ============================================================

export const SIGNAL_STATUS_LABELS: Record<SignalStatus, string> = {
  new: 'New',
  investigating: 'Investigating',
  validated: 'Validated',
  content_ready: 'Content Ready',
  published: 'Published',
  rejected: 'Rejected',
}

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  market_pulse: 'Market Pulse',
  why_it_moved: 'Why It Moved',
  macro_to_crypto: 'Macro → Crypto',
  etf_watch: 'ETF Watch',
  week_ahead: 'This Week Ahead',
  weekly_intelligence: 'Weekly Intelligence',
  narrative_watch: 'Narrative Watch',
  chart_insight: 'Chart + Insight',
}

export const MACRO_EVENT_TYPE_LABELS: Record<MacroEventType, string> = {
  CPI: 'CPI',
  CORE_CPI: 'Core CPI',
  PCE: 'PCE',
  CORE_PCE: 'Core PCE',
  FOMC: 'FOMC Meeting',
  NFP: 'Non-Farm Payrolls',
  PPI: 'PPI',
  GDP: 'GDP',
  RATE_DECISION: 'Rate Decision',
  FOMC_MINUTES: 'FOMC Minutes',
  FOMC_PRESSER: 'FOMC Press Conference',
  OTHER: 'Other',
}
