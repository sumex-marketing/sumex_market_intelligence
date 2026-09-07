import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runSignalScan } from '@/lib/signals/engine'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runSignalScan()
  return NextResponse.json({ success: true, ...result })
}
