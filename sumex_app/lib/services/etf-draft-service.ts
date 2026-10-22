import { SupabaseClient } from '@supabase/supabase-js'
import { stripMarkdown } from '@/lib/utils'

export interface EtfDaySummary {
  date: string
  asset: string
  net_flow_usd: number
  fund_count?: number
}

export interface EtfFundFlow {
  date: string
  asset: string
  fund_ticker: string
  fund_name?: string
  flow_usd: number
}

export interface FlowEvaluation {
  date: string
  worthTalkingAbout: boolean
  reasons: string[]
  isDivergence: boolean
  inflowAssets: string[]
  outflowAssets: string[]
  totalNetFlowUsd: number
  topInflowAsset: { asset: string; amountUsd: number } | null
  topOutflowAsset: { asset: string; amountUsd: number } | null
}

export function formatFlowM(usd: number | null | undefined): string {
  if (usd == null) return '$0.00M'
  const m = usd / 1_000_000
  const abs = Math.abs(m)
  const sign = m > 0 ? '+' : m < 0 ? '-' : ''
  return `${sign}$${abs.toFixed(2)}M`
}

export function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00Z')
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
    const day = d.getUTCDate()
    return `${month}. ${day}`
  } catch {
    return dateStr
  }
}

/**
 * Determines whether a given trading day's ETF flows are noteworthy ("worth talking about")
 */
export function evaluateDateFlows(
  totals: EtfDaySummary[],
  prevTotals?: EtfDaySummary[]
): FlowEvaluation {
  const date = totals[0]?.date ?? ''
  const reasons: string[] = []

  const inflowAssets: string[] = []
  const outflowAssets: string[] = []
  let totalNetFlowUsd = 0
  let topInflowAsset: { asset: string; amountUsd: number } | null = null
  let topOutflowAsset: { asset: string; amountUsd: number } | null = null

  for (const t of totals) {
    const flow = t.net_flow_usd ?? 0
    totalNetFlowUsd += flow

    if (flow > 0) {
      inflowAssets.push(t.asset)
      if (!topInflowAsset || flow > topInflowAsset.amountUsd) {
        topInflowAsset = { asset: t.asset, amountUsd: flow }
      }
    } else if (flow < 0) {
      outflowAssets.push(t.asset)
      if (!topOutflowAsset || flow < topOutflowAsset.amountUsd) {
        topOutflowAsset = { asset: t.asset, amountUsd: flow }
      }
    }
  }

  // 1. Cross-Asset Divergence (e.g. BTC saw net inflows, while ETH & SOL saw outflows)
  const isDivergence = inflowAssets.length > 0 && outflowAssets.length > 0
  if (isDivergence) {
    reasons.push(
      `Cross-asset flow divergence: ${inflowAssets.join('/')} saw net inflows while ${outflowAssets.join('/')} experienced net outflows`
    )
  }

  // 2. High Net Volume per asset (any asset >= $15M magnitude)
  for (const t of totals) {
    const absM = Math.abs((t.net_flow_usd ?? 0) / 1_000_000)
    if (absM >= 15) {
      reasons.push(`${t.asset} recorded significant flow volume of ${formatFlowM(t.net_flow_usd)}`)
    }
  }

  // 3. Aggregate Market Total (net total across all assets >= $25M)
  const absTotalM = Math.abs(totalNetFlowUsd / 1_000_000)
  if (absTotalM >= 25) {
    reasons.push(`Aggregate ETF net flow across all assets reached ${formatFlowM(totalNetFlowUsd)}`)
  }

  // 4. Direction Reversal from previous trading day
  if (prevTotals && prevTotals.length > 0) {
    const prevMap = new Map(prevTotals.map((p) => [p.asset, p.net_flow_usd ?? 0]))
    for (const t of totals) {
      const prev = prevMap.get(t.asset)
      if (prev !== undefined) {
        const currM = (t.net_flow_usd ?? 0) / 1_000_000
        const prevM = prev / 1_000_000
        const reversed = (currM > 0 && prevM < 0) || (currM < 0 && prevM > 0)
        if (reversed && Math.abs(currM - prevM) >= 20) {
          reasons.push(
            `${t.asset} reversed flow direction: ${formatFlowM(prev)} ➔ ${formatFlowM(t.net_flow_usd)}`
          )
        }
      }
    }
  }

  const worthTalkingAbout = reasons.length > 0 || totals.length >= 2

  return {
    date,
    worthTalkingAbout,
    reasons,
    isDivergence,
    inflowAssets,
    outflowAssets,
    totalNetFlowUsd,
    topInflowAsset,
    topOutflowAsset,
  }
}

