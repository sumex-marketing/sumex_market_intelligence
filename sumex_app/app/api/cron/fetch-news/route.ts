import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchCryptoNewsFeeds } from '@/lib/sources/news'
import { isAuthorizedCronOrUser } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleNewsSync(request)
}

export async function POST(request: Request) {
  return handleNewsSync(request)
}

async function handleNewsSync(request: Request) {
  if (!(await isAuthorizedCronOrUser(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const jobName = 'fetch-news'

  // Start job log
  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_name: jobName, status: 'running', started_at: now })
    .select('id')
    .single()

  try {
    const newsItems = await fetchCryptoNewsFeeds()

    if (newsItems.length === 0) {
      if (job?.id) {
        await supabase
          .from('job_runs')
          .update({ status: 'success', finished_at: new Date().toISOString(), records_processed: 0 })
          .eq('id', job.id)
      }
      return NextResponse.json({ success: true, count: 0, message: 'No new articles found' })
    }

    // Upsert items into news_items table, ignoring existing URLs
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

    if (insertErr) {
      throw insertErr
    }

    const newCount = inserted?.length ?? 0
    const processedCount = rows.length

    // Update job run
    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          records_processed: processedCount,
        })
        .eq('id', job.id)
    }

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

    return NextResponse.json({
      success: true,
      records: newCount > 0 ? newCount : processedCount,
      newArticles: newCount,
      totalChecked: processedCount,
      timestamp: now,
    })
  } catch (err: any) {
    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq('id', job.id)
    }

    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
