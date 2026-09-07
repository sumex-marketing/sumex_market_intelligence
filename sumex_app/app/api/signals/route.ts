import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const severity = searchParams.get('severity')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const supabase = await createClient()
  let query = supabase.from('open_signals').select('*').limit(limit)

  if (status) {
    query = query.eq('status', status)
  }
  if (severity) {
    query = query.eq('severity', severity)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('signals')
    .insert({
      signal_type: body.signal_type ?? 'manual_catalyst',
      subject: body.subject ?? 'GENERAL',
      title: body.title,
      severity: body.severity ?? 'medium',
      score: body.score ?? 5,
      trigger_detail: body.trigger_detail ?? 'Manually created signal',
      evidence_summary: body.evidence_summary ?? '',
      status: 'new',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}
