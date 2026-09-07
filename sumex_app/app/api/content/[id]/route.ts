import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('content_drafts')
    .select('*, research_cards(*)')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json()

  const updateData: Record<string, any> = {}

  if (body.title !== undefined) updateData.title = body.title
  if (body.body !== undefined) updateData.body = body.body
  if (body.format !== undefined) updateData.format = body.format
  if (body.source_list !== undefined) updateData.source_list = body.source_list

  if (body.status !== undefined) {
    updateData.status = body.status
    if (body.status === 'approved') {
      updateData.approved_at = new Date().toISOString()
      updateData.approved_by = user?.id ?? null
    } else if (body.status === 'rejected') {
      updateData.rejected_at = new Date().toISOString()
      updateData.rejected_by = user?.id ?? null
      if (body.rejection_note) updateData.rejection_note = body.rejection_note
    }
  }

  const { data, error } = await supabase
    .from('content_drafts')
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

  const { error } = await supabase.from('content_drafts').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
