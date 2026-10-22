'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ContentDraft } from '@/lib/types'
import {
  Save,
  CheckCircle,
  XCircle,
  Send,
  Copy,
  Check,
  Wand2,
  Eye,
  Edit3,
  Zap,
  FileText,
  Sparkles,
  Clipboard,
} from 'lucide-react'
import Link from 'next/link'
import EtfSocialCardStudio, { XIcon } from '@/app/components/EtfSocialCardStudio'
import { stripMarkdown, markdownToRichHtml } from '@/lib/utils'

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

// Clean document renderer (handles clean plain text with styled headers and list items)
function MarkdownPreview({ text }: { text: string }) {
  const clean = stripMarkdown(text)
  const lines = clean.split('\n')
  const rendered = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return '<div style="height:12px"></div>'
    }

    // Section headers: starting with emoji (📊, 🎯, 📈, ⚡, 🇺🇸) or clean header formats
    if (/^[📊🎯📈⚡]/.test(trimmed) || /^(Key Data Points|Market Commentary|What To Watch|Invalidation|Supporting Evidence|Live Market Context):?$/i.test(trimmed)) {
      return `<h3 style="font-size:1.05rem;font-weight:700;color:#23F7DD;margin:22px 0 8px">${trimmed}</h3>`
    }

    // Sub-bullet (2+ leading spaces and bullet)
    if (/^\s{2,}•\s+(.+)$/.test(line)) {
      const content = line.replace(/^\s{2,}•\s+/, '')
      return `<li style="margin:4px 0 4px 28px;list-style:circle;list-style-position:inside;color:var(--text-secondary);font-size:0.875rem">${content}</li>`
    }

    // Main bullet
    if (/^\s*•\s+(.+)$/.test(line)) {
      const content = line.replace(/^\s*•\s+/, '')
      return `<li style="margin:6px 0;padding-left:4px;list-style:disc;list-style-position:inside;color:var(--text-primary);font-size:0.92rem;font-weight:600">${content}</li>`
    }

    // Regular paragraph
    return `<p style="color:var(--text-secondary);font-size:0.92rem;line-height:1.75;margin:8px 0">${trimmed}</p>`
  }).join('')

  return (
    <div
      style={{
        padding: '24px',
        minHeight: '380px',
        background: 'var(--bg-surface)',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        lineHeight: 1.7,
      }}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  )
}

