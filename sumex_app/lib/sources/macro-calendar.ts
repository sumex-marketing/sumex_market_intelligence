/**
 * ForexFactory Economic Calendar Fetcher
 *
 * Uses the free, no-auth-required ForexFactory JSON API:
 *   https://nfs.faireconomy.media/ff_calendar_thisweek.json
 *   https://nfs.faireconomy.media/ff_calendar_nextweek.json
 *
 * Returns US High & Medium impact events, mapped to our macro_event_type enum.
 * No API key required. No rate limits. 100% free.
 *
 * SERVER-SIDE ONLY
 */

export interface ForexFactoryEvent {
  title: string
  country: string      // "USD", "EUR", "GBP", etc.
  date: string         // ISO 8601 with offset: "2026-09-11T08:30:00-04:00"
  impact: 'High' | 'Medium' | 'Low' | 'Holiday'
  forecast: string     // "0.2%" or ""
  previous: string     // "0.1%" or ""
  actual?: string      // Filled in once released
}

export interface MappedMacroEvent {
  type: string
  title: string
  event_time_utc: string
  importance: 'high' | 'medium' | 'low'
  forecast: string | null
  previous: string | null
  actual: string | null
  status: string
  official_url: string | null
}

/**
 * Maps FF event title keywords → our macro_event_type enum + display title
 */
const EVENT_TYPE_MAP: Array<{
  patterns: string[]
  type: string
  titleOverride: string
  importance: 'high' | 'medium' | 'low'
}> = [
  {
    patterns: ['core cpi m/m'],
    type: 'CORE_CPI',
    titleOverride: 'US Core CPI MoM',
    importance: 'high',
  },
  {
    patterns: ['core cpi y/y', 'core cpi'],
    type: 'CORE_CPI',
    titleOverride: 'US Core CPI YoY',
    importance: 'high',
  },
  {
    patterns: ['cpi m/m'],
    type: 'CPI',
    titleOverride: 'US CPI MoM',
    importance: 'high',
  },
  {
    patterns: ['cpi y/y', 'cpi'],
    type: 'CPI',
    titleOverride: 'US CPI YoY',
    importance: 'high',
  },
  {
    patterns: ['core pce price index', 'core pce'],
    type: 'CORE_PCE',
    titleOverride: 'US Core PCE YoY',
    importance: 'high',
  },
  {
    patterns: ['pce price index', 'personal spending'],
    type: 'PCE',
    titleOverride: 'US PCE YoY',
    importance: 'high',
  },
  {
    patterns: ['fomc meeting minutes'],
    type: 'FOMC_MINUTES',
    titleOverride: 'FOMC Meeting Minutes',
    importance: 'high',
  },
  {
    patterns: ['fomc press conference', 'fed chair', 'powell'],
    type: 'FOMC_PRESSER',
    titleOverride: 'Fed Chair Press Conference',
    importance: 'high',
  },
  {
    patterns: ['federal funds rate'],
    type: 'RATE_DECISION',
    titleOverride: 'Fed Rate Decision',
    importance: 'high',
  },
  {
    patterns: ['fomc statement'],
    type: 'FOMC',
    titleOverride: 'FOMC Rate Statement',
    importance: 'high',
  },
  {
    patterns: ['non-farm employment change', 'nonfarm payrolls', 'nfp'],
    type: 'NFP',
    titleOverride: 'US Nonfarm Payrolls',
    importance: 'high',
  },
  {
    patterns: ['core ppi m/m', 'core ppi'],
    type: 'PPI',
    titleOverride: 'US Core PPI MoM',
    importance: 'medium',
  },
  {
    patterns: ['ppi m/m', 'ppi'],
    type: 'PPI',
    titleOverride: 'US PPI MoM',
    importance: 'medium',
  },
  {
    patterns: ['gdp q/q', 'gdp'],
    type: 'GDP',
    titleOverride: 'US GDP QoQ',
    importance: 'high',
  },
]

function mapFFEvent(ev: ForexFactoryEvent): MappedMacroEvent | null {
  const lower = ev.title.toLowerCase()

  for (const mapping of EVENT_TYPE_MAP) {
    if (mapping.patterns.some((p) => lower.includes(p))) {
      const importance =
        ev.impact === 'High' ? 'high' : ev.impact === 'Medium' ? 'medium' : mapping.importance

      // FF dates include timezone offset (e.g., "2026-09-11T08:30:00-04:00")
      // Convert to UTC ISO string directly
      const isoTime = new Date(ev.date).toISOString()

      const actual = ev.actual && ev.actual !== '' ? ev.actual : null
      const status = actual ? 'released' : 'upcoming'

      return {
        type: mapping.type,
        title: mapping.titleOverride,
        event_time_utc: isoTime,
        importance,
        forecast: ev.forecast && ev.forecast !== '' ? ev.forecast : null,
        previous: ev.previous && ev.previous !== '' ? ev.previous : null,
        actual,
        status,
        official_url: null,
      }
    }
  }

  return null
}

async function fetchFFWeek(endpoint: 'thisweek' | 'nextweek'): Promise<ForexFactoryEvent[]> {
  const url = `https://nfs.faireconomy.media/ff_calendar_${endpoint}.json`
  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return []
    const text = await res.text()
    // Guard against HTML fallback (next week not posted yet)
    if (text.trim().startsWith('<')) return []
    return JSON.parse(text) as ForexFactoryEvent[]
  } catch {
    return []
  }
}

/**
 * Fetch US High + Medium impact events for this week and next week.
 * No API key required.
 */
export async function fetchFmpMacroEvents(_apiKey?: string): Promise<MappedMacroEvent[]> {
  const [thisWeek, nextWeek] = await Promise.all([
    fetchFFWeek('thisweek'),
    fetchFFWeek('nextweek'),
  ])

  const allEvents = [...thisWeek, ...nextWeek]

  // Only USD, High or Medium impact
  const filtered = allEvents.filter(
    (e) => e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium')
  )

  const mapped: MappedMacroEvent[] = []
  for (const ev of filtered) {
    const m = mapFFEvent(ev)
    if (m) mapped.push(m)
  }

  return mapped
}
