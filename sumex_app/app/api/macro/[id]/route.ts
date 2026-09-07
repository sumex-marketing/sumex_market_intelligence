import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (body.actual !== undefined) updateData.actual = body.actual
  if (body.actual && !body.actual_released_at) updateData.actual_released_at = new Date().toISOString()
  if (body.status !== undefined) updateData.status = body.status
  if (body.market_reaction_note !== undefined) updateData.market_reaction_note = body.market_reaction_note
  if (body.forecast !== undefined) updateData.forecast = body.forecast
  if (body.previous !== undefined) updateData.previous = body.previous

  const { data, error } = await supabase
    .from('macro_events')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('macro_events').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
