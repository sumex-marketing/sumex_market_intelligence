import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, FileText } from 'lucide-react'
import ResearchCardList from './ResearchCardList'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const supabase = await createClient()

  const { data: cards } = await supabase
    .from('research_cards')
    .select('*, signals(id, title, subject, score, signal_type), content_drafts(id, format, status, created_at)')
    .order('created_at', { ascending: false })

  return (
    <div className="flex-col gap-6" style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden' }}>
      <ResearchCardList initialCards={(cards as any) ?? []} />
    </div>
  )
}

