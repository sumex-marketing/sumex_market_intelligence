'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, RefreshCw } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

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

  if (drafts.length === 0) {
    return (
      <div className="card empty-state">
        <div className="empty-state-icon" style={{ fontSize: '2rem' }}>✍️</div>
        <div className="empty-state-title">No Content Drafts</div>
        <div className="empty-state-desc">All drafts have been deleted.</div>
        <Link href="/research" className="btn btn-primary mt-2">Go to Research Cards</Link>
      </div>
    )
  }

  return (
    <div className="grid-3">
      {drafts.map((draft) => (
        <div key={draft.id} style={{ position: 'relative' }}>
          {/* Delete button — sits above the Link */}
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
            style={{ textDecoration: 'none', background: 'var(--bg-elevated)', display: 'flex' }}
          >
            <div>
              <div className="flex items-center justify-between mb-2" style={{ paddingRight: 32 }}>
                <span className="badge badge-blue uppercase text-xs">{draft.format.replace(/_/g, ' ')}</span>
                <span className={`badge badge-${draft.status === 'approved' ? 'green' : draft.status === 'editor_review' ? 'amber' : 'muted'}`}>
                  {draft.status.replace(/_/g, ' ')}
                </span>
              </div>

              <h3 className="font-bold text-primary text-base line-clamp-2" style={{ lineHeight: 1.4 }}>
                {draft.title ?? 'Untitled Intelligence Report'}
              </h3>
              <p className="text-xs text-muted mt-2 line-clamp-3">
                {draft.body ? draft.body.slice(0, 150) + '...' : 'No draft content body...'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-subtle text-xs text-muted">
              <span>Created {formatRelativeTime(draft.created_at)}</span>
              <span className="text-blue font-medium">Edit Draft →</span>
            </div>
          </Link>
        </div>
      ))}
    </div>
  )
}
