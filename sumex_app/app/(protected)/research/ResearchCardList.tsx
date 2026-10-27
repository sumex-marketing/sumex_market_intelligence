'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Trash2,
  RefreshCw,
  Plus,
  Search,
  X,
  Copy,
  Check,
  Zap,
  Sparkles,
  FileText,
  ArrowUpRight,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Layers,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

export interface JoinedSignal {
  id: string
  title: string
  subject: string
  score: number | null
  signal_type: string
}

export interface JoinedDraft {
  id: string
  format: string
  status: string
  created_at: string
}

export interface ResearchCard {
  id: string
  observation: string | null
  thesis: string | null
  question: string | null
  confidence: number | null
  editorial_decision: string | null
  ai_analysis: any | null
  ai_analyzed_at: string | null
  created_at: string
  signals: JoinedSignal | null
  content_drafts?: JoinedDraft[]
}

export default function ResearchCardList({ initialCards }: { initialCards: ResearchCard[] }) {
  const router = useRouter()
  const [cards, setCards] = useState<ResearchCard[]>(initialCards)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Loading states
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [generatingDraftId, setGeneratingDraftId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [exportingBatch, setExportingBatch] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ANALYZED' | 'APPROVED' | 'DRAFT' | 'WITH_DRAFT'>('ALL')
  const [assetFilter, setAssetFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'newest' | 'confidence' | 'oldest'>('newest')

  // Feedback notice banner
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Sync state if initialCards updates
  useEffect(() => {
    setCards(initialCards)
  }, [initialCards])

  // Clear notice after 5 seconds
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  // Extract unique assets / subjects for filtering
  const availableAssets = useMemo(() => {
    const assetSet = new Set<string>()
    cards.forEach((c) => {
      const subject = c.signals?.subject?.trim().toUpperCase()
      if (subject) assetSet.add(subject)
      // Also inspect observation for common assets
      const obs = (c.observation || '').toUpperCase()
      if (obs.includes('BTC') || obs.includes('BITCOIN')) assetSet.add('BTC')
      if (obs.includes('ETH') || obs.includes('ETHER')) assetSet.add('ETH')
      if (obs.includes('SOL') || obs.includes('SOLANA')) assetSet.add('SOL')
      if (obs.includes('MACRO') || obs.includes('FOMC') || obs.includes('CPI')) assetSet.add('MACRO')
    })
    return Array.from(assetSet).slice(0, 8)
  }, [cards])

  // Metrics overview calculations
  const stats = useMemo(() => {
    const total = cards.length
    const analyzed = cards.filter((c) => c.ai_analysis != null || c.thesis != null).length
    const approved = cards.filter(
      (c) =>
        c.editorial_decision === 'approved' ||
        (c.ai_analysis as any)?.editorial_recommendation === 'PUBLISH_NOW'
    ).length
    const withDrafts = cards.filter((c) => c.content_drafts && c.content_drafts.length > 0).length
    const highConfidence = cards.filter((c) => (c.confidence ?? 0) >= 7).length
    return { total, analyzed, approved, withDrafts, highConfidence }
  }, [cards])

  // Filtered & sorted cards
  const filteredCards = useMemo(() => {
    let result = [...cards]

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((c) => {
        const obs = (c.observation || '').toLowerCase()
        const thesis = (c.thesis || '').toLowerCase()
        const question = (c.question || '').toLowerCase()
        const subject = (c.signals?.subject || '').toLowerCase()
        const title = (c.signals?.title || '').toLowerCase()
        return obs.includes(q) || thesis.includes(q) || question.includes(q) || subject.includes(q) || title.includes(q)
      })
    }

    // Status filter
    if (statusFilter === 'ANALYZED') {
      result = result.filter((c) => c.ai_analysis != null || c.thesis != null)
    } else if (statusFilter === 'APPROVED') {
      result = result.filter(
        (c) =>
          c.editorial_decision === 'approved' ||
          (c.ai_analysis as any)?.editorial_recommendation === 'PUBLISH_NOW'
      )
    } else if (statusFilter === 'DRAFT') {
      result = result.filter((c) => c.ai_analysis == null && c.thesis == null)
    } else if (statusFilter === 'WITH_DRAFT') {
      result = result.filter((c) => c.content_drafts && c.content_drafts.length > 0)
    }

    // Asset filter
    if (assetFilter !== 'ALL') {
      const a = assetFilter.toLowerCase()
      result = result.filter((c) => {
        const subject = (c.signals?.subject || '').toLowerCase()
        const obs = (c.observation || '').toLowerCase()
        return subject.includes(a) || obs.includes(a)
      })
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'confidence') {
        return (b.confidence ?? 0) - (a.confidence ?? 0)
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return result
  }, [cards, searchQuery, statusFilter, assetFilter, sortBy])

  // Delete single card
  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/research/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setNotice({ type: 'error', message: `Failed to delete: ${data.error ?? res.statusText}` })
        return
      }
      setCards((prev) => prev.filter((c) => c.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setNotice({ type: 'success', message: 'Research card deleted successfully.' })
      router.refresh()
    } catch {
      setNotice({ type: 'error', message: 'Error deleting research card.' })
    } finally {
      setDeletingId(null)
    }
  }

  // Delete all or filtered view
  const handleDeleteAll = async (scope: 'all' | 'filtered' = 'all') => {
    const isFiltered = scope === 'filtered' && (searchQuery || statusFilter !== 'ALL' || assetFilter !== 'ALL')
    const targetList = isFiltered ? filteredCards : cards
    const targetLabel = isFiltered
      ? `${filteredCards.length} filtered research card(s)`
      : `all ${cards.length} research card(s)`

    if (targetList.length === 0) return

    const confirmed = confirm(
      `Are you sure you want to delete ${targetLabel}? This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingAll(true)
    try {
      const idsToDelete = targetList.map((c) => c.id)
      const res = await fetch('/api/research', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: isFiltered ? idsToDelete : undefined }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice({ type: 'error', message: `Failed to delete: ${data.error ?? res.statusText}` })
        return
      }

      const idSet = new Set(idsToDelete)
      setCards((prev) => prev.filter((c) => !idSet.has(c.id)))
      setSelectedIds(new Set())
      setNotice({
        type: 'success',
        message: `Successfully deleted ${data.count ?? idsToDelete.length} research card(s).`,
      })
      router.refresh()
    } catch {
      setNotice({ type: 'error', message: 'Error deleting research cards.' })
    } finally {
      setDeletingAll(false)
    }
  }

  // Delete selected batch
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    const confirmed = confirm(`Delete ${selectedIds.size} selected research card(s)? This cannot be undone.`)
    if (!confirmed) return

    setDeletingAll(true)
    try {
      const idsArray = Array.from(selectedIds)
      const res = await fetch('/api/research', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsArray }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice({ type: 'error', message: `Failed to delete selected cards: ${data.error ?? res.statusText}` })
        return
      }

      setCards((prev) => prev.filter((c) => !selectedIds.has(c.id)))
      setSelectedIds(new Set())
      setNotice({ type: 'success', message: `Deleted ${idsArray.length} research card(s).` })
      router.refresh()
    } catch {
      setNotice({ type: 'error', message: 'Error deleting selected cards.' })
    } finally {
      setDeletingAll(false)
    }
  }

  // 1-Click Quick Draft Generation
  const handleQuickDraft = async (e: React.MouseEvent, card: ResearchCard) => {
    e.preventDefault()
    e.stopPropagation()
    setGeneratingDraftId(card.id)
    try {
      const res = await fetch(`/api/research/${card.id}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'market_pulse' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // Optimistically record the new draft
        setCards((prev) =>
          prev.map((c) => {
            if (c.id === card.id) {
              const existingDrafts = c.content_drafts ?? []
              return {
                ...c,
                content_drafts: [
                  ...existingDrafts,
                  { id: data.draft?.id || 'new', format: 'market_pulse', status: 'draft', created_at: new Date().toISOString() },
                ],
              }
            }
            return c
          })
        )
        setNotice({
          type: 'success',
          message: `⚡ Content Draft generated for "${card.observation || 'Research Card'}". View in Content Drafts.`,
        })
        router.refresh()
      } else {
        setNotice({ type: 'error', message: `Draft generation failed: ${data.error ?? 'Unknown error'}` })
      }
    } catch {
      setNotice({ type: 'error', message: 'Error generating content draft.' })
    } finally {
      setGeneratingDraftId(null)
    }
  }

  // 1-Click Copy ChatGPT Prompt & live analysis package
  const handleCopyPrompt = async (e: React.MouseEvent, cardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const res = await fetch(`/api/research/${cardId}/analysis-package`)
      const data = await res.json()
      if (data.package) {
        await navigator.clipboard.writeText(JSON.stringify(data.package, null, 2))
        setCopiedId(cardId)
        setTimeout(() => setCopiedId(null), 2000)
        setNotice({ type: 'success', message: 'ChatGPT prompt package copied to clipboard!' })
      } else {
        alert('Could not compile prompt package.')
      }
    } catch {
      alert('Error copying prompt package.')
    }
  }

  // Batch Export JSON
  const handleBatchExport = async () => {
    if (selectedIds.size === 0) return
    setExportingBatch(true)
    try {
      const selectedCards = cards.filter((c) => selectedIds.has(c.id))
      const jsonStr = JSON.stringify(selectedCards, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sumex_research_cards_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setNotice({ type: 'success', message: `Exported ${selectedCards.length} research card(s) to JSON.` })
    } catch {
      setNotice({ type: 'error', message: 'Failed to export research cards.' })
    } finally {
      setExportingBatch(false)
    }
  }

  // Multi-select toggle helpers
  const handleToggleSelect = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllVisible = () => {
    if (selectedIds.size === filteredCards.length && filteredCards.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCards.map((c) => c.id)))
    }
  }

  const isFiltered = searchQuery.trim() !== '' || statusFilter !== 'ALL' || assetFilter !== 'ALL'

  // Helper for asset badge styling
  const getAssetBadgeColor = (subject: string | null | undefined) => {
    const s = (subject || '').toUpperCase()
    if (s.includes('BTC') || s.includes('BITCOIN')) return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' }
    if (s.includes('ETH') || s.includes('ETHER')) return { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.3)' }
    if (s.includes('SOL') || s.includes('SOLANA')) return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' }
    if (s.includes('MACRO') || s.includes('FOMC') || s.includes('CPI')) return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' }
    return { bg: 'rgba(35, 247, 221, 0.12)', text: '#23F7DD', border: 'rgba(35, 247, 221, 0.25)' }
  }

  return (
    <div className="flex-col gap-6">
      {/* ─── Top Header & Primary Actions ───────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-primary">Research Cards</h1>
            <span
              className="badge"
              style={{
                background: 'rgba(35, 247, 221, 0.12)',
                color: '#23F7DD',
                border: '1px solid rgba(35, 247, 221, 0.25)',
                fontWeight: 700,
              }}
            >
              {cards.length} Total
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Deep dive intelligence synthesis, ChatGPT thesis compiler & draft incubator
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Delete All / Delete View Button */}
          {cards.length > 0 && (
            <button
              onClick={() => handleDeleteAll(isFiltered ? 'filtered' : 'all')}
              disabled={deletingAll || cards.length === 0}
              className="btn btn-sm"
              title={isFiltered ? 'Delete only visible cards matching filter' : 'Delete all research cards'}
              style={{
                gap: 6,
                color: '#ff4d4f',
                borderColor: 'rgba(255, 77, 79, 0.35)',
                background: 'rgba(255, 77, 79, 0.08)',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 77, 79, 0.18)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 77, 79, 0.08)')}
            >
              {deletingAll ? (
                <>
                  <RefreshCw size={13} className="spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  <span>
                    {isFiltered
                      ? `Delete View (${filteredCards.length})`
                      : `Delete All (${cards.length})`}
                  </span>
                </>
              )}
            </button>
          )}

          {/* New Research Card Button */}
          <Link href="/research/new" className="btn btn-primary btn-sm" style={{ gap: 6 }}>
            <Plus size={15} />
            <span>New Research Card</span>
          </Link>
        </div>
      </div>

      {/* ─── Feedback Notice Alert ─────────────────────────────────────────── */}
      {notice && (
        <div
          className="card flex items-center justify-between"
          style={{
            padding: '10px 16px',
            background: notice.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${notice.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 8,
          }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: notice.type === 'success' ? '#22c55e' : '#ef4444' }}>
            {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notice.message}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 6px', height: 'auto', minHeight: 'unset' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Intelligence Stats Ribbon ────────────────────────────────────── */}
      <div className="grid-4" style={{ gap: 14 }}>
        <div
          className="card flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: 14 }}
        >
          <div>
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Total Cards</div>
            <div className="text-2xl font-black text-primary mt-1">{stats.total}</div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(35, 247, 221, 0.1)', color: '#23F7DD' }}>
            <Layers size={20} />
          </div>
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: 14 }}
        >
          <div>
            <div className="text-xs text-muted font-medium uppercase tracking-wider">AI Synthesized</div>
            <div className="text-2xl font-black text-primary mt-1">
              {stats.analyzed}
              <span className="text-xs text-muted font-normal ml-2">
                ({stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0}%)
              </span>
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(142, 51, 255, 0.12)', color: '#8E33FF' }}>
            <Sparkles size={20} />
          </div>
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: 14 }}
        >
          <div>
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Approved Theses</div>
            <div className="text-2xl font-black text-primary mt-1" style={{ color: '#22c55e' }}>
              {stats.approved}
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: 14 }}
        >
          <div>
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Drafts Generated</div>
            <div className="text-2xl font-black text-primary mt-1" style={{ color: '#f59e0b' }}>
              {stats.withDrafts}
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <Zap size={20} />
          </div>
        </div>
      </div>

      {/* ─── Search, Filter & Control Toolbar ──────────────────────────────── */}
      <div
        className="card flex-col gap-3"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          padding: 14,
        }}
      >
        {/* Row 1: Search & Asset / Sort Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 240 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search observation, thesis, question, symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{
                paddingLeft: 34,
                paddingRight: searchQuery ? 32 : 12,
                height: 36,
                fontSize: '0.85rem',
                background: 'var(--bg-elevated)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Asset & Sort Selects */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Asset quick filter */}
            {availableAssets.length > 0 && (
              <select
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                className="form-input"
                style={{
                  height: 36,
                  padding: '4px 10px',
                  fontSize: '0.85rem',
                  background: 'var(--bg-elevated)',
                  width: 'auto',
                }}
              >
                <option value="ALL">All Subjects</option>
                {availableAssets.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="form-input"
              style={{
                height: 36,
                padding: '4px 10px',
                fontSize: '0.85rem',
                background: 'var(--bg-elevated)',
                width: 'auto',
              }}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="confidence">Sort: Highest Confidence</option>
              <option value="oldest">Sort: Oldest First</option>
            </select>
          </div>
        </div>

        {/* Row 2: Status Pills & Select All Checkbox */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-subtle">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ height: 30, fontSize: '0.78rem' }}
            >
              All ({cards.length})
            </button>
            <button
              onClick={() => setStatusFilter('ANALYZED')}
              className={`btn btn-sm ${statusFilter === 'ANALYZED' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ height: 30, fontSize: '0.78rem' }}
            >
              <Sparkles size={12} />
              <span>AI Analyzed ({stats.analyzed})</span>
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`btn btn-sm ${statusFilter === 'APPROVED' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ height: 30, fontSize: '0.78rem' }}
            >
              <CheckCircle2 size={12} />
              <span>Approved ({stats.approved})</span>
            </button>
            <button
              onClick={() => setStatusFilter('WITH_DRAFT')}
              className={`btn btn-sm ${statusFilter === 'WITH_DRAFT' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ height: 30, fontSize: '0.78rem' }}
            >
              <Zap size={12} />
              <span>With Drafts ({stats.withDrafts})</span>
            </button>
            <button
              onClick={() => setStatusFilter('DRAFT')}
              className={`btn btn-sm ${statusFilter === 'DRAFT' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ height: 30, fontSize: '0.78rem' }}
            >
              Pending Thesis ({cards.length - stats.analyzed})
            </button>
          </div>

          {/* Select all visible checkbox */}
          {filteredCards.length > 0 && (
            <label
              className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none"
              style={{ padding: '4px 8px', borderRadius: 4 }}
            >
              <input
                type="checkbox"
                checked={selectedIds.size === filteredCards.length && filteredCards.length > 0}
                onChange={handleSelectAllVisible}
                style={{ cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
              />
              <span>Select all visible ({filteredCards.length})</span>
            </label>
          )}
        </div>
      </div>

      {/* ─── Batch Multi-Select Action Dock (Visible when cards are selected) ── */}
      {selectedIds.size > 0 && (
        <div
          className="card flex items-center justify-between flex-wrap gap-3 animate-fade-in"
          style={{
            background: 'rgba(16, 24, 40, 0.95)',
            border: '1px solid rgba(35, 247, 221, 0.35)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            padding: '10px 18px',
            position: 'sticky',
            top: 70,
            zIndex: 40,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="badge"
              style={{
                background: 'rgba(35, 247, 221, 0.15)',
                color: '#23F7DD',
                fontWeight: 700,
                border: '1px solid rgba(35, 247, 221, 0.3)',
              }}
            >
              {selectedIds.size} Selected
            </span>
            <span className="text-sm text-secondary">
              Batch actions available for selected cards
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Export JSON */}
            <button
              onClick={handleBatchExport}
              disabled={exportingBatch}
              className="btn btn-ghost btn-sm"
              style={{ gap: 6 }}
            >
              <Download size={13} />
              <span>Export Packages</span>
            </button>

            {/* Delete Selected */}
            <button
              onClick={handleDeleteSelected}
              disabled={deletingAll}
              className="btn btn-sm"
              style={{
                gap: 6,
                color: '#ff4d4f',
                borderColor: 'rgba(255, 77, 79, 0.35)',
                background: 'rgba(255, 77, 79, 0.12)',
                fontWeight: 600,
              }}
            >
              <Trash2 size={13} />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 8px' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Cards Grid ────────────────────────────────────────────────────── */}
      {cards.length === 0 ? (
        /* Empty State: Zero total cards */
        <div className="card empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div
            className="empty-state-icon"
            style={{
              fontSize: '2.5rem',
              width: 64,
              height: 64,
              margin: '0 auto 16px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(35, 247, 221, 0.08)',
              color: '#23F7DD',
            }}
          >
            <FileText size={32} />
          </div>
          <div className="empty-state-title text-xl font-bold text-primary">No Research Cards Available</div>
          <div className="empty-state-desc text-sm text-muted max-w-md mx-auto mt-2">
            All research cards have been cleared, or none have been initiated yet. Create a deep-dive research card manually or generate one from the live signal feed.
          </div>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link href="/research/new" className="btn btn-primary">
              <Plus size={16} /> Create Research Card
            </Link>
            <Link href="/signals" className="btn btn-ghost">
              <Zap size={15} /> Explore Signal Feed
            </Link>
          </div>
        </div>
      ) : filteredCards.length === 0 ? (
        /* Empty State: Filter produced 0 matches */
        <div className="card empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div className="text-3xl mb-3">🔍</div>
          <div className="empty-state-title text-lg font-bold text-primary">No Matching Cards Found</div>
          <div className="empty-state-desc text-sm text-muted max-w-md mx-auto mt-1">
            No research cards match your current search & filter criteria.
          </div>
          <button
            onClick={() => {
              setSearchQuery('')
              setStatusFilter('ALL')
              setAssetFilter('ALL')
            }}
            className="btn btn-ghost btn-sm mt-4"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Render Grid of Research Cards */
        <div className="grid-3">
          {filteredCards.map((card) => {
            const isSelected = selectedIds.has(card.id)
            const subject = card.signals?.subject || 'Manual'
            const badgeColors = getAssetBadgeColor(subject)
            const draftCount = card.content_drafts?.length ?? 0
            const hasDraft = draftCount > 0
            const isAnalyzed = card.ai_analysis != null || card.thesis != null

            return (
              <div
                key={card.id}
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  transition: 'all 0.2s ease',
                  border: isSelected ? '1px solid #23F7DD' : '1px solid transparent',
                }}
              >
                {/* Multi-select Checkbox on Card */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    zIndex: 20,
                  }}
                  onClick={(e) => handleToggleSelect(e, card.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{
                      cursor: 'pointer',
                      accentColor: 'var(--brand-primary)',
                      width: 16,
                      height: 16,
                    }}
                  />
                </div>

                {/* Top Action Buttons (Copy Prompt & Delete) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {/* Copy Prompt Button */}
                  <button
                    onClick={(e) => handleCopyPrompt(e, card.id)}
                    title="Copy full ChatGPT prompt & live package"
                    style={{
                      background: 'rgba(35, 247, 221, 0.08)',
                      border: '1px solid rgba(35, 247, 221, 0.2)',
                      borderRadius: 6,
                      padding: '4px 7px',
                      cursor: 'pointer',
                      color: copiedId === card.id ? '#22c55e' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.72rem',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(35, 247, 221, 0.18)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(35, 247, 221, 0.08)')}
                  >
                    {copiedId === card.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>

                  {/* Single Delete Button */}
                  <button
                    onClick={(e) => handleDelete(e, card.id, card.observation ?? card.question ?? 'this card')}
                    disabled={deletingId === card.id}
                    title="Delete research card"
                    style={{
                      background: 'rgba(239, 68, 68, 0.10)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: 6,
                      padding: '4px 7px',
                      cursor: 'pointer',
                      color: 'var(--red, #ef4444)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.72rem',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.10)')}
                  >
                    {deletingId === card.id ? <RefreshCw size={12} className="spin" /> : <Trash2 size={12} />}
                  </button>
                </div>

                {/* Card Main Container (Click navigates to /research/[id]) */}
                <Link
                  href={`/research/${card.id}`}
                  className="card flex-col justify-between gap-4"
                  style={{
                    textDecoration: 'none',
                    background: isSelected ? 'rgba(35, 247, 221, 0.04)' : 'var(--bg-elevated)',
                    display: 'flex',
                    minHeight: 250,
                    padding: '16px 16px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border-default)',
                    transition: 'border-color 0.2s, transform 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(35, 247, 221, 0.3)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isSelected ? '#23F7DD' : 'var(--border-default)'
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center gap-2 mb-3" style={{ paddingLeft: 22, paddingRight: 64 }}>
                      <span
                        className="badge"
                        style={{
                          background: badgeColors.bg,
                          color: badgeColors.text,
                          border: `1px solid ${badgeColors.border}`,
                          fontWeight: 700,
                          fontSize: '0.72rem',
                        }}
                      >
                        {subject}
                      </span>

                      {/* Editorial Decision or AI Analyzed Badge */}
                      {card.editorial_decision ? (
                        <span
                          className={`badge ${
                            card.editorial_decision === 'approved'
                              ? 'badge-green'
                              : card.editorial_decision === 'rejected'
                              ? 'badge-red'
                              : 'badge-amber'
                          }`}
                          style={{ textTransform: 'capitalize', fontSize: '0.72rem' }}
                        >
                          {card.editorial_decision}
                        </span>
                      ) : isAnalyzed ? (
                        <span className="badge badge-purple" style={{ fontSize: '0.72rem', gap: 4 }}>
                          <Sparkles size={11} /> AI Analyzed
                        </span>
                      ) : (
                        <span className="badge badge-muted" style={{ fontSize: '0.72rem' }}>
                          Draft
                        </span>
                      )}

                      {/* Draft ready indicator */}
                      {hasDraft && (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        >
                          ⚡ {draftCount} Draft{draftCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Observation Title */}
                    <h3
                      className="font-bold text-primary text-base line-clamp-2"
                      style={{ lineHeight: 1.4, margin: '6px 0 8px' }}
                    >
                      {card.observation ?? 'Untitled Observation'}
                    </h3>

                    {/* Thesis or Core Analytical Question */}
                    <p
                      className="text-xs text-muted line-clamp-3"
                      style={{ lineHeight: 1.5, color: card.thesis ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                    >
                      {card.thesis ?? card.question ?? 'Click to formulate thesis & compile analysis...'}
                    </p>
                  </div>

                  {/* Card Footer Actions & Metadata */}
                  <div className="flex-col gap-2.5 pt-3 border-t border-subtle">
                    {/* Confidence & Timestamp */}
                    <div className="flex items-center justify-between text-xs text-muted">
                      <div className="flex items-center gap-1.5">
                        <span className="text-disabled">Confidence:</span>
                        {card.confidence ? (
                          <span
                            className="font-semibold"
                            style={{
                              color:
                                card.confidence >= 7
                                  ? 'var(--green, #22c55e)'
                                  : card.confidence >= 4
                                  ? 'var(--accent-amber, #f59e0b)'
                                  : 'var(--red, #ef4444)',
                            }}
                          >
                            {card.confidence}/10
                          </span>
                        ) : (
                          <span className="text-disabled">Pending</span>
                        )}
                      </div>
                      <span>{formatRelativeTime(card.created_at)}</span>
                    </div>

                    {/* Direct Quick Action Toolbar on Card */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {/* Quick Generate Draft Button */}
                      <button
                        onClick={(e) => handleQuickDraft(e, card)}
                        disabled={generatingDraftId === card.id}
                        className="btn btn-sm"
                        title="Generate a content draft for this research card"
                        style={{
                          flex: 1,
                          height: 28,
                          fontSize: '0.74rem',
                          background: hasDraft ? 'rgba(245, 158, 11, 0.12)' : 'rgba(35, 247, 221, 0.1)',
                          color: hasDraft ? '#f59e0b' : '#23F7DD',
                          borderColor: hasDraft ? 'rgba(245, 158, 11, 0.3)' : 'rgba(35, 247, 221, 0.3)',
                          padding: '0 8px',
                          gap: 4,
                        }}
                      >
                        {generatingDraftId === card.id ? (
                          <>
                            <RefreshCw size={11} className="spin" />
                            <span>Drafting...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={11} />
                            <span>{hasDraft ? 'Generate Another' : '⚡ Quick Draft'}</span>
                          </>
                        )}
                      </button>

                      {/* Open Workspace Icon Link */}
                      <span
                        className="btn btn-ghost btn-sm"
                        style={{
                          height: 28,
                          padding: '0 8px',
                          fontSize: '0.74rem',
                          gap: 4,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span>Workspace</span>
                        <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
