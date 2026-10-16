import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, FileText } from 'lucide-react'
import ResearchCardList from './ResearchCardList'

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
        <ResearchCardList initialCards={cards as any} />
      )}
    </div>
  )
}
