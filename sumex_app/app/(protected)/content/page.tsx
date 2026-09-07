import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatRelativeTime } from '@/lib/utils'
import { Edit3, Plus, FileText, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ContentPage() {
  const supabase = await createClient()

  const { data: drafts } = await supabase
    .from('content_drafts')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Content Drafts</h1>
          <p className="text-sm text-muted">Editorial review pipeline & publication readiness</p>
        </div>
      </div>

      {(!drafts || drafts.length === 0) ? (
        <div className="card empty-state">
          <Edit3 className="empty-state-icon" />
          <div className="empty-state-title">No Content Drafts Created</div>
          <div className="empty-state-desc">
            Approved Research Cards generate publication-ready content drafts automatically.
          </div>
          <Link href="/research" className="btn btn-primary mt-2">
            Go to Research Cards
          </Link>
        </div>
      ) : (
        <div className="grid-3">
          {drafts.map((draft) => (
            <Link
              key={draft.id}
              href={`/content/${draft.id}`}
              className="card flex-col justify-between gap-4"
              style={{ textDecoration: 'none', background: 'var(--bg-elevated)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="badge badge-blue uppercase text-xs">{draft.format.replace('_', ' ')}</span>
                  <span className={`badge badge-${draft.status === 'approved' ? 'green' : draft.status === 'editor_review' ? 'amber' : 'muted'}`}>
                    {draft.status}
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
          ))}
        </div>
      )}
    </div>
  )
}