/**
 * Builds the headline and social text matching the Cointelegraph format
 */
export function buildEtfSocialDraft(
  evaluation: FlowEvaluation,
  totals: EtfDaySummary[],
  fundFlows: EtfFundFlow[]
): {
  headline: string
  tweetText: string
  fullArticle: string
} {
  const dateLabel = formatDateLabel(evaluation.date)

  function formatAssetList(assets: string[]): string {
    if (assets.length === 0) return ''
    if (assets.length === 1) return assets[0]
    if (assets.length === 2) return `${assets[0]} and ${assets[1]}`
    return `${assets.slice(0, -1).join(', ')}, and ${assets[assets.length - 1]}`
  }

  // 1. Generate the Lead Hook Headline
  let headline = ''
  if (evaluation.isDivergence) {
    headline = `🇺🇸 ETF FLOWS: ${formatAssetList(evaluation.inflowAssets)} spot ETFs saw net inflows on ${dateLabel}, while ${formatAssetList(evaluation.outflowAssets)} spot ETFs saw net outflows.`
  } else if (evaluation.inflowAssets.length > 0) {
    headline = `🇺🇸 ETF FLOWS: Broad spot ETF net inflows recorded on ${dateLabel} led by ${formatAssetList(evaluation.inflowAssets)}.`
  } else if (evaluation.outflowAssets.length > 0) {
    headline = `🇺🇸 ETF FLOWS: Broad spot ETF net outflows recorded on ${dateLabel} as risk-off sentiment prevails.`
  } else {
    headline = `🇺🇸 ETF FLOWS: Flat net flow activity across US spot ETFs on ${dateLabel}.`
  }

  // 2. Asset Flow Lines (BTC, ETH, SOL, HYPE)
  // Ensure order: BTC, ETH, SOL, HYPE
  const assetOrder = ['BTC', 'ETH', 'SOL', 'HYPE']
  const sortedTotals = [...totals].sort((a, b) => {
    const ia = assetOrder.indexOf(a.asset)
    const ib = assetOrder.indexOf(b.asset)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  const flowLines = sortedTotals.map((t) => `${t.asset}: ${formatFlowM(t.net_flow_usd)}`)

  // 3. Tweet / Flash Post (1:1 with Cointelegraph style)
  const tweetText = `${headline}\n\n${flowLines.join('\n')}`

  // 4. Detailed Fund-by-Fund Breakdown (100% Clean plain text, no raw markdown)
  const fundGroups: Record<string, EtfFundFlow[]> = {}
  for (const f of fundFlows) {
    if (!fundGroups[f.asset]) fundGroups[f.asset] = []
    fundGroups[f.asset].push(f)
  }

  let fundBreakdownText = '📊 Fund-Level Flow Breakdown:\n\n'
  for (const asset of assetOrder) {
    const list = fundGroups[asset]
    if (!list || list.length === 0) continue

    const totalAsset = totals.find((t) => t.asset === asset)
    const totalAssetFlow = totalAsset ? formatFlowM(totalAsset.net_flow_usd) : 'N/A'

    // Sort by largest absolute flow
    const activeFunds = list
      .filter((f) => (f.flow_usd ?? 0) !== 0)
      .sort((a, b) => Math.abs(b.flow_usd ?? 0) - Math.abs(a.flow_usd ?? 0))

    fundBreakdownText += `• ${asset} Spot ETFs (Net: ${totalAssetFlow}):\n`
    if (activeFunds.length === 0) {
      fundBreakdownText += `  • All ${list.length} reporting funds posted flat/zero net flow.\n`
    } else {
      for (const fund of activeFunds.slice(0, 4)) {
        fundBreakdownText += `  • ${fund.fund_ticker}: ${formatFlowM(fund.flow_usd)}\n`
      }
    }
  }

  // 5. Market Insight & Institutional Implications
  let insightText = '🎯 Institutional Intelligence & Market Implications:\n\n'
  if (evaluation.isDivergence && evaluation.inflowAssets.includes('BTC')) {
    insightText +=
      `Institutional capital rotation heavily favored Bitcoin on ${dateLabel}, while smart-contract altcoin ecosystems experienced defensive outflows. ` +
      `This divergence suggests institutional allocators are treating BTC as digital gold and a macro hedge while remaining selective with broader crypto beta.`
  } else if (evaluation.totalNetFlowUsd > 0) {
    insightText +=
      `Strong institutional demand pushed cumulative net flows into positive territory (${formatFlowM(evaluation.totalNetFlowUsd)}) on ${dateLabel}. ` +
      `Sustained inflows across spot products provide key spot demand support and underpin bullish market structure.`
  } else {
    insightText +=
      `Spot ETFs absorbed net redemptions totaling ${formatFlowM(evaluation.totalNetFlowUsd)} on ${dateLabel}. ` +
      `Investors and market makers reduced spot ETF exposure amidst broader macro caution and liquidity rebalancing.`
  }

  // 6. Assemble Full Article Body (clean text, no asterisks or hashes)
  const fullArticle = `${tweetText}\n\n${fundBreakdownText}\n${insightText}\n\nIntelligence compiled by Sumex Market Intelligence Platform`

  return {
    headline: stripMarkdown(headline),
    tweetText: stripMarkdown(tweetText),
    fullArticle: stripMarkdown(fullArticle),
  }
}

/**
 * Call Gemini AI to enhance draft with contextual macro analysis
 */
async function enhanceDraftWithAi(
  headline: string,
  tweetText: string,
  fullArticle: string,
  date: string,
  totals: EtfDaySummary[],
  fundFlows: EtfFundFlow[]
): Promise<string> {
  const googleApiKey = process.env.GOOGLE_AI_API_KEY
  if (!googleApiKey) return stripMarkdown(fullArticle)

  const prompt = `You are the lead institutional crypto analyst at Sumex Market Intelligence.
The following ETF flow draft has been compiled for ${date}:

${fullArticle}

Enhance this draft into a concise, high-impact intelligence report ready for immediate publication and social distribution.

CRITICAL FORMATTING INSTRUCTIONS:
1. OUTPUT 100% CLEAN PLAIN TEXT. DO NOT USE ANY MARKDOWN TAGS:
   - NO bold asterisks (**bold**). Write words plainly.
   - NO header hashes (### Header or ## Header). Write plain section headers with a colon (e.g. '📈 Market Commentary & Catalysts:').
   - NO italic asterisks (*italic*).
   - Use clean bullet points (•) for bulleted lists.
2. Preserve the EXACT lead tweet / headline structure at the very top:
${tweetText}
3. Follow immediately with an institutional "📈 Market Commentary & Catalysts:" section (150-200 words) connecting these flows to institutional positioning, interest rate expectations, and crypto price action.
4. Keep the "📊 Fund-Level Flow Breakdown:" with exact numbers and clean bullets (•).
5. Keep the "🎯 Institutional Intelligence & Market Implications:" section sharp and data-driven.
6. NEVER use em dashes (--), use regular hyphens (-) or rewrite.
7. Return ONLY the clean plain text.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    if (res.ok) {
      const data = await res.json()
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (aiText && aiText.length > 100) {
        return stripMarkdown(aiText)
      }
    }
  } catch (err) {
    console.warn('[etf-draft-service] AI enhancement failed, using structured template:', err)
  }

  return stripMarkdown(fullArticle)
}

/**
 * Auto-generate ETF Flow drafts for any recent trading days that are worth talking about
 */
export async function autoGenerateEtfFlowDrafts(
  supabase: SupabaseClient,
  options?: {
    forceDate?: string
    maxDays?: number
  }
): Promise<{
  scannedDates: string[]
  createdCount: number
  createdDrafts: Record<string, unknown>[]
  skippedDates: string[]
}> {
  const maxDays = options?.maxDays ?? 7

  // 1. Fetch recent ETF daily totals
  let query = supabase
    .from('etf_daily_totals')
    .select('date, asset, net_flow_usd, fund_count')
    .order('date', { ascending: false })

  if (options?.forceDate) {
    query = query.eq('date', options.forceDate)
  } else {
    query = query.limit(maxDays * 4) // ~4 assets per day
  }

  const { data: totalsRows, error: totalsError } = await query
  if (totalsError || !totalsRows || totalsRows.length === 0) {
    console.error('[etf-draft-service] Error querying etf_daily_totals:', totalsError?.message)
    return { scannedDates: [], createdCount: 0, createdDrafts: [], skippedDates: [] }
  }

  // Group by date
  const byDate: Record<string, EtfDaySummary[]> = {}
  for (const r of totalsRows) {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  }

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))
  const createdDrafts: Record<string, unknown>[] = []
  const skippedDates: string[] = []

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i]
    const dayTotals = byDate[date]
    const prevDate = sortedDates[i + 1]
    const prevTotals = prevDate ? byDate[prevDate] : undefined

    // 2. Evaluate if worth talking about
    const evaluation = evaluateDateFlows(dayTotals, prevTotals)
    if (!evaluation.worthTalkingAbout && !options?.forceDate) {
      skippedDates.push(date)
      continue
    }

    // 3. Deduplication check: Has a draft for this date already been created?
    // Check if title or body contains the date
    const datePattern = formatDateLabel(date)
    const { data: existingDrafts } = await supabase
      .from('content_drafts')
      .select('id, title, created_at')
      .or(`title.ilike.%${date}%,title.ilike.%${datePattern}%,body.ilike.%${date}%`)
      .limit(1)

    if (existingDrafts && existingDrafts.length > 0 && !options?.forceDate) {
      // Already generated
      skippedDates.push(date)
      continue
    }

    // 4. Fetch fund-level breakdown for this date
    const { data: fundFlowsRows } = await supabase
      .from('etf_flows')
      .select('date, asset, fund_ticker, fund_name, flow_usd')
      .eq('date', date)

    const fundFlows: EtfFundFlow[] = fundFlowsRows ?? []

    // 5. Build structured draft
    const { headline, tweetText, fullArticle } = buildEtfSocialDraft(evaluation, dayTotals, fundFlows)

    // 6. Optionally enhance with AI
    const finalBody = await enhanceDraftWithAi(
      headline,
      tweetText,
      fullArticle,
      date,
      dayTotals,
      fundFlows
    )

    // 7. Find or create linked Signal & Research Card
    let researchId: string | null = null

    // Check if a research card already exists for this date/flow
    const { data: existingCards } = await supabase
      .from('research_cards')
      .select('id, observation, etf_context')
      .order('created_at', { ascending: false })
      .limit(10)

    const matchingCard = existingCards?.find((c) => {
      const obs = c.observation ?? ''
      const ctxDate = (c.etf_context as Record<string, unknown> | null)?.date
      return ctxDate === date || obs.includes(date) || obs.includes(datePattern)
    })

    if (matchingCard) {
      researchId = matchingCard.id
    } else {
      // Create a signal and research card
      const { data: newSignal } = await supabase
        .from('signals')
        .insert({
          signal_type: 'etf_flow',
          subject: evaluation.topInflowAsset?.asset ?? evaluation.topOutflowAsset?.asset ?? 'ALL',
          title: headline,
          severity: Math.abs(evaluation.totalNetFlowUsd / 1_000_000) >= 100 ? 'high' : 'medium',
          score: 7,
          trigger_detail: evaluation.reasons.join(' | ') || `ETF flows recorded for ${date}`,
          evidence_summary: `Total Net Flow: ${formatFlowM(evaluation.totalNetFlowUsd)} across reporting funds`,
          status: 'new',
          is_duplicate: false,
        })
        .select('id')
        .single()

      if (newSignal?.id) {
        const { data: newCard } = await supabase
          .from('research_cards')
          .insert({
            signal_id: newSignal.id,
            observation: headline,
            question: `What is driving the ETF flow dynamics on ${date} and what does it signal for market structure?`,
            verified_facts: dayTotals.map((t) => ({
              fact: `${t.asset} spot ETF net flow: ${formatFlowM(t.net_flow_usd)} on ${date}`,
              source: 'Farside Investors / Sumex ETF Ingestion',
              timestamp: new Date().toISOString(),
            })),
            etf_context: {
              date,
              total_net_flow_usd: evaluation.totalNetFlowUsd,
              inflows: evaluation.inflowAssets,
              outflows: evaluation.outflowAssets,
              reasons: evaluation.reasons,
            },
            thesis: `Institutional capital allocation showed ${evaluation.isDivergence ? 'divergence between Bitcoin and altcoin ETFs' : 'directional consensus'} on ${date}.`,
            context_news: [],
          })
          .select('id')
          .single()

        if (newCard?.id) {
          researchId = newCard.id
        }
      }
    }

    const cleanHeadline = stripMarkdown(headline)
    const cleanBody = stripMarkdown(finalBody)

    // 8. Insert into content_drafts
    const { data: draft, error: insertError } = await supabase
      .from('content_drafts')
      .insert({
        research_id: researchId,
        format: 'etf_watch',
        title: cleanHeadline,
        body: cleanBody,
        source_list: [
          {
            title: 'Farside Investors ETF Flow Tracker',
            url: 'https://farside.co.uk',
            source_type: 'etf',
          },
        ],
        status: 'draft',
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('[etf-draft-service] Error inserting content draft:', insertError.message)
    } else if (draft) {
      createdDrafts.push(draft)
    }
  }

  return {
    scannedDates: sortedDates,
    createdCount: createdDrafts.length,
    createdDrafts,
    skippedDates,
  }
}
