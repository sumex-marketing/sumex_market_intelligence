'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContentDraft } from '@/lib/types'
import { Save, CheckCircle, XCircle, Send, Copy, Check, Wand2, Eye, Edit3, Zap, FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const FORMAT_LABELS: Record<string, string> = {
  market_pulse: 'Market Pulse',
  why_it_moved: 'Why It Moved',
  macro_to_crypto: 'Macro to Crypto',
  etf_watch: 'ETF Watch',
  week_ahead: 'Week Ahead',
  weekly_intelligence: 'Weekly Intelligence',
  narrative_watch: 'Narrative Watch',
  chart_insight: 'Chart Insight',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'badge-muted',
  editor_review: 'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-red',
}

// Simple markdown preview renderer
function MarkdownPreview({ text }: { text: string }) {
  const html = text
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin:16px 0 8px">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin:12px 0 6px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;list-style:disc;list-style-position:inside;color:var(--text-secondary);font-size:0.875rem">$1</li>')
    .replace(/^(.+)$/gm, (line) => {
      if (line.startsWith('<h') || line.startsWith('<li')) return line
      return `<p style="color:var(--text-secondary);font-size:0.875rem;line-height:1.7;margin:6px 0">${line}</p>`
    })

  return (
    <div
      style={{ padding: '16px', minHeight: '350px' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default function DraftEditorWorkspace({ draft }: { draft: ContentDraft & { research_cards?: any } }) {
  const router = useRouter()
  const [title, setTitle] = useState(draft.title ?? '')
  const [body, setBody] = useState(draft.body ?? '')
  const [status, setStatus] = useState(draft.status)
  const [rejectionNote, setRejectionNote] = useState(draft.rejection_note ?? '')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const handleSave = async (newStatus?: string) => {
    setLoading(true)
    const targetStatus = newStatus ?? status

    try {
      const res = await fetch(`/api/content/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          status: targetStatus,
          rejection_note: targetStatus === 'rejected' ? rejectionNote : null,
        }),
      })

      if (res.ok) {
        setStatus(targetStatus as any)
        router.refresh()
      } else {
        alert('Failed to save changes')
      }
    } catch (err) {
      alert('Error updating draft')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyFormattedText = () => {
    const textToCopy = `# ${title}\n\n${body}`
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerateDraft = async () => {
    if (!draft.research_id) return
    setRegenerating(true)
    try {
      const res = await fetch(`/api/research/${draft.research_id}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: draft.format }),
      })
      const data = await res.json()
      if (data.data?.id) {
        router.push(`/content/${data.data.id}`)
      }
    } catch {
      alert('Error regenerating draft')
    } finally {
      setRegenerating(false)
    }
  }

  const researchCard = draft.research_cards

  return (
    <div className="flex-col gap-6">
      {/* Action Header */}
      <div className="card-glass flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-blue uppercase">
              {FORMAT_LABELS[draft.format] ?? draft.format.replace(/_/g, ' ')}
            </span>
            <span className={`badge ${STATUS_COLORS[status] ?? 'badge-muted'}`}>
              {status.replace(/_/g, ' ')}
            </span>
            {(draft as any).generated_by_ai && (
              <span className="badge" style={{ background: 'rgba(35,247,221,0.12)', color: '#23F7DD', border: '1px solid rgba(35,247,221,0.25)' }}>
                <Zap size={10} style={{ marginRight: 4 }} />AI Generated
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-primary">Content Draft Editor</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="btn btn-ghost btn-sm"
            style={{ color: previewMode ? '#23F7DD' : undefined }}
          >
            {previewMode ? <Edit3 size={14} /> : <Eye size={14} />}
            <span>{previewMode ? 'Edit Mode' : 'Preview'}</span>
          </button>

          <button onClick={handleCopyFormattedText} className="btn btn-secondary btn-sm">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy Text'}</span>
          </button>

          <button onClick={() => handleSave()} className="btn btn-primary btn-sm" disabled={loading}>
            <Save size={14} />
            <span>{loading ? 'Saving...' : 'Save Draft'}</span>
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
        {/* Main Editor */}
        <div className="flex-col gap-4">
          {/* Title */}
          <div className="card flex-col gap-3">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Report Title</label>
              <input
                type="text"
                className="form-input text-lg font-bold"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Headline Title..."
              />
            </div>
          </div>

          {/* Body */}
          <div className="card flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="form-label" style={{ marginBottom: 0 }}>
                Report Body {previewMode ? '(Preview)' : '(Markdown Supported)'}
              </label>
              <span className="text-xs text-muted">{body.split(' ').filter(Boolean).length} words</span>
            </div>

            {previewMode ? (
              <div
                style={{
                  minHeight: '350px',
                  background: 'var(--bg-surface)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'auto',
                }}
              >
                <MarkdownPreview text={body} />
              </div>
            ) : (
              <textarea
                className="form-textarea font-sans text-sm"
                style={{ minHeight: '380px', lineHeight: 1.7 }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write intelligence draft content... (## for headings, **bold**, - for lists)"
              />
            )}
          </div>

          {/* Editorial Approval Pipeline */}
          <div className="card flex-col gap-4">
            <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Editorial Approval Pipeline</h3>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleSave('editor_review')}
                className={`btn ${status === 'editor_review' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                disabled={loading}
              >
                <Send size={14} /> Submit for Review
              </button>

              <button
                onClick={() => handleSave('approved')}
                className="btn btn-success btn-sm"
                disabled={loading}
              >
                <CheckCircle size={14} /> Approve for Publication
              </button>

              <button
                onClick={() => handleSave('rejected')}
                className="btn btn-danger btn-sm"
                disabled={loading}
              >
                <XCircle size={14} /> Reject Draft
              </button>
            </div>

            {status === 'rejected' && (
              <div className="form-group mt-2">
                <label className="form-label" style={{ color: 'var(--text-red)' }}>Rejection Note / Feedback</label>
                <input
                  type="text"
                  className="form-input"
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Reason for rejection or requested changes..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Research Card Context */}
        <div className="flex-col gap-4">
          {/* Regenerate */}
          {draft.research_id && (
            <div
              className="card flex-col gap-3"
              style={{ border: '1px solid rgba(35,247,221,0.15)', background: 'rgba(35,247,221,0.03)' }}
            >
              <div className="flex items-center gap-2">
                <Wand2 size={15} style={{ color: '#23F7DD' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Engine</span>
              </div>
              <p className="text-xs text-muted">Regenerate this draft with fresh AI output from the same research card.</p>
              <button
                onClick={handleRegenerateDraft}
                className="btn btn-secondary btn-sm"
                disabled={regenerating}
              >
                {regenerating ? 'Regenerating...' : <><Wand2 size={13} /> Regenerate Draft</>}
              </button>
              <Link
                href={`/research/${draft.research_id}`}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'center' }}
              >
                <FileText size={13} /> View Research Card
              </Link>
            </div>
          )}

          {/* Research Card Context Panel */}
          {researchCard && (
            <div className="card flex-col gap-3">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Source Research Card</span>

              <div className="p-3 rounded-md" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <div className="text-sm font-semibold text-primary mb-1">{researchCard.observation ?? 'Observation'}</div>
                <div className="text-xs text-muted">{researchCard.question}</div>
              </div>

              {researchCard.thesis && (
                <div>
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Thesis</div>
                  <p className="text-xs text-secondary leading-relaxed">{researchCard.thesis.slice(0, 300)}{researchCard.thesis.length > 300 ? '...' : ''}</p>
                </div>
              )}

              {researchCard.confidence != null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Confidence:</span>
                  <span
                    className="badge badge-amber"
                    style={{ fontSize: '0.82rem' }}
                  >
                    {researchCard.confidence}/10
                  </span>
                </div>
              )}

              {researchCard.editorial_decision && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Editorial Decision:</span>
                  <span className="badge badge-green" style={{ fontSize: '0.82rem' }}>
                    {researchCard.editorial_decision.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Draft Info */}
          <div className="card flex-col gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Draft Info</span>
            <div className="text-xs text-muted flex items-center justify-between">
              <span>Format</span>
              <span className="text-primary font-medium">{FORMAT_LABELS[draft.format] ?? draft.format}</span>
            </div>
            <div className="text-xs text-muted flex items-center justify-between">
              <span>Word Count</span>
              <span className="text-primary font-medium">{body.split(' ').filter(Boolean).length}w</span>
            </div>
            <div className="text-xs text-muted flex items-center justify-between">
              <span>Status</span>
              <span className={`badge ${STATUS_COLORS[status] ?? 'badge-muted'}`} style={{ fontSize: '0.82rem' }}>
                {status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
