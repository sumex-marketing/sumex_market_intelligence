'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, RefreshCw } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface ResearchCard {
  id: string
  observation: string | null
  thesis: string | null
  question: string | null
  confidence: number | null
  editorial_decision: string | null
  ai_analysis: unknown | null
  ai_analyzed_at: string | null
  created_at: string
  signals: { title: string; subject: string } | null
}

export default function ResearchCardList({ initialCards }: { initialCards: ResearchCard[] }) {
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/research/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`Failed to delete: ${data.error ?? res.statusText}`)
        return
      }
      setCards((prev) => prev.filter((c) => c.id !== id))
      router.refresh()
    } catch {
      alert('Error deleting research card')
    } finally {
      setDeletingId(null)
    }
  }

  if (cards.length === 0) {
    return (
      <div className="card empty-state">
        <div className="empty-state-icon" style={{ fontSize: '2rem' }}>📄</div>
        <div className="empty-state-title">No Research Cards</div>
        <div className="empty-state-desc">All research cards have been deleted.</div>
        <Link href="/research/new" className="btn btn-primary mt-2">Create Card</Link>
      </div>
    )
  }

  return (
    <div className="grid-3">
      {cards.map((card) => (
        <div key={card.id} style={{ position: 'relative' }}>
          {/* Delete button — sits above the Link */}
          <button
            onClick={(e) => handleDelete(e, card.id, card.observation ?? card.question ?? 'this card')}
            disabled={deletingId === card.id}
            title="Delete research card"
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
            {deletingId === card.id
              ? <RefreshCw size={12} className="spin" />
              : <Trash2 size={12} />}
          </button>

          <Link
            href={`/research/${card.id}`}
            className="card flex-col justify-between gap-4"
            style={{ textDecoration: 'none', background: 'var(--bg-elevated)', display: 'flex' }}
          >
            <div>
              <div className="flex items-center justify-between mb-2" style={{ paddingRight: 32 }}>
                <span className="badge badge-purple">
                  {card.signals ? card.signals.subject : 'Manual Research'}
                </span>
                {card.editorial_decision ? (
                  <span className="badge badge-green">{card.editorial_decision}</span>
                ) : card.ai_analysis ? (
                  <span className="badge badge-amber">AI Analyzed</span>
                ) : (
                  <span className="badge badge-muted">Draft</span>
                )}
              </div>

              <h3 className="font-bold text-primary text-base line-clamp-2" style={{ lineHeight: 1.4 }}>
                {card.observation ?? 'Untitled Observation'}
              </h3>
              <p className="text-xs text-muted mt-2 line-clamp-2">
                {card.thesis ?? card.question ?? 'Click to open research card workspace...'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-subtle text-xs text-muted">
              <span>Confidence: {card.confidence ? `${card.confidence}/10` : 'Pending'}</span>
              <span>{formatRelativeTime(card.created_at)}</span>
            </div>
          </Link>
        </div>
      ))}
    </div>
  )
}
