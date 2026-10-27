import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('research_cards')
    .select('*, signals(title, subject, signal_type, score)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json()

  // Prevent duplicate research cards for the same signal
  if (body.signal_id) {
    const { data: existingCard } = await supabase
      .from('research_cards')
      .select('*')
      .eq('signal_id', body.signal_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingCard) {
      return NextResponse.json({ data: existingCard })
    }
  }

  // Fetch latest snapshot & macro context if creating from signal or scratch
  const [snapshotsRes, macroRes, etfRes] = await Promise.all([
    supabase.from('latest_market_snapshots').select('*'),
    supabase.from('macro_events').select('*').order('event_time_utc', { ascending: false }).limit(5),
    supabase.from('etf_daily_totals').select('*').order('date', { ascending: false }).limit(10),
  ])

  const { data, error } = await supabase
    .from('research_cards')
    .insert({
      signal_id: body.signal_id ?? null,
      created_by: user?.id ?? null,
      question: body.question ?? 'What caused this market move and how should we position?',
      observation: body.observation ?? body.title ?? 'Market anomaly detected',
      verified_facts: body.verified_facts ?? [],
      market_data_snapshot: { snapshots: snapshotsRes.data ?? [] },
      macro_context: { events: macroRes.data ?? [] },
      etf_context: { flows: etfRes.data ?? [] },
      context_news: body.context_news ?? [],
      on_chain_data: body.on_chain_data ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Update signal status to 'investigating'
  if (body.signal_id) {
    await supabase
      .from('signals')
      .update({ status: 'investigating' })
      .eq('id', body.signal_id)
  }

  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const ids: string[] | undefined = Array.isArray(body.ids) && body.ids.length > 0 ? body.ids : undefined

    let query = supabase.from('research_cards').delete({ count: 'exact' })

    if (ids && ids.length > 0) {
      query = query.in('id', ids)
    } else {
      // Delete all research cards
      query = query.neq('id', '00000000-0000-0000-0000-000000000000')
    }

    const { error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Record research_cleared_at when clearing all cards
    const now = new Date().toISOString()
    if (!ids) {
      await supabase.from('app_settings').upsert({
        key: 'research_cleared_at',
        value: now,
        description: 'Timestamp when all research cards were cleared',
        updated_at: now,
        updated_by: user.id,
      }, { onConflict: 'key' })
    }

    return NextResponse.json({
      success: true,
      count: count ?? 0,
      cleared_at: !ids ? now : undefined,
      message: `Successfully deleted ${count ?? 0} research card(s).`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

