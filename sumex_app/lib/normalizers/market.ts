/**
 * Market Snapshot Normaliser
 *
 * Takes raw CoinGecko data and writes normalised records to Supabase.
 * Runs SERVER-SIDE ONLY (scheduled job / API route).
 */

import { createServiceClient } from '../supabase/server'
import { fetchMarketData, fetchGlobalMetrics } from '../sources/coingecko'
import { CoinGeckoMarketData } from '../types'

interface NormaliserResult {
  success: boolean
  assetsProcessed: number
  metricsWritten: boolean
  error: string | null
}

export async function runMarketSnapshot(): Promise<NormaliserResult> {
  const supabase = createServiceClient()

  // 1. Load active assets with coingecko IDs
  const { data: assets, error: assetError } = await supabase
    .from('assets')
    .select('id, symbol, coingecko_id')
    .eq('active', true)
    .not('coingecko_id', 'is', null)

  if (assetError || !assets?.length) {
    return { success: false, assetsProcessed: 0, metricsWritten: false, error: assetError?.message ?? 'No active assets found' }
  }

  const coinIds = assets.map((a: { coingecko_id: string | null }) => a.coingecko_id!).filter(Boolean)
  const now = new Date().toISOString()

  // 2. Fetch market data
  const { data: marketData, status, error: fetchError } = await fetchMarketData(coinIds)

  // 3. Update source health record
  await supabase.from('sources').update({
    last_success_at: marketData ? now : undefined,
    last_error_at: marketData ? undefined : now,
    last_http_status: status,
    records_received: marketData?.length ?? 0,
    data_timestamp: marketData ? now : undefined,
    error_message: fetchError,
    updated_at: now,
  }).eq('name', 'CoinGecko')

  if (!marketData) {
    return { success: false, assetsProcessed: 0, metricsWritten: false, error: fetchError }
  }

  // 4. Build a map: coingecko_id -> asset row
  type AssetRow = { id: string; symbol: string; coingecko_id: string | null }
  const assetMap = new Map<string, AssetRow>()
  for (const a of assets as AssetRow[]) {
    if (a.coingecko_id) assetMap.set(a.coingecko_id, a)
  }

  // 5. Insert market_snapshots
  const snapshots = marketData
    .map((coin: CoinGeckoMarketData) => {
      const asset = assetMap.get(coin.id)
      if (!asset) return null
      return {
        asset_id: asset.id,
        timestamp: now,
        price_usd: coin.current_price,
        change_1h: coin.price_change_percentage_1h_in_currency,
        change_24h: coin.price_change_percentage_24h_in_currency,
        change_7d: coin.price_change_percentage_7d_in_currency,
        market_cap_usd: coin.market_cap,
        volume_24h_usd: coin.total_volume,
        source: 'coingecko',
        source_timestamp: coin.last_updated,
        fetched_at: now,
      }
    })
    .filter(Boolean)

  const { error: snapError } = await supabase.from('market_snapshots').insert(snapshots)
  if (snapError) {
    return { success: false, assetsProcessed: 0, metricsWritten: false, error: snapError.message }
  }

  // 6. Fetch and store global metrics
  let metricsWritten = false
  const { data: global } = await fetchGlobalMetrics()
  if (global) {
    const { error: metricError } = await supabase.from('market_metrics').insert({
      timestamp: now,
      total_market_cap_usd: global.total_market_cap.usd,
      btc_dominance: global.market_cap_percentage.btc,
      eth_dominance: global.market_cap_percentage.eth,
      total_volume_24h_usd: global.total_volume.usd,
      source: 'coingecko',
      source_timestamp: new Date(global.updated_at * 1000).toISOString(),
      fetched_at: now,
    })
    metricsWritten = !metricError
  }

  return {
    success: true,
    assetsProcessed: snapshots.length,
    metricsWritten,
    error: null,
  }
}
