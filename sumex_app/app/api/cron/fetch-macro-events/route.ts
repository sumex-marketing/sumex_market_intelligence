import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchFmpMacroEvents } from '@/lib/sources/macro-calendar'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleMacroSync(request)
}

export async function POST(request: Request) {
  return handleMacroSync(request)
}

async function handleMacroSync(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET &&
    process.env.NODE_ENV === 'production'
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FMP_API_KEY || ''

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const jobName = 'fetch-macro-events'

  const { data: job } = await supabase
    .from('job_runs')
    .insert({ job_name: jobName, status: 'running', started_at: now })
    .select('id')
    .single()

  try {
    const events = await fetchFmpMacroEvents(apiKey)

    let upserted = 0

    if (events.length > 0) {
      // Upsert based on type + event_time_utc (unique constraint)
      // We don't blindly overwrite actuals the user may have manually corrected
      for (const ev of events) {
        const { data: existing } = await supabase
          .from('macro_events')
          .select('id, actual, status')
          .eq('type', ev.type)
          .gte('event_time_utc', new Date(new Date(ev.event_time_utc).getTime() - 3600_000).toISOString())
          .lte('event_time_utc', new Date(new Date(ev.event_time_utc).getTime() + 3600_000).toISOString())
          .maybeSingle()

        if (existing) {
          // Update forecast/previous/actual only if not manually corrected
          const update: Record<string, string | null> = {
            forecast: ev.forecast,
            previous: ev.previous,
            updated_at: now,
          }
          // Only overwrite actual if FMP has new data and user hasn't set manual status
          if (ev.actual && existing.status !== 'reaction_recorded') {
            update.actual = ev.actual
            update.actual_released_at = now
            update.status = 'released'
          }
          await supabase.from('macro_events').update(update).eq('id', existing.id)
        } else {
          // New event — insert it
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

    if (job?.id) {
      await supabase
        .from('job_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          records_processed: upserted,
        })
        .eq('id', job.id)
    }

    // Update source health for ForexFactory Macro
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

    // Fire-and-forget: trigger signal detection after fresh macro data lands
    const baseUrl = new URL(request.url).origin
    const cronSecret = process.env.CRON_SECRET ? `?secret=${process.env.CRON_SECRET}` : ''
    fetch(`${baseUrl}/api/cron/detect-signals${cronSecret}`, { method: 'POST' }).catch(() => {})

    return NextResponse.json({ success: true, events_processed: upserted })

  } catch (err: any) {
    const errorMsg = err?.message ?? 'Macro calendar fetch error'

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
