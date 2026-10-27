import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_drafts')
    .select('*, research_cards(observation, thesis)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('content_drafts')
    .insert({
      research_id: body.research_id ?? null,
      format: body.format ?? 'market_pulse',
      title: body.title ?? 'Untitled Intelligence Draft',
      body: body.body ?? '',
      source_list: body.source_list ?? [],
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
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

    let query = supabase.from('content_drafts').delete({ count: 'exact' })

    if (ids && ids.length > 0) {
      query = query.in('id', ids)
    } else {
      query = query.neq('id', '00000000-0000-0000-0000-000000000000') // matches all rows
    }

    const { error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Record drafts_cleared_at in app_settings so auto-page-load does not immediately resurrect deleted past drafts
    const now = new Date().toISOString()
    await supabase.from('app_settings').upsert({
      key: 'drafts_cleared_at',
      value: now,
      description: 'Timestamp when content drafts were deleted',
      updated_at: now,
      updated_by: user.id,
    }, { onConflict: 'key' })

    return NextResponse.json({
      success: true,
      count: count ?? ids?.length ?? 0,
      cleared_at: now,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to delete drafts' }, { status: 500 })
  }
}

