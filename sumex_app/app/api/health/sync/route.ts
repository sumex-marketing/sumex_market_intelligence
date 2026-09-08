import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createServiceClient()

  try {
    const now = new Date().toISOString()
    
    // Check CoinGecko availability
    let cgStatus = 200
    try {
      const cgCheck = await fetch('https://api.coingecko.com/api/v3/ping', { cache: 'no-store' })
      cgStatus = cgCheck.status
    } catch {
      cgStatus = 503
    }

    if (cgStatus === 200) {
      await supabase
        .from('sources')
        .update({
          last_success_at: now,
          last_http_status: 200,
          data_timestamp: now,
          error_message: null,
        })
        .eq('name', 'CoinGecko')
    }

    // Refresh health status view
    const { data: sources, error } = await supabase
      .from('source_health')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ success: true, sources })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
