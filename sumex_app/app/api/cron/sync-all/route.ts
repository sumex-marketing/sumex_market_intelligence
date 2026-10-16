import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMarketData, fetchGlobalMetrics, DEFAULT_COINGECKO_IDS } from '@/lib/sources/coingecko'
import { fetchCryptoNewsFeeds } from '@/lib/sources/news'
import { scrapeFarsideEtfFlows } from '@/lib/sources/farside'
import { fetchFmpMacroEvents } from '@/lib/sources/macro-calendar'
import { executeSignalDetection } from '@/app/api/cron/detect-signals/route'
import { isAuthorizedCronOrUser } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleSyncAll(request)
}

export async function POST(request: Request) {
  return handleSyncAll(request)
}

async function handleSyncAll(request: Request) {
  if (!(await isAuthorizedCronOrUser(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const jobName = 'sync-all'

  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_name: jobName, status: 'running', started_at: now })
    .select('id')
    .single()

  const results: {
    market_data: { success: boolean; records: number; error?: string }
    news: { success: boolean; records: number; error?: string }
    etf_flows: { success: boolean; records: number; error?: string }
    macro: { success: boolean; records: number; error?: string }
    signals: { success: boolean; detected: number; created: number; error?: string }
  } = {
    market_data: { success: false, records: 0 },
    news: { success: false, records: 0 },
    etf_flows: { success: false, records: 0 },
    macro: { success: false, records: 0 },
    signals: { success: false, detected: 0, created: 0 },
  }

  try {
    // 1. Concurrently run all primary data ingestions (Market data, News, ETF flows, Macro)
    const [marketRes, newsRes, etfRes, macroRes] = await Promise.allSettled([
      syncMarketData(supabase, now),
      syncNews(supabase, now),
      syncEtfFlows(supabase, now),
      syncMacroEvents(supabase, now),
    ])

    if (marketRes.status === 'fulfilled') {
      results.market_data = marketRes.value
    } else {
      results.market_data = { success: false, records: 0, error: marketRes.reason?.message ?? 'Market sync failed' }
    }

    if (newsRes.status === 'fulfilled') {
      results.news = newsRes.value
    } else {
      results.news = { success: false, records: 0, error: newsRes.reason?.message ?? 'News sync failed' }
    }

    if (etfRes.status === 'fulfilled') {
      results.etf_flows = etfRes.value
    } else {
      results.etf_flows = { success: false, records: 0, error: etfRes.reason?.message ?? 'ETF sync failed' }
    }

    if (macroRes.status === 'fulfilled') {
      results.macro = macroRes.value
    } else {
      results.macro = { success: false, records: 0, error: macroRes.reason?.message ?? 'Macro sync failed' }
    }

    // 2. Run signal detection once data feeds have updated
    try {
      const sigData = await executeSignalDetection(supabase)
      results.signals = {
        success: true,
        detected: sigData.detected,
        created: sigData.created,
      }
    } catch (sigErr: any) {
      results.signals = {
        success: false,
        detected: 0,
        created: 0,
        error: sigErr?.message ?? 'Signal detection error',
      }
    }

    const totalRecords =
      results.market_data.records +
      results.news.records +
      results.etf_flows.records +
      results.macro.records

    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          records_processed: totalRecords,
          metadata: results,
        })
        .eq('id', job.id)
    }

    return NextResponse.json({
      success: true,
      timestamp: now,
      summary: results,
    })
  } catch (err: any) {
    const errorMsg = err?.message ?? 'Universal sync encountered an unexpected error'
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
    return NextResponse.json({ success: false, error: errorMsg, summary: results }, { status: 500 })
  }
}

// ─── Sub-tasks ────────────────────────────────────────────────────────────────

async function syncMarketData(
  supabase: ReturnType<typeof createServiceClient>,
  now: string
): Promise<{ success: boolean; records: number; error?: string }> {
  try {
    const { data: dbAssets } = await supabase
      .from('assets')
      .select('id, symbol, coingecko_id')
      .eq('active', true)

    const coinIds =
      (dbAssets?.map((a: { coingecko_id: string | null }) => a.coingecko_id).filter(Boolean) as string[]) ??
      DEFAULT_COINGECKO_IDS

    const cgRes = await fetchMarketData(coinIds)
    if (!cgRes.data || cgRes.data.length === 0) {
      return { success: false, records: 0, error: 'Empty CoinGecko payload' }
    }

    const assetMap = new Map((dbAssets ?? []).map((a: { id: string; coingecko_id: string | null }) => [a.coingecko_id, a.id]))
    const snapshotRows = cgRes.data
      .map((c) => ({
        asset_id: assetMap.get(c.id),
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
      }))
      .filter((r): r is typeof r & { asset_id: string } => r.asset_id != null)

    if (snapshotRows.length > 0) {
      await supabase.from('market_snapshots').insert(snapshotRows)
    }

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

    return { success: true, records: snapshotRows.length }
  } catch (err: any) {
    return { success: false, records: 0, error: err?.message ?? 'Market data sync failed' }
  }
}

