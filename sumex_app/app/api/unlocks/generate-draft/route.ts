import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWeeklyUnlockDraft } from '@/lib/services/token-unlock-service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const weekLabel = body.weekLabel || 'Oct 26 - Nov 1'

    const result = await generateWeeklyUnlockDraft(supabase, {
      weekRangeLabel: weekLabel,
      authorId: user.id,
    })

    return NextResponse.json({
      success: true,
      draftId: result.draftId,
      title: result.title,
      body: result.body,
      message: `Weekly Token Unlocks social draft generated successfully!`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to generate token unlocks draft' },
      { status: 500 }
    )
  }
}
