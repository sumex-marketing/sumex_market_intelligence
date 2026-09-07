import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatRelativeTime } from '@/lib/utils'
import { FileText, Plus, CheckCircle, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const supabase = await createClient()

  const { data: cards } = await supabase
    .from('research_cards')
    .select('*, signals(title, subject)')
    .order('created_at', { ascending: false })

  return (
    <div className="flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Research Cards</h1>
          <p className="text-sm text-muted">Deep dive analysis workspace & ChatGPT package compiler</p>
        </div>
        <Link href="/research/new" className="btn btn-primary">
          <Plus size={16} /> New Research Card
        </Link>
      </div>

      {(!cards || cards.length === 0) ? (
        <div className="card empty-state">
          <FileText className="empty-state-icon" />
          <div className="empty-state-title">No Research Cards Created</div>
          <div className="empty-state-desc">
            Create a card manually or convert an active signal into a research card.
          </div>
          <Link href="/research/new" className="btn btn-primary mt-2">
            Create Card
          </Link>
        </div>
      ) : (
        <div className="grid-3">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={`/research/${card.id}`}
              className="card flex-col justify-between gap-4"
              style={{ textDecoration: 'none', background: 'var(--bg-elevated)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
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
          ))}
        </div>
      )}
    </div>
  )
}
