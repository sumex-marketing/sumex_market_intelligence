import { SupabaseClient } from '@supabase/supabase-js'
import { stripMarkdown, deduplicateDraftContent } from '@/lib/utils'

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

export interface AssetFlowIntelligence {
  asset: string
  netFlowUsd: number
  priorStreakCount: number
  priorStreakType: 'inflow' | 'outflow' | null
  streakHook: string // e.g. "ending a 5-day outflow streak", "extending its inflow streak to 3 consecutive days"
  isStreakBreaker: boolean
  milestoneHook: string // e.g. "their largest daily inflow since Sept. 22"
  isMilestone: boolean
  priorPeakDate?: string
}

export interface FlowEvaluation {
  date: string
  dayOfWeek: string
  worthTalkingAbout: boolean
  reasons: string[]
  isDivergence: boolean
  inflowAssets: string[]
  outflowAssets: string[]
  flatAssets: string[]
  totalNetFlowUsd: number
  topInflowAsset: { asset: string; amountUsd: number } | null
  topOutflowAsset: { asset: string; amountUsd: number } | null
  assetIntelligence: Record<string, AssetFlowIntelligence>
  topFundInflows: EtfFundFlow[]
  topFundOutflows: EtfFundFlow[]
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

export function getDayOfWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00Z')
    return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
  } catch {
    return ''
  }
}

/**
 * Calculates prior consecutive streaks (inflow or outflow) and detects streak breakers
 */
export function calculateStreak(
  asset: string,
  currentFlow: number,
  date: string,
  history: EtfDaySummary[]
): {
  count: number
  type: 'inflow' | 'outflow' | null
  hook: string
  isStreakBreaker: boolean
} {
  const assetHistory = history
    .filter((h) => h.asset === asset && h.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))

  let priorStreakCount = 0
  let priorStreakType: 'inflow' | 'outflow' | null = null

  for (const p of assetHistory) {
    const pf = p.net_flow_usd ?? 0
    if (priorStreakType === null) {
      if (pf > 0) priorStreakType = 'inflow'
      else if (pf < 0) priorStreakType = 'outflow'
      else break // flat day ends streak
      priorStreakCount = 1
    } else if ((priorStreakType === 'inflow' && pf > 0) || (priorStreakType === 'outflow' && pf < 0)) {
      priorStreakCount++
    } else {
      break
    }
  }

  const currType = currentFlow > 0 ? 'inflow' : currentFlow < 0 ? 'outflow' : 'flat'

  // Streak breaker: prior streak was >= 2 days and current day flipped direction
  if (priorStreakCount >= 2 && priorStreakType && currType !== priorStreakType && currType !== 'flat') {
    return {
      count: priorStreakCount,
      type: priorStreakType,
      hook: `ending a ${priorStreakCount}-day ${priorStreakType} streak`,
      isStreakBreaker: true,
    }
  } else if (priorStreakCount >= 2 && priorStreakType === currType) {
    return {
      count: priorStreakCount + 1,
      type: currType,
      hook: `extending its ${currType} streak to ${priorStreakCount + 1} consecutive days`,
      isStreakBreaker: false,
    }
  }

  return {
    count: priorStreakCount,
    type: priorStreakType,
    hook: '',
    isStreakBreaker: false,
  }
}

/**
 * Finds historical milestone: e.g. "largest daily inflow since Sept. 22" or "heaviest outflow since Oct. 7"
 */
