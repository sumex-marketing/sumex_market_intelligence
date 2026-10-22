import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAndDraftAllPending } from '@/lib/services/draft-scanner-service'
import { isAuthorizedCronOrUser } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleScanAndDraft(request)
}

export async function POST(request: Request) {
  return handleScanAndDraft(request)
}

async function handleScanAndDraft(request: Request) {
  if (!(await isAuthorizedCronOrUser(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  let forceDate: string | undefined = undefined
  let maxEtfDays = 14
  let minSignalScore = 6.5

  try {
    const { searchParams } = new URL(request.url)
    const paramDate = searchParams.get('date')
    if (paramDate) forceDate = paramDate

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      if (body.date) forceDate = body.date
      if (body.maxEtfDays) maxEtfDays = body.maxEtfDays
      if (body.minSignalScore) minSignalScore = body.minSignalScore
    }
  } catch {
    // ignore parse error
  }

  try {
    const result = await checkAndDraftAllPending(supabase, {
      forceDate,
      maxEtfDays,
      minSignalScore,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err: any) {
    console.error('[scan-and-draft] Error:', err)
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Failed to scan and generate drafts' },
      { status: 500 }
    )
  }
}
