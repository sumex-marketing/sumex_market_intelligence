import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkAndDraftAllPending } from '@/lib/services/draft-scanner-service'
import SignalFeedWorkspace from './SignalFeedWorkspace'

export const dynamic = 'force-dynamic'

export default async function SignalsPage() {
  const supabase = await createClient()

  // Auto-populate drafts in the background so signals and drafts stay synchronized
  try {
    const serviceClient = createServiceClient()
    await checkAndDraftAllPending(serviceClient, { maxEtfDays: 5, minSignalScore: 6.5 })
  } catch (err) {
    console.warn('[signals/page] Auto-population check notice:', err)
  }

  const [signalsRes, newsRes] = await Promise.all([
    supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('news_items')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(60),
  ])

  return (
    <SignalFeedWorkspace
      signals={signalsRes.data ?? []}
      newsItems={newsRes.data ?? []}
    />
  )
}
