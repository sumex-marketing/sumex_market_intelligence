import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatRelativeTime, getScoreClass } from '@/lib/utils'
import SignalActions from './SignalActions'
import { ArrowLeft, Zap, Shield, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [signalRes, evidenceRes] = await Promise.all([
    supabase.from('signals').select('*').eq('id', id).single(),
    supabase.from('signal_evidence').select('*').eq('signal_id', id),
  ])

  if (!signalRes.data) {
    notFound()
  }

  const signal = signalRes.data
  const evidence = evidenceRes.data ?? []

  return (
    <div className="flex-col gap-6" style={{ maxWidth: '900px' }}>
      <div>
        <Link href="/signals" className="btn btn-ghost btn-sm mb-4">
          <ArrowLeft size={14} /> Back to Signals
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`score-badge ${getScoreClass(signal.score)}`}>
                {signal.score ? signal.score.toFixed(1) : 'N/A'}
              </span>
              <span className={`badge badge-signal-${signal.status}`}>{signal.status}</span>
              <span className={`badge badge-${signal.severity}`}>{signal.severity} severity</span>
            </div>
            <h1 className="text-2xl font-extrabold text-primary">{signal.title}</h1>
            <p className="text-sm text-muted mt-1">
              Detected {formatRelativeTime(signal.created_at)} • Subject: {signal.subject}
            </p>
          </div>

          <SignalActions signal={signal} />
        </div>
      </div>

      {/* Trigger Detail */}
      <div className="card flex-col gap-3">
        <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Trigger Detail</h3>
        <p className="text-sm text-secondary">{signal.trigger_detail}</p>
        {signal.evidence_summary && (
          <div className="p-3 border-subtle bg-surface rounded-md text-xs font-mono text-muted">
            {signal.evidence_summary}
          </div>
        )}
      </div>

      {/* Evidence Items */}
      <div className="card flex-col gap-4">
        <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Supporting Evidence ({evidence.length})</h3>
        {evidence.length === 0 ? (
          <div className="text-xs text-muted">No granular evidence rows attached.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Metric Name</th>
                  <th>Observed Value</th>
                  <th>Threshold</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((ev) => (
                  <tr key={ev.id}>
                    <td className="font-semibold text-primary">{ev.metric_name}</td>
                    <td className="td-mono font-bold text-amber">
                      {ev.value != null ? ev.value.toLocaleString() : ev.value_text ?? 'N/A'}
                    </td>
                    <td className="td-mono text-muted">
                      {ev.comparison_value != null ? ev.comparison_value.toLocaleString() : 'N/A'}
                    </td>
                    <td>
                      <span className="badge badge-blue">{ev.evidence_type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
