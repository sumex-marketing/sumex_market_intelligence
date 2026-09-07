'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Signal } from '@/lib/types'
import { FileText, CheckCircle, XCircle } from 'lucide-react'

export default function SignalActions({ signal }: { signal: Signal }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCreateResearchCard = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_id: signal.id,
          observation: signal.title,
          question: `Why did ${signal.subject} show ${signal.title}? What is the market impact?`,
        }),
      })

      const data = await res.json()
      if (data.data?.id) {
        router.push(`/research/${data.data.id}`)
      }
    } catch (err) {
      alert('Failed to create research card')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (status: string) => {
    setLoading(true)
    try {
      await fetch(`/api/signals/${signal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } catch (err) {
      alert('Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCreateResearchCard}
        className="btn btn-primary"
        disabled={loading}
      >
        <FileText size={16} />
        <span>Create Research Card</span>
      </button>

      {signal.status !== 'rejected' && (
        <button
          onClick={() => handleUpdateStatus('rejected')}
          className="btn btn-ghost btn-sm text-red"
          disabled={loading}
        >
          <XCircle size={14} />
          <span>Dismiss</span>
        </button>
      )}
    </div>
  )
}
