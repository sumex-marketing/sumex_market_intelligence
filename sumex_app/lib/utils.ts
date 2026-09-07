import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { ContentFormat, MacroImportance, SignalStatus, HealthStatus } from './types'

// ============================================================
// NUMBER FORMATTING
// ============================================================

export function formatPrice(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—'
  if (value >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, value < 0.01 ? 6 : value < 1 ? 4 : 2),
  }).format(value)
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value == null) return '—'
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (Math.abs(value) >= 1e9)  return `$${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6)  return `$${(value / 1e6).toFixed(2)}M`
  if (Math.abs(value) >= 1e3)  return `$${(value / 1e3).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

export function formatVolume(value: number | null | undefined): string {
  return formatLargeNumber(value)
}

export function formatMarketCap(value: number | null | undefined): string {
  return formatLargeNumber(value)
}

export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatDominance(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(2)}%`
}

export function formatEtfFlow(value: number | null | undefined): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const sign = value >= 0 ? '+' : '-'
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`
  return `${sign}$${abs.toLocaleString()}`
}

// ============================================================
// DATE / TIME FORMATTING
// ============================================================

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'MMM d, yyyy HH:mm') + ' UTC'
  } catch {
    return value
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'MMM d, yyyy')
  } catch {
    return value
  }
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true })
  } catch {
    return value
  }
}

export function formatCountdown(targetUtc: string): string {
  try {
    const target = parseISO(targetUtc)
    const now = new Date()
    const diffMs = target.getTime() - now.getTime()
    if (diffMs < 0) return 'Past'
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  } catch {
    return '—'
  }
}

export function isStale(timestamp: string | null | undefined, maxAgeHours: number): boolean {
  if (!timestamp) return true
  try {
    const ageMs = Date.now() - parseISO(timestamp).getTime()
    return ageMs > maxAgeHours * 60 * 60 * 1000
  } catch {
    return true
  }
}

// ============================================================
// COLOUR HELPERS
// ============================================================

export function getPctClass(value: number | null | undefined): string {
  if (value == null) return 'number-neutral'
  if (value > 0) return 'number-positive'
  if (value < 0) return 'number-negative'
  return 'number-neutral'
}

export function getSignalStatusClass(status: SignalStatus): string {
  const map: Record<SignalStatus, string> = {
    new: 'badge-signal-new',
    investigating: 'badge-signal-investigating',
    validated: 'badge-signal-validated',
    content_ready: 'badge-signal-content',
    published: 'badge-signal-published',
    rejected: 'badge-signal-rejected',
  }
  return map[status] ?? 'badge-muted'
}

export function getImportanceClass(importance: MacroImportance): string {
  const map: Record<MacroImportance, string> = {
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  }
  return map[importance] ?? 'badge-low'
}

export function getHealthClass(health: HealthStatus): string {
  const map: Record<HealthStatus, string> = {
    healthy: 'badge-healthy',
    stale: 'badge-stale',
    failing: 'badge-failing',
  }
  return map[health] ?? 'badge-muted'
}

export function getScoreClass(score: number | null | undefined): string {
  if (score == null) return 'low'
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

export function getConfidenceClass(confidence: number | null | undefined): string {
  if (confidence == null) return 'low'
  if (confidence >= 7) return 'high'
  if (confidence >= 4) return 'medium'
  return 'low'
}

// ============================================================
// CONTENT FORMAT HELPERS
// ============================================================

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

// ============================================================
// MISC
// ============================================================

export function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
