/**
 * Signal Engine
 *
 * Reads the latest market snapshots vs previous snapshot and
 * fires signals when configurable thresholds are crossed.
 *
 * The engine does NOT decide "bullish" or "bearish". It identifies
 * changes that deserve human attention.
 *
 * Runs SERVER-SIDE ONLY.
 */

import { createServiceClient } from '../supabase/server'
import { SignalType, MarketSnapshot, MarketMetrics, AppSettings } from '../types'

interface SignalCandidate {
  signal_type: SignalType
  subject: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  score: number
  score_magnitude: number
  score_abnormality: number
  score_confirmation: number
  score_relevance: number
  score_content_value: number
  trigger_detail: string
  evidence_summary: string
  evidence: {
    metric_name: string
    value: number | null
    comparison_value: number | null
    value_text?: string
    source_url?: string
    evidence_type: string
  }[]
}

function calcMagnitudeScore(pct: number, thresholds: [number, number, number]): number {
  const [low, med, high] = thresholds
  if (Math.abs(pct) >= high) return 2
  if (Math.abs(pct) >= med)  return 1.5
  if (Math.abs(pct) >= low)  return 1
  return 0.5
}

function calcSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 8) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

export async function runSignalScan(): Promise<{ created: number; error: string | null }> {
  const supabase = createServiceClient()

  // Load thresholds from settings
  const { data: settingRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'signal_thresholds')
    .single()

  const thresholds = (settingRow?.value ?? {}) as AppSettings['signal_thresholds']
  const btcPct   = thresholds.btc_24h_pct   ?? 4
  const ethPct   = thresholds.eth_24h_pct   ?? 5
  const solPct   = thresholds.sol_24h_pct   ?? 7
  const domPp    = thresholds.btc_dominance_pp  ?? 0.7
  const mcPct    = thresholds.market_cap_24h_pct ?? 3
  const volPct   = thresholds.volume_change_pct  ?? 25

  // Get latest 2 snapshots per asset to compute deltas
  const { data: snapshots } = await supabase
    .from('market_snapshots')
    .select('*, assets(symbol, name)')
    .order('timestamp', { ascending: false })
    .limit(100)

  // Get latest 2 global metrics rows
  const { data: metricsRows } = await supabase
    .from('market_metrics')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(2)

  const candidates: SignalCandidate[] = []
  const now = new Date().toISOString()

  // ── Price move signals per asset ──────────────────────────
  if (snapshots && snapshots.length) {
    // Group by asset_id, take latest two
    const byAsset = new Map<string, MarketSnapshot[]>()
    for (const s of snapshots as (MarketSnapshot & { assets: { symbol: string; name: string } })[]) {
      if (!byAsset.has(s.asset_id)) byAsset.set(s.asset_id, [])
      byAsset.get(s.asset_id)!.push(s)
    }

    for (const [, rows] of byAsset) {
      const latest = rows[0] as MarketSnapshot & { assets: { symbol: string; name: string } }
      const symbol = (latest as any).assets?.symbol ?? 'UNKNOWN'
      const change24h = latest.change_24h ?? 0

      // Determine threshold for this asset
      let threshold = btcPct
      if (symbol === 'ETH') threshold = ethPct
      else if (symbol === 'SOL') threshold = solPct
      else threshold = btcPct  // default for other assets

      if (Math.abs(change24h) >= threshold) {
        const direction = change24h > 0 ? 'up' : 'down'
        const mag = calcMagnitudeScore(change24h, [threshold, threshold * 1.5, threshold * 2.5])
        const score = mag + 1.5 + 1.5 + 2 + 1.5  // mag + abnormality + confirmation + relevance + content

        candidates.push({
          signal_type: 'price_move',
          subject: symbol,
          title: `${symbol} ${direction === 'up' ? '▲' : '▼'} ${Math.abs(change24h).toFixed(1)}% in 24h`,
          severity: calcSeverity(score),
          score: Math.min(score, 10),
          score_magnitude: mag,
          score_abnormality: 1.5,
          score_confirmation: 1.5,
          score_relevance: 2,
          score_content_value: 1.5,
          trigger_detail: `${symbol} moved ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}% in the last 24h, exceeding the ${threshold}% threshold`,
          evidence_summary: `${symbol} 24h: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}% | Price: $${latest.price_usd?.toLocaleString()}`,
          evidence: [
            {
              metric_name: `${symbol} 24h Price Change`,
              value: change24h,
              comparison_value: threshold,
              evidence_type: 'market_metric',
            },
            {
              metric_name: `${symbol} Price (USD)`,
              value: latest.price_usd,
              comparison_value: null,
              evidence_type: 'market_metric',
            },
            {
              metric_name: `${symbol} Volume 24h`,
              value: latest.volume_24h_usd,
              comparison_value: null,
              evidence_type: 'market_metric',
            },
          ],
        })
      }

      // Volume spike signal
      if (rows.length >= 2) {
        const prev = rows[1]
        if (prev.volume_24h_usd && latest.volume_24h_usd) {
          const volChange = ((latest.volume_24h_usd - prev.volume_24h_usd) / prev.volume_24h_usd) * 100
          if (Math.abs(volChange) >= (thresholds.volume_change_pct ?? 25)) {
            const mag = calcMagnitudeScore(volChange, [25, 50, 100])
            const score = mag + 1 + 1 + 1.5 + 1.5
            candidates.push({
              signal_type: 'volume_spike',
              subject: symbol,
              title: `${symbol} volume ${volChange > 0 ? 'spike' : 'drop'} ${Math.abs(volChange).toFixed(0)}% vs previous`,
              severity: calcSeverity(score),
              score: Math.min(score, 10),
              score_magnitude: mag,
              score_abnormality: 1,
              score_confirmation: 1,
              score_relevance: 1.5,
              score_content_value: 1.5,
              trigger_detail: `${symbol} 24h volume changed ${volChange > 0 ? '+' : ''}${volChange.toFixed(1)}% vs previous snapshot`,
              evidence_summary: `${symbol} volume: ${volChange > 0 ? '+' : ''}${volChange.toFixed(1)}%`,
              evidence: [
                { metric_name: `${symbol} Volume Change`, value: volChange, comparison_value: volPct, evidence_type: 'market_metric' },
                { metric_name: `${symbol} Volume Current`, value: latest.volume_24h_usd, comparison_value: null, evidence_type: 'market_metric' },
                { metric_name: `${symbol} Volume Previous`, value: prev.volume_24h_usd, comparison_value: null, evidence_type: 'market_metric' },
              ],
            })
          }
        }
      }
    }
  }

  // ── Global metrics signals ────────────────────────────────
  if (metricsRows && metricsRows.length >= 2) {
    const latest = metricsRows[0] as MarketMetrics
    const prev   = metricsRows[1] as MarketMetrics

    // BTC dominance shift
    if (latest.btc_dominance != null && prev.btc_dominance != null) {
      const domDelta = latest.btc_dominance - prev.btc_dominance
      if (Math.abs(domDelta) >= domPp) {
        const score = 6
        candidates.push({
          signal_type: 'dominance_shift',
          subject: 'BTC.D',
          title: `BTC dominance ${domDelta > 0 ? '▲' : '▼'} ${Math.abs(domDelta).toFixed(2)} pp`,
          severity: calcSeverity(score),
          score,
          score_magnitude: 1.5,
          score_abnormality: 1.5,
          score_confirmation: 1,
          score_relevance: 2,
          score_content_value: 1,
          trigger_detail: `BTC dominance moved ${domDelta > 0 ? '+' : ''}${domDelta.toFixed(2)} percentage points vs previous snapshot`,
          evidence_summary: `BTC.D: ${latest.btc_dominance.toFixed(2)}% (${domDelta > 0 ? '+' : ''}${domDelta.toFixed(2)} pp)`,
          evidence: [
            { metric_name: 'BTC Dominance Delta', value: domDelta, comparison_value: domPp, evidence_type: 'market_metric' },
            { metric_name: 'BTC Dominance Current', value: latest.btc_dominance, comparison_value: null, evidence_type: 'market_metric' },
            { metric_name: 'BTC Dominance Previous', value: prev.btc_dominance, comparison_value: null, evidence_type: 'market_metric' },
          ],
        })
      }
    }

    // Total market cap move
    if (latest.total_market_cap_usd != null && prev.total_market_cap_usd != null) {
      const mcChange = ((latest.total_market_cap_usd - prev.total_market_cap_usd) / prev.total_market_cap_usd) * 100
      if (Math.abs(mcChange) >= mcPct) {
        const mag = calcMagnitudeScore(mcChange, [mcPct, mcPct * 2, mcPct * 4])
        const score = mag + 1.5 + 1.5 + 2 + 1.5
        candidates.push({
          signal_type: 'market_cap_move',
          subject: 'TOTAL',
          title: `Total market cap ${mcChange > 0 ? '▲' : '▼'} ${Math.abs(mcChange).toFixed(1)}%`,
          severity: calcSeverity(score),
          score: Math.min(score, 10),
          score_magnitude: mag,
          score_abnormality: 1.5,
          score_confirmation: 1.5,
          score_relevance: 2,
          score_content_value: 1.5,
          trigger_detail: `Total crypto market cap changed ${mcChange > 0 ? '+' : ''}${mcChange.toFixed(2)}%, exceeding ${mcPct}% threshold`,
          evidence_summary: `Market cap: ${mcChange > 0 ? '+' : ''}${mcChange.toFixed(2)}%`,
          evidence: [
            { metric_name: 'Total Market Cap Change %', value: mcChange, comparison_value: mcPct, evidence_type: 'market_metric' },
            { metric_name: 'Total Market Cap Current', value: latest.total_market_cap_usd, comparison_value: null, evidence_type: 'market_metric' },
          ],
        })
      }
    }
  }

  if (candidates.length === 0) {
    return { created: 0, error: null }
  }

  // ── Deduplication ─────────────────────────────────────────
  // Check for existing open signals of same type+subject in the last 6h
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const { data: existingSignals } = await supabase
    .from('signals')
    .select('id, signal_type, subject')
    .in('status', ['new', 'investigating', 'validated'])
    .gte('created_at', sixHoursAgo)

  const existingSet = new Set(
    (existingSignals ?? []).map((s: { signal_type: string; subject: string }) => `${s.signal_type}:${s.subject}`)
  )

  const newCandidates = candidates.filter(
    (c) => !existingSet.has(`${c.signal_type}:${c.subject}`)
  )

  if (newCandidates.length === 0) {
    return { created: 0, error: null }
  }

  // ── Insert signals ────────────────────────────────────────
  let created = 0
  for (const c of newCandidates) {
    const { data: sig, error: sigError } = await supabase
      .from('signals')
      .insert({
        signal_type: c.signal_type,
        subject: c.subject,
        title: c.title,
        severity: c.severity,
        score: c.score,
        score_magnitude: c.score_magnitude,
        score_abnormality: c.score_abnormality,
        score_confirmation: c.score_confirmation,
        score_relevance: c.score_relevance,
        score_content_value: c.score_content_value,
        status: 'new',
        trigger_detail: c.trigger_detail,
        evidence_summary: c.evidence_summary,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (sigError || !sig) continue

    // Insert evidence rows
    if (c.evidence.length) {
      await supabase.from('signal_evidence').insert(
        c.evidence.map((e) => ({
          signal_id: sig.id,
          metric_name: e.metric_name,
          value: e.value,
          comparison_value: e.comparison_value,
          value_text: e.value_text ?? null,
          source_url: e.source_url ?? null,
          evidence_type: e.evidence_type,
          created_at: now,
        }))
      )
    }

    created++
  }

  return { created, error: null }
}
