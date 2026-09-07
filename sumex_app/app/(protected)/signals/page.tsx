import { createClient } from '@/lib/supabase/server'
import SignalFeedWorkspace from './SignalFeedWorkspace'

export const dynamic = 'force-dynamic'

export default async function SignalsPage() {
  const supabase = await createClient()

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
