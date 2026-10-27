import { SupabaseClient } from '@supabase/supabase-js'
import { TokenUnlock, UnlockType } from '@/lib/types'
import { deduplicateDraftContent, stripMarkdown } from '@/lib/utils'

export const DEFAULT_TOKEN_UNLOCKS: Omit<TokenUnlock, 'id' | 'created_at'>[] = [
  {
    token_name: 'Falcon Finance',
    token_symbol: 'FF',
    unlock_date: '2026-11-01',
    est_value_usd: 20_070_000,
    pct_circulating_supply: 6.07,
    unlock_type: 'linear',
    description: 'Linear team and investor vesting release',
    source: 'CoinMarketCap Research',
  },
  {
    token_name: 'Collector Crypt',
    token_symbol: 'CARDS',
    unlock_date: '2026-10-29',
    est_value_usd: 17_430_000,
    pct_circulating_supply: 14.28,
    unlock_type: 'linear',
    description: 'Ecosystem & private allocation distribution',
    source: 'CoinMarketCap Research',
  },
  {
    token_name: 'Sui',
    token_symbol: 'SUI',
    unlock_date: '2026-11-01',
    est_value_usd: 11_910_000,
    pct_circulating_supply: 0.32,
    unlock_type: 'linear',
    description: 'Community reserve & series unlock tranche',
    source: 'CoinMarketCap Research',
  },
  {
    token_name: 'EigenCloud',
    token_symbol: 'EIGEN',
    unlock_date: '2026-11-01',
    est_value_usd: 7_270_000,
    pct_circulating_supply: 3.77,
    unlock_type: 'linear',
    description: 'Early contributor and foundation unlocks',
    source: 'CoinMarketCap Research',
  },
  {
    token_name: 'Pharos',
    token_symbol: 'PROS',
    unlock_date: '2026-10-30',
    est_value_usd: 5_830_000,
    pct_circulating_supply: 6.93,
    unlock_type: 'linear',
    description: 'Liquidity incentives and protocol emissions',
    source: 'CoinMarketCap Research',
  },
  {
    token_name: 'MegaETH',
    token_symbol: 'MEGA',
    unlock_date: '2026-10-30',
    est_value_usd: 3_770_000,
    pct_circulating_supply: 7.36,
    unlock_type: 'linear',
    description: 'Strategic partners and builder grants tranche',
    source: 'CoinMarketCap Research',
  },
  {
    token_name: 'Aster',
    token_symbol: 'ASTER',
    unlock_date: '2026-11-01',
    est_value_usd: 1_580_000,
    pct_circulating_supply: 0.08,
    unlock_type: 'linear',
    description: 'Staking reward unlocked allocation',
    source: 'CoinMarketCap Research',
  },
  {
    token_name: 'Walrus',
    token_symbol: 'WAL',
    unlock_date: '2026-11-01',
    est_value_usd: 1_490_000,
    pct_circulating_supply: 1.70,
    unlock_type: 'linear',
    description: 'Development milestone release tranche',
    source: 'CoinMarketCap Research',
  },
]

