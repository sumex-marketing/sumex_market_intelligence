import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/research/generate-cards
 *
 * Scans high-conviction signals and auto-creates research cards for any that
 * don't already have one. This is the manual "Generate Research Cards" trigger —
 * the same logic the cron uses, but invoked explicitly by the user so it always
 * runs fresh regardless of cleared_at timestamps.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const minScore: number = typeof body.minScore === 'number' ? body.minScore : 6.0

    // Fetch high-conviction signals
    const { data: signals, error: sigErr } = await supabase
      .from('signals')
      .select('id, title, subject, score, severity, status, trigger_detail, evidence_summary, created_at, signal_type')
      .or(`score.gte.${minScore},severity.in.(critical,high)`)
      .order('score', { ascending: false })
      .limit(20)

    if (sigErr) {
      return NextResponse.json({ error: sigErr.message }, { status: 500 })
    }

    if (!signals || signals.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: 0,
        message: 'No high-conviction signals found to generate research cards from.',
      })
    }

    // Fetch latest market snapshot, macro context, ETF context once
    const [snapshotsRes, macroRes, etfRes] = await Promise.all([
      supabase.from('latest_market_snapshots').select('*'),
      supabase.from('macro_events').select('*').order('event_time_utc', { ascending: false }).limit(5),
      supabase.from('etf_daily_totals').select('*').order('date', { ascending: false }).limit(10),
    ])

    let created = 0
    let skipped = 0
    const createdCards: Array<{ id: string; observation: string }> = []

    for (const sig of signals) {
      // Check if a research card already exists for this signal
      const { data: existing } = await supabase
        .from('research_cards')
        .select('id')
        .eq('signal_id', sig.id)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      // Build verified facts from available signal data
      const verifiedFacts: Array<{ fact: string }> = []
      if (sig.trigger_detail) verifiedFacts.push({ fact: sig.trigger_detail })
      if (sig.evidence_summary && sig.evidence_summary !== sig.trigger_detail) {
        verifiedFacts.push({ fact: sig.evidence_summary })
      }
      if (verifiedFacts.length === 0) verifiedFacts.push({ fact: sig.title })

      const { data: newCard, error: cardErr } = await supabase
        .from('research_cards')
        .insert({
          signal_id: sig.id,
          created_by: user.id,
          observation: sig.title,
          question: `What institutional drivers triggered this ${sig.subject} move and how does it shift market structure?`,
          thesis: sig.trigger_detail ?? sig.evidence_summary ?? 'Institutional liquidity anomaly detected — requires further investigation.',
          confidence: Math.min(10, Math.round(sig.score ?? 7)),
          verified_facts: verifiedFacts,
          market_data_snapshot: { snapshots: snapshotsRes.data ?? [] },
          macro_context: { events: macroRes.data ?? [] },
          etf_context: { flows: etfRes.data ?? [] },
          context_news: [],
        })
        .select('id, observation')
        .single()

      if (!cardErr && newCard) {
        created++
        createdCards.push({ id: newCard.id, observation: newCard.observation ?? sig.title })

        // Update signal status so it appears in research pipeline
        await supabase
          .from('signals')
          .update({ status: 'content_ready' })
          .eq('id', sig.id)
      }
    }

    let message = ''
    if (created === 0) {
      message = `All ${skipped} high-conviction signal(s) already have research cards.`
    } else {
      message = `Generated ${created} new research card(s). ${skipped > 0 ? `${skipped} already existed and were skipped.` : ''}`
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      cards: createdCards,
      message,
    })
  } catch (err: any) {
    console.error('[research/generate-cards] Error:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
