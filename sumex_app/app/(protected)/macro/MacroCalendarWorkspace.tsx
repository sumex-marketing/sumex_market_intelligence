'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MacroEvent, MacroEventType, MacroImportance } from '@/lib/types'
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
} from 'lucide-react'
import CryptoIcon from '@/app/components/CryptoIcon'
import { createClient } from '@/lib/supabase/client'

interface MacroCalendarWorkspaceProps {
  events: MacroEvent[]
  etfTotals: Array<{
    date: string
    asset: string
    net_flow_usd: number | null
    fund_count: number
  }>
  etfFlows: Array<{
    id: string
    date: string
    asset: string
    fund_ticker: string
    fund_name: string
    flow_usd: number | null
    confidence: string
  }>
  initialTab?: 'calendar' | 'etf'
}

function formatFlow(usd: number | null, allowDashForZero = false) {
  if (usd == null) return 'N/A'
  if (usd === 0) return allowDashForZero ? 'N/A' : '$0.0M'
  const abs = Math.abs(usd)
  const prefix = usd > 0 ? '+' : usd < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${prefix}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(0)}K`
  return `${prefix}$${abs.toFixed(0)}`
}

export default function MacroCalendarWorkspace({
  events,
  etfTotals,
  etfFlows,
  initialTab = 'calendar',
}: MacroCalendarWorkspaceProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'calendar' | 'etf'>(initialTab)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<MacroEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [syncingEtf, setSyncingEtf] = useState(false)
  const [syncingMacro, setSyncingMacro] = useState(false)
  const [selectedEtfAsset, setSelectedEtfAsset] = useState<'ALL' | 'BTC' | 'ETH' | 'SOL' | 'HYPE'>('ALL')

  // Local events state — kept in sync via Supabase Realtime
  const [localEvents, setLocalEvents] = useState<MacroEvent[]>(events)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  // Sync if the server re-fetches new data (e.g. after router.refresh())
  useEffect(() => {
    setLocalEvents(events)
  }, [events])

  // Supabase Realtime subscription for macro_events
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('macro-events-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'macro_events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLocalEvents((prev) => {
              // Avoid duplicates (e.g. after router.refresh() race)
              if (prev.some((e) => e.id === (payload.new as MacroEvent).id)) return prev
              return [...prev, payload.new as MacroEvent].sort(
                (a, b) => new Date(b.event_time_utc).getTime() - new Date(a.event_time_utc).getTime()
              )
            })
          } else if (payload.eventType === 'UPDATE') {
            setLocalEvents((prev) =>
              prev.map((e) => (e.id === (payload.new as MacroEvent).id ? (payload.new as MacroEvent) : e))
            )
          } else if (payload.eventType === 'DELETE') {
            setLocalEvents((prev) => prev.filter((e) => e.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // New Event Form State
  const [type, setType] = useState<MacroEventType>('CPI')
  const [title, setTitle] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [importance, setImportance] = useState<MacroImportance>('high')
  const [forecast, setForecast] = useState('')
  const [previous, setPrevious] = useState('')

  // Edit Actual State
  const [actual, setActual] = useState('')
  const [reactionNote, setReactionNote] = useState('')

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !eventTime) return
    setLoading(true)

    try {
      const res = await fetch('/api/macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          event_time_utc: new Date(eventTime).toISOString(),
          importance,
          forecast: forecast || null,
          previous: previous || null,
        }),
      })

      if (res.ok) {
        setShowAddModal(false)
        setTitle('')
        setEventTime('')
        setForecast('')
        setPrevious('')
        router.refresh()
      } else {
        alert('Failed to add macro event')
      }
    } catch {
      alert('Error creating event')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveActual = async () => {
    if (!editingEvent) return
    setLoading(true)

    try {
      const res = await fetch(`/api/macro/${editingEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual,
          status: 'released',
          market_reaction_note: reactionNote,
        }),
      })

      if (res.ok) {
        setEditingEvent(null)
        setActual('')
        setReactionNote('')
        // Realtime subscription will update the row automatically — no need for router.refresh()
      } else {
        alert('Failed to update event')
      }
    } catch {
      alert('Error updating event')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/macro/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`Failed to delete event: ${data.error ?? res.statusText}`)
        return
      }
      // Realtime subscription handles removing the row from localEvents — no router.refresh() needed
      setLocalEvents((prev) => prev.filter((e) => e.id !== id))
    } catch {
      alert('Error deleting event')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSyncEtfFlows = async () => {
    setSyncingEtf(true)
    try {
      const res = await fetch('/api/cron/fetch-etf-flows', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        alert(`ETF sync returned: ${data.error ?? 'Unknown error'}`)
      }
    } catch {
      alert('Error triggering ETF sync')
    } finally {
      setSyncingEtf(false)
    }
  }

  const handleSyncMacroEvents = async () => {
    setSyncingMacro(true)
    try {
      const res = await fetch('/api/cron/fetch-macro-events', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        // Fetch fresh events directly to guarantee the UI updates immediately
        // (router.refresh() alone can sometimes not re-propagate props in App Router)
        const eventsRes = await fetch('/api/macro', { credentials: 'include' })
        if (eventsRes.ok) {
          const { data: freshEvents } = await eventsRes.json()
          if (Array.isArray(freshEvents)) {
            setLocalEvents(freshEvents)
          }
        }
        router.refresh()
      } else if (data.error?.includes('FMP_API_KEY')) {
        alert(
          'FMP API key not configured.\n\nGet your free key at:\nhttps://financialmodelingprep.com/developer/docs\n\nThen add it to .env.local as:\nFMP_API_KEY=your_key_here'
        )
      } else {
        alert(`Macro sync error: ${data.error ?? 'Unknown error'}`)
      }
    } catch {
      alert('Error triggering macro sync')
    } finally {
      setSyncingMacro(false)
    }
  }

  const filteredFlows = etfFlows.filter((f) =>
    selectedEtfAsset === 'ALL' ? true : f.asset === selectedEtfAsset
  )

  // Group filtered flows by date for daily subtotals
  const flowsByDate = filteredFlows.reduce<Record<string, typeof filteredFlows>>((acc, f) => {
    if (!acc[f.date]) acc[f.date] = []
    acc[f.date].push(f)
    return acc
  }, {})
  const sortedDates = Object.keys(flowsByDate).sort((a, b) => b.localeCompare(a))

  // Latest BTC, ETH, SOL, & HYPE total flow
  const latestBtcTotal = etfTotals.find((t) => t.asset === 'BTC')
  const latestEthTotal = etfTotals.find((t) => t.asset === 'ETH')
  const latestSolTotal = etfTotals.find((t) => t.asset === 'SOL')
  const latestHypeTotal = etfTotals.find((t) => t.asset === 'HYPE')

  const latestDate =
    latestBtcTotal?.date ?? latestEthTotal?.date ?? latestSolTotal?.date ?? latestHypeTotal?.date ?? 'Latest'
  const combinedLatestFlow =
    (latestBtcTotal?.net_flow_usd ?? 0) +
    (latestEthTotal?.net_flow_usd ?? 0) +
    (latestSolTotal?.net_flow_usd ?? 0) +
    (latestHypeTotal?.net_flow_usd ?? 0)
  const combinedFundCount =
    (latestBtcTotal?.fund_count ?? 0) +
    (latestEthTotal?.fund_count ?? 0) +
    (latestSolTotal?.fund_count ?? 0) +
    (latestHypeTotal?.fund_count ?? 0)

  return (
    <div className="flex-col gap-6">
      {/* ── Sub-Navigation Tabs ── */}
      <div className="flex items-center justify-between">
        <div className="tabs">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
            style={{
              color: activeTab === 'calendar' ? '#23F7DD' : undefined,
              fontWeight: 700,
            }}
          >
            <Calendar size={14} style={{ display: 'inline', marginRight: 6 }} />
            Macro Calendar ({localEvents.length})
            <span
              title={realtimeConnected ? 'Live — auto-updating' : 'Connecting to live feed…'}
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: realtimeConnected ? '#23F7DD' : '#888',
                marginLeft: 7,
                verticalAlign: 'middle',
                boxShadow: realtimeConnected ? '0 0 6px #23F7DD' : 'none',
                animation: realtimeConnected ? 'pulse-dot 2s infinite' : 'none',
              }}
            />
          </button>
          <button
            onClick={() => setActiveTab('etf')}
            className={`tab ${activeTab === 'etf' ? 'active' : ''}`}
            style={{
              color: activeTab === 'etf' ? '#8E33FF' : undefined,
              fontWeight: 700,
            }}
          >
            <Layers size={14} style={{ display: 'inline', marginRight: 6 }} />
            Spot ETF Flows ({etfFlows.length})
          </button>
        </div>

        {activeTab === 'calendar' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncMacroEvents}
              className="btn btn-ghost btn-sm"
              disabled={syncingMacro}
              title="Auto-fetch CPI, NFP, FOMC and more from Financial Modeling Prep (free)"
              style={{ color: '#23F7DD', fontSize: '0.8rem' }}
            >
              <RefreshCw size={13} className={syncingMacro ? 'spin' : ''} />
              {syncingMacro ? 'Syncing...' : 'Auto-Sync'}
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
              <Plus size={15} /> Add Macro Event
            </button>
          </div>
        ) : (
          <button
            onClick={handleSyncEtfFlows}
            className="btn btn-purple btn-sm"
            disabled={syncingEtf}
          >
            <RefreshCw size={14} className={syncingEtf ? 'spin' : ''} />
            {syncingEtf ? 'Syncing...' : 'Sync ETF Flows'}
          </button>
        )}
      </div>

      {/* ── Tab 1: Macro Calendar ── */}
      {activeTab === 'calendar' && (
        <>
          {localEvents.length === 0 ? (
            <div className="card empty-state">
              <Calendar className="empty-state-icon" />
              <div className="empty-state-title">No Macro Events Scheduled</div>
              <div className="empty-state-desc">
                Add upcoming CPI, FOMC, or Employment releases to the calendar.
              </div>
            </div>
          ) : (
            <div className="card p-0" style={{ overflow: 'hidden' }}>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Event Date (UTC)</th>
                      <th>Type</th>
                      <th>Event Title</th>
                      <th>Importance</th>
                      <th>Previous</th>
                      <th>Forecast</th>
                      <th title="The released value of the economic indicator once published">Released Value</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td className="td-mono text-xs font-semibold text-primary">
                          {new Date(ev.event_time_utc).toUTCString().replace(' GMT', '')}
                        </td>
                        <td>
                          <span className="badge badge-purple">{ev.type}</span>
                        </td>
                        <td className="font-semibold text-primary">{ev.title}</td>
                        <td>
                          <span className={`badge badge-${ev.importance}`}>{ev.importance}</span>
                        </td>
                        <td className="td-mono text-muted">{ev.previous ?? 'N/A'}</td>
                        <td className="td-mono text-muted">{ev.forecast ?? 'N/A'}</td>
                        <td className="td-mono font-bold" style={{ color: ev.actual ? '#23F7DD' : undefined }}>
                          {ev.actual
                            ? ev.actual
                            : new Date(ev.event_time_utc) < new Date()
                            ? <span className="text-muted font-normal italic" title="Event has passed — actual not captured by auto-sync">Not recorded</span>
                            : <span className="text-muted font-normal italic">Pending</span>
                          }
                        </td>
                        <td>
                          {(() => {
                            const s = ev.status
                            const cls =
                              s === 'released' || s === 'reaction_recorded'
                                ? 'badge-green'
                                : s === 'upcoming'
                                ? 'badge-purple'
                                : s === 'archived'
                                ? 'badge-muted'
                                : 'badge-muted'
                            const label =
                              s === 'reaction_recorded'
                                ? 'recorded'
                                : s
                            return <span className={`badge ${cls}`}>{label}</span>
                          })()}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingEvent(ev)
                                setActual(ev.actual ?? '')
                                setReactionNote(ev.market_reaction_note ?? '')
                              }}
                              className="btn btn-ghost btn-sm"
                              style={{ color: '#23F7DD' }}
                            >
                              <Edit2 size={13} /> Result
                            </button>
                            <button
                              onClick={() => handleDelete(ev.id, ev.title)}
                              className="btn btn-ghost btn-sm text-red"
                              disabled={deletingId === ev.id}
                              title="Delete this macro event"
                            >
                              {deletingId === ev.id ? (
                                <RefreshCw size={13} className="spin" />
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab 2: ETF Flows ── */}
      {activeTab === 'etf' && (
        <div className="flex-col gap-6">
          {/* Latest Daily Net Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            {/* ALL ETFs TOTAL */}
            <div
              className="card"
              style={{
                borderColor: 'rgba(35,247,221,0.35)',
                background: 'linear-gradient(135deg, rgba(35,247,221,0.08), rgba(142,51,255,0.08))',
                position: 'relative',
                padding: '16px 18px',
                boxShadow: '0 8px 24px -6px rgba(35,247,221,0.1)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, rgba(35,247,221,0.2), rgba(142,51,255,0.2))',
                      border: '1px solid rgba(35,247,221,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#23F7DD',
                      flexShrink: 0,
                    }}
                  >
                    <Layers size={16} />
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    All Spot ETFs
                  </span>
                </div>
                <span className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {latestDate}
                </span>
              </div>

              <div
                className="metric-value mt-2"
                style={{
                  color: combinedLatestFlow >= 0 ? 'var(--green)' : 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                }}
              >
                {combinedLatestFlow >= 0 ? (
                  <ArrowUpRight size={22} />
                ) : (
                  <ArrowDownRight size={22} />
                )}
                {formatFlow(combinedLatestFlow)}
              </div>
              <div className="text-xs text-muted mt-2 flex items-center gap-1.5" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#23F7DD]" />
                <span>{combinedFundCount} tracked institutional funds</span>
              </div>
            </div>

            {/* BTC */}
            <div
              className="card"
              style={{
                borderColor: 'rgba(247,147,26,0.3)',
                background: 'linear-gradient(180deg, rgba(247,147,26,0.06) 0%, rgba(20,24,33,0.85) 100%)',
                position: 'relative',
                padding: '16px 18px',
                boxShadow: '0 8px 24px -6px rgba(247,147,26,0.1)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CryptoIcon symbol="BTC" name="Bitcoin" size={28} />
                  <div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', lineHeight: 1.1 }}>
                      Bitcoin Spot
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#F7931A', fontWeight: 600 }}>BTC</span>
                  </div>
                </div>
                <span className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {latestBtcTotal?.date ?? 'Latest'}
                </span>
              </div>

              <div
                className="metric-value mt-2"
                style={{
                  color: (latestBtcTotal?.net_flow_usd ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                }}
              >
                {(latestBtcTotal?.net_flow_usd ?? 0) >= 0 ? (
                  <ArrowUpRight size={22} />
                ) : (
                  <ArrowDownRight size={22} />
                )}
                {formatFlow(latestBtcTotal?.net_flow_usd ?? 0)}
              </div>
              <div className="text-xs text-muted mt-2 flex items-center gap-1.5" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#F7931A]" />
                <span>{latestBtcTotal?.fund_count ?? 0} institutional spot funds</span>
              </div>
            </div>

            {/* ETH */}
            <div
              className="card"
              style={{
                borderColor: 'rgba(98,126,234,0.3)',
                background: 'linear-gradient(180deg, rgba(98,126,234,0.06) 0%, rgba(20,24,33,0.85) 100%)',
                position: 'relative',
                padding: '16px 18px',
                boxShadow: '0 8px 24px -6px rgba(98,126,234,0.1)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CryptoIcon symbol="ETH" name="Ethereum" size={28} />
                  <div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', lineHeight: 1.1 }}>
                      Ethereum Spot
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#8299F8', fontWeight: 600 }}>ETH</span>
                  </div>
                </div>
                <span className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {latestEthTotal?.date ?? 'Latest'}
                </span>
              </div>

              <div
                className="metric-value mt-2"
                style={{
                  color: (latestEthTotal?.net_flow_usd ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                }}
              >
                {(latestEthTotal?.net_flow_usd ?? 0) >= 0 ? (
                  <ArrowUpRight size={22} />
                ) : (
                  <ArrowDownRight size={22} />
                )}
                {formatFlow(latestEthTotal?.net_flow_usd ?? 0)}
              </div>
              <div className="text-xs text-muted mt-2 flex items-center gap-1.5" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#8299F8]" />
                <span>{latestEthTotal?.fund_count ?? 0} institutional spot funds</span>
              </div>
            </div>

            {/* SOL */}
            <div
              className="card"
              style={{
                borderColor: 'rgba(153,69,255,0.3)',
                background: 'linear-gradient(180deg, rgba(153,69,255,0.06) 0%, rgba(20,24,33,0.85) 100%)',
                position: 'relative',
                padding: '16px 18px',
                boxShadow: '0 8px 24px -6px rgba(153,69,255,0.1)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CryptoIcon symbol="SOL" name="Solana" size={28} />
                  <div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', lineHeight: 1.1 }}>
                      Solana ETP
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#A855F7', fontWeight: 600 }}>SOL</span>
                  </div>
                </div>
                <span className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {latestSolTotal?.date ?? 'Latest'}
                </span>
              </div>

              <div
                className="metric-value mt-2"
                style={{
                  color: (latestSolTotal?.net_flow_usd ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                }}
              >
                {(latestSolTotal?.net_flow_usd ?? 0) >= 0 ? (
                  <ArrowUpRight size={22} />
                ) : (
                  <ArrowDownRight size={22} />
                )}
                {formatFlow(latestSolTotal?.net_flow_usd ?? 0)}
              </div>
              <div className="text-xs text-muted mt-2 flex items-center gap-1.5" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]" />
                <span>{latestSolTotal?.fund_count ?? 0} institutional trusts & ETPs</span>
              </div>
            </div>

            {/* HYPE */}
            <div
              className="card"
              style={{
                borderColor: 'rgba(35,247,221,0.3)',
                background: 'linear-gradient(180deg, rgba(35,247,221,0.06) 0%, rgba(20,24,33,0.85) 100%)',
                position: 'relative',
                padding: '16px 18px',
                boxShadow: '0 8px 24px -6px rgba(35,247,221,0.1)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CryptoIcon symbol="HYPE" name="Hyperliquid" size={28} />
                  <div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', lineHeight: 1.1 }}>
                      Hyperliquid
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#23F7DD', fontWeight: 600 }}>HYPE</span>
                  </div>
                </div>
                <span className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {latestHypeTotal?.date ?? 'Latest'}
                </span>
              </div>

              <div
                className="metric-value mt-2"
                style={{
                  color: (latestHypeTotal?.net_flow_usd ?? 0) >= 0 ? 'var(--green)' : 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                }}
              >
                {(latestHypeTotal?.net_flow_usd ?? 0) >= 0 ? (
                  <ArrowUpRight size={22} />
                ) : (
                  <ArrowDownRight size={22} />
                )}
                {formatFlow(latestHypeTotal?.net_flow_usd ?? 0)}
              </div>
              <div className="text-xs text-muted mt-2 flex items-center gap-1.5" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#23F7DD]" />
                <span>{latestHypeTotal?.fund_count ?? 0} vault & index products</span>
              </div>
            </div>
          </div>

          {/* ETF Flows Table with Asset Filter */}
          <div className="card p-0" style={{ overflow: 'hidden' }}>
            <div
              className="flex items-center justify-between"
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(142,51,255,0.04)',
              }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={16} color="#8E33FF" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Institutional Fund Flow Log
                </span>
                <span className="badge badge-purple" style={{ fontSize: '0.82rem' }}>
                  {filteredFlows.length} entries
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: 'ALL', label: 'All Assets', icon: <Layers size={14} /> },
                  { key: 'BTC', label: 'Bitcoin', icon: <CryptoIcon symbol="BTC" size={16} /> },
                  { key: 'ETH', label: 'Ethereum', icon: <CryptoIcon symbol="ETH" size={16} /> },
                  { key: 'SOL', label: 'Solana', icon: <CryptoIcon symbol="SOL" size={16} /> },
                  { key: 'HYPE', label: 'Hyperliquid', icon: <CryptoIcon symbol="HYPE" size={16} /> },
                ].map((item) => {
                  const isSelected = selectedEtfAsset === item.key
                  return (
                    <button
                      key={item.key}
                      onClick={() => setSelectedEtfAsset(item.key as any)}
                      className="btn btn-sm flex items-center gap-1.5 transition-all"
                      style={{
                        fontSize: '0.82rem',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(35,247,221,0.2) 0%, rgba(142,51,255,0.2) 100%)'
                          : 'rgba(255,255,255,0.04)',
                        borderColor: isSelected ? 'rgba(35,247,221,0.5)' : 'rgba(255,255,255,0.08)',
                        color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                        fontWeight: isSelected ? 700 : 500,
                        boxShadow: isSelected ? '0 0 10px rgba(35,247,221,0.15)' : 'none',
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '105px', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ width: '100px', whiteSpace: 'nowrap' }}>Asset</th>
                    <th style={{ width: '90px', whiteSpace: 'nowrap' }}>Ticker</th>
                    <th>Institutional Fund Name</th>
                    <th style={{ textAlign: 'right', width: '140px', whiteSpace: 'nowrap' }}>Fund Net Flow</th>
                    <th style={{ textAlign: 'right', width: '150px', whiteSpace: 'nowrap' }}>Asset Daily Total</th>
                    <th style={{ width: '90px', whiteSpace: 'nowrap' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-muted">
                        No ETF flow records ingested. Click &quot;Sync ETF Flows&quot; above.
                      </td>
                    </tr>
                  ) : (
                    sortedDates.flatMap((date) => {
                      const rows = flowsByDate[date]
                      const dayTotal = rows.reduce((sum, f) => sum + (f.flow_usd ?? 0), 0)
                      const isDayPositive = dayTotal > 0
                      const isDayZero = dayTotal === 0

                      // Standard asset display ordering: BTC, ETH, SOL, HYPE
                      const assetOrder: Array<'BTC' | 'ETH' | 'SOL' | 'HYPE'> = ['BTC', 'ETH', 'SOL', 'HYPE']
                      const activeAssets = assetOrder.filter((a) => rows.some((r) => r.asset === a))

                      return [
                        // If viewing ALL assets, render a prominent date summary banner
                        ...(selectedEtfAsset === 'ALL'
                          ? [
                              <tr
                                key={`date-header-${date}`}
                                style={{
                                  background: 'linear-gradient(90deg, rgba(142,51,255,0.09), rgba(35,247,221,0.05))',
                                  borderTop: '2px solid rgba(142,51,255,0.3)',
                                }}
                              >
                                <td colSpan={7} style={{ padding: '8px 16px' }}>
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-3">
                                      <span
                                        className="font-bold text-xs"
                                        style={{ color: '#23F7DD', fontFamily: 'var(--font-mono)' }}
                                      >
                                        📅 {date}
                                      </span>
                                      <span style={{ color: 'var(--border-strong)' }}>|</span>
                                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        All ETFs Combined Net Flow:
                                      </span>
                                      <span
                                        className="font-bold text-sm"
                                        style={{
                                          color: isDayZero
                                            ? 'var(--text-muted)'
                                            : isDayPositive
                                            ? 'var(--green)'
                                            : 'var(--red)',
                                          fontFamily: 'var(--font-mono)',
                                        }}
                                      >
                                        {formatFlow(dayTotal)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs flex-wrap" style={{ fontFamily: 'var(--font-mono)' }}>
                                      {activeAssets.map((a) => {
                                        const aTotal = rows
                                          .filter((r) => r.asset === a)
                                          .reduce((sum, f) => sum + (f.flow_usd ?? 0), 0)
                                        return (
                                          <div
                                            key={a}
                                            className="flex items-center gap-1.5 px-2 py-0.5 rounded"
                                            style={{
                                              background: 'rgba(255,255,255,0.05)',
                                              border: '1px solid rgba(255,255,255,0.08)',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            <CryptoIcon symbol={a} size={14} />
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{a}:</span>
                                            <span style={{ color: aTotal >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                                              {formatFlow(aTotal)}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>,
                            ]
                          : []),

                        // Fund rows grouped cleanly by asset with exact asset daily totals
                        ...activeAssets.flatMap((asset, aIdx) => {
                          const assetRows = rows.filter((r) => r.asset === asset)
                          const assetTotal = assetRows.reduce((sum, f) => sum + (f.flow_usd ?? 0), 0)
                          const isAssetPositive = assetTotal > 0
                          const isAssetZero = assetTotal === 0

                          return assetRows.map((flow, idx) => {
                            const flowUsd = flow.flow_usd ?? 0
                            const isPositive = flowUsd > 0
                            const isZero = flowUsd === 0

                            const assetColor =
                              flow.asset === 'BTC'
                                ? '#F7931A'
                                : flow.asset === 'ETH'
                                ? '#8299F8'
                                : flow.asset === 'SOL'
                                ? '#A855F7'
                                : '#23F7DD'

                            return (
                              <tr key={flow.id}>
                                {/* Date only shown on first row of date */}
                                <td className="td-mono text-xs font-semibold text-primary" style={{ whiteSpace: 'nowrap' }}>
                                  {aIdx === 0 && idx === 0 ? date : ''}
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <div className="flex items-center gap-2">
                                    <CryptoIcon symbol={flow.asset} size={20} />
                                    <span
                                      className="font-bold text-xs"
                                      style={{
                                        fontFamily: 'var(--font-mono)',
                                        color: assetColor,
                                      }}
                                    >
                                      {flow.asset}
                                    </span>
                                  </div>
                                </td>
                                <td className="td-mono font-bold" style={{ color: '#23F7DD', whiteSpace: 'nowrap' }}>
                                  <span
                                    style={{
                                      padding: '2px 7px',
                                      borderRadius: 5,
                                      background: 'rgba(35,247,221,0.08)',
                                      border: '1px solid rgba(35,247,221,0.2)',
                                      fontSize: '0.82rem',
                                    }}
                                  >
                                    {flow.fund_ticker}
                                  </span>
                                </td>
                                <td className="text-secondary text-xs" style={{ whiteSpace: 'nowrap' }}>
                                  {flow.fund_name}
                                </td>
                                <td
                                  className="td-mono font-bold"
                                  style={{
                                    textAlign: 'right',
                                    whiteSpace: 'nowrap',
                                    paddingRight: 16,
                                    color: isZero
                                      ? 'var(--text-muted)'
                                      : isPositive
                                      ? 'var(--green)'
                                      : 'var(--red)',
                                  }}
                                >
                                  {formatFlow(flow.flow_usd, true)}
                                </td>
                                {/* Asset daily subtotal spanned across this asset's funds */}
                                {idx === 0 ? (
                                  <td
                                    rowSpan={assetRows.length}
                                    className="td-mono font-bold"
                                    style={{
                                      textAlign: 'right',
                                      verticalAlign: 'middle',
                                      whiteSpace: 'nowrap',
                                      color: isAssetZero
                                        ? 'var(--text-muted)'
                                        : isAssetPositive
                                        ? 'var(--green)'
                                        : 'var(--red)',
                                      background: isAssetZero
                                        ? 'transparent'
                                        : isAssetPositive
                                        ? 'rgba(0,220,130,0.06)'
                                        : 'rgba(255,80,80,0.06)',
                                      borderLeft: `2px solid ${
                                        isAssetZero
                                          ? 'var(--border-subtle)'
                                          : isAssetPositive
                                          ? 'rgba(0,220,130,0.4)'
                                          : 'rgba(255,80,80,0.4)'
                                      }`,
                                      fontSize: '0.96rem',
                                      paddingRight: 18,
                                    }}
                                  >
                                    <div>{formatFlow(assetTotal)}</div>
                                    <div
                                      className="flex items-center justify-end gap-1.5 mt-1"
                                      style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        color: 'var(--text-muted)',
                                        letterSpacing: '0.03em',
                                      }}
                                    >
                                      <CryptoIcon symbol={asset} size={13} />
                                      <span>{asset} Daily Total</span>
                                    </div>
                                  </td>
                                ) : null}
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <span className="badge badge-muted" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                                    Verified
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        }),

                        // Thin separator row between date groups
                        <tr
                          key={`sep-${date}`}
                          style={{
                            height: 4,
                            background: 'rgba(255,255,255,0.03)',
                          }}
                        >
                          <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--border-subtle)' }} />
                        </tr>,
                      ]
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Macro Event Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <form
            onSubmit={handleCreateEvent}
            className="card-glass flex-col gap-4"
            style={{ width: '100%', maxWidth: '500px' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-primary">Add Macro Event</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn btn-ghost btn-sm"
              >
                ✕
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Event Type</label>
              <select
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                {[
                  { v: 'CPI', l: 'CPI' },
                  { v: 'CORE_CPI', l: 'Core CPI' },
                  { v: 'PCE', l: 'PCE' },
                  { v: 'CORE_PCE', l: 'Core PCE' },
                  { v: 'FOMC', l: 'FOMC Meeting' },
                  { v: 'RATE_DECISION', l: 'Rate Decision' },
                  { v: 'FOMC_MINUTES', l: 'FOMC Minutes' },
                  { v: 'FOMC_PRESSER', l: 'FOMC Press Conference' },
                  { v: 'NFP', l: 'Nonfarm Payrolls' },
                  { v: 'ADP_EMPLOYMENT', l: 'ADP Employment' },
                  { v: 'UNEMPLOYMENT_CLAIMS', l: 'Unemployment Claims' },
                  { v: 'JOLTS', l: 'JOLTS Job Openings' },
                  { v: 'PPI', l: 'PPI' },
                  { v: 'GDP', l: 'GDP' },
                  { v: 'RETAIL_SALES', l: 'Retail Sales' },
                  { v: 'CORE_RETAIL_SALES', l: 'Core Retail Sales' },
                  { v: 'CONSUMER_CONFIDENCE', l: 'Consumer Confidence' },
                  { v: 'CONSUMER_SENTIMENT', l: 'Consumer Sentiment' },
                  { v: 'ISM_MANUFACTURING', l: 'ISM Manufacturing PMI' },
                  { v: 'ISM_SERVICES', l: 'ISM Services PMI' },
                  { v: 'TRADE_BALANCE', l: 'Trade Balance' },
                  { v: 'OTHER', l: 'Other' },
                ].map(({ v, l }) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Event Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. US CPI Inflation YoY"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Release Time (Local / UTC)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                required
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Previous Value</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 3.1%"
                  value={previous}
                  onChange={(e) => setPrevious(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Forecast Consensus</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2.9%"
                  value={forecast}
                  onChange={(e) => setForecast(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Actual Result Modal */}
      {editingEvent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            className="card-glass flex-col gap-4"
            style={{ width: '100%', maxWidth: '500px' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-primary">
                Record Actual Release: {editingEvent.title}
              </h2>
              <button
                onClick={() => setEditingEvent(null)}
                className="btn btn-ghost btn-sm"
              >
                ✕
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Actual Released Figure</label>
              <input
                type="text"
                className="form-input text-lg font-bold"
                placeholder="e.g. 2.8%"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Immediate Market Reaction Note</label>
              <textarea
                className="form-textarea"
                placeholder="e.g. BTC spiked +$1.2k immediately following lower than expected inflation figure"
                value={reactionNote}
                onChange={(e) => setReactionNote(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingEvent(null)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveActual}
                className="btn btn-primary"
                disabled={loading}
              >
                Save Release Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

