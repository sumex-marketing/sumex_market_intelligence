import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTokenUnlocks,
  saveTokenUnlock,
  deleteTokenUnlock,
  deleteAllTokenUnlocks,
} from '@/lib/services/token-unlock-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  try {
    const summary = await getTokenUnlocks(supabase)
    return NextResponse.json(summary)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to fetch token unlocks' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    if (!body.token_name || !body.token_symbol || !body.unlock_date || body.est_value_usd == null) {
      return NextResponse.json(
        { error: 'token_name, token_symbol, unlock_date, and est_value_usd are required' },
        { status: 400 }
      )
    }

    const saved = await saveTokenUnlock(supabase, body)
    return NextResponse.json({ success: true, data: saved })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to save token unlock' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const id = body.id

    if (id) {
      await deleteTokenUnlock(supabase, id)
      return NextResponse.json({ success: true, message: `Deleted unlock ${id}` })
    }

    // Delete all
    const count = await deleteAllTokenUnlocks(supabase)
    return NextResponse.json({
      success: true,
      count,
      message: `Successfully deleted ${count} token unlock(s).`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Failed to delete token unlocks' },
      { status: 500 }
    )
  }
}
