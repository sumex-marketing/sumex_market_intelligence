import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isAuthorizedCronOrUser } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleDetection(request)
}

export async function POST(request: Request) {
  return handleDetection(request)
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DetectedSignal {
  signal_type: 'etf_flow' | 'macro_event' | 'price_move'
  subject: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  score: number
  trigger_detail: string
  evidence_summary: string
  verified_facts: { fact: string; source: string; timestamp: string }[]
  etf_context?: Record<string, unknown>
  macro_context?: Record<string, unknown>
  market_data_snapshot?: Record<string, unknown>
  observation: string
  question: string
}

// ─── Helper: format USD millions ──────────────────────────────────────────────
function fmtM(valM: number): string {
  const abs = Math.abs(valM)
  const sign = valM >= 0 ? '+' : '-'
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}B`
  return `${sign}$${abs.toFixed(1)}M`
}

// ─── Detector 1: ETF Flow Spike ───────────────────────────────────────────────
async function detectEtfFlowSpikes(
  supabase: ReturnType<typeof createServiceClient>
): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = []

  // Grab the last 2 recorded days of ETF totals per asset so we can detect spikes & reversals
  const { data: rows, error } = await supabase
    .from('etf_daily_totals')
    .select('date, asset, net_flow_usd, fund_count')
    .order('date', { ascending: false })
    .limit(20)

  if (error || !rows || rows.length === 0) {
    if (error) console.error('[detect-signals] etf_daily_totals query error:', error.message)
    return signals
  }

  // Group by asset
  const byAsset: Record<string, typeof rows> = {}
  for (const r of rows) {
    if (!byAsset[r.asset]) byAsset[r.asset] = []
    byAsset[r.asset].push(r)
  }

  for (const [asset, assetRows] of Object.entries(byAsset)) {
    const latest = assetRows[0]
    const prev = assetRows[1]
    // net_flow_usd is stored in raw dollars (e.g. 174600000 = $174.6M)
    const flowM = (latest?.net_flow_usd ?? 0) / 1_000_000
    const prevFlowM = prev ? (prev.net_flow_usd ?? 0) / 1_000_000 : 0
    const absFlowM = Math.abs(flowM)
    const direction = flowM >= 0 ? 'inflow' : 'outflow'

    // Spike thresholds
    let severity: DetectedSignal['severity'] | null = null
    let score = 5

    if (absFlowM >= 500) { severity = 'critical'; score = 9 }
    else if (absFlowM >= 300) { severity = 'high'; score = 8 }
    else if (absFlowM >= 150) { severity = 'medium'; score = 6 }

    // Flow reversal (sign flip with prev day > $50M magnitude)
    const isReversal = prev &&
      Math.abs(prevFlowM) >= 50 &&
      ((flowM >= 0 && prevFlowM < 0) || (flowM < 0 && prevFlowM >= 0))

    if (isReversal && !severity) {
      severity = 'medium'
      score = 6
    }

    if (!severity) continue

    const flowLabel = fmtM(flowM)
    const prevLabel = fmtM(prevFlowM)
    const reversalNote = isReversal
      ? ` (reversal from ${prevLabel} on ${prev?.date})`
      : ''

    const title = isReversal
      ? `${asset} ETF Flow Reversal: ${flowLabel} on ${latest.date}`
      : `${asset} ETF ${direction === 'inflow' ? 'Inflow' : 'Outflow'} Spike: ${flowLabel} on ${latest.date}`

    signals.push({
      signal_type: 'etf_flow',
      subject: asset,
      title,
      severity,
      score,
      trigger_detail: `${asset} spot ETF recorded ${flowLabel} net ${direction} on ${latest.date}${reversalNote}`,
      evidence_summary: `Net flow: ${flowLabel} | Prev day (${prev?.date ?? 'prior'}): ${prevLabel} | Funds reporting: ${latest.fund_count ?? 'all'}`,
      verified_facts: [
        {
          fact: `${asset} ETF net ${direction} of ${flowLabel} recorded on ${latest.date}`,
          source: 'Farside Investors / ETF Daily Totals',
          timestamp: new Date().toISOString(),
        },
        ...(isReversal
          ? [{
              fact: `Previous day flow was ${prevLabel} on ${prev?.date} (sign reversal detected)`,
              source: 'Farside Investors / ETF Daily Totals',
              timestamp: new Date().toISOString(),
            }]
          : []),
      ],
      etf_context: {
        date: latest.date,
        asset,
        net_flow_usd: latest.net_flow_usd,
        net_flow_millions: flowM,
        prev_date: prev?.date ?? null,
        prev_net_flow_millions: prevFlowM,
        is_reversal: isReversal,
        fund_count: latest.fund_count,
      },
      observation: title,
      question: isReversal
        ? `What triggered the ${asset} ETF flow reversal and is this a trend change or one-day anomaly?`
        : `What is driving the ${asset} ETF ${direction} spike of ${flowLabel} and what does it signal for near-term price action?`,
    })
  }

  return signals
}

// ─── Detector 2: Macro Event Surprise ────────────────────────────────────────
async function detectMacroSurprises(
  supabase: ReturnType<typeof createServiceClient>
): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = []

  // Released events from the last 72h with actual values
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const { data: events, error } = await supabase
    .from('macro_events')
    .select('*')
    .eq('status', 'released')
    .gte('actual_released_at', cutoff)
    .not('actual', 'is', null)
    .not('forecast', 'is', null)
    .order('actual_released_at', { ascending: false })
    .limit(10)

  if (error || !events || events.length === 0) {
    if (error) console.error('[detect-signals] macro_events query error:', error.message)
    return signals
  }

  const HIGH_IMPORTANCE = ['CPI', 'CORE_CPI', 'NFP', 'FOMC', 'FOMC_MINUTES', 'PCE', 'CORE_PCE', 'RATE_DECISION', 'PPI']

  for (const ev of events) {
    // Clean string numbers (e.g. "0.4%", "$120B", "2.5")
    const parseVal = (str: string | null): number => {
      if (!str) return NaN
      const clean = str.replace(/[^0-9.-]/g, '')
      return parseFloat(clean)
    }

    const actual = parseVal(ev.actual)
    const forecast = parseVal(ev.forecast)

    if (isNaN(actual) || isNaN(forecast) || forecast === 0) continue

    const deviationPct = Math.abs((actual - forecast) / Math.abs(forecast)) * 100
    const isHighImportance = HIGH_IMPORTANCE.includes(ev.type?.toUpperCase() ?? '') || ev.importance === 'high'
    const isBeat = actual > forecast
    const direction = isBeat ? 'beat' : 'missed'

    let severity: DetectedSignal['severity'] | null = null
    let score = 5

    if (deviationPct >= 40) { severity = 'critical'; score = 9 }
    else if (deviationPct >= 20) { severity = 'high'; score = 8 }
    else if (deviationPct >= 10 && isHighImportance) { severity = 'medium'; score = 6 }
    else if (isHighImportance && deviationPct < 5) { severity = 'low'; score = 4 }

    if (!severity) continue

    const eventName = ev.title ?? ev.type ?? 'Macro Release'
    const devStr = `${deviationPct.toFixed(1)}%`
    const title = `${eventName} ${direction === 'beat' ? 'Beat' : 'Miss'}: ${ev.actual} vs ${ev.forecast} forecast (${devStr} deviation)`

    signals.push({
      signal_type: 'macro_event',
      subject: 'MACRO',
      title,
      severity,
      score,
      trigger_detail: `${eventName} actual: ${ev.actual} vs forecast: ${ev.forecast} (${devStr} deviation)`,
      evidence_summary: `Actual: ${ev.actual} | Forecast: ${ev.forecast} | Previous: ${ev.previous ?? 'N/A'} | Deviation: ${devStr}`,
      verified_facts: [
        {
          fact: `${eventName} came in at ${ev.actual}, ${direction} the forecast of ${ev.forecast} by ${devStr}`,
          source: 'FMP Macro Calendar / BLS / Fed',
          timestamp: ev.actual_released_at ?? new Date().toISOString(),
        },
        ...(ev.previous
          ? [{
              fact: `Previous ${eventName} reading was ${ev.previous}`,
              source: 'FMP Macro Calendar',
              timestamp: ev.actual_released_at ?? new Date().toISOString(),
            }]
          : []),
      ],
      macro_context: {
        event_id: ev.id,
        type: ev.type,
        title: ev.title,
        event_time_utc: ev.event_time_utc,
        actual: ev.actual,
        forecast: ev.forecast,
        previous: ev.previous,
        deviation_pct: deviationPct,
        importance: ev.importance,
      },
      observation: title,
      question: `How will the ${eventName} ${direction} (${devStr} deviation from forecast) transmit into crypto markets and ETF flows?`,
    })
  }

  return signals
}

// ─── Detector 3: Price Move ───────────────────────────────────────────────────
async function detectPriceMoves(
  supabase: ReturnType<typeof createServiceClient>
): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = []

  const { data: snapshots, error } = await supabase
    .from('latest_market_snapshots')
    .select('symbol, price_usd, change_24h, change_7d, market_cap_usd, volume_24h_usd')
    .in('symbol', ['BTC', 'ETH', 'SOL', 'HYPE'])

  if (error || !snapshots) {
    if (error) console.error('[detect-signals] latest_market_snapshots query error:', error.message)
    return signals
  }

  for (const snap of snapshots) {
    const change = snap.change_24h ?? 0
    const absChange = Math.abs(change)

    let severity: DetectedSignal['severity'] | null = null
    let score = 5

    if (absChange >= 10) { severity = 'critical'; score = 9 }
    else if (absChange >= 6) { severity = 'high'; score = 8 }
    else if (absChange >= 3) { severity = 'medium'; score = 6 }

    if (!severity) continue

    const direction = change >= 0 ? 'up' : 'down'
    const symbol = snap.symbol
    const priceStr = snap.price_usd != null ? `$${snap.price_usd.toLocaleString('en-US', { maximumFractionDigits: snap.price_usd < 10 ? 4 : 2 })}` : 'N/A'
    const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
    const title = `${symbol} ${direction === 'up' ? 'up' : 'down'} ${changeStr} in 24h, price at ${priceStr}`

    signals.push({
      signal_type: 'price_move',
      subject: symbol,
      title,
      severity,
      score,
      trigger_detail: `${symbol} moved ${changeStr} in the past 24h to ${priceStr}`,
      evidence_summary: `24h change: ${changeStr} | 7d change: ${snap.change_7d != null ? `${snap.change_7d.toFixed(1)}%` : 'N/A'} | Volume: ${snap.volume_24h_usd != null ? `$${(snap.volume_24h_usd / 1e9).toFixed(2)}B` : 'N/A'}`,
      verified_facts: [
        {
          fact: `${symbol} price moved ${changeStr} in 24h to ${priceStr}`,
          source: 'CoinGecko / Market Snapshots',
          timestamp: new Date().toISOString(),
        },
        {
          fact: `${symbol} 24h volume: ${snap.volume_24h_usd != null ? `$${(snap.volume_24h_usd / 1e9).toFixed(2)}B` : 'unavailable'}`,
          source: 'CoinGecko / Market Snapshots',
          timestamp: new Date().toISOString(),
        },
      ],
      market_data_snapshot: {
        symbol,
        price_usd: snap.price_usd,
        change_24h: change,
        change_7d: snap.change_7d,
        market_cap_usd: snap.market_cap_usd,
        volume_24h_usd: snap.volume_24h_usd,
      },
      observation: title,
      question: `What is driving ${symbol}'s ${changeStr} 24h move and is there ETF flow or macro catalyst confirmation?`,
    })
  }

  return signals
}

