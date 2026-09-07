import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ResearchWorkspace from './ResearchWorkspace'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ResearchCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: card } = await supabase
    .from('research_cards')
    .select('*, signals(*)')
    .eq('id', id)
    .single()

  if (!card) {
    notFound()
  }

  return (
    <div className="flex-col gap-6">
      <Link href="/research" className="btn btn-ghost btn-sm" style={{ width: 'fit-content' }}>
        <ArrowLeft size={14} /> Back to Research Workspace
      </Link>

      <ResearchWorkspace card={card} />
    </div>
  )
}