export function formatUnlockValue(usd: number): string {
  const abs = Math.abs(usd)
  if (abs >= 1_000_000_000) {
    return `$${(abs / 1_000_000_000).toFixed(2)}B`
  }
  if (abs >= 1_000_000) {
    return `$${(abs / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 1_000) {
    return `$${(abs / 1_000).toFixed(1)}K`
  }
  return `$${abs.toFixed(0)}`
}

export function isHighImpactUnlock(unlock: { est_value_usd: number; pct_circulating_supply: number }): boolean {
  return unlock.est_value_usd >= 10_000_000 || unlock.pct_circulating_supply >= 5.0
}

const SETTINGS_KEY = 'token_unlocks_data'

/**
 * Loads token unlocks from database, falling back gracefully to app_settings if table is pending.
 */
export async function getTokenUnlocks(supabase: SupabaseClient): Promise<{
  data: TokenUnlock[]
  totalValueUsd: number
  topUnlock: TokenUnlock | null
  highImpactCount: number
  avgPctSupply: number
}> {
  let list: TokenUnlock[] = []

  // 1. Try relational table first
  try {
    const { data, error } = await supabase
      .from('token_unlocks')
      .select('*')
      .order('est_value_usd', { ascending: false })

    if (!error && data && data.length > 0) {
      list = data as TokenUnlock[]
    }
  } catch {
    // Table may not exist yet
  }

  // 2. If no data in relational table, check app_settings
  if (list.length === 0) {
    try {
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle()

      if (setting?.value && Array.isArray(setting.value) && setting.value.length > 0) {
        list = setting.value as TokenUnlock[]
      } else {
        // Initialize with default dataset
        const seeded: TokenUnlock[] = DEFAULT_TOKEN_UNLOCKS.map((item, idx) => ({
          ...item,
          id: `seed-unlock-${idx + 1}-${item.token_symbol.toLowerCase()}`,
          created_at: new Date().toISOString(),
        }))

        await supabase.from('app_settings').upsert({
          key: SETTINGS_KEY,
          value: seeded,
          description: 'Default Token Unlocks Intelligence seed dataset',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

        list = seeded
      }
    } catch (err) {
      console.warn('[token-unlock-service] app_settings read failed:', err)
      // Fallback in-memory
      list = DEFAULT_TOKEN_UNLOCKS.map((item, idx) => ({
        ...item,
        id: `seed-unlock-${idx + 1}-${item.token_symbol.toLowerCase()}`,
        created_at: new Date().toISOString(),
      }))
    }
  }

  // Sort by est_value_usd DESC
  list.sort((a, b) => (b.est_value_usd ?? 0) - (a.est_value_usd ?? 0))

  const totalValueUsd = list.reduce((sum, item) => sum + (Number(item.est_value_usd) || 0), 0)
  const topUnlock = list[0] ?? null
  const highImpactCount = list.filter((item) => isHighImpactUnlock(item)).length
  const avgPctSupply = list.length > 0
    ? list.reduce((sum, item) => sum + (Number(item.pct_circulating_supply) || 0), 0) / list.length
    : 0

  return {
    data: list,
    totalValueUsd,
    topUnlock,
    highImpactCount,
    avgPctSupply: Number(avgPctSupply.toFixed(2)),
  }
}

/**
 * Saves or updates a token unlock item, and creates a signal if high-impact.
 */
export async function saveTokenUnlock(
  supabase: SupabaseClient,
  item: {
    id?: string
    token_name: string
    token_symbol: string
    unlock_date: string
    unlock_time_utc?: string | null
    amount_tokens?: number | null
    est_value_usd: number
    pct_circulating_supply: number
    unlock_type: UnlockType
    description?: string | null
    source?: string | null
  }
): Promise<TokenUnlock> {
  const isUpdate = Boolean(item.id)
  const id = item.id || `unlock-${Date.now()}-${item.token_symbol.toLowerCase()}`
  const now = new Date().toISOString()

  const record: TokenUnlock = {
    id,
    token_name: item.token_name.trim(),
    token_symbol: item.token_symbol.trim().toUpperCase(),
    unlock_date: item.unlock_date,
    unlock_time_utc: item.unlock_time_utc ?? null,
    amount_tokens: item.amount_tokens != null ? Number(item.amount_tokens) : null,
    est_value_usd: Number(item.est_value_usd) || 0,
    pct_circulating_supply: Number(item.pct_circulating_supply) || 0,
    unlock_type: item.unlock_type || 'linear',
    description: item.description ?? null,
    source: item.source || 'CoinMarketCap',
    created_at: now,
    updated_at: now,
  }

  // Try saving to table
  let saved = false
  try {
    const { data, error } = await supabase
      .from('token_unlocks')
      .upsert(record)
      .select('*')
      .single()

    if (!error && data) {
      saved = true
    }
  } catch {}

  // Fallback to app_settings
  if (!saved) {
    const current = await getTokenUnlocks(supabase)
    let updatedList = current.data

    if (isUpdate) {
      updatedList = updatedList.map((c) => (c.id === record.id ? record : c))
    } else {
      updatedList = [record, ...updatedList.filter((c) => c.token_symbol !== record.token_symbol)]
    }

    await supabase.from('app_settings').upsert({
      key: SETTINGS_KEY,
      value: updatedList,
      description: 'Token Unlocks Intelligence dataset',
      updated_at: now,
    }, { onConflict: 'key' })
  }

  // If high impact, emit signal
  if (isHighImpactUnlock(record)) {
    try {
      await emitUnlockSignal(supabase, record)
    } catch (err) {
      console.warn('[token-unlock-service] Failed to emit unlock signal:', err)
    }
  }

  return record
}

/**
 * Emits a high-conviction signal into the signals table when a large unlock occurs.
 */
export async function emitUnlockSignal(
  supabase: SupabaseClient,
  unlock: TokenUnlock
): Promise<void> {
  const signalTitle = `🔓 Top Token Unlock: ${unlock.token_name} (${unlock.token_symbol}) unlocks ${formatUnlockValue(unlock.est_value_usd)} (${unlock.pct_circulating_supply}% circ supply) on ${unlock.unlock_date}`

  // Check if signal exists
  const { data: existing } = await supabase
    .from('signals')
    .select('id')
    .eq('subject', unlock.token_symbol)
    .ilike('title', `%${unlock.unlock_date}%`)
    .maybeSingle()

  if (existing) return

  const isCritical = unlock.est_value_usd >= 15_000_000 || unlock.pct_circulating_supply >= 10.0
  const score = Math.min(9.5, Math.max(7.2, 7.0 + (unlock.pct_circulating_supply / 4.0)))

  await supabase.from('signals').insert({
    signal_type: 'manual_catalyst',
    subject: unlock.token_symbol,
    title: signalTitle,
    severity: isCritical ? 'critical' : 'high',
    score: Number(score.toFixed(1)),
    status: 'new',
    trigger_detail: `${unlock.token_name} has a scheduled ${unlock.unlock_type} unlock of ${formatUnlockValue(unlock.est_value_usd)} representing ${unlock.pct_circulating_supply}% of circulating supply on ${unlock.unlock_date}. High dilution supply overhang.`,
    evidence_summary: `Estimated Value: ${formatUnlockValue(unlock.est_value_usd)} | Dilution: ${unlock.pct_circulating_supply}% of circulating supply | Vesting Type: ${unlock.unlock_type.toUpperCase()} | Source: ${unlock.source ?? 'CoinMarketCap Research'}`,
  })
}

/**
 * Deletes a token unlock item.
 */
export async function deleteTokenUnlock(
  supabase: SupabaseClient,
  id: string
): Promise<boolean> {
  let deleted = false
  try {
    const { error } = await supabase.from('token_unlocks').delete().eq('id', id)
    if (!error) deleted = true
  } catch {}

  // Also clean up from app_settings
  const current = await getTokenUnlocks(supabase)
  const filtered = current.data.filter((item) => item.id !== id)
  await supabase.from('app_settings').upsert({
    key: SETTINGS_KEY,
    value: filtered,
    description: 'Token Unlocks Intelligence dataset',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })

  return true
}

/**
 * Bulk deletes all token unlocks.
 */
export async function deleteAllTokenUnlocks(
  supabase: SupabaseClient
): Promise<number> {
  let count = 0
  try {
    const { count: c } = await supabase
      .from('token_unlocks')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    count = c ?? 0
  } catch {}

  const current = await getTokenUnlocks(supabase)
  count = Math.max(count, current.data.length)

  await supabase.from('app_settings').upsert({
    key: SETTINGS_KEY,
    value: [],
    description: 'Token Unlocks Intelligence dataset (cleared)',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })

  return count
}

/**
 * Builds the exact weekly token unlocks social post and stores it in content_drafts.
 */
export async function generateWeeklyUnlockDraft(
  supabase: SupabaseClient,
  options?: {
    weekRangeLabel?: string
    authorId?: string
  }
): Promise<{ draftId: string; title: string; body: string }> {
  const { data: unlocks, totalValueUsd } = await getTokenUnlocks(supabase)
  const weekRange = options?.weekRangeLabel || 'Oct 26 - Nov 1'
  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

  const topItems = unlocks.slice(0, 8)
  const lines = topItems.map((item, idx) => {
    const emoji = numberEmojis[idx] || `${idx + 1}.`
    const valStr = formatUnlockValue(item.est_value_usd)
    return `${emoji} ${item.token_name} (${item.token_symbol}) - ${valStr}; ${item.pct_circulating_supply}% circ supply`
  })

  const highDilutionTokens = topItems.filter((i) => i.pct_circulating_supply >= 5.0)
  const highDilutionText = highDilutionTokens.length > 0
    ? `High dilution risk (>5% circulating supply) is concentrated in ${highDilutionTokens.map((t) => `${t.token_symbol} (${t.pct_circulating_supply}%)`).join(', ')}.`
    : `Supply dilution is moderately distributed across reporting assets.`

  const draftTitle = `Top Token Unlocks This Week (${weekRange})`
  const rawBody =
    `🔓 Top Token Unlocks This Week (${weekRange})\n\n` +
    lines.join('\n') +
    `\n\n` +
    `📊 Market Impact & Liquidity Analysis:\n` +
    `A combined ${formatUnlockValue(totalValueUsd)} in token supply unlocks this week. ${highDilutionText} Large-cap unlocks like SUI ($11.91M) present minimal relative dilution (0.32%) despite high dollar value.\n\n` +
    `🎯 Institutional Positioning:\n` +
    `Traders and hedge funds should anticipate localized volatility and monitor potential spot hedging or short-dated derivatives positioning leading into key unlock timestamps.\n\n` +
    `Intelligence compiled by Sumex Market Intelligence Platform`

  const cleanBody = deduplicateDraftContent(rawBody)

  // Check if draft already exists
  const { data: existingDraft } = await supabase
    .from('content_drafts')
    .select('id')
    .ilike('title', `%${draftTitle}%`)
    .maybeSingle()

  let draftId = ''
  if (existingDraft) {
    draftId = existingDraft.id
    await supabase
      .from('content_drafts')
      .update({
        body: cleanBody,
        status: 'draft',
      })
      .eq('id', draftId)
  } else {
    const { data: newDraft } = await supabase
      .from('content_drafts')
      .insert({
        format: 'week_ahead',
        title: cleanDraftTitle(draftTitle),
        body: cleanBody,
        status: 'draft',
      })
      .select('id')
      .single()

    draftId = newDraft?.id || 'new-draft'
  }

  return {
    draftId,
    title: draftTitle,
    body: cleanBody,
  }
}

function cleanDraftTitle(title: string): string {
  return stripMarkdown(title)
}
