import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Edit3 } from 'lucide-react'
import ContentDraftList from './ContentDraftList'

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
          <p className="text-sm text-muted">Editorial review pipeline &amp; publication readiness</p>
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
        <ContentDraftList initialDrafts={drafts as any} />
      )}
    </div>
  )
}
