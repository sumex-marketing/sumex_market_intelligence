import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMarketData, fetchGlobalMetrics, DEFAULT_COINGECKO_IDS } from '@/lib/sources/coingecko'
import { runSignalScan } from '@/lib/signals/engine'
import { isAuthorizedCronOrUser } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return await handleMarketDataSync(request)
}

export async function POST(request: Request) {
  return await handleMarketDataSync(request)
}

async function handleMarketDataSync(request: Request) {
  if (!(await isAuthorizedCronOrUser(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const jobName = 'fetch-market-data'

  // Log job run start
  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_name: jobName, status: 'running', started_at: now })
    .select('id')
    .single()

  try {
    // 1. Fetch assets from DB (or default watchlist)
    const { data: dbAssets } = await supabase
      .from('assets')
      .select('id, symbol, coingecko_id')
      .eq('active', true)

    const coinIds = (dbAssets?.map((a: { coingecko_id: string | null }) => a.coingecko_id).filter(Boolean) as string[]) ?? DEFAULT_COINGECKO_IDS

    // 2. Fetch prices from CoinGecko
    const cgRes = await fetchMarketData(coinIds.length > 0 ? coinIds : DEFAULT_COINGECKO_IDS)

    if (!cgRes.data) {
      throw new Error(`CoinGecko market error: ${cgRes.error}`)
    }

    // 3. Map asset IDs and insert snapshots
    const assetMap = new Map((dbAssets ?? []).map((a: { id: string; coingecko_id: string | null }) => [a.coingecko_id, a.id]))
    const snapshotRows = cgRes.data.map((c) => ({
      asset_id: assetMap.get(c.id) ?? dbAssets?.[0]?.id,
      timestamp: now,
      price_usd: c.current_price,
      change_1h: c.price_change_percentage_1h_in_currency,
      change_24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h,
      change_7d: c.price_change_percentage_7d_in_currency,
      market_cap_usd: c.market_cap,
      volume_24h_usd: c.total_volume,
      source: 'coingecko',
      source_timestamp: c.last_updated,
      fetched_at: now,
    })).filter((r) => r.asset_id != null)

    if (snapshotRows.length > 0) {
      await supabase.from('market_snapshots').insert(snapshotRows)
    }

    // 4. Fetch global metrics
    const globalRes = await fetchGlobalMetrics()
    if (globalRes.data) {
      await supabase.from('market_metrics').insert({
        timestamp: now,
        total_market_cap_usd: globalRes.data.total_market_cap.usd,
        btc_dominance: globalRes.data.market_cap_percentage.btc,
        eth_dominance: globalRes.data.market_cap_percentage.eth,
        total_volume_24h_usd: globalRes.data.total_volume.usd,
        source: 'coingecko',
        fetched_at: now,
      })
    }

    // 5. Update source status
    await supabase
      .from('sources')
      .update({
        last_success_at: now,
        last_http_status: cgRes.status,
        records_received: snapshotRows.length,
        data_timestamp: now,
        error_message: null,
      })
      .eq('name', 'CoinGecko')

    // 6. Run signal engine scan
    const signalRes = await runSignalScan()

    // Complete job run log
    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          records_processed: snapshotRows.length,
          metadata: { signals_created: signalRes.created },
        })
        .eq('id', job.id)
    }

    return NextResponse.json({
      success: true,
      records: snapshotRows.length,
      signalsCreated: signalRes.created,
    })
  } catch (err: any) {
    const errorMsg = err?.message ?? 'Unknown sync error'

    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: errorMsg,
        })
        .eq('id', job.id)
    }

    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}
