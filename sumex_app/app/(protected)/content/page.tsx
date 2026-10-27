import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkAndDraftAllPending } from '@/lib/services/draft-scanner-service'
import { Edit3 } from 'lucide-react'
import ContentDraftList from './ContentDraftList'

export const dynamic = 'force-dynamic'

export default async function ContentPage() {
  const supabase = await createClient()

  // Auto-populate any pending ETF flows or high-conviction signals automatically on page load
  try {
    const serviceClient = createServiceClient()
    await checkAndDraftAllPending(serviceClient, { maxEtfDays: 7, minSignalScore: 6.5 })
  } catch (err) {
    console.warn('[content/page] Auto-population check notice:', err)
  }

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

