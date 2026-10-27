'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Unlock,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  Calendar,
  Layers,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  Flame,
  ArrowUpRight,
  TrendingDown,
  Clock,
} from 'lucide-react'
import { TokenUnlock, UnlockType } from '@/lib/types'
import { formatUnlockValue, isHighImpactUnlock } from '@/lib/services/token-unlock-service'
import TokenUnlockSocialCardStudio, { XIcon } from '@/app/components/TokenUnlockSocialCardStudio'

interface TokenUnlocksWorkspaceProps {
  initialUnlocks: TokenUnlock[]
  initialSummary: {
    totalValueUsd: number
    topUnlock: TokenUnlock | null
    highImpactCount: number
    avgPctSupply: number
  }
}

export default function TokenUnlocksWorkspace({
  initialUnlocks,
  initialSummary,
}: TokenUnlocksWorkspaceProps) {
  const router = useRouter()
  const [unlocks, setUnlocks] = useState<TokenUnlock[]>(initialUnlocks)

  // Modals & Active Views
  const [showStudioModal, setShowStudioModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'high_impact' | 'linear' | 'cliff'>('all')
  const [sortBy, setSortBy] = useState<'value' | 'pct' | 'date'>('value')

  // Loading States
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string; link?: string } | null>(null)

  // New Unlock Form State
  const [tokenName, setTokenName] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [estValueUsd, setEstValueUsd] = useState('')
  const [pctCircSupply, setPctCircSupply] = useState('')
  const [unlockDate, setUnlockDate] = useState('2026-11-01')
  const [unlockType, setUnlockType] = useState<UnlockType>('linear')
  const [description, setDescription] = useState('')
  const [savingNew, setSavingNew] = useState(false)

  // Overview stats calculation
  const stats = useMemo(() => {
    const totalValue = unlocks.reduce((acc, u) => acc + (Number(u.est_value_usd) || 0), 0)
    const sorted = [...unlocks].sort((a, b) => (b.est_value_usd ?? 0) - (a.est_value_usd ?? 0))
    const top = sorted[0] ?? null
    const highImpact = unlocks.filter((u) => isHighImpactUnlock(u)).length
    const avgPct = unlocks.length > 0
      ? unlocks.reduce((acc, u) => acc + (Number(u.pct_circulating_supply) || 0), 0) / unlocks.length
      : 0
    return {
      totalValue,
      top,
      highImpact,
      avgPct: Number(avgPct.toFixed(2)),
    }
  }, [unlocks])

  // Filtered & Sorted list
  const filteredUnlocks = useMemo(() => {
    let result = [...unlocks]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (u) =>
          u.token_name.toLowerCase().includes(q) ||
          u.token_symbol.toLowerCase().includes(q) ||
          (u.description || '').toLowerCase().includes(q)
      )
    }

    if (filterTab === 'high_impact') {
      result = result.filter((u) => isHighImpactUnlock(u))
    } else if (filterTab === 'linear') {
      result = result.filter((u) => u.unlock_type === 'linear')
    } else if (filterTab === 'cliff') {
      result = result.filter((u) => u.unlock_type === 'cliff')
    }

    result.sort((a, b) => {
      if (sortBy === 'pct') {
        return (b.pct_circulating_supply ?? 0) - (a.pct_circulating_supply ?? 0)
      }
      if (sortBy === 'date') {
        return new Date(a.unlock_date).getTime() - new Date(b.unlock_date).getTime()
      }
      return (b.est_value_usd ?? 0) - (a.est_value_usd ?? 0)
    })

    return result
  }, [unlocks, searchQuery, filterTab, sortBy])

  // Single delete
  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete unlock for "${name}"?`)) return
    setDeletingId(id)

    try {
      const res = await fetch('/api/unlocks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setUnlocks((prev) => prev.filter((u) => u.id !== id))
        setNotice({ type: 'success', message: `Deleted unlock event for ${name}.` })
        router.refresh()
      } else {
        alert('Failed to delete token unlock.')
      }
    } catch {
      alert('Error deleting token unlock.')
    } finally {
      setDeletingId(null)
    }
  }

  // Delete all
  const handleDeleteAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${unlocks.length} token unlock(s)? This cannot be undone.`)) return
    setDeletingAll(true)

    try {
      const res = await fetch('/api/unlocks', { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setUnlocks([])
        setNotice({ type: 'success', message: `Successfully deleted all token unlocks.` })
        router.refresh()
      } else {
        alert(`Failed to delete unlocks: ${data.error}`)
      }
    } catch {
      alert('Error deleting token unlocks.')
    } finally {
      setDeletingAll(false)
    }
  }

  // Generate Weekly Social Draft
  const handleGenerateDraft = async () => {
    setGeneratingDraft(true)
    setNotice(null)

    try {
      const res = await fetch('/api/unlocks/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekLabel: 'Oct 26 - Nov 1' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setNotice({
          type: 'success',
          message: `⚡ Weekly Token Unlocks Draft ready!`,
          link: `/content/${data.draftId}`,
        })
      } else {
        setNotice({ type: 'error', message: data.error || 'Failed to generate draft.' })
      }
    } catch {
      setNotice({ type: 'error', message: 'Error generating weekly unlock draft.' })
    } finally {
      setGeneratingDraft(false)
    }
  }

  // Save new unlock modal
  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenName || !tokenSymbol || !estValueUsd || !pctCircSupply || !unlockDate) return

    setSavingNew(true)
    try {
      const valNum = parseFloat(estValueUsd.replace(/[^0-9.-]/g, '')) * (estValueUsd.toLowerCase().includes('m') ? 1_000_000 : 1)
      const pctNum = parseFloat(pctCircSupply.replace(/[^0-9.-]/g, ''))

      const res = await fetch('/api/unlocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_name: tokenName,
          token_symbol: tokenSymbol,
          est_value_usd: valNum,
          pct_circulating_supply: pctNum,
          unlock_date: unlockDate,
          unlock_type: unlockType,
          description,
        }),
      })

      const data = await res.json()
      if (res.ok && data.data) {
        setUnlocks((prev) => [data.data, ...prev.filter((u) => u.id !== data.data.id)])
        setShowAddModal(false)
        setTokenName('')
        setTokenSymbol('')
        setEstValueUsd('')
        setPctCircSupply('')
        setDescription('')
        setNotice({ type: 'success', message: `Added token unlock event for ${data.data.token_name} (${data.data.token_symbol}).` })
        router.refresh()
      } else {
        alert(data.error || 'Failed to save token unlock.')
      }
    } catch {
      alert('Error creating token unlock.')
    } finally {
      setSavingNew(false)
    }
  }

  return (
    <div className="flex-col gap-6">
      {/* ─── Top Header & Primary Action Toolbar ────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-primary">Token Unlocks Intelligence</h1>
            <span
              className="badge"
              style={{
                background: 'rgba(35, 247, 221, 0.12)',
                color: '#23F7DD',
                border: '1px solid rgba(35, 247, 221, 0.25)',
                fontWeight: 700,
              }}
            >
              {unlocks.length} Tracked
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Weekly supply dilution radar, linear & cliff vesting schedules, and viral social graphics studio
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Social Card Studio Button */}
          <button
            onClick={() => setShowStudioModal(true)}
            className="btn btn-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(35, 247, 221, 0.15) 0%, rgba(142, 51, 255, 0.2) 100%)',
              color: '#23F7DD',
              borderColor: 'rgba(35, 247, 221, 0.35)',
              fontWeight: 700,
              gap: 6,
            }}
          >
            <Sparkles size={14} />
            <span>🎨 Social Card Studio</span>
          </button>

          {/* 1-Click Generate Social Draft */}
          <button
            onClick={handleGenerateDraft}
            disabled={generatingDraft}
            className="btn btn-sm btn-primary"
            style={{ gap: 6, fontWeight: 700 }}
          >
            {generatingDraft ? <RefreshCw size={13} className="spin" /> : <Zap size={13} />}
            <span>{generatingDraft ? 'Drafting...' : '⚡ Generate Social Draft'}</span>
          </button>

          {/* Add Unlock Event */}
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-sm btn-ghost"
            style={{ gap: 6 }}
          >
            <Plus size={14} />
            <span>Add Event</span>
          </button>

          {/* Delete All Button */}
          {unlocks.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="btn btn-sm"
              title="Delete all token unlocks"
              style={{
                color: '#ff4d4f',
                borderColor: 'rgba(255, 77, 79, 0.35)',
                background: 'rgba(255, 77, 79, 0.08)',
                gap: 5,
              }}
            >
              {deletingAll ? <RefreshCw size={12} className="spin" /> : <Trash2 size={12} />}
              <span>Delete All</span>
            </button>
          )}
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
            {notice.link && (
              <Link href={notice.link} className="btn btn-sm btn-primary ml-2" style={{ padding: '2px 8px', height: 'auto', minHeight: 'unset', fontSize: '0.75rem' }}>
                Open Draft <ArrowUpRight size={12} />
              </Link>
            )}
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

      {/* ─── Overview Stats Ribbon ─────────────────────────────────────────── */}
      <div className="grid-4" style={{ gap: 14 }}>
        <div
          className="card flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: 14 }}
        >
          <div>
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Unlocking This Week</div>
            <div className="text-2xl font-black text-primary mt-1">
              {formatUnlockValue(stats.totalValue)}
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(35, 247, 221, 0.1)', color: '#23F7DD' }}>
            <Unlock size={20} />
          </div>
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: 14 }}
        >
          <div>
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Largest Single Unlock</div>
            <div className="text-xl font-black text-primary mt-1 line-clamp-1">
              {stats.top ? `${stats.top.token_symbol} (${formatUnlockValue(stats.top.est_value_usd)})` : 'None'}
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <Flame size={20} />
          </div>
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: 14 }}
        >
          <div>
            <div className="text-xs text-muted font-medium uppercase tracking-wider">High Dilution (&gt;5% Circ)</div>
            <div className="text-2xl font-black text-primary mt-1" style={{ color: stats.highImpact > 0 ? '#ef4444' : '#22c55e' }}>
              {stats.highImpact} <span className="text-xs text-muted font-normal">Tokens</span>
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <TrendingDown size={20} />
          </div>
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', padding: 14 }}
        >
          <div>
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Average Dilution</div>
            <div className="text-2xl font-black text-primary mt-1">
              {stats.avgPct}%
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(142, 51, 255, 0.12)', color: '#8E33FF' }}>
            <Layers size={20} />
          </div>
        </div>
      </div>

      {/* ─── Control Toolbar: Search, Filters & View Mode ───────────────────── */}
      <div
        className="card flex-col gap-3"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          padding: 14,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 220 }}>
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
              placeholder="Search token name, ticker, or notes..."
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

          {/* Sort Dropdown & View Mode Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
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
              <option value="value">Sort: Largest USD Value</option>
              <option value="pct">Sort: Highest % Circ Supply</option>
              <option value="date">Sort: Unlock Date</option>
            </select>

            {/* View Mode Buttons */}
            <div className="flex items-center p-1 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
              <button
                onClick={() => setViewMode('cards')}
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', height: 28 }}
                title="Cards View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', height: 28 }}
                title="Data Table View"
              >
                <TableIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-subtle">
          <button
            onClick={() => setFilterTab('all')}
            className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ height: 30, fontSize: '0.78rem' }}
          >
            All This Week ({unlocks.length})
          </button>
          <button
            onClick={() => setFilterTab('high_impact')}
            className={`btn btn-sm ${filterTab === 'high_impact' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              height: 30,
              fontSize: '0.78rem',
              color: filterTab === 'high_impact' ? '#fff' : '#ef4444',
            }}
          >
            <Flame size={12} />
            <span>High Impact ({unlocks.filter((u) => isHighImpactUnlock(u)).length})</span>
          </button>
          <button
            onClick={() => setFilterTab('linear')}
            className={`btn btn-sm ${filterTab === 'linear' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ height: 30, fontSize: '0.78rem' }}
          >
            Linear ({unlocks.filter((u) => u.unlock_type === 'linear').length})
          </button>
          <button
            onClick={() => setFilterTab('cliff')}
            className={`btn btn-sm ${filterTab === 'cliff' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ height: 30, fontSize: '0.78rem' }}
          >
            Cliff ({unlocks.filter((u) => u.unlock_type === 'cliff').length})
          </button>
        </div>
      </div>

      {/* ─── Main Content: Cards Grid or Data Table ─────────────────────────── */}
      {unlocks.length === 0 ? (
        <div className="card empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div className="empty-state-icon" style={{ fontSize: '2.5rem', margin: '0 auto 16px' }}>
            🔓
          </div>
          <div className="empty-state-title text-xl font-bold text-primary">No Token Unlocks Available</div>
          <div className="empty-state-desc text-sm text-muted max-w-md mx-auto mt-2">
            All unlock events have been cleared or none are recorded for this timeframe.
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary mt-6">
            <Plus size={16} /> Add Token Unlock Event
          </button>
        </div>
      ) : filteredUnlocks.length === 0 ? (
        <div className="card empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div className="text-3xl mb-3">🔍</div>
          <div className="empty-state-title text-lg font-bold text-primary">No Matching Unlocks</div>
          <div className="empty-state-desc text-sm text-muted max-w-md mx-auto mt-1">
            No token unlock records match your search query or filter.
          </div>
          <button
            onClick={() => {
              setSearchQuery('')
              setFilterTab('all')
            }}
            className="btn btn-ghost btn-sm mt-4"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* ─── Research Cards Grid (Matching CoinMarketCap Research Aesthetic) ─── */
        <div className="grid-4" style={{ gap: 18 }}>
          {filteredUnlocks.map((token, index) => {
            const isHigh = isHighImpactUnlock(token)
            const isLinear = token.unlock_type === 'linear'

            // Avatar initial background
            const avatarColors = [
              '#f59e0b',
              '#10b981',
              '#3b82f6',
              '#8b5cf6',
              '#ec4899',
              '#6366f1',
              '#14b8a6',
              '#f97316',
            ]
            const avatarBg = avatarColors[index % avatarColors.length]

            return (
              <div
                key={token.id}
                className="card flex-col justify-between"
                style={{
                  background: 'var(--bg-elevated)',
                  border: isHigh ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-default)',
                  borderRadius: 14,
                  padding: '18px 18px 16px',
                  position: 'relative',
                  minHeight: 290,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                }}
              >
                {/* Delete button (top right) */}
                <button
                  onClick={(e) => handleDelete(e, token.id, token.token_name)}
                  disabled={deletingId === token.id}
                  title="Delete unlock"
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 6,
                    padding: '3px 6px',
                    cursor: 'pointer',
                    color: 'var(--red, #ef4444)',
                  }}
                >
                  {deletingId === token.id ? <RefreshCw size={11} className="spin" /> : <Trash2 size={11} />}
                </button>

                {/* Card Top: Avatar, Name, Ticker & Vesting Tag */}
                <div>
                  <div className="flex items-center justify-between pr-6">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar */}
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: avatarBg,
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          boxShadow: `0 2px 8px ${avatarBg}44`,
                        }}
                      >
                        {token.token_symbol.slice(0, 2)}
                      </div>

                      {/* Name & Symbol */}
                      <div>
                        <h4 className="font-extrabold text-primary text-base line-clamp-1" style={{ lineHeight: 1.2 }}>
                          {token.token_name}
                        </h4>
                        <span className="text-xs text-muted font-bold tracking-wider">{token.token_symbol}</span>
                      </div>
                    </div>

                    {/* Vesting type badge */}
                    <span
                      className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>{isLinear ? 'Linear' : 'Cliff'}</span>
                      <span style={{ color: '#3b82f6', fontSize: '0.75rem' }}>◢</span>
                    </span>
                  </div>

                  <div className="pt-4 pb-2 border-t border-subtle mt-3 flex-col gap-3">
                    {/* Metric 1: % Of Circ. Supply */}
                    <div>
                      <div className="text-xs text-muted font-medium mb-0.5">% Of Circ. Supply</div>
                      <div
                        className="text-2xl font-black"
                        style={{
                          color:
                            token.pct_circulating_supply >= 10.0
                              ? '#ef4444'
                              : token.pct_circulating_supply >= 5.0
                              ? '#f59e0b'
                              : 'var(--brand-primary, #23F7DD)',
                        }}
                      >
                        {token.pct_circulating_supply.toFixed(2)}%
                      </div>
                    </div>

                    {/* Metric 2: Est. Value (USD) */}
                    <div>
                      <div className="text-xs text-muted font-medium mb-0.5">Est. Value (USD)</div>
                      <div className="text-2xl font-black text-primary">
                        {formatUnlockValue(token.est_value_usd)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Date Pill */}
                <div
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold"
                  style={{
                    background: 'rgba(35, 247, 221, 0.06)',
                    border: '1px solid rgba(35, 247, 221, 0.15)',
                    color: 'var(--text-secondary)',
                    marginTop: 10,
                  }}
                >
                  <Calendar size={13} style={{ color: '#f59e0b' }} />
                  <span>{token.unlock_date}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ─── Data Table View ─────────────────────────────────────────────── */
        <div className="card overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-elevated)' }}>
                <th className="p-3 text-xs font-bold text-muted uppercase">Token</th>
                <th className="p-3 text-xs font-bold text-muted uppercase">Est. Value (USD)</th>
                <th className="p-3 text-xs font-bold text-muted uppercase">% Circ. Supply</th>
                <th className="p-3 text-xs font-bold text-muted uppercase">Vesting Type</th>
                <th className="p-3 text-xs font-bold text-muted uppercase">Unlock Date</th>
                <th className="p-3 text-xs font-bold text-muted uppercase">Impact Level</th>
                <th className="p-3 text-xs font-bold text-muted uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnlocks.map((u) => {
                const isHigh = isHighImpactUnlock(u)
                return (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    className="hover:bg-opacity-50"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{u.token_name}</span>
                        <span className="text-xs text-muted">({u.token_symbol})</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-primary">
                      {formatUnlockValue(u.est_value_usd)}
                    </td>
                    <td className="p-3 font-mono font-semibold" style={{ color: u.pct_circulating_supply >= 5 ? '#ef4444' : '#22c55e' }}>
                      {u.pct_circulating_supply.toFixed(2)}%
                    </td>
                    <td className="p-3">
                      <span className="badge badge-muted text-xs capitalize">{u.unlock_type}</span>
                    </td>
                    <td className="p-3 text-xs text-secondary">{u.unlock_date}</td>
                    <td className="p-3">
                      {isHigh ? (
                        <span className="badge badge-red text-xs">High Dilution</span>
                      ) : (
                        <span className="badge badge-green text-xs">Normal</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => handleDelete(e, u.id, u.token_name)}
                        className="btn btn-ghost btn-sm text-red"
                        style={{ padding: '3px 8px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Social Card Studio Modal ───────────────────────────────────────── */}
      {showStudioModal && (
        <TokenUnlockSocialCardStudio
          unlocks={unlocks}
          weekLabel="Oct 26 - Nov 1"
          asModal={true}
          onClose={() => setShowStudioModal(false)}
        />
      )}

      {/* ─── Add Token Unlock Modal ─────────────────────────────────────────── */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="card flex-col gap-4"
            style={{
              maxWidth: 520,
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              padding: 24,
              borderRadius: 14,
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-primary">Add Token Unlock Event</h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-sm">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveNew} className="flex-col gap-3">
              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="text-xs text-muted block mb-1">Token Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Falcon Finance"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Token Symbol *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FF"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="text-xs text-muted block mb-1">Est. Value (USD) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 20070000 or 20.07M"
                    value={estValueUsd}
                    onChange={(e) => setEstValueUsd(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">% Circulating Supply *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 6.07"
                    value={pctCircSupply}
                    onChange={(e) => setPctCircSupply(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="text-xs text-muted block mb-1">Unlock Date *</label>
                  <input
                    type="date"
                    required
                    value={unlockDate}
                    onChange={(e) => setUnlockDate(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Vesting Structure</label>
                  <select
                    value={unlockType}
                    onChange={(e) => setUnlockType(e.target.value as UnlockType)}
                    className="form-input"
                  >
                    <option value="linear">Linear</option>
                    <option value="cliff">Cliff</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">Tranche / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Team & Investor Vesting Tranche"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-subtle">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={savingNew} className="btn btn-primary btn-sm">
                  {savingNew ? 'Saving...' : 'Add Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
