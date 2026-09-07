import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const [snapshotsRes, metricsRes, sourceHealthRes] = await Promise.all([
    supabase.from('latest_market_snapshots').select('*'),
    supabase.from('latest_market_metrics').select('*').single(),
    supabase.from('source_health').select('*'),
  ])

  return NextResponse.json({
    snapshots: snapshotsRes.data ?? [],
    metrics: metricsRes.data ?? null,
    sources: sourceHealthRes.data ?? [],
  })
}
