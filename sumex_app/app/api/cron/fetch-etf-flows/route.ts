import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeFarsideEtfFlows } from '@/lib/sources/farside'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return await handleEtfSync(request)
}

export async function POST(request: Request) {
  return await handleEtfSync(request)
}

async function handleEtfSync(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET &&
    process.env.NODE_ENV === 'production'
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const jobName = 'fetch-etf-flows'

  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_name: jobName, status: 'running', started_at: now })
    .select('id')
    .single()

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
      // Upsert into etf_flows table
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

    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          records_processed: allFlows.length,
        })
        .eq('id', job.id)
    }

    // Update source health for Farside Investors
    const now = new Date().toISOString()
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

    // Fire-and-forget: trigger signal detection after fresh ETF data lands
    const baseUrl = new URL(request.url).origin
    const cronSecret = process.env.CRON_SECRET ? `?secret=${process.env.CRON_SECRET}` : ''
    fetch(`${baseUrl}/api/cron/detect-signals${cronSecret}`, { method: 'POST' }).catch(() => {})

    return NextResponse.json({
      success: true,
      records: allFlows.length,
    })
  } catch (err: any) {
    const errorMsg = err?.message ?? 'ETF scrape error'

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
