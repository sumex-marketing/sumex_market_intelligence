'use client'

import { useState } from 'react'
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
  if (usd == null) return '—'
  if (usd === 0) return allowDashForZero ? '—' : '$0.0M'
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
  const [syncingEtf, setSyncingEtf] = useState(false)
  const [syncingMacro, setSyncingMacro] = useState(false)
  const [selectedEtfAsset, setSelectedEtfAsset] = useState<'ALL' | 'BTC' | 'ETH' | 'SOL' | 'HYPE'>('ALL')

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
        router.refresh()
      } else {
        alert('Failed to update event')
      }
    } catch {
      alert('Error updating event')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    await fetch(`/api/macro/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const handleSyncEtfFlows = async () => {
    setSyncingEtf(true)
    try {
      const res = await fetch('/api/cron/fetch-etf-flows')
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
      const res = await fetch('/api/cron/fetch-macro-events')
      const data = await res.json()
      if (data.success) {
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
            Macro Calendar ({events.length})
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
          {events.length === 0 ? (
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
                      <th>Actual</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
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
                        <td className="td-mono text-muted">{ev.previous ?? '—'}</td>
                        <td className="td-mono text-muted">{ev.forecast ?? '—'}</td>
                        <td className="td-mono font-bold" style={{ color: ev.actual ? '#23F7DD' : undefined }}>
                          {ev.actual ?? <span className="text-muted font-normal italic">Pending</span>}
                        </td>
                        <td>
                          <span className={`badge ${ev.status === 'released' ? 'badge-green' : 'badge-muted'}`}>
                            {ev.status}
                          </span>
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
                            <button onClick={() => handleDelete(ev.id)} className="btn btn-ghost btn-sm text-red">
                              <Trash2 size={13} />
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
                background: 'linear-gradient(135deg, rgba(35,247,221,0.07), rgba(142,51,255,0.07))',
                position: 'relative',
                padding: '16px 18px',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(35,247,221,0.18)',
                      color: '#23F7DD',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ALL
                  </div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
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
                  fontSize: '1.4rem',
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
              <div className="text-xs text-muted mt-2" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                {combinedFundCount} tracked institutional funds
              </div>
            </div>

            {/* BTC */}
            <div className="card" style={{ borderColor: 'rgba(247,147,26,0.25)', position: 'relative', padding: '16px 18px' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(247,147,26,0.18)',
                      color: '#F7931A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    BTC
                  </div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    Bitcoin Spot
                  </span>
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
                  fontSize: '1.4rem',
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
              <div className="text-xs text-muted mt-2" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                {latestBtcTotal?.fund_count ?? 0} institutional spot funds
              </div>
            </div>

            {/* ETH */}
            <div className="card" style={{ borderColor: 'rgba(98,126,234,0.25)', position: 'relative', padding: '16px 18px' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(98,126,234,0.18)',
                      color: '#627EEA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ETH
                  </div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    Ethereum Spot
                  </span>
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
                  fontSize: '1.4rem',
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
              <div className="text-xs text-muted mt-2" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                {latestEthTotal?.fund_count ?? 0} institutional spot funds
              </div>
            </div>

            {/* SOL */}
            <div className="card" style={{ borderColor: 'rgba(153,69,255,0.25)', position: 'relative', padding: '16px 18px' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(153,69,255,0.18)',
                      color: '#9945FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    SOL
                  </div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    Solana ETP
                  </span>
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
                  fontSize: '1.4rem',
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
              <div className="text-xs text-muted mt-2" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                {latestSolTotal?.fund_count ?? 0} institutional trusts & ETPs
              </div>
            </div>

            {/* HYPE */}
            <div className="card" style={{ borderColor: 'rgba(35,247,221,0.25)', position: 'relative', padding: '16px 18px' }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(35,247,221,0.18)',
                      color: '#23F7DD',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    HYPE
                  </div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    Hyperliquid
                  </span>
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
                  fontSize: '1.4rem',
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
              <div className="text-xs text-muted mt-2" style={{ whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                {latestHypeTotal?.fund_count ?? 0} vault & index products
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

              <div className="flex items-center gap-2">
                {(['ALL', 'BTC', 'ETH', 'SOL', 'HYPE'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelectedEtfAsset(a)}
                    className={`btn btn-sm ${
                      selectedEtfAsset === a ? 'btn-primary' : 'btn-ghost text-muted'
                    }`}
                    style={{ fontSize: '0.82rem', padding: '3px 10px' }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '105px', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ width: '75px', whiteSpace: 'nowrap' }}>Asset</th>
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
                                    <div className="flex items-center gap-4 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                                      {activeAssets.map((a) => {
                                        const aTotal = rows
                                          .filter((r) => r.asset === a)
                                          .reduce((sum, f) => sum + (f.flow_usd ?? 0), 0)
                                        return (
                                          <span key={a} style={{ color: aTotal >= 0 ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                                            <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>{a}:</span>
                                            {formatFlow(aTotal)}
                                          </span>
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

                            return (
                              <tr key={flow.id}>
                                {/* Date only shown on first row of date */}
                                <td className="td-mono text-xs font-semibold text-primary" style={{ whiteSpace: 'nowrap' }}>
                                  {aIdx === 0 && idx === 0 ? date : ''}
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <span
                                    className={`badge ${
                                      flow.asset === 'BTC'
                                        ? 'badge-amber'
                                        : flow.asset === 'ETH'
                                        ? 'badge-purple'
                                        : flow.asset === 'SOL'
                                        ? 'badge-blue'
                                        : 'badge-cyan'
                                    }`}
                                    style={{ whiteSpace: 'nowrap' }}
                                  >
                                    {flow.asset}
                                  </span>
                                </td>
                                <td className="td-mono font-bold" style={{ color: '#23F7DD', whiteSpace: 'nowrap' }}>
                                  {flow.fund_ticker}
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
                                      style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        color: 'var(--text-muted)',
                                        marginTop: 2,
                                        letterSpacing: '0.03em',
                                      }}
                                    >
                                      {asset} Net Flow
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
                  'CPI',
                  'CORE_CPI',
                  'PCE',
                  'CORE_PCE',
                  'FOMC',
                  'NFP',
                  'PPI',
                  'GDP',
                  'RATE_DECISION',
                  'OTHER',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
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

