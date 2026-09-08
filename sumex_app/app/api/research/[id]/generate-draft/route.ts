import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtM(val: number | null | undefined): string {
  if (val == null) return 'N/A'
  const abs = Math.abs(val)
  const sign = val >= 0 ? '+' : '-'
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}B`
  return `${sign}$${abs.toFixed(0)}M`
}

// ─── Live-data context builder ─────────────────────────────────────────────────
function buildLiveContext(
  etfTotals: Record<string, any>[],
  macroEvents: Record<string, any>[]
): string {
  let out = ''

  // ── ETF Flows section ────────────────────────────────────────────────────────
  if (etfTotals.length > 0) {
    // Group by asset
    const byAsset: Record<string, Record<string, any>[]> = {}
    for (const row of etfTotals) {
      const asset = row.asset ?? 'BTC'
      if (!byAsset[asset]) byAsset[asset] = []
      byAsset[asset].push(row)
    }

    out += '\n## LIVE ETF FLOW DATA (Last 5 Trading Days)\n'
    for (const [asset, rows] of Object.entries(byAsset)) {
      out += `\n### ${asset} Spot ETF Flows\n`
      out += '| Date | Net Flow | Cumulative Total |\n'
      out += '|------|----------|------------------|\n'
      for (const r of rows.slice(0, 5)) {
        out += `| ${r.date} | ${fmtM(r.total_net_flow)} | ${fmtM(r.cumulative_total)} |\n`
      }
      // 5-day sum
      const fiveDaySum = rows.slice(0, 5).reduce((s: number, r: any) => s + (r.total_net_flow ?? 0), 0)
      out += `\n**5-Day Net Flow: ${fmtM(fiveDaySum)}**\n`
    }
  }

  // ── Macro Calendar section ───────────────────────────────────────────────────
  if (macroEvents.length > 0) {
    out += '\n## UPCOMING MACRO EVENTS (Next 7 Days)\n'
    out += '| Event | Date | Forecast | Previous | Impact |\n'
    out += '|-------|------|----------|----------|--------|\n'
    for (const e of macroEvents.slice(0, 8)) {
      const date = e.event_time_utc ? new Date(e.event_time_utc).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : 'N/A'
      const forecast = e.forecast_value != null ? e.forecast_value : 'N/A'
      const previous = e.previous_value != null ? e.previous_value : 'N/A'
      const impact = e.importance ?? e.impact ?? 'medium'
      out += `| ${e.event_name ?? e.event_type} | ${date} | ${forecast} | ${previous} | ${impact.toUpperCase()} |\n`
    }
  }

  return out
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(
  card: Record<string, any>,
  format: string,
  liveContext: string
): string {
  const signal = card.signals
  const facts = (card.verified_facts ?? []).map((f: any) => `• ${f.fact ?? f}`).join('\n')
  const news = (card.context_news ?? []).map((n: any) => `• ${n.title} (${n.url})`).join('\n')
  const thesis = card.thesis ?? card.question ?? card.observation ?? 'Market signal detected'

  const formatInstructions: Record<string, string> = {
    market_pulse: `Write a concise "Market Pulse" intelligence brief. Target ~200 words. Structure:
1. **One-line hook** (what happened)
2. **What it means** (2-3 sentences core insight)
3. **Key data points** (bullet list of 3-5 verified facts - use the live ETF flow numbers where relevant)
4. **Watch next** (1-2 sentences on what to monitor, referencing upcoming macro events)
Use a sharp, institutional-analyst voice. No hype, just data-driven intelligence.`,

    why_it_moved: `Write a "Why It Moved" deep-dive explaining the catalyst chain. Target ~300 words. Structure:
1. **The Move** (describe price/flow action - cite live ETF flow data)
2. **Catalyst Chain** (what triggered what - macro to ETF to price)
3. **Supporting Evidence** (cite the verified facts)
4. **What bears watching** (invalidation conditions or follow-through signals, reference upcoming macro events)
Analytical, structured, institutional voice.`,

    macro_to_crypto: `Write a "Macro to Crypto" briefing explaining how macro conditions are impacting crypto. Target ~250 words. Structure:
1. **Macro Backdrop** (Fed, rates, DXY context - cite any relevant upcoming macro events)
2. **Crypto Transmission** (how macro is flowing into crypto via ETF - use live flow numbers)
3. **Key Signal** (this specific observation)
4. **Forward Look** (next macro catalyst to watch - reference the macro calendar data)
Professional, cross-asset analyst voice.`,

    etf_watch: `Write an "ETF Watch" intelligence note focused on Bitcoin/Ethereum spot ETF flows. Target ~200 words. Structure:
1. **Flow Headline** (net inflow/outflow summary - use live ETF flow data prominently)
2. **Trend** (5-day flow trend from the live data)
3. **Price Impact** (correlation to BTC price action)
4. **What it signals** (institutional sentiment reading)
Data-driven, use the live numbers throughout.`,

    week_ahead: `Write a "Week Ahead" macro preview. Target ~300 words. Structure:
1. **Key Events This Week** (pull from the live macro calendar data - list specific events, dates, and forecasts)
2. **Market Positioning** (where crypto markets are heading into the week - reference ETF flows)
3. **Signals to Watch** (BTC/ETH levels, ETF flow momentum from live data)
4. **Base Case** (most likely scenario)
Forward-looking, preview format.`,
  }

  const formatGuide = formatInstructions[format] ?? formatInstructions.market_pulse

  return `You are the lead market intelligence analyst at Sumex, a professional crypto market intelligence platform.

## RESEARCH CARD CONTEXT

**Signal/Observation:** ${signal?.title ?? card.observation ?? 'Market Signal'}
**Asset:** ${signal?.subject ?? 'BTC'}
**Signal Type:** ${signal?.signal_type ?? 'manual_catalyst'}
**Severity:** ${signal?.severity ?? 'medium'}
**Relevance Score:** ${signal?.score ?? 'N/A'}/10
**Trigger Detail:** ${signal?.trigger_detail ?? card.question ?? 'See observation below'}

**Core Thesis:** ${thesis}

**Verified Facts:**
${facts || '- No specific facts logged yet'}

**Context News:**
${news || '- No news items linked'}

**AI Analysis Summary:** ${card.ai_analysis?.market_thesis ?? 'Not yet analyzed'}
**Confidence:** ${card.confidence ?? 'N/A'}/10
${liveContext}
## TASK

${formatGuide}

## RULES
- Write ONLY the article body. No meta commentary.
- Do not include "DRAFT" or "FOR INTERNAL USE" headers.
- Use markdown formatting (##, **, bullet lists).
- Start directly with the article hook - no preamble.
- **NEVER use em dashes (the character --) anywhere in your output. Use a regular hyphen (-) or rewrite the sentence instead.**
- **IMPORTANT: Actively integrate the LIVE ETF FLOW DATA and MACRO EVENTS into your draft where relevant.** Reference actual flow numbers, dates, and event names - this is what makes Sumex intelligence unique.
- Keep it concise and data-driven. Sumex intelligence is precise, not padded.
`
}