export default function DraftEditorWorkspace({ draft }: { draft: ContentDraft & { research_cards?: any } }) {
  const router = useRouter()
  const [title, setTitle] = useState(() => stripMarkdown(draft.title ?? ''))
  const [body, setBody] = useState(() => stripMarkdown(draft.body ?? ''))
  const [status, setStatus] = useState(draft.status)
  const [rejectionNote, setRejectionNote] = useState(draft.rejection_note ?? '')
  const [loading, setLoading] = useState(false)
  const [copiedType, setCopiedType] = useState<'clean' | 'social' | 'raw' | null>(null)
  const [viewMode, setViewMode] = useState<'clean' | 'edit'>('clean')
  const [regenerating, setRegenerating] = useState(false)

  const isEtfDraft = draft.format === 'etf_watch' || title.includes('ETF FLOWS') || body.includes('ETF FLOWS')
  const [activeViewTab, setActiveViewTab] = useState<'social' | 'article'>(isEtfDraft ? 'social' : 'article')
  const extractedTweetText = isEtfDraft
    ? (body.split(/(?:###|📊|📈)/)[0].trim() || title)
    : `${title}\n\n${body.slice(0, 240)}`
  const extractedDateMatch = title.match(/[A-Za-z]{3}\.?\s*\d+|[0-9]{4}-[0-9]{2}-[0-9]{2}/)
  const draftDate = extractedDateMatch ? extractedDateMatch[0] : new Date(draft.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const handleSanitizeClean = () => {
    setTitle((prev) => stripMarkdown(prev))
    setBody((prev) => stripMarkdown(prev))
  }

  const handleSave = async (newStatus?: string) => {
    setLoading(true)
    const targetStatus = newStatus ?? status
    const cleanTitle = stripMarkdown(title)
    const cleanBody = stripMarkdown(body)

    try {
      const res = await fetch(`/api/content/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          body: cleanBody,
          status: targetStatus,
          rejection_note: targetStatus === 'rejected' ? rejectionNote : null,
        }),
      })

      if (res.ok) {
        setStatus(targetStatus as any)
        setTitle(cleanTitle)
        setBody(cleanBody)
        router.refresh()
      } else {
        alert('Failed to save changes')
      }
    } catch {
      alert('Error updating draft')
    } finally {
      setLoading(false)
    }
  }

  // 1. Copy Clean Copy (strips all markdown syntax like ##, **, *)
  // Also attaches formatted HTML to the clipboard so pasting into Google Docs, Slack, Notion, or Word formats cleanly!
  const handleCopyCleanText = async () => {
    const cleanTitle = stripMarkdown(title)
    const cleanBody = stripMarkdown(body)
    const cleanFull = `${cleanTitle}\n\n${cleanBody}`
    const richHtml = markdownToRichHtml(cleanTitle, body)

    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([cleanFull], { type: 'text/plain' }),
            'text/html': new Blob([richHtml], { type: 'text/html' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(cleanFull)
      }
    } catch {
      await navigator.clipboard.writeText(cleanFull)
    }

    setCopiedType('clean')
    setTimeout(() => setCopiedType(null), 2500)
  }

  // 2. Copy Social Post only (clean text for X/Twitter, Telegram, LinkedIn)
  const handleCopySocialPost = async () => {
    const cleanPost = stripMarkdown(extractedTweetText)
    await navigator.clipboard.writeText(cleanPost)
    setCopiedType('social')
    setTimeout(() => setCopiedType(null), 2500)
  }

  // 3. Copy Raw Markdown (for developers/internal markdown archives)
  const handleCopyRawMarkdown = async () => {
    await navigator.clipboard.writeText(`# ${title}\n\n${body}`)
    setCopiedType('raw')
    setTimeout(() => setCopiedType(null), 2500)
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
      <div className="card-glass flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-blue uppercase text-xs">
              {FORMAT_LABELS[draft.format] ?? draft.format.replace(/_/g, ' ')}
            </span>
            <span className={`badge ${STATUS_COLORS[status] ?? 'badge-muted'}`}>
              {status.replace(/_/g, ' ')}
            </span>
            {(draft as any).generated_by_ai && (
              <span
                className="badge"
                style={{
                  background: 'rgba(35,247,221,0.12)',
                  color: '#23F7DD',
                  border: '1px solid rgba(35,247,221,0.25)',
                }}
              >
                <Zap size={10} style={{ marginRight: 4 }} />
                AI Generated
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-primary">Content Draft Workspace</h1>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary Action: Copy Clean Copy */}
          <button
            onClick={handleCopyCleanText}
            className="btn btn-primary btn-sm"
            style={{
              background: 'linear-gradient(135deg, #23F7DD 0%, #00C2A0 100%)',
              color: '#041014',
              fontWeight: 700,
              gap: 6,
              boxShadow: '0 2px 10px rgba(35,247,221,0.25)',
            }}
            title="Copy clean publication text without any markdown tags"
          >
            {copiedType === 'clean' ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedType === 'clean' ? 'Clean Copy Copied!' : 'Copy Clean Form'}</span>
          </button>

          {/* Social Flash Copy Button */}
          {isEtfDraft && (
            <button
              onClick={handleCopySocialPost}
              className="btn btn-secondary btn-sm"
              style={{ gap: 6, color: '#23F7DD', borderColor: 'rgba(35,247,221,0.3)' }}
              title="Copy the clean concise social flash post"
            >
              {copiedType === 'social' ? <Check size={14} /> : <XIcon size={13} />}
              <span>{copiedType === 'social' ? 'Social Post Copied!' : 'Copy Social Flash'}</span>
            </button>
          )}

          {/* Clean View vs Edit Switcher */}
          <button
            onClick={() => setViewMode(viewMode === 'clean' ? 'edit' : 'clean')}
            className="btn btn-ghost btn-sm"
            style={{
              color: viewMode === 'edit' ? '#23F7DD' : undefined,
              gap: 5,
              border: '1px solid var(--border-subtle)',
            }}
            title={viewMode === 'clean' ? 'Switch to text edit mode' : 'Switch to formatted view'}
          >
            {viewMode === 'edit' ? <Eye size={14} /> : <Edit3 size={14} />}
            <span>{viewMode === 'edit' ? 'Formatted View' : 'Edit Clean Text'}</span>
          </button>

          {/* Clean Markdown Sanitizer Button */}
          <button
            onClick={handleSanitizeClean}
            className="btn btn-ghost btn-sm"
            style={{ border: '1px solid var(--border-subtle)', gap: 5, color: '#23F7DD' }}
            title="Clean text: strip any markdown asterisks, hashes, or tags"
          >
            <Sparkles size={14} />
            <span>Clean Text</span>
          </button>

          {/* Save Draft Button */}
          <button
            onClick={() => handleSave()}
            className="btn btn-ghost btn-sm"
            disabled={loading}
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <Save size={14} />
            <span>{loading ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs for ETF Drafts */}
      {isEtfDraft && (
        <div className="flex items-center gap-2 border-b border-subtle pb-2">
          <button
            onClick={() => setActiveViewTab('social')}
            className={`btn btn-sm ${activeViewTab === 'social' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ gap: 6 }}
          >
            <XIcon size={14} />
            <span>⚡ Social Media &amp; Graphic Studio</span>
          </button>
          <button
            onClick={() => setActiveViewTab('article')}
            className={`btn btn-sm ${activeViewTab === 'article' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ gap: 6 }}
          >
            <FileText size={14} />
            <span>📄 Full Intelligence Report &amp; Clean Copy</span>
          </button>
        </div>
      )}

      {/* Social Media & Graphic Studio View */}
      {isEtfDraft && activeViewTab === 'social' && (
        <EtfSocialCardStudio
          date={draftDate}
          headline={title}
          tweetText={extractedTweetText}
        />
      )}

      {/* Main Document & Sidebar Grid (Rendered for article tab or non-ETF drafts) */}
      {(!isEtfDraft || activeViewTab === 'article') && (
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
          {/* Main Document Column */}
          <div className="flex-col gap-4">
            {viewMode === 'clean' ? (
              /* CLEAN FORM VIEW (DEFAULT) */
              <div className="flex-col gap-4">
                {/* Clean Title Banner */}
                <div
                  className="card flex-col gap-2"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-semibold text-muted tracking-wider">Publication Headline</span>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-green text-xs">Clean Form Ready</span>
                      <button
                        onClick={() => setViewMode('edit')}
                        className="btn btn-ghost btn-xs text-muted"
                        style={{ padding: '2px 6px' }}
                      >
                        <Edit3 size={11} /> Edit Text
                      </button>
                    </div>
                  </div>
                  <h2 className="text-lg font-bold text-primary" style={{ lineHeight: 1.4 }}>
                    {stripMarkdown(title)}
                  </h2>
                </div>

                {/* Clean Rendered Document */}
                <div className="card flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-subtle">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-semibold text-primary">Clean Document Content</span>
                      <span className="text-xs text-muted">({body.split(' ').filter(Boolean).length} words)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyCleanText}
                        className="btn btn-primary btn-xs"
                        style={{
                          background: '#23F7DD',
                          color: '#000',
                          fontWeight: 700,
                          gap: 4,
                        }}
                      >
                        {copiedType === 'clean' ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedType === 'clean' ? 'Copied Clean!' : 'Copy Clean Text'}</span>
                      </button>

                      <button
                        onClick={handleCopyRawMarkdown}
                        className="btn btn-ghost btn-xs text-muted"
                        title="Copy raw markdown syntax"
                      >
                        {copiedType === 'raw' ? <Check size={11} /> : <FileText size={11} />}
                        <span>Raw MD</span>
                      </button>
                    </div>
                  </div>

                  <MarkdownPreview text={body} />
                </div>
              </div>
            ) : (
              /* CLEAN TEXT EDIT MODE */
              <div className="flex-col gap-4">
                {/* Title */}
                <div className="card flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="form-label mb-0">Report Headline</label>
                    <button
                      onClick={() => setViewMode('clean')}
                      className="btn btn-ghost btn-xs text-blue"
                    >
                      <Eye size={12} /> Switch to Formatted View
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input text-lg font-bold"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Headline Title..."
                  />
                </div>

                {/* Body */}
                <div className="card flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="form-label mb-0">
                        Report Body (Clean Plain Text)
                      </label>
                      <span className="badge badge-green text-xs" style={{ padding: '1px 6px' }}>
                        Clean Form
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSanitizeClean}
                        className="btn btn-ghost btn-xs text-primary"
                        style={{ background: 'rgba(35,247,221,0.08)', gap: 4 }}
                        title="Ensure text is 100% clean without asterisks or hashtags"
                      >
                        <Sparkles size={11} />
                        <span>Clean Formatting</span>
                      </button>
                      <span className="text-xs text-muted">{body.split(' ').filter(Boolean).length} words</span>
                    </div>
                  </div>

                  <textarea
                    className="form-textarea text-sm"
                    style={{ minHeight: '420px', lineHeight: 1.75, fontFamily: 'inherit' }}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Clean institutional intelligence text without any markdown tags..."
                  />
                </div>
              </div>
            )}

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

          {/* Right Sidebar: Context & Actions */}
          <div className="flex-col gap-4">
            {/* Quick Copy Card */}
            <div
              className="card flex-col gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(35,247,221,0.06) 0%, rgba(142,51,255,0.06) 100%)',
                border: '1px solid rgba(35,247,221,0.2)',
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: '#23F7DD' }} />
                <span className="text-sm font-bold text-primary">Clean Copy Center</span>
              </div>
              <p className="text-xs text-muted">
                Copy text formatted cleanly without raw markdown symbols (`#`, `**`, etc.) for immediate pasting into social media, documents, or newsletters.
              </p>

              <button
                onClick={handleCopyCleanText}
                className="btn btn-primary btn-sm"
                style={{
                  background: '#23F7DD',
                  color: '#000',
                  fontWeight: 700,
                  justifyContent: 'center',
                }}
              >
                {copiedType === 'clean' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedType === 'clean' ? 'Clean Copy Ready!' : 'Copy Clean Document'}</span>
              </button>

              {isEtfDraft && (
                <button
                  onClick={handleCopySocialPost}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'center', color: '#23F7DD' }}
                >
                  {copiedType === 'social' ? <Check size={14} /> : <XIcon size={13} />}
                  <span>{copiedType === 'social' ? 'Social Post Copied!' : 'Copy Social Flash'}</span>
                </button>
              )}
            </div>

            {/* AI Engine Panel */}
            {draft.research_id && (
              <div
                className="card flex-col gap-3"
                style={{ border: '1px solid rgba(35,247,221,0.15)', background: 'rgba(35,247,221,0.03)' }}
              >
                <div className="flex items-center gap-2">
                  <Wand2 size={15} style={{ color: '#23F7DD' }} />
                  <span className="text-sm font-semibold text-primary">AI Engine</span>
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

            {/* Source Research Card Panel */}
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
                    <span className="badge badge-amber" style={{ fontSize: '0.82rem' }}>
                      {researchCard.confidence}/10
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Draft Metadata */}
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
      )}
    </div>
  )
}
