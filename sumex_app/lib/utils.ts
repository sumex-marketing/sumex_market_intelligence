import { formatDistanceToNow, format, parseISO } from 'date-fns'
import { ContentFormat, MacroImportance, SignalStatus, HealthStatus } from './types'

// ============================================================
// NUMBER FORMATTING
// ============================================================

export function formatPrice(value: number | null | undefined, decimals = 2): string {
  if (value == null) return 'N/A'
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
  if (value == null) return 'N/A'
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
  if (value == null) return 'N/A'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatDominance(value: number | null | undefined): string {
  if (value == null) return 'N/A'
  return `${value.toFixed(2)}%`
}

export function formatEtfFlow(value: number | null | undefined): string {
  if (value == null) return 'N/A'
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
  if (!value) return 'N/A'
  try {
    return format(parseISO(value), 'MMM d, yyyy HH:mm') + ' UTC'
  } catch {
    return value
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A'
  try {
    return format(parseISO(value), 'MMM d, yyyy')
  } catch {
    return value
  }
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return 'N/A'
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
    return 'N/A'
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

export function formatSignalType(type: string | null | undefined): { label: string; color: string; bg: string } {
  switch (type) {
    case 'price_move':
      return { label: 'Price Anomaly', color: '#F7931A', bg: 'rgba(247,147,26,0.15)' }
    case 'volume_spike':
      return { label: 'Volume Surge', color: '#9945FF', bg: 'rgba(153,69,255,0.15)' }
    case 'etf_flow':
      return { label: 'ETF Flow Spike', color: '#23F7DD', bg: 'rgba(35,247,221,0.15)' }
    case 'macro_event':
      return { label: 'Macro Catalyst', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' }
    case 'manual_catalyst':
      return { label: 'Analyst Catalyst', color: '#EC4899', bg: 'rgba(236,72,153,0.15)' }
    default:
      return { label: type ? type.replace(/_/g, ' ') : 'Market Signal', color: '#23F7DD', bg: 'rgba(35,247,221,0.12)' }
  }
}

export function getSignalScoreBadge(score: number | null | undefined): {
  label: string
  scoreText: string
  color: string
  bg: string
  description: string
  level: 'critical' | 'high' | 'moderate' | 'low'
} {
  const num = score != null ? score : 5.0
  const scoreText = `${num.toFixed(1)}/10`
  if (num >= 7.5) {
    return {
      label: 'Critical Anomaly',
      scoreText,
      color: '#f87171',
      bg: 'rgba(239,68,68,0.16)',
      description: 'Urgent dislocation / major catalyst (Score 7.5 - 10.0)',
      level: 'critical',
    }
  }
  if (num >= 6.0) {
    return {
      label: 'High Significance',
      scoreText,
      color: '#fbbf24',
      bg: 'rgba(245,158,11,0.16)',
      description: 'High market impact / confirmed move (Score 6.0 - 7.4)',
      level: 'high',
    }
  }
  if (num >= 4.0) {
    return {
      label: 'Moderate Signal',
      scoreText,
      color: '#23F7DD',
      bg: 'rgba(35,247,221,0.14)',
      description: 'Standard volatility threshold trigger (Score 4.0 - 5.9)',
      level: 'moderate',
    }
  }
  return {
    label: 'Low Alert',
    scoreText,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
    description: 'Routine market activity / noise (Score < 4.0)',
    level: 'low',
  }
}

export function formatSignalStatus(status: string | null | undefined): { label: string; color: string; bg: string } {
  switch (status) {
    case 'new':
      return { label: 'New Signal', color: '#23F7DD', bg: 'rgba(35,247,221,0.15)' }
    case 'investigating':
      return { label: 'Under Review', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' }
    case 'validated':
      return { label: 'Confirmed Opportunity', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' }
    case 'content_ready':
      return { label: 'Draft Ready', color: '#c084fc', bg: 'rgba(192,132,252,0.15)' }
    case 'published':
      return { label: 'Published', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' }
    case 'rejected':
      return { label: 'Dismissed', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
    default:
      return { label: status ?? 'Active', color: '#23F7DD', bg: 'rgba(35,247,221,0.15)' }
  }
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

/**
 * Strips all markdown syntax characters (#, *, _, `, >, etc.) and returns clean plain text
 * ready for copying directly to social media (X/Twitter, Telegram), newsletters, or messaging.
 */
export function stripMarkdown(md: string | null | undefined): string {
  if (!md) return ''
  return md
    // Remove image syntax ![alt](url)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove link syntax [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove fenced code blocks
    .replace(/```[a-z]*\n([\s\S]*?)```/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Strip headers (# Header -> Header, ### Header -> Header)
    .replace(/^#{1,6}\s*(.+)$/gm, '$1')
    // Strip bold and italics with matching delimiters (**bold** -> bold, *italic* -> italic)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Strip any residual or unmatched asterisks/underscores for bold
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    // Remove strikethrough (~~text~~)
    .replace(/~~(.*?)~~/g, '$1')
    // Strip blockquotes (> quote -> quote)
    .replace(/^\s*>\s+(.+)$/gm, '$1')
    // Standardize bullet points, preserving indentation
    .replace(/^(\s*)[-*•]\s+/gm, '$1• ')
    // Remove horizontal rules
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '')
    // Clean up residual headers that had no text after ###
    .replace(/^#{1,6}\s*$/gm, '')
    // Collapse excess newlines (3+ -> 2)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Converts basic markdown to clean HTML for rich-text clipboard copying (Google Docs, Slack, Notion, Word)
 */
export function markdownToRichHtml(title: string, md: string): string {
  const cleanBodyHtml = md
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16pt;font-weight:bold;margin:16px 0 8px;">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:13pt;font-weight:bold;margin:12px 0 6px;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\s*• (.+)$/gm, '<li style="margin:4px 0;">$1</li>')
    .replace(/^\s*[-*] (.+)$/gm, '<li style="margin:4px 0;">$1</li>')
    .replace(/^([^<].+)$/gm, '<p style="margin:8px 0;line-height:1.6;">$1</p>')

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <h1 style="font-size:20pt;font-weight:bold;margin-bottom:12px;">${title}</h1>
    ${cleanBodyHtml}
  </div>`
}

/**
 * Deduplicates content inside drafts:
 * - Removes duplicate paragraphs and identical consecutive lines
 * - Removes repeated section headers (e.g. repeated '📈 Market Commentary & Catalysts:')
 * - Removes duplicate sentences across narrative paragraphs (respecting abbreviations and monetary figures)
 * - Collapses redundant whitespace and ensures clean executive readability
 */
export function deduplicateDraftContent(rawText: string | null | undefined): string {
  if (!rawText) return ''
  const text = stripMarkdown(rawText).trim()
  const lines = text.split('\n')

  const seenParagraphs = new Set<string>()
  const seenSentences = new Set<string>()
  const seenHeaders = new Set<string>()
  const cleanedLines: string[] = []

  function normalizeKey(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  function splitSentences(t: string): string[] {
    // Preserve abbreviations (months, U.S., etc.) and monetary decimal points ($12.30M)
    const safe = t.replace(
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|U\.S)\.\s+(\d+|[A-Z])/g,
      (m) => m.replace('.', '___DOT___')
    )
    const parts = safe.split(/(?<=[.!?])\s+(?=[A-Z])/)
    return parts.map((p) => p.replace(/___DOT___/g, '.'))
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('')
      }
      continue
    }

    // Check headers (lines ending with colon or starting with emojis/hashes)
    const isHeader =
      trimmed.endsWith(':') ||
      /^#{1,4}\s/.test(trimmed) ||
      /^[📊📈🎯🏆🔻•\s]{1,4}[A-Za-z]/.test(trimmed) && trimmed.length < 60 && !trimmed.includes('.')

    const normKey = normalizeKey(trimmed)

    // Check exact line duplication
    if (normKey.length > 15 && seenParagraphs.has(normKey)) {
      continue // drop duplicate line/paragraph
    }

    if (isHeader) {
      if (normKey.length > 8 && seenHeaders.has(normKey)) {
        continue // drop duplicate header
      }
      seenHeaders.add(normKey)
      seenParagraphs.add(normKey)
      cleanedLines.push(line)
      continue
    }

    // If this line is a bullet item
    if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
      if (seenParagraphs.has(normKey)) {
        continue
      }
      seenParagraphs.add(normKey)
      cleanedLines.push(line)
      continue
    }

    // For narrative prose paragraphs, check for duplicate sentences
    if (trimmed.length > 40) {
      const sentences = splitSentences(trimmed)
      const keptSentences: string[] = []

      for (const sentence of sentences) {
        const sTrim = sentence.trim()
        const sKey = normalizeKey(sTrim)
        if (sKey.length >= 28) {
          if (seenSentences.has(sKey)) {
            continue // Skip sentence already in the draft!
          }
          seenSentences.add(sKey)
        }
        keptSentences.push(sTrim)
      }

      if (keptSentences.length > 0) {
        seenParagraphs.add(normKey)
        cleanedLines.push(keptSentences.join(' '))
      }
    } else {
      seenParagraphs.add(normKey)
      cleanedLines.push(line)
    }
  }

  return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

