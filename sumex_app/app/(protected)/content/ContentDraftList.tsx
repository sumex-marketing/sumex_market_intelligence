'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, RefreshCw, Zap, Copy, Check, Sparkles } from 'lucide-react'
import { XIcon } from '@/app/components/EtfSocialCardStudio'
import { formatRelativeTime, stripMarkdown } from '@/lib/utils'

interface ContentDraft {
  id: string
  format: string
  title: string | null
  body: string | null
  status: string
  created_at: string
}

export default function ContentDraftList({ initialDrafts }: { initialDrafts: ContentDraft[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState(initialDrafts)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [generatingEtf, setGeneratingEtf] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<'all' | 'etf' | 'other'>('all')

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`Failed to delete: ${data.error ?? res.statusText}`)
        return
      }
      setDrafts((prev) => prev.filter((d) => d.id !== id))
      router.refresh()
    } catch {
      alert('Error deleting content draft')
    } finally {
      setDeletingId(null)
    }
  }

  const [scanNotice, setScanNotice] = useState<string | null>(null)

  const handleCheckAndGenerateDrafts = async () => {
    setGeneratingEtf(true)
    setScanNotice(null)
    try {
      const res = await fetch('/api/content/scan-and-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        setScanNotice(data.summaryMessage || 'Draft scan complete.')
        router.refresh()
      } else {
        alert(`Draft generation error: ${data.error ?? 'Unknown error'}`)
      }
    } catch {
      alert('Error triggering draft generation')
    } finally {
      setGeneratingEtf(false)
    }
  }

  const handleCopyQuickPost = (e: React.MouseEvent, draft: ContentDraft) => {
    e.preventDefault()
    e.stopPropagation()
    const tweetText = draft.body?.split(/(?:###|📊|📈)/)[0].trim() || draft.title || ''
    const cleanText = stripMarkdown(tweetText)
    navigator.clipboard.writeText(cleanText)
    setCopiedId(draft.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredDrafts = drafts.filter((d) => {
    const isEtf = d.format === 'etf_watch' || d.title?.includes('ETF FLOWS') || d.body?.includes('ETF FLOWS')
    if (filterTab === 'etf') return isEtf
    if (filterTab === 'other') return !isEtf
    return true
  })

  return (
    <div className="flex-col gap-6">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Filter Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterTab('all')}
            className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          >
            All Drafts ({drafts.length})
          </button>
          <button
            onClick={() => setFilterTab('etf')}
            className={`btn btn-sm ${filterTab === 'etf' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              color: filterTab === 'etf' ? '#000' : '#23F7DD',
              background: filterTab === 'etf' ? '#23F7DD' : 'rgba(35,247,221,0.1)',
              borderColor: 'rgba(35,247,221,0.3)',
            }}
          >
            <Zap size={14} />
            <span>⚡ ETF Flow Flashes ({drafts.filter((d) => d.format === 'etf_watch' || d.title?.includes('ETF FLOWS')).length})</span>
          </button>
          <button
            onClick={() => setFilterTab('other')}
            className={`btn btn-sm ${filterTab === 'other' ? 'btn-primary' : 'btn-ghost'}`}
          >
            Market Briefs ({drafts.filter((d) => d.format !== 'etf_watch' && !d.title?.includes('ETF FLOWS')).length})
          </button>
        </div>

        {/* Action Button: Check & Generate Drafts */}
        <button
          onClick={handleCheckAndGenerateDrafts}
          disabled={generatingEtf}
          className="btn btn-secondary btn-sm"
          style={{
            gap: 6,
            background: 'linear-gradient(135deg, rgba(35,247,221,0.12) 0%, rgba(142,51,255,0.12) 100%)',
            borderColor: 'rgba(35,247,221,0.4)',
            color: '#23F7DD',
            fontWeight: 700,
          }}
          title="Scan ETF flows and high-conviction signals to draft any noteworthy events"
        >
          {generatingEtf ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
          <span>{generatingEtf ? 'Checking Feeds & Drafting...' : '⚡ Check & Generate Drafts'}</span>
        </button>
      </div>

      {/* Notice Banner */}
      {scanNotice && (
        <div
          className="card p-3 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(35,247,221,0.1) 0%, rgba(142,51,255,0.06) 100%)',
            border: '1px solid rgba(35,247,221,0.3)',
            borderRadius: 10,
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: '#23F7DD' }} />
            <span className="text-sm font-semibold text-primary">{scanNotice}</span>
          </div>
          <button onClick={() => setScanNotice(null)} className="btn btn-ghost btn-xs text-muted">
            Dismiss
          </button>
        </div>
      )}

      {filteredDrafts.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon" style={{ fontSize: '2rem' }}>✍️</div>
          <div className="empty-state-title">No Content Drafts in this view</div>
          <div className="empty-state-desc">Click "Check & Generate Drafts" to scan for noteworthy ETF flows and market signals.</div>
          <button onClick={handleCheckAndGenerateDrafts} className="btn btn-primary mt-2">
            Check & Generate Drafts Now
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {filteredDrafts.map((draft) => {
            const isEtf = draft.format === 'etf_watch' || draft.title?.includes('ETF FLOWS') || draft.body?.includes('ETF FLOWS')

            return (
              <div key={draft.id} style={{ position: 'relative' }}>
                {/* Delete button — top right */}
                <button
                  onClick={(e) => handleDelete(e, draft.id, draft.title ?? 'this draft')}
                  disabled={deletingId === draft.id}
                  title="Delete content draft"
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 10,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 6,
                    padding: '4px 7px',
                    cursor: 'pointer',
                    color: 'var(--red, #ef4444)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.22)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                >
                  {deletingId === draft.id
                    ? <RefreshCw size={12} className="spin" />
                    : <Trash2 size={12} />}
                </button>

                <Link
                  href={`/content/${draft.id}`}
                  className="card flex-col justify-between gap-4"
                  style={{
                    textDecoration: 'none',
                    background: isEtf ? 'linear-gradient(180deg, rgba(35,247,221,0.03) 0%, var(--bg-elevated) 100%)' : 'var(--bg-elevated)',
                    border: isEtf ? '1px solid rgba(35,247,221,0.2)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    height: '100%',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2" style={{ paddingRight: 32 }}>
                      {isEtf ? (
                        <span
                          className="badge text-xs uppercase"
                          style={{
                            background: 'rgba(35,247,221,0.15)',
                            color: '#23F7DD',
                            border: '1px solid rgba(35,247,221,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <XIcon size={10} /> Social Flash
                        </span>
                      ) : (
                        <span className="badge badge-blue uppercase text-xs">{draft.format.replace(/_/g, ' ')}</span>
                      )}

                      <span className={`badge badge-${draft.status === 'approved' ? 'green' : draft.status === 'editor_review' ? 'amber' : 'muted'}`}>
                        {draft.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h3 className="font-bold text-primary text-base line-clamp-2" style={{ lineHeight: 1.4 }}>
                      {draft.title ?? 'Untitled Intelligence Report'}
                    </h3>

                    <p className="text-xs text-muted mt-2 line-clamp-3" style={{ whiteSpace: 'pre-line' }}>
                      {draft.body ? stripMarkdown(draft.body).slice(0, 160) + '...' : 'No draft content body...'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-subtle text-xs text-muted">
                    <span>{formatRelativeTime(draft.created_at)}</span>

                    <div className="flex items-center gap-2">
                      {isEtf && (
                        <button
                          onClick={(e) => handleCopyQuickPost(e, draft)}
                          className="btn btn-ghost btn-xs"
                          style={{
                            padding: '2px 8px',
                            color: copiedId === draft.id ? '#22C55E' : '#23F7DD',
                            background: 'rgba(35,247,221,0.08)',
                          }}
                          title="Copy social post text to clipboard"
                        >
                          {copiedId === draft.id ? <Check size={11} /> : <Copy size={11} />}
                          <span>{copiedId === draft.id ? 'Copied!' : 'Copy Post'}</span>
                        </button>
                      )}
                      <span className="text-blue font-medium">Edit Studio →</span>
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
