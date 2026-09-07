'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'

function NewResearchCardForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialObs =
    searchParams.get('observation') ||
    searchParams.get('headline') ||
    (searchParams.get('symbol') ? `Market movement anomaly observed in ${searchParams.get('symbol')}` : '')

  const initialUrl = searchParams.get('url')
  const initialQ = initialUrl
    ? `What are the structural drivers and market impacts of this catalyst? (Source: ${initialUrl})`
    : ''

  const [observation, setObservation] = useState(initialObs)
  const [question, setQuestion] = useState(initialQ)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!observation) return
    setLoading(true)

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observation,
          question: question || 'What is driving this anomaly and how should Sumex position?',
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

  return (
    <form onSubmit={handleSubmit} className="card flex-col gap-4">
      <div className="form-group">
        <label className="form-label">Core Observation / Event</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. BTC Coinbase Premium gap flipped positive despite ETF outflows"
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Core Analytical Question</label>
        <textarea
          className="form-textarea"
          placeholder="e.g. Is US spot demand decoupling from derivatives leverage?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
        />
      </div>

      <button type="submit" className="btn btn-primary btn-lg mt-2" disabled={loading}>
        {loading ? 'Creating...' : 'Create Research Card & Formulate Thesis'}
      </button>
    </form>
  )
}

export default function NewResearchCardPage() {
  return (
    <div className="flex-col gap-6" style={{ maxWidth: '650px' }}>
      <div>
        <Link href="/research" className="btn btn-ghost btn-sm mb-4">
          <ArrowLeft size={14} /> Back to Research
        </Link>
        <h1 className="text-2xl font-extrabold text-primary">New Research Card</h1>
        <p className="text-sm text-muted mt-1">
          Initiate a new research topic for data collection, evidence evaluation, and AI synthesis
        </p>
      </div>

      <Suspense fallback={<div className="card text-muted">Loading research form...</div>}>
        <NewResearchCardForm />
      </Suspense>
    </div>
  )
}
