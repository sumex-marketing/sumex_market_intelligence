import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { autoGenerateEtfFlowDrafts } from '@/lib/services/etf-draft-service'
import { isAuthorizedCronOrUser } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleAutoGenerate(request)
}

export async function POST(request: Request) {
  return handleAutoGenerate(request)
}

async function handleAutoGenerate(request: Request) {
  if (!(await isAuthorizedCronOrUser(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  let forceDate: string | undefined = undefined
  let maxDays = 10

  try {
    const { searchParams } = new URL(request.url)
    const paramDate = searchParams.get('date')
    if (paramDate) forceDate = paramDate

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      if (body.date) forceDate = body.date
      if (body.maxDays) maxDays = body.maxDays
    }
  } catch {
    // ignore json parse error
  }

  try {
    const result = await autoGenerateEtfFlowDrafts(supabase, {
      forceDate,
      maxDays,
    })

    return NextResponse.json({
      success: true,
      scanned_dates: result.scannedDates,
      created_count: result.createdCount,
      created_drafts: result.createdDrafts,
      skipped_dates: result.skippedDates,
    })
  } catch (err: any) {
    console.error('[auto-generate-etf] Error:', err)
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to auto-generate ETF drafts' },
      { status: 500 }
    )
  }
}
