import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('macro_events')
    .select('*')
    .order('event_time_utc', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('macro_events')
    .insert({
      type: body.type ?? 'CPI',
      title: body.title,
      event_time_utc: body.event_time_utc,
      importance: body.importance ?? 'medium',
      forecast: body.forecast ?? null,
      previous: body.previous ?? null,
      actual: body.actual ?? null,
      official_url: body.official_url ?? null,
      status: body.status ?? 'planned',
      market_reaction_note: body.market_reaction_note ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
