import { createClient } from '@/lib/supabase/server'
import MacroCalendarWorkspace from './MacroCalendarWorkspace'

export const dynamic = 'force-dynamic'

export default async function MacroCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const resolvedParams = await searchParams
  const initialTab = resolvedParams?.tab === 'etf' ? 'etf' : 'calendar'
  const supabase = await createClient()

  const [eventsRes, etfTotalsRes, etfFlowsRes] = await Promise.all([
    supabase
      .from('macro_events')
      .select('*')
      .order('event_time_utc', { ascending: false }),
    supabase
      .from('etf_daily_totals')
      .select('*')
      .order('date', { ascending: false })
      .limit(100),
    supabase
      .from('etf_flows')
      .select('*')
      .order('date', { ascending: false })
      .order('asset', { ascending: true })
      .order('fund_ticker', { ascending: true })
      .limit(500),
  ])

  return (
    <div className="flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{
              background: 'linear-gradient(135deg, #e8edf5 30%, #23F7DD 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Macro & ETF Intelligence
          </h1>
          <p className="text-sm text-muted mt-1">
            Macroeconomic release calendar, actuals tracking, and Spot ETF flow monitoring
          </p>
        </div>
      </div>

      <MacroCalendarWorkspace
        events={eventsRes.data ?? []}
        etfTotals={etfTotalsRes.data ?? []}
        etfFlows={etfFlowsRes.data ?? []}
        initialTab={initialTab}
      />
    </div>
  )
}

