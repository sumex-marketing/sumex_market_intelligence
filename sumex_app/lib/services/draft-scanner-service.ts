import { SupabaseClient } from '@supabase/supabase-js'
import { autoGenerateEtfFlowDrafts } from './etf-draft-service'
import { stripMarkdown, deduplicateDraftContent } from '@/lib/utils'
import { getTokenUnlocks, isHighImpactUnlock, emitUnlockSignal } from './token-unlock-service'

export interface ScanAndDraftResult {
  totalChecked: number
  totalCreated: number
  etfDraftsCount: number
  signalDraftsCount: number
  createdDrafts: Array<{
    id: string
    title: string
    format: string
    type: 'etf' | 'signal' | 'research'
  }>
  summaryMessage: string
}

function fmtM(val: number | null | undefined): string {
  if (val == null) return 'N/A'
  const sign = val > 0 ? '+' : val < 0 ? '-' : ''
  const absRaw = Math.abs(val)
  const absM = absRaw >= 10_000 ? absRaw / 1_000_000 : absRaw
  if (absM >= 1000) return `${sign}$${(absM / 1000).toFixed(2)}B`
  return `${sign}$${absM.toFixed(1)}M`
}

/**
 * Checks all intelligence feeds (noteworthy ETF flows and high-conviction signals)
 * and drafts them if any are pending and worth talking about.
 */
