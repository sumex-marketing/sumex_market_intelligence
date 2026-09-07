import { createClient } from '@/lib/supabase/server'
import MarketDeskWorkspace from './MarketDeskWorkspace'

export const dynamic = 'force-dynamic'

export default async function MarketDeskPage() {
  const supabase = await createClient()

  const [snapshotsRes, metricsRes, historyRes, assetsRes] = await Promise.all([
    supabase.from('latest_market_snapshots').select('*'),
    supabase.from('latest_market_metrics').select('*').single(),
    supabase
      .from('market_snapshots')
      .select('id, timestamp, price_usd, change_1h, change_24h, change_7d, market_cap_usd, volume_24h_usd, source, assets(symbol, name)')
      .order('timestamp', { ascending: false })
      .limit(30),
    supabase.from('assets').select('*').order('sort_order', { ascending: true }),
  ])

  const snapshots = snapshotsRes.data ?? []
  const metrics = metricsRes.data ?? null
  const recentHistory = historyRes.data ?? []
  const assets = assetsRes.data ?? []

  return (
    <MarketDeskWorkspace
      snapshots={snapshots}
      metrics={metrics}
      recentHistory={recentHistory}
      assets={assets}
    />
  )
}