export function findHistoricalMilestone(
  asset: string,
  flow: number,
  date: string,
  history: EtfDaySummary[]
): {
  hook: string
  isMilestone: boolean
  priorPeakDate?: string
  daysAgo?: number
} {
  const absM = Math.abs(flow / 1_000_000)
  // Only search milestones if volume magnitude is significant (>= $20M)
  if (absM < 20) return { hook: '', isMilestone: false }

  const assetHistory = history
    .filter((h) => h.asset === asset && h.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (flow > 0) {
    let priorPeak: EtfDaySummary | null = null
    let daysAgo = 0
    for (const p of assetHistory) {
      daysAgo++
      // Allow 0.5% tolerance for data provider reconciliations
      if ((p.net_flow_usd ?? 0) >= flow * 1.005) {
        priorPeak = p
        break
      }
    }

    if (priorPeak && daysAgo >= 5) {
      const peakDateLabel = formatDateLabel(priorPeak.date)
      return {
        hook: `their largest daily inflow since ${peakDateLabel}`,
        isMilestone: true,
        priorPeakDate: priorPeak.date,
        daysAgo,
      }
    } else if (!priorPeak && daysAgo >= 10) {
      return {
        hook: `their largest daily inflow on record across the past ${daysAgo} trading days`,
        isMilestone: true,
        daysAgo,
      }
    }
  } else if (flow < 0) {
    let priorPeak: EtfDaySummary | null = null
    let daysAgo = 0
    for (const p of assetHistory) {
      daysAgo++
      // If prior day had larger outflow (more negative)
      if ((p.net_flow_usd ?? 0) <= flow * 1.005) {
        priorPeak = p
        break
      }
    }

    if (priorPeak && daysAgo >= 5) {
      const peakDateLabel = formatDateLabel(priorPeak.date)
      return {
        hook: `their largest daily outflow since ${peakDateLabel}`,
        isMilestone: true,
        priorPeakDate: priorPeak.date,
        daysAgo,
      }
    } else if (!priorPeak && daysAgo >= 10) {
      return {
        hook: `their heaviest redemption day across the past ${daysAgo} trading days`,
        isMilestone: true,
        daysAgo,
      }
    }
  }

  return { hook: '', isMilestone: false }
}

/**
 * Determines whether a given trading day's ETF flows are noteworthy ("worth talking about")
 * and extracts all streak, milestone, and high in/outflow intelligence.
 */
export function evaluateDateFlows(
  totals: EtfDaySummary[],
  historyTotals: EtfDaySummary[] = [],
  fundFlows: EtfFundFlow[] = []
): FlowEvaluation {
  const date = totals[0]?.date ?? ''
  const dayOfWeek = getDayOfWeek(date)
  const reasons: string[] = []

  const inflowAssets: string[] = []
  const outflowAssets: string[] = []
  const flatAssets: string[] = []
  let totalNetFlowUsd = 0
  let topInflowAsset: { asset: string; amountUsd: number } | null = null
  let topOutflowAsset: { asset: string; amountUsd: number } | null = null
  const assetIntelligence: Record<string, AssetFlowIntelligence> = {}

  // 1. Check for unsettled / zero-flow days
  const allZero = totals.every((t) => (t.net_flow_usd ?? 0) === 0)
  if (allZero && totals.length > 0) {
    return {
      date,
      dayOfWeek,
      worthTalkingAbout: false,
      reasons: [],
      isDivergence: false,
      inflowAssets: [],
      outflowAssets: [],
      flatAssets: totals.map((t) => t.asset),
      totalNetFlowUsd: 0,
      topInflowAsset: null,
      topOutflowAsset: null,
      assetIntelligence: {},
      topFundInflows: [],
      topFundOutflows: [],
    }
  }

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
    } else {
      flatAssets.push(t.asset)
    }

    // Calculate streaks & milestones for each asset
    const streak = calculateStreak(t.asset, flow, date, historyTotals)
    const milestone = findHistoricalMilestone(t.asset, flow, date, historyTotals)

    assetIntelligence[t.asset] = {
      asset: t.asset,
      netFlowUsd: flow,
      priorStreakCount: streak.count,
      priorStreakType: streak.type,
      streakHook: streak.hook,
      isStreakBreaker: streak.isStreakBreaker,
      milestoneHook: milestone.hook,
      isMilestone: milestone.isMilestone,
      priorPeakDate: milestone.priorPeakDate,
    }

    if (milestone.isMilestone) {
      reasons.push(`${t.asset}: ${milestone.hook} (${formatFlowM(flow)})`)
    }
    if (streak.isStreakBreaker) {
      reasons.push(`${t.asset}: ${streak.hook} with ${formatFlowM(flow)}`)
    }
  }

  // 2. Cross-Asset Divergence
  const isDivergence = inflowAssets.length > 0 && outflowAssets.length > 0
  if (isDivergence) {
    reasons.push(
      `Cross-asset flow divergence: ${inflowAssets.join('/')} saw net inflows while ${outflowAssets.join('/')} experienced net outflows`
    )
  }

  // 3. High Net Volume per asset (magnitude >= $15M)
  for (const t of totals) {
    const absM = Math.abs((t.net_flow_usd ?? 0) / 1_000_000)
    if (absM >= 15 && !assetIntelligence[t.asset]?.isMilestone && !assetIntelligence[t.asset]?.isStreakBreaker) {
      reasons.push(`${t.asset} recorded significant flow volume of ${formatFlowM(t.net_flow_usd)}`)
    }
  }

  // 4. Aggregate Market Total (net total across all assets >= $25M)
  const absTotalM = Math.abs(totalNetFlowUsd / 1_000_000)
  if (absTotalM >= 25) {
    reasons.push(`Aggregate ETF net flow across all assets reached ${formatFlowM(totalNetFlowUsd)}`)
  }

  // 5. Rank Top Fund Inflows & Outflows
  const topFundInflows = fundFlows
    .filter((f) => (f.flow_usd ?? 0) > 0)
    .sort((a, b) => (b.flow_usd ?? 0) - (a.flow_usd ?? 0))

  const topFundOutflows = fundFlows
    .filter((f) => (f.flow_usd ?? 0) < 0)
    .sort((a, b) => (a.flow_usd ?? 0) - (b.flow_usd ?? 0)) // most negative first

  const worthTalkingAbout = reasons.length > 0 && Math.abs(totalNetFlowUsd) > 0

  return {
    date,
    dayOfWeek,
    worthTalkingAbout,
    reasons,
    isDivergence,
    inflowAssets,
    outflowAssets,
    flatAssets,
    totalNetFlowUsd,
    topInflowAsset,
    topOutflowAsset,
    assetIntelligence,
    topFundInflows,
    topFundOutflows,
  }
}

