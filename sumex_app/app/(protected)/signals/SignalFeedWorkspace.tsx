'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Signal, SignalSeverity, SignalType } from '@/lib/types'
import { formatRelativeTime, formatSignalType, getSignalScoreBadge, formatSignalStatus } from '@/lib/utils'
import {
  Zap,
  Plus,
  RefreshCw,
  Filter,
  ArrowUpRight,
  Search,
  ShieldCheck,
  Newspaper,
  ExternalLink,
  Layers,
  FilePlus,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react'

interface SignalFeedWorkspaceProps {
  signals: Signal[]
  newsItems?: any[]
}

export default function SignalFeedWorkspace({
  signals,
  newsItems = [],
}: SignalFeedWorkspaceProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'signals' | 'catalysts'>('signals')

  // Local signals state for optimistic updates
  const [localSignals, setLocalSignals] = useState(signals)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Signal Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [loading, setLoading] = useState(false)

  // Catalyst / News Filters
  const [newsCategory, setNewsCategory] = useState<string>('ALL')
  const [newsPublisher, setNewsPublisher] = useState<string>('ALL')
  const [newsSearch, setNewsSearch] = useState('')
  const [syncingNews, setSyncingNews] = useState(false)
  const [newsNotice, setNewsNotice] = useState<string | null>(null)

  // New Signal Form State
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('BTC')
  const [signalType, setSignalType] = useState<SignalType>('manual_catalyst')
  const [severity, setSeverity] = useState<SignalSeverity>('medium')
  const [score, setScore] = useState(6.0)
  const [triggerDetail, setTriggerDetail] = useState('')

  const [draftingAll, setDraftingAll] = useState(false)
  const [draftNotice, setDraftNotice] = useState<{
    type: 'success' | 'info' | 'error'
    message: string
    createdCount: number
    createdDrafts?: Array<{ id: string; title: string; format: string }>
  } | null>(null)
  const [draftingSignalId, setDraftingSignalId] = useState<string | null>(null)

  const handleCheckAndGenerateDrafts = async () => {
    setDraftingAll(true)
    setDraftNotice(null)
    try {
      const res = await fetch('/api/content/scan-and-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        setDraftNotice({
          type: data.totalCreated > 0 ? 'success' : 'info',
          message: data.summaryMessage || 'Scan complete.',
          createdCount: data.totalCreated ?? 0,
          createdDrafts: data.createdDrafts,
        })
        router.refresh()
      } else {
        setDraftNotice({
          type: 'error',
          message: data.error || 'Failed to scan and generate drafts.',
          createdCount: 0,
        })
      }
    } catch {
      setDraftNotice({
        type: 'error',
        message: 'Network error triggering draft generator.',
        createdCount: 0,
      })
    } finally {
      setDraftingAll(false)
    }
  }

  const handleDraftSingleSignal = async (sig: Signal) => {
    setDraftingSignalId(sig.id)
    try {
      // 1. Create or get research card
      const resCard = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_id: sig.id,
          observation: sig.title,
          question: `What institutional drivers triggered this ${sig.subject} move and how does it shift market structure?`,
          thesis: sig.trigger_detail || sig.evidence_summary || 'Institutional catalyst signal detected.',
        }),
      })
      const cardData = await resCard.json()
      const cardId = cardData.data?.id
      if (!cardId) {
        alert('Could not initialize research card for signal')
        return
      }

      // 2. Generate clean draft
      const resDraft = await fetch(`/api/research/${cardId}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'market_pulse' }),
      })
      const draftData = await resDraft.json()
      if (draftData.data?.id) {
        router.push(`/content/${draftData.data.id}`)
      } else {
        alert(draftData.error || 'Failed to generate draft for signal')
      }
    } catch {
      alert('Error generating draft for signal')
    } finally {
      setDraftingSignalId(null)
    }
  }

  const handleRunScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/signals/scan', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        alert(`Scan failed: ${data.error ?? 'Unknown'}`)
      }
    } catch {
      alert('Error triggering signal scan')
    } finally {
      setScanning(false)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/signals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setLocalSignals((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: newStatus as any } : s))
        )
      } else {
        alert('Failed to update status')
      }
    } catch {
      alert('Error updating signal status')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteSignal = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/signals/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLocalSignals((prev) => prev.filter((s) => s.id !== id))
      } else {
        alert('Failed to delete signal')
      }
    } catch {
      alert('Error deleting signal')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSyncNews = async () => {
    setSyncingNews(true)
    setNewsNotice(null)
    try {
      const res = await fetch('/api/cron/fetch-news', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setNewsNotice(`Ingested ${data.records ?? 0} stories`)
        setTimeout(() => setNewsNotice(null), 4000)
        router.refresh()
      } else {
        setNewsNotice(`Sync note: ${data.error || 'Check network'}`)
      }
    } catch {
      setNewsNotice('Error fetching RSS feeds')
    } finally {
      setSyncingNews(false)
    }
  }

  const handleCreateSignal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return
    setLoading(true)

    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          signal_type: signalType,
          severity,
          score,
          trigger_detail: triggerDetail || 'Manual analyst catalyst trigger',
        }),
      })

      if (res.ok) {
        setShowNewModal(false)
        setTitle('')
        setTriggerDetail('')
        router.refresh()
      } else {
        alert('Failed to log catalyst signal')
      }
    } catch {
      alert('Error logging signal')
    } finally {
      setLoading(false)
    }
  }

  const filteredSignals = localSignals.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false
    if (severityFilter !== 'ALL' && s.severity !== severityFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        s.title.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.signal_type.toLowerCase().includes(q)
      )
    }
    return true
  })

  const filteredNews = newsItems.filter((n) => {
    if (newsCategory !== 'ALL' && n.category !== newsCategory) return false
    if (newsPublisher !== 'ALL' && n.publisher !== newsPublisher) return false
    if (newsSearch) {
      const q = newsSearch.toLowerCase()
      return (
        n.title?.toLowerCase().includes(q) ||
        (n.summary && n.summary.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="flex-col gap-6">
      {/* ── Page Header & Controls ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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
            Market Signals & Catalysts Feed
          </h1>
          <p className="text-sm text-muted mt-1">
            Algorithmic anomaly detection scanner & live catalyst discovery wire
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeTab === 'signals' ? (
            <>
              {/* Primary User Action: Click to Generate Drafts */}
              <button
                onClick={handleCheckAndGenerateDrafts}
                className="btn btn-secondary btn-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(35,247,221,0.15) 0%, rgba(142,51,255,0.15) 100%)',
                  borderColor: 'rgba(35,247,221,0.4)',
                  color: '#23F7DD',
                  fontWeight: 700,
                  gap: 6,
                  boxShadow: '0 2px 10px rgba(35,247,221,0.15)',
                }}
                disabled={draftingAll}
                title="System automatically checks ETF flows and high-conviction signals and drafts any pending reports"
              >
                {draftingAll ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                <span>{draftingAll ? 'Checking & Drafting...' : '⚡ Generate Drafts'}</span>
              </button>

              <button
                onClick={handleRunScan}
                className="btn btn-ghost btn-sm"
                style={{ color: '#23F7DD', border: '1px solid rgba(35,247,221,0.2)' }}
                disabled={scanning}
              >
                <RefreshCw size={14} className={scanning ? 'spin' : ''} />
                <span>{scanning ? 'Scanning...' : 'Run Scanner'}</span>
              </button>

              <button
                onClick={() => setShowNewModal(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} />
                <span>Log Catalyst Signal</span>
              </button>
            </>
          ) : (
            <>
              {newsNotice && (
                <span className="badge badge-cyan text-xs font-semibold">
                  {newsNotice}
                </span>
              )}
              <button
                onClick={handleSyncNews}
                className="btn btn-primary btn-sm"
                disabled={syncingNews}
              >
                <RefreshCw size={14} className={syncingNews ? 'spin' : ''} />
                <span>{syncingNews ? 'Ingesting Feeds...' : 'Sync News Feeds'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Draft Generation Result Notification Banner ── */}
      {draftNotice && (
        <div
          className="card p-3 flex items-center justify-between flex-wrap gap-3 animate-fade-in"
          style={{
            background:
              draftNotice.type === 'success'
                ? 'linear-gradient(135deg, rgba(35,247,221,0.12) 0%, rgba(142,51,255,0.08) 100%)'
                : draftNotice.type === 'info'
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(239,68,68,0.1)',
            border:
              draftNotice.type === 'success'
                ? '1px solid rgba(35,247,221,0.4)'
                : draftNotice.type === 'info'
                ? '1px solid var(--border-subtle)'
                : '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
          }}
        >
          <div className="flex items-center gap-2.5">
            {draftNotice.type === 'success' ? (
              <Sparkles size={18} style={{ color: '#23F7DD' }} />
            ) : draftNotice.type === 'info' ? (
              <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
            ) : (
              <AlertCircle size={18} style={{ color: '#ef4444' }} />
            )}
            <span className="text-sm font-semibold text-primary">{draftNotice.message}</span>
          </div>

          <div className="flex items-center gap-2">
            {draftNotice.createdCount > 0 && (
              <Link
                href="/content"
                className="btn btn-primary btn-xs"
                style={{
                  background: '#23F7DD',
                  color: '#000',
                  fontWeight: 700,
                  gap: 4,
                }}
              >
                <FileText size={12} />
                <span>View Drafts Workspace →</span>
              </Link>
            )}
            <button
              onClick={() => setDraftNotice(null)}
              className="btn btn-ghost btn-xs text-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Workspace Tab Switcher ── */}
      <div className="flex items-center gap-2 border-b border-subtle pb-2">
        <button
          onClick={() => setActiveTab('signals')}
          className={`btn btn-sm ${activeTab === 'signals' ? 'btn-primary' : 'btn-ghost'}`}
        >
          <Zap size={14} />
          Market Signals ({signals.length})
        </button>
        <button
          onClick={() => setActiveTab('catalysts')}
          className={`btn btn-sm ${activeTab === 'catalysts' ? 'btn-primary' : 'btn-ghost'}`}
          style={activeTab === 'catalysts' ? { background: '#8E33FF', borderColor: '#8E33FF' } : {}}
        >
          <Newspaper size={14} />
          Catalysts & News Wire ({newsItems.length})
        </button>
      </div>

      {/* ── TAB 1: Market Signals ── */}
      {activeTab === 'signals' && (
        <>
          {/* Filter Bar */}
          <div
            className="card p-3 flex items-center justify-between flex-wrap gap-4"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted">
                <Filter size={14} /> Status:
              </div>
              <div className="flex items-center gap-1">
                {[
                { val: 'ALL', label: 'All' },
                { val: 'new', label: 'New' },
                { val: 'investigating', label: 'Under Review' },
                { val: 'validated', label: 'Confirmed' },
                { val: 'content_ready', label: 'Draft Ready' },
              ].map(({ val, label }) => (
                  <button
                    key={val}
                    onClick={() => setStatusFilter(val)}
                    className={`btn btn-xs ${statusFilter === val ? 'btn-secondary' : 'btn-ghost'}`}
                    style={statusFilter === val ? { borderColor: '#23F7DD', color: '#23F7DD' } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-muted ml-2">
                Severity:
              </div>
              <div className="flex items-center gap-1">
                {['ALL', 'high', 'medium', 'low'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`btn btn-xs ${severityFilter === sev ? 'btn-secondary' : 'btn-ghost'}`}
                    style={severityFilter === sev ? { borderColor: '#8E33FF', color: '#8E33FF' } : {}}
                  >
                    {sev.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg-surface)',
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Search size={14} className="text-muted" />
                <input
                  type="text"
                  placeholder="Search signals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    width: '140px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Signals Table */}
          {filteredSignals.length === 0 ? (
            <div className="card empty-state">
              <Zap className="empty-state-icon" />
              <div className="empty-state-title">No Signals Found</div>
              <div className="empty-state-desc">
                {signals.length === 0
                  ? 'No market moves have crossed signal thresholds yet. Click "Run Scanner" to scan current prices.'
                  : 'No signals match your filter criteria.'}
              </div>
            </div>
          ) : (
            <div
              className="card p-0"
              style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}
            >
              {/* Score Explanation Legend Bar */}
              <div
                className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 border-b border-subtle"
                style={{ background: 'rgba(15, 23, 42, 0.65)', fontSize: '0.72rem' }}
              >
                <span className="text-muted font-medium">
                  Priority Score Guide (0.0 to 10.0 scale):
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 font-semibold" style={{ color: '#f87171' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#f87171' }} />
                    7.5 - 10.0 Critical Anomaly
                  </span>
                  <span className="flex items-center gap-1 font-semibold" style={{ color: '#fbbf24' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />
                    6.0 - 7.4 High Significance
                  </span>
                  <span className="flex items-center gap-1 font-semibold" style={{ color: '#23F7DD' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#23F7DD' }} />
                    4.0 - 5.9 Moderate Signal
                  </span>
                  <span className="flex items-center gap-1 font-semibold" style={{ color: '#94a3b8' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#94a3b8' }} />
                    &lt; 4.0 Low Alert
                  </span>
                </div>
              </div>

              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'visible',
                  width: '100%',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <table
                  style={{
                    tableLayout: 'fixed',
                    minWidth: '100%',
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}
                >
                  <colgroup>
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '100px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap' }} title="Algorithmic Priority Score from 0.0 (low noise) to 10.0 (critical anomaly)">
                        Priority (0-10)
                      </th>
                      <th>Signal / Subject</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Type</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Severity</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                      <th>Trigger Evidence</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Detected</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.map((sig) => {
                      const scoreBadge = getSignalScoreBadge(sig.score)
                      const typeInfo = formatSignalType(sig.signal_type)
                      const statusInfo = formatSignalStatus(sig.status)
                      const severityColors: Record<string, { color: string; bg: string }> = {
                        critical: { color: '#f87171', bg: 'rgba(239,68,68,0.16)' },
                        high:     { color: '#fbbf24', bg: 'rgba(245,158,11,0.16)' },
                        medium:   { color: '#23F7DD', bg: 'rgba(35,247,221,0.14)' },
                        low:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
                      }
                      const sevStyle = severityColors[sig.severity] ?? severityColors.medium
                      return (
                      <tr key={sig.id}>
                        {/* Priority Score badge with full text */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div
                              style={{
                                padding: '3px 8px',
                                borderRadius: 7,
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 2,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 800,
                                fontSize: '0.9rem',
                                background: scoreBadge.bg,
                                color: scoreBadge.color,
                                border: `1px solid ${scoreBadge.color}45`,
                              }}
                              title={`Priority Score: ${sig.score ? sig.score.toFixed(1) : 'N/A'} / 10 - ${scoreBadge.description}`}
                            >
                              <span>{sig.score ? sig.score.toFixed(1) : 'N/A'}</span>
                              <span style={{ fontSize: '0.62rem', opacity: 0.75, fontWeight: 600 }}>/10</span>
                            </div>
                            <div
                              style={{
                                fontSize: '0.68rem',
                                color: scoreBadge.color,
                                fontWeight: 700,
                                textAlign: 'center',
                                lineHeight: 1.15,
                                whiteSpace: 'nowrap',
                              }}
                              title={scoreBadge.description}
                            >
                              {scoreBadge.label}
                            </div>
                          </div>
                        </td>

                        {/* Title + asset */}
                        <td style={{ overflow: 'hidden' }}>
                          <div style={{ width: '100%', overflow: 'hidden' }}>
                            <Link
                              href={`/signals/${sig.id}`}
                              className="font-bold text-primary hover:text-cyan"
                              style={{
                                textDecoration: 'none',
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: '0.92rem',
                              }}
                              title={sig.title}
                            >
                              {sig.title}
                            </Link>
                            <div className="flex items-center gap-1 mt-1" style={{ fontSize: '0.78rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#23F7DD' }}>{sig.subject}</span>
                            </div>
                          </div>
                        </td>

                        {/* Signal type - human readable */}
                        <td style={{ overflow: 'hidden' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: typeInfo.bg,
                              color: typeInfo.color,
                              border: `1px solid ${typeInfo.color}33`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {typeInfo.label}
                          </span>
                        </td>

                        {/* Severity */}
                        <td style={{ overflow: 'hidden' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: sevStyle.bg,
                              color: sevStyle.color,
                              border: `1px solid ${sevStyle.color}33`,
                              textTransform: 'capitalize',
                            }}
                          >
                            {sig.severity}
                          </span>
                        </td>

                        {/* Status - inline dropdown */}
                        <td style={{ overflow: 'hidden' }}>
                          <select
                            value={sig.status}
                            disabled={updatingId === sig.id}
                            onChange={(e) => handleStatusChange(sig.id, e.target.value)}
                            style={{
                              background: statusInfo.bg,
                              color: statusInfo.color,
                              border: `1px solid ${statusInfo.color}44`,
                              borderRadius: 6,
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '3px 6px',
                              cursor: 'pointer',
                              outline: 'none',
                              width: '100%',
                              opacity: updatingId === sig.id ? 0.5 : 1,
                            }}
                          >
                            <option value="new">New</option>
                            <option value="investigating">Investigating</option>
                            <option value="validated">Validated</option>
                            <option value="content_ready">Content Ready</option>
                            <option value="published">Published</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>

                        {/* Trigger evidence */}
                        <td style={{ overflow: 'hidden' }}>
                          <div
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--text-secondary)',
                              fontSize: '0.85rem',
                            }}
                            title={sig.trigger_detail ?? sig.evidence_summary ?? 'Standard threshold breach'}
                          >
                            {sig.trigger_detail ?? sig.evidence_summary ?? 'Standard threshold breach'}
                          </div>
                        </td>

                        {/* Time */}
                        <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {formatRelativeTime(sig.created_at)}
                        </td>

                        {/* Actions */}
                        <td style={{ width: '180px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <button
                              onClick={() => handleDraftSingleSignal(sig)}
                              disabled={draftingSignalId === sig.id}
                              className="btn btn-ghost btn-xs"
                              style={{
                                color: '#23F7DD',
                                background: 'rgba(35,247,221,0.08)',
                                border: '1px solid rgba(35,247,221,0.25)',
                                gap: 3,
                                padding: '3px 7px',
                                fontSize: '0.78rem',
                              }}
                              title="Generate intelligence draft report for this signal"
                            >
                              {draftingSignalId === sig.id ? (
                                <RefreshCw size={11} className="spin" />
                              ) : (
                                <Sparkles size={11} />
                              )}
                              <span>{draftingSignalId === sig.id ? 'Drafting...' : 'Draft'}</span>
                            </button>

                            <Link
                              href={`/signals/${sig.id}`}
                              className="btn btn-ghost btn-sm"
                              style={{ color: '#23F7DD', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}
                            >
                              Inspect <ArrowUpRight size={13} />
                            </Link>
                            <button
                              onClick={() => handleDeleteSignal(sig.id, sig.title)}
                              disabled={deletingId === sig.id}
                              title="Delete signal"
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--red, #ef4444)', padding: '4px 6px' }}
                            >
                              {deletingId === sig.id
                                ? <RefreshCw size={12} className="spin" />
                                : <Trash2 size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: Catalysts & News Wire ── */}
      {activeTab === 'catalysts' && (
        <>
          {/* Filter Bar */}
          <div
            className="card p-3 flex items-center justify-between flex-wrap gap-4"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted">
                Category:
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {['ALL', 'regulatory', 'institutional', 'security', 'protocol', 'market'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNewsCategory(cat)}
                    className={`btn btn-xs ${newsCategory === cat ? 'btn-secondary' : 'btn-ghost'}`}
                    style={newsCategory === cat ? { borderColor: '#8E33FF', color: '#8E33FF' } : {}}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-muted ml-2">
                Publisher:
              </div>
              <div className="flex items-center gap-1">
                {['ALL', 'Cointelegraph', 'Decrypt', 'The Block'].map((pub) => (
                  <button
                    key={pub}
                    onClick={() => setNewsPublisher(pub)}
                    className={`btn btn-xs ${newsPublisher === pub ? 'btn-secondary' : 'btn-ghost'}`}
                    style={newsPublisher === pub ? { borderColor: '#23F7DD', color: '#23F7DD' } : {}}
                  >
                    {pub}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg-surface)',
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Search size={14} className="text-muted" />
                <input
                  type="text"
                  placeholder="Search catalysts..."
                  value={newsSearch}
                  onChange={(e) => setNewsSearch(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    width: '140px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* News Wire Cards Grid */}
          {filteredNews.length === 0 ? (
            <div className="card empty-state">
              <Newspaper className="empty-state-icon" />
              <div className="empty-state-title">No Catalysts Found</div>
              <div className="empty-state-desc">
                Click "Sync News Feeds" to fetch breaking stories from Cointelegraph, Decrypt, and The Block.
              </div>
            </div>
          ) : (
            <div className="flex-col gap-3">
              {filteredNews.map((item: any) => {
                const relevance = item.relevance_score ?? 0.5
                return (
                  <div
                    key={item.id || item.url}
                    className="card flex items-center justify-between gap-4 flex-wrap"
                    style={{
                      padding: '14px 18px',
                      background: 'var(--bg-surface)',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="badge badge-purple" style={{ fontSize: '0.82rem' }}>
                          {item.publisher}
                        </span>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.82rem',
                            backgroundColor: 'rgba(35,247,221,0.08)',
                            color: '#23F7DD',
                            borderColor: 'rgba(35,247,221,0.2)',
                          }}
                        >
                          {item.category?.toUpperCase() ?? 'MARKET'}
                        </span>
                        <span className="text-xs text-muted">
                          {formatRelativeTime(item.published_at)}
                        </span>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.82rem',
                            fontFamily: 'var(--font-mono)',
                            color: relevance >= 0.7 ? '#22c55e' : '#f59e0b',
                          }}
                        >
                          Rel: {(relevance * 100).toFixed(0)}%
                        </span>
                      </div>

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-primary hover:text-cyan block text-sm"
                        style={{ textDecoration: 'none', lineHeight: 1.4 }}
                      >
                        {item.title}
                        <ExternalLink size={11} className="inline ml-1.5 opacity-60" />
                      </a>

                      {item.summary && (
                        <p
                          className="text-xs text-muted mt-1 truncate"
                          style={{ maxWidth: '780px', margin: 0 }}
                        >
                          {item.summary}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                      <Link
                        href={`/research/new?headline=${encodeURIComponent(item.title)}&url=${encodeURIComponent(item.url)}`}
                        className="btn btn-primary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <FilePlus size={14} />
                        Research Story
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Log Manual Catalyst Modal ── */}
      {showNewModal && (
        <div className="modal-backdrop">
          <form onSubmit={handleCreateSignal} className="modal-card flex-col gap-4">
            <div className="modal-header">
              <span className="font-bold text-primary">Log Manual Market Catalyst</span>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="btn btn-ghost btn-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Subject Asset</label>
                <select
                  className="form-select"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="BTC">BTC (Bitcoin)</option>
                  <option value="ETH">ETH (Ethereum)</option>
                  <option value="SOL">SOL (Solana)</option>
                  <option value="MACRO">Macro / DXY / Yields</option>
                  <option value="TOTAL">Total Crypto Market</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Signal Category</label>
                <select
                  className="form-select"
                  value={signalType}
                  onChange={(e) => setSignalType(e.target.value as any)}
                >
                  <option value="manual_catalyst">Manual Catalyst Event</option>
                  <option value="price_move">Price Move</option>
                  <option value="etf_flow">ETF Flow Anomaly</option>
                  <option value="macro_event">Macro Release</option>
                  <option value="sector_rotation">Sector Rotation</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Signal Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. BTC Breaks Resistance as Spot ETF Absorbs $180M"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Severity Level</label>
                <select
                  className="form-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Relevance Score (1 - 10)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="10"
                  className="form-input"
                  value={score}
                  onChange={(e) => setScore(parseFloat(e.target.value) || 5)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Trigger Detail & Context</label>
              <textarea
                className="form-textarea"
                placeholder="Explain the technical or fundamental anomaly that triggered this signal..."
                value={triggerDetail}
                onChange={(e) => setTriggerDetail(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Create Signal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
