import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AnalysisPackage } from '@/lib/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: card, error } = await supabase
    .from('research_cards')
    .select('*, signals(*)')
    .eq('id', id)
    .single()

  if (error || !card) {
    return NextResponse.json({ error: 'Research Card not found' }, { status: 404 })
  }

  const systemInstruction = `
You are the lead crypto market intelligence analyst for Sumex. 
Analyze the provided market data, signal trigger details, macro context, ETF flows, and news.
Synthesize the information into a structured JSON analysis matching this schema EXACTLY:

{
  "what_changed": ["Key market/macro/ETF metric shifts"],
  "verified_facts": ["Fact 1", "Fact 2"],
  "interesting_relationships": ["Correlations or cross-asset shifts noticed"],
  "contradictions": ["Conflicting data signals"],
  "possible_explanations": [{"explanation": "Reason A", "confidence": 8}],
  "market_thesis": "One paragraph core thesis explaining the movement",
  "confidence_score": 8,
  "unsupported_claims": ["Unverified rumors"],
  "invalidation_conditions": ["Conditions under which this thesis fails"],
  "watch_next": ["Key metrics/catalysts to track over next 24-72h"],
  "content_angles": [
    {
      "hook": "Compelling headline hook",
      "insight": "Core takeaway",
      "format": "market_pulse",
      "evidence": ["Data point A", "Data point B"]
    }
  ],
  "editorial_recommendation": "PUBLISH_NOW"
}
`.trim()

  const analysisPackage: AnalysisPackage = {
    card_id: card.id,
    created_at: card.created_at,
    question: card.question,
    observation: card.observation,
    signal: card.signals
      ? {
          title: card.signals.title,
          type: card.signals.signal_type,
          subject: card.signals.subject,
          severity: card.signals.severity,
          score: card.signals.score,
          trigger_detail: card.signals.trigger_detail,
          evidence_summary: card.signals.evidence_summary,
        }
      : null,
    verified_facts: card.verified_facts ?? [],
    market_data_snapshot: card.market_data_snapshot ?? {},
    macro_context: card.macro_context ?? {},
    etf_context: card.etf_context ?? {},
    context_news: card.context_news ?? [],
    on_chain_data: card.on_chain_data ?? null,
    instruction: systemInstruction,
  }

  return NextResponse.json({ package: analysisPackage })
}
