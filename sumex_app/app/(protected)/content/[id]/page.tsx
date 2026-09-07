import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DraftEditorWorkspace from './DraftEditorWorkspace'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ContentDraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: draft } = await supabase
    .from('content_drafts')
    .select('*, research_cards(*)')
    .eq('id', id)
    .single()

  if (!draft) {
    notFound()
  }

  return (
    <div className="flex-col gap-6">
      <Link href="/content" className="btn btn-ghost btn-sm mb-2" style={{ width: 'fit-content' }}>
        <ArrowLeft size={14} /> Back to Drafts
      </Link>

      <DraftEditorWorkspace draft={draft} />
    </div>
  )
}