/**
 * Builds the news headline, social post, and detailed intelligence draft
 * matching the editorial standards of The Block and Cointelegraph.
 */
export function buildEtfSocialDraft(
  evaluation: FlowEvaluation,
  totals: EtfDaySummary[],
  fundFlows: EtfFundFlow[]
): {
  title: string
  headline: string
  tweetText: string
  fullArticle: string
} {
  const dateLabel = formatDateLabel(evaluation.date)
  const dayName = evaluation.dayOfWeek ? `${evaluation.dayOfWeek} (${dateLabel})` : dateLabel

  const btcIntel = evaluation.assetIntelligence['BTC']
  const ethIntel = evaluation.assetIntelligence['ETH']

  // ── 1. Craft Lead News Hooks (Matching The Block style) ─────────────────────
  let headline = ''
  let draftTitle = ''

  if (btcIntel?.isMilestone && ethIntel?.isStreakBreaker) {
    const btcAction = (btcIntel.netFlowUsd ?? 0) >= 0 ? 'in net inflows' : 'in net redemptions'
    const ethAction = (ethIntel.netFlowUsd ?? 0) >= 0 ? 'added' : 'shed'
    const btcVerb = (btcIntel.netFlowUsd ?? 0) >= 0 ? 'inflows' : 'redemptions'
    const ethVerb = (ethIntel.netFlowUsd ?? 0) >= 0 ? `snaps ${ethIntel.priorStreakCount}-day outflow streak with` : `snaps ${ethIntel.priorStreakCount}-day inflow streak shedding`

    headline = `🇺🇸 ETF FLOWS: US spot bitcoin ETFs recorded ${formatFlowM(btcIntel.netFlowUsd)} ${btcAction} on ${dayName}, ${btcIntel.milestoneHook}.\n\nSpot ether ETFs ${ethAction} ${formatFlowM(ethIntel.netFlowUsd)}, ${ethIntel.streakHook}.`
    draftTitle = `🇺🇸 US spot bitcoin ETFs record ${formatFlowM(btcIntel.netFlowUsd)} ${btcVerb} on ${dateLabel} (${btcIntel.milestoneHook}) as ether ${ethVerb} ${formatFlowM(ethIntel.netFlowUsd)}`
  } else if (btcIntel?.isMilestone) {
    const btcAction = (btcIntel.netFlowUsd ?? 0) >= 0 ? 'in net inflows' : 'in net redemptions'
    const btcVerb = (btcIntel.netFlowUsd ?? 0) >= 0 ? 'inflows' : 'redemptions'
    headline = `🇺🇸 ETF FLOWS: US spot bitcoin ETFs recorded ${formatFlowM(btcIntel.netFlowUsd)} ${btcAction} on ${dayName}, ${btcIntel.milestoneHook}.`
    if (ethIntel && (ethIntel.netFlowUsd ?? 0) !== 0) {
      headline += `\n\nSpot ether ETFs ${ethIntel.netFlowUsd > 0 ? 'added' : 'shed'} ${formatFlowM(ethIntel.netFlowUsd)}${ethIntel.streakHook ? `, ${ethIntel.streakHook}` : ''}.`
    }
    draftTitle = `🇺🇸 US spot bitcoin ETFs record ${formatFlowM(btcIntel.netFlowUsd)} ${btcVerb} on ${dateLabel} (${btcIntel.milestoneHook})`
  } else if (ethIntel?.isStreakBreaker) {
    const ethAction = (ethIntel.netFlowUsd ?? 0) >= 0 ? 'added' : 'shed'
    const ethVerb = (ethIntel.netFlowUsd ?? 0) >= 0 ? 'add' : 'shed'
    headline = `🇺🇸 ETF FLOWS: Spot ether ETFs ${ethAction} ${formatFlowM(ethIntel.netFlowUsd)} on ${dayName}, ${ethIntel.streakHook}.`
    if (btcIntel && (btcIntel.netFlowUsd ?? 0) !== 0) {
      const btcAction = (btcIntel.netFlowUsd ?? 0) >= 0 ? 'in net inflows' : 'in net redemptions'
      headline += `\n\nSpot bitcoin ETFs recorded ${formatFlowM(btcIntel.netFlowUsd)} ${btcAction}${btcIntel.streakHook ? `, ${btcIntel.streakHook}` : ''}.`
    }
    draftTitle = `🇺🇸 Spot ether ETFs ${ethVerb} ${formatFlowM(ethIntel.netFlowUsd)} on ${dateLabel}, ${ethIntel.streakHook}`
  } else if (evaluation.isDivergence) {
    headline = `🇺🇸 ETF FLOWS: ${evaluation.inflowAssets.join('/')} spot ETFs recorded net inflows on ${dayName}, while ${evaluation.outflowAssets.join('/')} spot ETFs saw net outflows.`
    draftTitle = `🇺🇸 ETF FLOWS: ${evaluation.inflowAssets.join('/')} see net inflows on ${dateLabel} as ${evaluation.outflowAssets.join('/')} experience outflows`
  } else if (evaluation.inflowAssets.length > 0) {
    headline = `🇺🇸 ETF FLOWS: Broad spot ETF net inflows recorded on ${dayName} led by ${evaluation.inflowAssets.join(' and ')}.`
    draftTitle = `🇺🇸 ETF FLOWS: Broad spot ETF net inflows recorded on ${dateLabel} led by ${evaluation.inflowAssets.join(' and ')}`
  } else if (evaluation.outflowAssets.length > 0) {
    headline = `🇺🇸 ETF FLOWS: Broad spot ETF net outflows recorded on ${dayName} as risk-off sentiment prevails.`
    draftTitle = `🇺🇸 ETF FLOWS: Broad spot ETF net outflows recorded on ${dateLabel}`
  } else {
    headline = `🇺🇸 ETF FLOWS: Flat net flow activity across US spot ETFs on ${dayName}.`
    draftTitle = `🇺🇸 ETF FLOWS: Flat net flow activity across US spot ETFs on ${dateLabel}`
  }


  // ── 2. Asset Flow Lines (Order: BTC, ETH, SOL, HYPE) ────────────────────────
  const assetOrder = ['BTC', 'ETH', 'SOL', 'HYPE']
  const sortedTotals = [...totals].sort((a, b) => {
    const ia = assetOrder.indexOf(a.asset)
    const ib = assetOrder.indexOf(b.asset)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  const flowLines = sortedTotals.map((t) => `• ${t.asset}: ${formatFlowM(t.net_flow_usd)}`)
  const btcFlow = totals.find((t) => t.asset === 'BTC')?.net_flow_usd ?? 0
  const ethFlow = totals.find((t) => t.asset === 'ETH')?.net_flow_usd ?? 0
  const btcEthCombined = btcFlow + ethFlow

  const hasAltcoins = sortedTotals.some(
    (t) => (t.asset === 'SOL' || t.asset === 'HYPE') && (t.net_flow_usd ?? 0) !== 0
  )
  const totalSummary = hasAltcoins
    ? `Combined BTC + ETH: ${formatFlowM(btcEthCombined)}\nTotal Net Flow (All Assets): ${formatFlowM(evaluation.totalNetFlowUsd)}`
    : `Total Net Flow: ${formatFlowM(evaluation.totalNetFlowUsd)}`

  // ── 3. Tweet / Flash Post (The Block / Cointelegraph Style) ─────────────────
  const tweetText = `${headline}\n\n${flowLines.join('\n')}\n${totalSummary}`

  // ── 4. High Inflows & Outflows: Fund Leaders & Laggards ──────────────────────
  let highFlowsText = '🏆 Top Fund Inflows:\n'
  if (evaluation.topFundInflows.length > 0) {
    for (const f of evaluation.topFundInflows.slice(0, 6)) {
      const issuer = f.fund_name ? ` (${f.fund_name.replace(/ Trust| Fund| ETF| ETP/g, '').trim()})` : ''
      highFlowsText += `• ${f.fund_ticker}${issuer}: ${formatFlowM(f.flow_usd)}\n`
    }
  } else {
    highFlowsText += '• None recorded (no funds posted net positive inflows).\n'
  }

  highFlowsText += '\n🔻 Top Fund Outflows / Redemptions:\n'
  if (evaluation.topFundOutflows.length > 0) {
    for (const f of evaluation.topFundOutflows.slice(0, 5)) {
      const issuer = f.fund_name ? ` (${f.fund_name.replace(/ Trust| Fund| ETF| ETP/g, '').trim()})` : ''
      highFlowsText += `• ${f.fund_ticker}${issuer}: ${formatFlowM(f.flow_usd)}\n`
    }
  } else {
    highFlowsText += '• None recorded across reporting funds (zero redemptions posted).\n'
  }

  // ── 5. Detailed Breakdown by Asset ──────────────────────────────────────────
  const fundGroups: Record<string, EtfFundFlow[]> = {}
  for (const f of fundFlows) {
    if (!fundGroups[f.asset]) fundGroups[f.asset] = []
    fundGroups[f.asset].push(f)
  }

  let fundBreakdownText = '📊 Complete Fund-Level Breakdown by Asset:\n\n'
  for (const asset of assetOrder) {
    const list = fundGroups[asset]
    const totalAsset = totals.find((t) => t.asset === asset)
    const totalAssetFlow = totalAsset ? formatFlowM(totalAsset.net_flow_usd) : '$0.00M'

    if (!list || list.length === 0) {
      if (totalAsset) {
        fundBreakdownText += `• ${asset} Spot Products (Net: ${totalAssetFlow}): Zero flow activity recorded.\n\n`
      }
      continue
    }

    const activeFunds = list
      .filter((f) => (f.flow_usd ?? 0) !== 0)
      .sort((a, b) => Math.abs(b.flow_usd ?? 0) - Math.abs(a.flow_usd ?? 0))

    const flatFunds = list.filter((f) => (f.flow_usd ?? 0) === 0)

    fundBreakdownText += `• ${asset} Spot ETFs (Net: ${totalAssetFlow}):\n`
    if (activeFunds.length === 0) {
      fundBreakdownText += `  • All ${list.length} reporting funds posted flat/zero net flow.\n`
    } else {
      for (const fund of activeFunds) {
        fundBreakdownText += `  • ${fund.fund_ticker}: ${formatFlowM(fund.flow_usd)}\n`
      }
      if (flatFunds.length > 0) {
        const flatTickers = flatFunds.map((f) => f.fund_ticker).slice(0, 6).join(', ')
        fundBreakdownText += `  • Flat/Zero flow reporting funds (${flatTickers}: $0.00M)\n`
      }
    }
    fundBreakdownText += '\n'
  }

  // ── 6. Market Commentary & Catalysts ───────────────────────────────────────
  let commentaryText = '📈 Market Commentary & Catalysts:\n\n'
  if (btcIntel?.isMilestone) {
    if ((btcIntel.netFlowUsd ?? 0) >= 0) {
      commentaryText +=
        `Institutional capital poured into spot crypto products on ${dayName}, led by ${formatFlowM(btcIntel.netFlowUsd)} into Bitcoin spot ETFs. ` +
        `This marked ${btcIntel.milestoneHook}, powered predominantly by dominant inflows into BlackRock (IBIT) and Fidelity (FBTC). ` +
        `Traders and institutional allocators are positioning aggressively ahead of upcoming macroeconomic volatility and election catalysts, solidifying Bitcoin's role as premier digital gold.\n\n`
    } else {
      commentaryText +=
        `Institutional capital pulled back on ${dayName}, led by substantial net redemptions of ${formatFlowM(btcIntel.netFlowUsd)} from Bitcoin spot ETFs. ` +
        `This marked ${btcIntel.milestoneHook}, driven primarily by profit-taking across major funds including BlackRock (IBIT) and Fidelity (FBTC). ` +
        `Macro trading desks and institutional allocators scaled back exposure amidst broader risk-off caution and liquidity repositioning ahead of key economic data releases.\n\n`
    }
  } else if (evaluation.totalNetFlowUsd > 0) {
    commentaryText +=
      `Institutional demand remained firmly positive on ${dayName}, generating ${formatFlowM(evaluation.totalNetFlowUsd)} in cumulative net inflows across US spot ETFs. ` +
      `High-volume liquidity absorption through regulated exchange-traded products continues to remove liquid supply from OTC desks and secondary exchanges.\n\n`
  } else {
    commentaryText +=
      `US spot ETFs recorded net redemptions of ${formatFlowM(evaluation.totalNetFlowUsd)} on ${dayName}. ` +
      `Institutional participants reduced exposure amidst broader macro caution and liquidity rebalancing across risk assets.\n\n`
  }

  if (ethIntel?.isStreakBreaker) {
    if ((ethIntel.netFlowUsd ?? 0) >= 0) {
      commentaryText +=
        `Crucially, Ethereum spot ETFs added ${formatFlowM(ethIntel.netFlowUsd)}, ${ethIntel.streakHook}. ` +
        `Positive flows into Grayscale's Ethereum Mini Trust and Fidelity's FETH successfully offset redemptions elsewhere, halting consecutive days of institutional selling.\n\n`
    } else {
      commentaryText +=
        `Meanwhile, Ethereum spot ETFs shed ${formatFlowM(ethIntel.netFlowUsd)}, ${ethIntel.streakHook}, reflecting sustained profit-taking across second-largest crypto spot products.\n\n`
    }
  }

  if (evaluation.flatAssets.includes('SOL') || evaluation.flatAssets.includes('HYPE')) {
    const flatList = evaluation.flatAssets.filter((a) => a === 'SOL' || a === 'HYPE').join(' and ')
    commentaryText +=
      `Secondary smart-contract assets ${flatList} saw flat/zero net flows across all reporting funds, indicating that institutional participants remain strictly focused on BTC and ETH rather than rotating down into altcoin beta.\n\n`
  }

  // ── 7. Institutional Intelligence & Implications ───────────────────────────
  let implicationsText = '🎯 Institutional Intelligence & Market Implications:\n\n'
  if (evaluation.isDivergence) {
    implicationsText +=
      `• Cross-Asset Divergence: Capital allocation favored ${evaluation.inflowAssets.join('/')} while ${evaluation.outflowAssets.join('/')} faced headwinds, confirming asset-specific institutional rotation rather than generic market beta.\n`
  }
  if (btcIntel?.isMilestone) {
    if ((btcIntel.netFlowUsd ?? 0) >= 0) {
      implicationsText +=
        `• Structural BTC Demand: Persistent spot absorption provides strong price structure support and signals robust institutional accumulation regardless of short-term derivative volatility.\n`
    } else {
      implicationsText +=
        `• Institutional BTC De-risking: Elevated spot ETF redemptions signal tactical profit-taking and caution among macro desks near key market levels.\n`
    }
  }
  if (ethIntel?.isStreakBreaker) {
    if ((ethIntel.netFlowUsd ?? 0) >= 0) {
      implicationsText +=
        `• ETH Flow Reversal: Snapping the ${ethIntel.priorStreakCount}-day outflow streak relieves sustained spot selling pressure and marks a pivotal technical baseline for Ethereum spot products.\n`
    } else {
      implicationsText +=
        `• ETH Sentiment Pause: Halting the prior positive flow streak indicates near-term institutional consolidation across Ethereum products.\n`
    }
  }
  if (evaluation.topFundInflows.length > 0) {
    const topFund = evaluation.topFundInflows[0]
    implicationsText +=
      `• Primary Capital Magnet: ${topFund.fund_ticker} absorbed ${formatFlowM(topFund.flow_usd)}, continuing to dominate daily market share and institutional allocation volume.\n`
  }

  // ── 8. Assemble Full Clean Article ──────────────────────────────────────────
  const rawArticle = `${tweetText}\n\n${highFlowsText}\n${fundBreakdownText}${commentaryText}${implicationsText}\nIntelligence compiled by Sumex Market Intelligence Platform`
  const fullArticle = deduplicateDraftContent(rawArticle)

  return {
    title: stripMarkdown(draftTitle),
    headline: stripMarkdown(headline),
    tweetText: stripMarkdown(tweetText),
    fullArticle: stripMarkdown(fullArticle),
  }
}


/**
 * Call Gemini AI to polish and enrich draft while guaranteeing 100% clean plain text
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

Review and polish this draft into a concise, institutional-grade market intelligence report ready for immediate executive publication and social distribution.

CRITICAL FORMATTING & DEDUPLICATION INSTRUCTIONS:
1. OUTPUT 100% CLEAN PLAIN TEXT. DO NOT USE ANY MARKDOWN TAGS:
   - NO bold asterisks (**bold**). Write words plainly.
   - NO header hashes (### Header or ## Header). Write plain section headers with a colon (e.g. '📈 Market Commentary & Catalysts:').
   - NO italic asterisks (*italic*).
   - Use clean bullet points (•) for bulleted lists.
2. PRESERVE THE EXACT LEAD HOOK, FLASH POST, AND EXACT NUMBERS WITHOUT ANY MODIFICATION:
${tweetText}
   CRITICAL DATA INTEGRITY MANDATE: ALL NET FLOW FIGURES, ASSET TOTALS, AND COMBINED TOTALS (E.G. COMBINED BTC + ETH) ARE MATHEMATICALLY VERIFIED AND SOURCED DIRECTLY FROM FARSIDE INVESTORS. DO NOT ALTER, ROUND, ESTIMATE, OR RECALCULATE ANY MONETARY AMOUNTS OR TICKER FIGURES.
3. PRESERVE THE '🏆 Top Fund Inflows:' and '🔻 Top Fund Outflows / Redemptions:' sections with exact numbers.
4. PRESERVE THE '📊 Complete Fund-Level Breakdown by Asset:' section.
5. STRICT CONTENT DEDUPLICATION MANDATE:
   - DO NOT duplicate sentences or phrases that appear elsewhere in the report.
   - Do NOT repeat the lead headline or bullet points inside the '📈 Market Commentary & Catalysts:' or '🎯 Institutional Intelligence & Market Implications:' sections.
   - Each section must offer distinct, non-repetitive macro and market structure analysis.
6. Enrich the '📈 Market Commentary & Catalysts:' section with sharp macro analysis (150-200 words) connecting these flows to institutional positioning and price momentum.
7. Keep '🎯 Institutional Intelligence & Market Implications:' crisp and actionable.
8. Return ONLY the clean plain text.`

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
            temperature: 0.6,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    if (res.ok) {
      const data = await res.json()
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (aiText && aiText.length > 100) {
        return deduplicateDraftContent(aiText)
      }
    }
  } catch (err) {
    console.warn('[etf-draft-service] AI enhancement failed, using structured template:', err)
  }

  return deduplicateDraftContent(fullArticle)
}


/**
 * Auto-generate or update ETF Flow drafts for any recent trading days that are worth talking about
 */
export async function autoGenerateEtfFlowDrafts(
  supabase: SupabaseClient,
  options?: {
    forceDate?: string
    maxDays?: number
    forceUpdateExisting?: boolean
    afterDate?: string
  }
): Promise<{
  scannedDates: string[]
  createdCount: number
  createdDrafts: Record<string, unknown>[]
  skippedDates: string[]
}> {
  const maxDays = options?.maxDays ?? 14

  // 1. Fetch extensive historical ETF daily totals (up to 90 days / 360 rows)
  // to ensure streaks and historical milestone lookbacks are always accurate.
  const { data: allTotalsRows, error: totalsError } = await supabase
    .from('etf_daily_totals')
    .select('date, asset, net_flow_usd, fund_count')
    .order('date', { ascending: false })
    .limit(360)

  if (totalsError || !allTotalsRows || allTotalsRows.length === 0) {
    console.error('[etf-draft-service] Error querying etf_daily_totals:', totalsError?.message)
    return { scannedDates: [], createdCount: 0, createdDrafts: [], skippedDates: [] }
  }

  // Group by date
  const byDate: Record<string, EtfDaySummary[]> = {}
  for (const r of allTotalsRows) {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  }

  const allSortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))
  const eligibleDates = options?.afterDate
    ? allSortedDates.filter((d) => d >= options.afterDate!.substring(0, 10))
    : allSortedDates

  const targetDates = options?.forceDate
    ? [options.forceDate]
    : eligibleDates.slice(0, maxDays)

  const createdDrafts: Record<string, unknown>[] = []
  const skippedDates: string[] = []

  for (const date of targetDates) {
    const dayTotals = byDate[date]
    if (!dayTotals || dayTotals.length === 0) {
      skippedDates.push(date)
      continue
    }

    // Historical records strictly before this date
    const historyTotals = allTotalsRows.filter((r) => r.date < date)

    // 2. Fetch fund-level breakdown for this date
    const { data: fundFlowsRows } = await supabase
      .from('etf_flows')
      .select('date, asset, fund_ticker, fund_name, flow_usd')
      .eq('date', date)

    const fundFlows: EtfFundFlow[] = fundFlowsRows ?? []

    // 3. Evaluate if worth talking about (with full streak & milestone analytics)
    const evaluation = evaluateDateFlows(dayTotals, historyTotals, fundFlows)
    if (!evaluation.worthTalkingAbout && !options?.forceDate) {
      skippedDates.push(date)
      continue
    }

    // 4. Find linked Signal & Research Card
    const datePattern = formatDateLabel(date) // e.g. "Oct. 22"
    const rawMonthDay = datePattern.replace('.', '') // e.g. "Oct 22"

    const { data: existingCards } = await supabase
      .from('research_cards')
      .select('id, observation, etf_context')
      .order('created_at', { ascending: false })
      .limit(40)

    const matchingCard = existingCards?.find((c) => {
      const obs = c.observation ?? ''
      const ctxDate = (c.etf_context as Record<string, unknown> | null)?.date
      return ctxDate === date || obs.includes(date) || obs.includes(datePattern) || obs.includes(rawMonthDay)
    })

    const matchingCardId = matchingCard?.id

    // Check for existing draft for this date or linked research card
    const { data: recentDrafts } = await supabase
      .from('content_drafts')
      .select('id, title, body, research_id, created_at')
      .order('created_at', { ascending: false })
      .limit(150)

    const existingDraft = (recentDrafts ?? []).find((d) => {
      if (matchingCardId && d.research_id === matchingCardId) return true
      const fullText = `${d.title} ${d.body || ''}`
      return (
        fullText.includes(date) ||
        fullText.includes(datePattern) ||
        fullText.includes(rawMonthDay)
      )
    })

    if (existingDraft && !options?.forceDate && !options?.forceUpdateExisting) {
      // Already generated and update not forced
      skippedDates.push(date)
      continue
    }

    // 5. Build structured institutional draft
    const { title, headline, tweetText, fullArticle } = buildEtfSocialDraft(evaluation, dayTotals, fundFlows)

    // 6. Optionally enhance with AI
    const finalBody = await enhanceDraftWithAi(
      headline,
      tweetText,
      fullArticle,
      date,
      dayTotals,
      fundFlows
    )

    const cleanTitle = stripMarkdown(title)
    const cleanBody = stripMarkdown(finalBody)

    // 7. Resolve researchId
    let researchId: string | null = matchingCardId ?? null

    if (!researchId) {
      // Check if signal exists before inserting
      const { data: existingSignals } = await supabase
        .from('signals')
        .select('id, title, trigger_detail')
        .eq('signal_type', 'etf_flow')
        .order('created_at', { ascending: false })
        .limit(20)

      let signalId = existingSignals?.find(
        (s) => s.trigger_detail?.includes(date) || s.title?.includes(datePattern) || s.title?.includes(rawMonthDay)
      )?.id

      if (!signalId) {
        const { data: newSignal } = await supabase
          .from('signals')
          .insert({
            signal_type: 'etf_flow',
            subject: evaluation.topInflowAsset?.asset ?? evaluation.topOutflowAsset?.asset ?? 'ALL',
            title: cleanTitle,
            severity: Math.abs(evaluation.totalNetFlowUsd / 1_000_000) >= 100 ? 'high' : 'medium',
            score: 8,
            trigger_detail: evaluation.reasons.join(' | ') || `ETF flows recorded for ${date}`,
            evidence_summary: `Total Net Flow: ${formatFlowM(evaluation.totalNetFlowUsd)} across reporting funds`,
            status: 'content_ready',
            is_duplicate: false,
          })
          .select('id')
          .single()

        signalId = newSignal?.id
      }

      if (signalId) {
        const { data: newCard } = await supabase
          .from('research_cards')
          .insert({
            signal_id: signalId,
            observation: cleanTitle,
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
              topFundInflows: evaluation.topFundInflows.slice(0, 5),
              topFundOutflows: evaluation.topFundOutflows.slice(0, 5),
            },
            thesis: `Institutional capital allocation showed ${evaluation.isDivergence ? 'divergence between Bitcoin and altcoin ETFs' : 'directional conviction'} on ${date}.`,
            context_news: [],
          })
          .select('id')
          .single()

        if (newCard?.id) {
          researchId = newCard.id
        }
      }
    }

    // 8. Insert or Update content_drafts
    if (existingDraft && (options?.forceDate || options?.forceUpdateExisting)) {
      const { data: updatedDraft, error: updateError } = await supabase
        .from('content_drafts')
        .update({
          title: cleanTitle,
          body: cleanBody,
          status: 'draft',
        })
        .eq('id', existingDraft.id)
        .select('*')
        .single()

      if (updateError) {
        console.error('[etf-draft-service] Error updating draft:', updateError.message)
      } else if (updatedDraft) {
        createdDrafts.push(updatedDraft)
      }
    } else if (existingDraft) {
      skippedDates.push(date)
      continue
    } else {
      // Direct secondary guard against duplicates
      const { data: duplicateCheck } = await supabase
        .from('content_drafts')
        .select('id')
        .or(`title.ilike.%${date}%,title.ilike.%${datePattern}%,title.ilike.%${rawMonthDay}%`)
        .limit(1)
        .maybeSingle()

      if (duplicateCheck) {
        skippedDates.push(date)
        continue
      }

      const { data: newDraft, error: insertError } = await supabase
        .from('content_drafts')
        .insert({
          research_id: researchId,
          format: 'etf_watch',
          title: cleanTitle,
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
        console.error('[etf-draft-service] Error inserting draft:', insertError.message)
      } else if (newDraft) {
        createdDrafts.push(newDraft)
      }
    }
  }

  return {
    scannedDates: targetDates,
    createdCount: createdDrafts.length,
    createdDrafts,
    skippedDates,
  }
}
