import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('research_cards')
    .select('*, signals(*)')
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

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (body.question !== undefined) updateData.question = body.question
  if (body.observation !== undefined) updateData.observation = body.observation
  if (body.verified_facts !== undefined) updateData.verified_facts = body.verified_facts
  if (body.context_news !== undefined) updateData.context_news = body.context_news
  if (body.on_chain_data !== undefined) updateData.on_chain_data = body.on_chain_data

  // Manual AI Analysis paste input
  if (body.ai_analysis !== undefined) {
    updateData.ai_analysis = body.ai_analysis
    updateData.ai_analyzed_at = new Date().toISOString()
    if (body.ai_analysis.market_thesis) updateData.thesis = body.ai_analysis.market_thesis
    if (body.ai_analysis.confidence_score != null) updateData.confidence = body.ai_analysis.confidence_score
    if (body.ai_analysis.invalidation_conditions) updateData.invalidation_conditions = JSON.stringify(body.ai_analysis.invalidation_conditions)
    if (body.ai_analysis.watch_next) updateData.next_watch = JSON.stringify(body.ai_analysis.watch_next)
  }

  // Editorial Decision
  if (body.editorial_decision !== undefined) {
    updateData.editorial_decision = body.editorial_decision
    updateData.editorial_note = body.editorial_note ?? null
    updateData.decided_by = user?.id ?? null
    updateData.decided_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('research_cards')
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

  const { error } = await supabase.from('research_cards').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