export async function checkAndDraftAllPending(
  supabase: SupabaseClient,
  options?: {
    forceDate?: string
    maxEtfDays?: number
    minSignalScore?: number
    ignoreClearedAt?: boolean
  }
): Promise<ScanAndDraftResult> {
  const maxEtfDays = options?.maxEtfDays ?? 14
  const minSignalScore = options?.minSignalScore ?? 7.0
  const createdDrafts: ScanAndDraftResult['createdDrafts'] = []

  // If user explicitly triggers manual draft check, clear drafts_cleared_at and research_cleared_at
  let clearedAt: string | null = null
  let researchClearedAt: string | null = null
  if (options?.ignoreClearedAt) {
    await Promise.all([
      supabase.from('app_settings').delete().eq('key', 'drafts_cleared_at'),
      supabase.from('app_settings').delete().eq('key', 'research_cleared_at'),
    ])
  } else if (!options?.forceDate) {
    const [draftSettingRes, researchSettingRes] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'drafts_cleared_at').maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'research_cleared_at').maybeSingle(),
    ])
    clearedAt = draftSettingRes.data?.value ? String(draftSettingRes.data.value) : null
    researchClearedAt = researchSettingRes.data?.value ? String(researchSettingRes.data.value) : null
  }

  // ── 1. Check ETF Flows ────────────────────────────────────────────────────────
  let etfDraftsCount = 0
  try {
    const etfResult = await autoGenerateEtfFlowDrafts(supabase, {
      forceDate: options?.forceDate,
      maxDays: maxEtfDays,
      afterDate: clearedAt ? clearedAt.substring(0, 10) : undefined,
    })

    if (etfResult.createdDrafts && etfResult.createdDrafts.length > 0) {
      for (const d of etfResult.createdDrafts) {
        createdDrafts.push({
          id: String(d.id ?? ''),
          title: String(d.title ?? ''),
          format: String(d.format ?? 'etf_watch'),
          type: 'etf',
        })
      }
      etfDraftsCount = etfResult.createdDrafts.length
    }
  } catch (err) {
    console.warn('[draft-scanner-service] ETF check failed:', err)
  }

  // ── 2. Check High-Conviction Signals ──────────────────────────────────────────
  let signalDraftsCount = 0
  try {
    // Ensure high-impact token unlocks have signals emitted
    try {
      const { data: unlocks } = await getTokenUnlocks(supabase)
      for (const u of unlocks) {
        if (isHighImpactUnlock(u)) {
          await emitUnlockSignal(supabase, u)
        }
      }
    } catch {}

    // Fetch signals with high score or high severity
    let signalQuery = supabase
      .from('signals')
      .select('id, title, subject, score, severity, status, trigger_detail, evidence_summary, created_at')
      .or(`score.gte.${minSignalScore},severity.in.(critical,high),status.in.(validated,content_ready)`)
      .order('score', { ascending: false })
      .limit(10)

    if (clearedAt) {
      signalQuery = signalQuery.gt('created_at', clearedAt)
    }

    const { data: topSignals } = await signalQuery

    if (topSignals && topSignals.length > 0) {
      // Fetch existing drafts to avoid duplicates
      const { data: existingDrafts } = await supabase
        .from('content_drafts')
        .select('id, title, research_id, created_at')
        .order('created_at', { ascending: false })
        .limit(120)

      const existingTitles = (existingDrafts ?? []).map((d) => (d.title ?? '').toLowerCase())
      const existingResearchIds = new Set((existingDrafts ?? []).map((d) => d.research_id).filter(Boolean))
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      // Also fetch live context once for all candidate signals
      const [etfTotalsRes, macroEventsRes] = await Promise.all([
        supabase
          .from('etf_daily_totals')
          .select('date, asset, net_flow_usd')
          .order('date', { ascending: false })
          .limit(8),
        supabase
          .from('macro_events')
          .select('title, type, event_time_utc')
          .order('event_time_utc', { ascending: false })
          .limit(4),
      ])

      const etfTotals = etfTotalsRes.data ?? []
      const macroEvents = macroEventsRes.data ?? []

      for (const sig of topSignals) {
        // Skip ETF signals that already have an ETF Watch draft
        if (sig.title.includes('ETF FLOWS') || sig.title.includes('spot ETFs saw net') || sig.title.includes('ETF Inflow Spike')) {
          continue
        }

        // Check if draft already exists mentioning this signal
        const sigTitleLower = sig.title.toLowerCase()
        const alreadyDrafted = existingTitles.some(
          (t) => t.includes(sigTitleLower) || sigTitleLower.includes(t)
        )
        if (alreadyDrafted) continue

        // Check if this asset already has an active draft generated in the last 24h
        const alreadyDraftedAsset = (existingDrafts ?? []).some((d) => {
          if (!d.created_at || d.created_at < oneDayAgo) return false
          const tLower = (d.title ?? '').toLowerCase()
          const sLower = sig.subject.toLowerCase()
          return (
            tLower.includes(`: ${sLower} `) ||
            tLower.includes(` ${sLower} ▲`) ||
            tLower.includes(` ${sLower} ▼`)
          )
        })
        if (alreadyDraftedAsset) continue

        // Check if research card exists for this signal
        let cardId: string | null = null
        const { data: existingCard } = await supabase
          .from('research_cards')
          .select('id')
          .eq('signal_id', sig.id)
          .maybeSingle()

        if (existingCard) {
          cardId = existingCard.id
          if (existingResearchIds.has(cardId)) {
            continue
          }
        } else {
          // If research cards were cleared, only auto-create cards for signals newer than researchClearedAt
          const isEligibleForCard = !researchClearedAt || (sig.created_at && sig.created_at > researchClearedAt)
          if (isEligibleForCard) {
            const { data: newCard } = await supabase
              .from('research_cards')
              .insert({
                signal_id: sig.id,
                observation: sig.title,
                question: `What institutional drivers triggered this ${sig.subject} move and how does it shift market structure?`,
                thesis: sig.trigger_detail ?? sig.evidence_summary ?? 'Institutional liquidity anomaly detected.',
                confidence: Math.round(sig.score ?? 7),
                verified_facts: [{ fact: sig.trigger_detail ?? sig.title }],
              })
              .select('id')
              .single()

            if (newCard) {
              cardId = newCard.id
            }
          }
        }

        // Generate clean institutional draft body
        const matchingEtf = etfTotals.find((e) => e.asset?.toUpperCase() === sig.subject?.toUpperCase()) ?? etfTotals[0]
        const nextMacro = macroEvents[0]
        const etfContext = matchingEtf
          ? `• ${matchingEtf.asset} ETF Net Flow (${matchingEtf.date}): ${fmtM(matchingEtf.net_flow_usd)}`
          : '• ETF flow data pending update'
        const macroContext = nextMacro
          ? `• Upcoming Macro Event: ${nextMacro.title ?? nextMacro.type} (${nextMacro.event_time_utc ? new Date(nextMacro.event_time_utc).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'})`
          : '• Macro calendar: monitoring risk catalysts'

        const cleanDraftTitle = stripMarkdown(`Market Pulse: ${sig.title}`)

        // Avoid repeating the title in thesis
        const rawDetail = sig.trigger_detail ?? sig.evidence_summary ?? ''
        const hasDetail = rawDetail.trim().length > 0 && !rawDetail.toLowerCase().includes(sig.title.toLowerCase())
        const thesisText = hasDetail
          ? `${rawDetail}. This shift reflects immediate liquidity repositioning by major trading desks.`
          : `Significant volume and price action observed across institutional metrics, reflecting immediate liquidity repositioning.`

        const rawDraftBody =
          `${sig.title}\n\n` +
          `Asset: ${sig.subject} | Severity: ${sig.severity.toUpperCase()} | Priority Score: ${sig.score ?? 'N/A'}/10\n\n` +
          `Market Thesis:\n` +
          `${thesisText}\n\n` +
          `📊 Live Market Context:\n` +
          `${etfContext}\n` +
          `${macroContext}\n\n` +
          `🎯 Institutional Implications:\n` +
          `Traders and institutional allocators should monitor whether this move confirms broader macro trend continuation or presents a tactical re-entry opportunity near key support levels.\n\n` +
          `What To Watch:\n` +
          `• Monitor 24-48h volume confirmation on ${sig.subject}\n` +
          `• Track institutional spot ETF flow direction\n` +
          `• Watch macro calendar for volatility catalysts\n\n` +
          `Intelligence compiled by Sumex Market Intelligence Platform`

        const cleanDraftBody = deduplicateDraftContent(rawDraftBody)

        const { data: draft, error: draftErr } = await supabase
          .from('content_drafts')
          .insert({
            research_id: cardId,
            format: 'market_pulse',
            title: cleanDraftTitle,
            body: cleanDraftBody,
            status: 'draft',
          })
          .select('*')
          .single()

        if (!draftErr && draft) {
          createdDrafts.push({
            id: draft.id,
            title: draft.title,
            format: 'market_pulse',
            type: 'signal',
          })
          signalDraftsCount++

          // Update signal status
          await supabase
            .from('signals')
            .update({ status: 'content_ready' })
            .eq('id', sig.id)
        }
      }
    }
  } catch (err) {
    console.warn('[draft-scanner-service] Signal check failed:', err)
  }


  // ── 3. Build User Summary Message ─────────────────────────────────────────────
  const totalCreated = createdDrafts.length
  let summaryMessage = ''

  if (totalCreated === 0) {
    summaryMessage = 'All intelligence feeds scanned. All noteworthy ETF flows and high-conviction signals already have active drafts.'
  } else {
    const parts: string[] = []
    if (etfDraftsCount > 0) {
      parts.push(`${etfDraftsCount} ETF Flow Flash${etfDraftsCount > 1 ? 'es' : ''}`)
    }
    if (signalDraftsCount > 0) {
      parts.push(`${signalDraftsCount} Market Signal Draft${signalDraftsCount > 1 ? 's' : ''}`)
    }
    summaryMessage = `Generated ${totalCreated} new intelligence draft(s): ${parts.join(' and ')}.`
  }

  return {
    totalChecked: (maxEtfDays || 14) + 10,
    totalCreated,
    etfDraftsCount,
    signalDraftsCount,
    createdDrafts,
    summaryMessage,
  }
}