// ─── Structured fallback generator ────────────────────────────────────────────
function generateStructuredFallback(
  card: Record<string, any>,
  format: string,
  etfTotals: Record<string, any>[],
  macroEvents: Record<string, any>[]
): string {
  const signal = card.signals
  const subject = signal?.subject ?? 'BTC'
  const title = signal?.title ?? card.observation ?? 'Market Signal Detected'
  const thesis = card.thesis ?? card.question ?? 'See research card for full context.'
  const facts = (card.verified_facts ?? []).slice(0, 5).map((f: any) => `- ${f.fact ?? f}`)
  const watchNext = card.ai_analysis?.watch_next ?? []
  const invalidation = card.ai_analysis?.invalidation_conditions ?? []

  // Build live snippets
  const latestEtfRow = etfTotals[0]
  const etfSnippet = latestEtfRow
    ? `- ${latestEtfRow.asset ?? 'BTC'} ETF Net Flow (${latestEtfRow.date}): ${fmtM(latestEtfRow.total_net_flow)}`
    : null
  const nextEvent = macroEvents[0]
  const macroSnippet = nextEvent
    ? `- Upcoming: **${nextEvent.event_name ?? nextEvent.event_type}** - ${nextEvent.event_time_utc ? new Date(nextEvent.event_time_utc).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : 'TBD'}`
    : null

  const liveDataLines = [etfSnippet, macroSnippet].filter(Boolean).join('\n')

  if (format === 'market_pulse') {
    return `## ${title}

${thesis}

### Key Data Points
${facts.length > 0 ? facts.join('\n') : '- Signal data pending verification'}
${liveDataLines ? `\n### Live Market Context\n${liveDataLines}` : ''}

### What To Watch
${watchNext.length > 0
  ? watchNext.slice(0, 3).map((w: string) => `- ${w}`).join('\n')
  : `- Monitor ${subject} price action over the next 24-48h\n- Track ETF flow continuation\n- Watch macro calendar for risk events`}

### Invalidation
${invalidation.length > 0
  ? invalidation.slice(0, 2).map((c: string) => `- ${c}`).join('\n')
  : `- Thesis invalidates if ${subject} reverses below key support without volume`}

*Intelligence compiled by Sumex Market Intelligence Platform*`
  }

  return `## ${title}

**Asset:** ${subject} - **Severity:** ${signal?.severity ?? 'medium'}

${thesis}

### Supporting Evidence
${facts.length > 0 ? facts.join('\n') : '- Awaiting verified data inputs'}
${liveDataLines ? `\n### Live Market Context\n${liveDataLines}` : ''}

### Forward Indicators
${watchNext.length > 0
  ? watchNext.map((w: string) => `- ${w}`).join('\n')
  : '- Continue monitoring for follow-through signal'}

*Draft generated by Sumex Intelligence Engine*`
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json().catch(() => ({}))
  const format: string = body.format ?? 'market_pulse'

  // 1. Fetch the research card with signal context
  const { data: card, error: cardError } = await supabase
    .from('research_cards')
    .select('*, signals(*)')
    .eq('id', id)
    .single()

  if (cardError || !card) {
    return NextResponse.json({ error: 'Research card not found' }, { status: 404 })
  }

  // 2. Fetch live context data in parallel
  const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const [etfTotalsRes, macroEventsRes] = await Promise.all([
    supabase
      .from('etf_daily_totals')
      .select('date, asset, total_net_flow, cumulative_total')
      .order('date', { ascending: false })
      .order('asset', { ascending: true })
      .limit(20), // last ~10 trading days per asset
    supabase
      .from('macro_events')
      .select('event_name, event_type, event_time_utc, forecast_value, previous_value, importance, actual_value')
      .in('status', ['upcoming', 'planned'])
      .gte('event_time_utc', now)
      .lte('event_time_utc', sevenDaysAhead)
      .order('event_time_utc', { ascending: true })
      .limit(10),
  ])

  const etfTotals: Record<string, any>[] = etfTotalsRes.data ?? []
  const macroEvents: Record<string, any>[] = macroEventsRes.data ?? []

  const cardTitle = card.signals?.title ?? card.observation ?? 'Intelligence Report'
  const formatLabel = format.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  let draftBody = ''
  let generatedByAi = false

  // 3. Try AI generation (Google Gemini or OpenAI)
  const googleApiKey = process.env.GOOGLE_AI_API_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY
  const aiProvider = process.env.AI_PROVIDER ?? 'google'

  const liveContext = buildLiveContext(etfTotals, macroEvents)
  const prompt = buildPrompt(card, format, liveContext)

  try {
    if (googleApiKey && (aiProvider === 'google' || !openaiApiKey)) {
      // Google Gemini
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        }
      )

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json()
        draftBody = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (draftBody) generatedByAi = true
      }
    } else if (openaiApiKey) {
      // OpenAI fallback
      const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1200,
          temperature: 0.7,
        }),
      })

      if (oaiRes.ok) {
        const oaiData = await oaiRes.json()
        draftBody = oaiData?.choices?.[0]?.message?.content ?? ''
        if (draftBody) generatedByAi = true
      }
    }
  } catch (aiErr) {
    console.error('[AI Draft] Generation failed:', aiErr)
  }

  // 4. Fallback to structured template if AI unavailable
  if (!draftBody) {
    draftBody = generateStructuredFallback(card, format, etfTotals, macroEvents)
  }

  // 5. Save draft to content_drafts
  const { data: draft, error: draftError } = await supabase
    .from('content_drafts')
    .insert({
      research_id: id,
      format,
      title: `${formatLabel}: ${cardTitle}`,
      body: draftBody,
      source_list: (card.context_news ?? []).map((n: any) => n.url).filter(Boolean),
      status: 'draft',
      generated_by_ai: generatedByAi,
    })
    .select('*')
    .single()

  if (draftError) {
    // Handle missing column gracefully
    const { data: draft2, error: draftError2 } = await supabase
      .from('content_drafts')
      .insert({
        research_id: id,
        format,
        title: `${formatLabel}: ${cardTitle}`,
        body: draftBody,
        source_list: (card.context_news ?? []).map((n: any) => n.url).filter(Boolean),
        status: 'draft',
      })
      .select('*')
      .single()

    if (draftError2) {
      return NextResponse.json({ error: draftError2.message }, { status: 400 })
    }

    return NextResponse.json({ data: draft2, generatedByAi, liveDataInjected: { etfRows: etfTotals.length, macroEvents: macroEvents.length } })
  }

  return NextResponse.json({ data: draft, generatedByAi, liveDataInjected: { etfRows: etfTotals.length, macroEvents: macroEvents.length } })
}