async function syncNews(
  supabase: ReturnType<typeof createServiceClient>,
  now: string
): Promise<{ success: boolean; records: number; error?: string }> {
  try {
    const newsItems = await fetchCryptoNewsFeeds()
    if (newsItems.length === 0) {
      return { success: true, records: 0 }
    }

    const rows = newsItems.map((n) => ({
      title: n.title,
      url: n.url,
      publisher: n.publisher,
      published_at: n.published_at,
      summary: n.summary,
      category: n.category,
      relevance_score: n.relevance_score,
      status: 'discovered',
      discovered_at: now,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('news_items')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      .select('id')

    if (insertErr) throw insertErr
    const newCount = inserted?.length ?? 0
    const processedCount = rows.length

    // Update source health for Crypto News Wire
    const { data: existingSource } = await supabase
      .from('sources')
      .select('id')
      .eq('name', 'Crypto News Wire')
      .maybeSingle()

    if (existingSource) {
      await supabase
        .from('sources')
        .update({
          last_success_at: now,
          last_http_status: 200,
          records_received: processedCount,
          data_timestamp: now,
          error_message: null,
        })
        .eq('id', existingSource.id)
    } else {
      await supabase
        .from('sources')
        .insert({
          name: 'Crypto News Wire',
          type: 'news',
          base_url: 'https://cointelegraph.com/rss',
          trust_level: 'structured',
          active: true,
          last_success_at: now,
          last_http_status: 200,
          records_received: processedCount,
          data_timestamp: now,
          error_message: null,
        })
    }

    return { success: true, records: newCount > 0 ? newCount : processedCount }
  } catch (err: any) {
    return { success: false, records: 0, error: err?.message ?? 'News sync failed' }
  }
}

async function syncEtfFlows(
  supabase: ReturnType<typeof createServiceClient>,
  now: string
): Promise<{ success: boolean; records: number; error?: string }> {
  try {
    const [btcScrape, ethScrape, solScrape, hypeScrape] = await Promise.all([
      scrapeFarsideEtfFlows('BTC'),
      scrapeFarsideEtfFlows('ETH'),
      scrapeFarsideEtfFlows('SOL'),
      scrapeFarsideEtfFlows('HYPE'),
    ])

    const allFlows = [
      ...btcScrape.data,
      ...ethScrape.data,
      ...solScrape.data,
      ...hypeScrape.data,
    ]

    if (allFlows.length > 0) {
      const rows = allFlows.map((f) => ({
        date: f.date,
        asset: f.asset,
        fund_ticker: f.fund_ticker,
        fund_name: f.fund_name,
        flow_usd: f.flow_usd,
        confidence: 'medium',
        fetched_at: now,
      }))

      await supabase.from('etf_flows').upsert(rows, {
        onConflict: 'date,asset,fund_ticker',
      })
    }

    await supabase
      .from('sources')
      .update({
        last_success_at: now,
        last_http_status: 200,
        records_received: allFlows.length,
        data_timestamp: now,
        error_message: null,
      })
      .eq('name', 'Farside Investors')

    return { success: true, records: allFlows.length }
  } catch (err: any) {
    return { success: false, records: 0, error: err?.message ?? 'ETF scrape failed' }
  }
}

async function syncMacroEvents(
  supabase: ReturnType<typeof createServiceClient>,
  now: string
): Promise<{ success: boolean; records: number; error?: string }> {
  try {
    const apiKey = process.env.FMP_API_KEY || ''
    const events = await fetchFmpMacroEvents(apiKey)

    let upserted = 0
    if (events.length > 0) {
      for (const ev of events) {
        const { data: existing } = await supabase
          .from('macro_events')
          .select('id, actual, status')
          .eq('type', ev.type)
          .gte('event_time_utc', new Date(new Date(ev.event_time_utc).getTime() - 3600_000).toISOString())
          .lte('event_time_utc', new Date(new Date(ev.event_time_utc).getTime() + 3600_000).toISOString())
          .maybeSingle()

        if (existing) {
          const update: Record<string, string | null> = {
            forecast: ev.forecast,
            previous: ev.previous,
            updated_at: now,
          }
          if (ev.actual && existing.status !== 'reaction_recorded') {
            update.actual = ev.actual
            update.actual_released_at = now
            update.status = 'released'
          }
          await supabase.from('macro_events').update(update).eq('id', existing.id)
        } else {
          await supabase.from('macro_events').insert({
            type: ev.type,
            title: ev.title,
            event_time_utc: ev.event_time_utc,
            importance: ev.importance,
            forecast: ev.forecast,
            previous: ev.previous,
            actual: ev.actual,
            actual_released_at: ev.actual ? now : null,
            status: ev.status,
            official_url: ev.official_url,
            created_at: now,
            updated_at: now,
          })
        }
        upserted++
      }
    }

    await supabase
      .from('sources')
      .update({
        last_success_at: now,
        last_http_status: 200,
        records_received: upserted,
        data_timestamp: now,
        error_message: null,
      })
      .eq('name', 'ForexFactory Macro')

    return { success: true, records: upserted }
  } catch (err: any) {
    return { success: false, records: 0, error: err?.message ?? 'Macro sync failed' }
  }
}
