import { createClient } from '@/lib/supabase/server'
import ContentDraftList from './ContentDraftList'

export const dynamic = 'force-dynamic'

export default async function ContentPage() {
  const supabase = await createClient()

  // NOTE: Auto-draft generation is handled by the cron job (fetch-etf-flows, detect-signals).
  // We do NOT run checkAndDraftAllPending here to prevent deleted drafts from
  // being resurrected on every page refresh. Use the manual "Scan & Draft" button instead.

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

      <ContentDraftList initialDrafts={(drafts ?? []) as any} />
    </div>
  )
}

