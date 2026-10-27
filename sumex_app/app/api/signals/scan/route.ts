import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runSignalScan } from '@/lib/signals/engine'
import { checkAndDraftAllPending } from '@/lib/services/draft-scanner-service'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runSignalScan()

  // Auto-populate drafts for freshly scanned signals & ETF flows
  try {
    const serviceClient = createServiceClient()
    await checkAndDraftAllPending(serviceClient, { maxEtfDays: 5, minSignalScore: 6.5 })
  } catch (err) {
    console.warn('[signals/scan] Auto-population notice:', err)
  }

  return NextResponse.json({ success: true, ...result })
}