// ─── Deduplication check ──────────────────────────────────────────────────────
async function isDuplicate(
  supabase: ReturnType<typeof createServiceClient>,
  signal_type: string,
  subject: string
): Promise<boolean> {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('signals')
    .select('id')
    .eq('signal_type', signal_type)
    .eq('subject', subject)
    .gte('created_at', windowStart)
    .eq('is_duplicate', false)
    .limit(1)

  return (data?.length ?? 0) > 0
}

// ─── Main detection executor ──────────────────────────────────────────────────
export async function executeSignalDetection(supabase: ReturnType<typeof createServiceClient>) {
  // Run all detectors in parallel
  const [etfSignals, macroSignals, priceSignals] = await Promise.all([
    detectEtfFlowSpikes(supabase),
    detectMacroSurprises(supabase),
    detectPriceMoves(supabase),
  ])

  const allDetected = [...etfSignals, ...macroSignals, ...priceSignals]

  let created = 0
  let skipped = 0
  const createdCards: string[] = []

  for (const detected of allDetected) {
    // Deduplication: skip if same type+subject signal exists in last 24h
    const dup = await isDuplicate(supabase, detected.signal_type, detected.subject)
    if (dup) {
      skipped++
      continue
    }

    // 1. Create signal
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .insert({
        signal_type: detected.signal_type,
        subject: detected.subject,
        title: detected.title,
        severity: detected.severity,
        score: detected.score,
        trigger_detail: detected.trigger_detail,
        evidence_summary: detected.evidence_summary,
        status: 'new',
        is_duplicate: false,
      })
      .select('id')
      .single()

    if (signalError || !signal) {
      console.error('[detect-signals] Failed to insert signal:', signalError?.message)
      continue
    }

    // 2. Create linked research card
    const { data: card, error: cardError } = await supabase
      .from('research_cards')
      .insert({
        signal_id: signal.id,
        created_by: null, // system-generated
        observation: detected.observation,
        question: detected.question,
        verified_facts: detected.verified_facts,
        etf_context: detected.etf_context ?? null,
        macro_context: detected.macro_context ?? null,
        market_data_snapshot: detected.market_data_snapshot ?? null,
        context_news: [],
      })
      .select('id')
      .single()

    if (cardError || !card) {
      console.error('[detect-signals] Failed to insert research card:', cardError?.message)
      // Clean up the signal we just created
      await supabase.from('signals').delete().eq('id', signal.id)
      continue
    }

    createdCards.push(card.id)
    created++
  }

  // Update source health for Sumex Signal Engine
  const updateTime = new Date().toISOString()
  await supabase
    .from('sources')
    .update({
      last_success_at: updateTime,
      last_http_status: 200,
      records_received: allDetected.length,
      data_timestamp: updateTime,
      error_message: null,
    })
    .eq('name', 'Sumex Signal Engine')

  return {
    detected: allDetected.length,
    created,
    skipped,
    card_ids: createdCards,
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handleDetection(request: Request) {
  if (!(await isAuthorizedCronOrUser(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const jobName = 'detect-signals'

  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_name: jobName, status: 'running', started_at: now })
    .select('id')
    .single()

  try {
    const result = await executeSignalDetection(supabase)

    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          records_processed: result.created,
        })
        .eq('id', job.id)
    }

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err: any) {
    const errorMsg = err?.message ?? 'Signal detection error'
    console.error('[detect-signals]', errorMsg)

    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: errorMsg,
        })
        .eq('id', job.id)
    }

    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
