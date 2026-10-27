'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ResearchCard, AiAnalysisInput, VerifiedFact, NewsItem, ContentFormat } from '@/lib/types'
import {
  Copy,
  Check,
  Bot,
  Sparkles,
  Edit3,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ExternalLink,
  Code,
  Wand2,
  ChevronDown,
  FileText,
  Zap,
  ArrowLeft,
} from 'lucide-react'

const FORMAT_OPTIONS: { value: ContentFormat; label: string; desc: string }[] = [
  { value: 'market_pulse', label: 'Market Pulse', desc: 'Quick ~200w brief on what happened & what it means' },
  { value: 'why_it_moved', label: 'Why It Moved', desc: 'Deep-dive catalyst chain analysis ~300w' },
  { value: 'macro_to_crypto', label: 'Macro to Crypto', desc: 'How macro conditions are transmitting to crypto' },
  { value: 'etf_watch', label: 'ETF Watch', desc: 'Spot ETF flow intelligence note' },
  { value: 'week_ahead', label: 'Week Ahead', desc: 'Forward-looking macro & market preview' },
]

export default function ResearchWorkspace({ card }: { card: ResearchCard }) {
  const router = useRouter()
  const [showExportModal, setShowExportModal] = useState(false)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [exportPackage, setExportPackage] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [aiJsonInput, setAiJsonInput] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [draftFormat, setDraftFormat] = useState<ContentFormat>('market_pulse')
  const [draftGenerating, setDraftGenerating] = useState(false)
  const [draftResult, setDraftResult] = useState<{ id: string; generatedByAi: boolean; etfRows: number; macroEvents: number } | null>(null)

  // Fact management
  const [newFact, setNewFact] = useState('')
  const [facts, setFacts] = useState<VerifiedFact[]>(card.verified_facts ?? [])

  // News management
  const [newsTitle, setNewsTitle] = useState('')
  const [newsUrl, setNewsUrl] = useState('')
  const [newsList, setNewsList] = useState<NewsItem[]>(card.context_news ?? [])

  // Fetch compiled ChatGPT package
  const handleGeneratePackage = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/research/${card.id}/analysis-package`)
      const data = await res.json()
      if (data.package) {
        setExportPackage(JSON.stringify(data.package, null, 2))
        setShowExportModal(true)
      }
    } catch (err) {
      alert('Failed to generate export package')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPackage = () => {
    navigator.clipboard.writeText(exportPackage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveAiAnalysis = async () => {
    setPasteError(null)
    try {
      const parsed = JSON.parse(aiJsonInput) as AiAnalysisInput
      setLoading(true)

      const res = await fetch(`/api/research/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_analysis: parsed }),
      })

      if (res.ok) {
        setShowPasteModal(false)
        setAiJsonInput('')
        router.refresh()
      } else {
        const data = await res.json()
        setPasteError(data.error ?? 'Failed to save analysis')
      }
    } catch (err) {
      setPasteError('Invalid JSON format. Please ensure you copied ChatGPT\'s full JSON response.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEditorialDecision = async (decision: string) => {
    setLoading(true)
    try {
      await fetch(`/api/research/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorial_decision: decision }),
      })
      router.refresh()
    } catch (err) {
      alert('Failed to update decision')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCard = async () => {
    if (!confirm(`Delete research card "${card.observation}"? This cannot be undone.`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/research/${card.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/research')
      } else {
        const data = await res.json().catch(() => ({}))
        alert(`Failed to delete card: ${data.error ?? res.statusText}`)
      }
    } catch {
      alert('Error deleting research card')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAiDraft = async () => {
    setDraftGenerating(true)
    setDraftResult(null)
    try {
      const res = await fetch(`/api/research/${card.id}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: draftFormat }),
      })
      const data = await res.json()
      if (data.data?.id) {
        setDraftResult({
          id: data.data.id,
          generatedByAi: data.generatedByAi,
          etfRows: data.liveDataInjected?.etfRows ?? 0,
          macroEvents: data.liveDataInjected?.macroEvents ?? 0,
        })
      } else {
        alert(data.error ?? 'Failed to generate draft')
      }
    } catch (err) {
      alert('Error generating draft')
    } finally {
      setDraftGenerating(false)
    }
  }

  const handleCreateDraft = async (format: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research_id: card.id,
          format,
          title: card.observation ? `Intelligence Report: ${card.observation}` : 'Market Intelligence Report',
          body: card.thesis ?? '',
        }),
      })
      const data = await res.json()
      if (data.data?.id) {
        router.push(`/content/${data.data.id}`)
      }
    } catch (err) {
      alert('Failed to create content draft')
    } finally {
      setLoading(false)
    }
  }

  const handleAddFact = async () => {
    if (!newFact) return
    const updated = [...facts, { fact: newFact, source: 'Manual Analyst Entry', timestamp: new Date().toISOString() }]
    setFacts(updated)
    setNewFact('')
    await fetch(`/api/research/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified_facts: updated }),
    })
  }

  const handleAddNews = async () => {
    if (!newsTitle || !newsUrl) return
    const newItem: NewsItem = {
      id: crypto.randomUUID(),
      title: newsTitle,
      url: newsUrl,
      discovered_at: new Date().toISOString(),
      status: 'discovered',
      publisher: 'Manual Entry',
      published_at: null,
      summary: null,
      category: null,
      relevance_score: null,
      created_at: new Date().toISOString(),
    }
    const updated = [...newsList, newItem]
    setNewsList(updated)
    setNewsTitle('')
    setNewsUrl('')
    await fetch(`/api/research/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_news: updated }),
    })
  }

  return (
    <div className="flex-col gap-6">
      {/* Top Navigation & Delete Card Button */}
      <div className="flex items-center justify-between">
        <Link href="/research" className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
          <ArrowLeft size={14} /> Back to Research Cards
        </Link>
        <button
          onClick={handleDeleteCard}
          disabled={loading}
          className="btn btn-sm"
          style={{
            color: '#ff4d4f',
            borderColor: 'rgba(255, 77, 79, 0.35)',
            background: 'rgba(255, 77, 79, 0.08)',
            fontWeight: 600,
            gap: 6,
          }}
          title="Delete this research card"
        >
          <Trash2 size={13} />
          <span>Delete Card</span>
        </button>
      </div>

      {/* Header Bar */}
      <div className="card-glass flex items-center justify-between gap-4 flex-wrap" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ minWidth: 0, flex: '1 1 280px' }}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="badge badge-purple">Research Card</span>
            {card.editorial_decision && (
              <span className="badge badge-green">Decision: {card.editorial_decision}</span>
            )}
          </div>
          <h1 className="text-xl font-extrabold text-primary" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{card.observation}</h1>
          <p className="text-sm text-muted mt-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{card.question}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
          <button
            onClick={handleGeneratePackage}
            className="btn btn-primary"
            disabled={loading}
          >
            <Copy size={16} />
            <span>Generate ChatGPT Package</span>
          </button>

          <button
            onClick={() => setShowPasteModal(true)}
            className="btn btn-secondary"
            disabled={loading}
          >
            <Bot size={16} />
            <span>Paste AI Response</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Data Context on Left, AI Synthesis on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, width: '100%', maxWidth: '100%' }}>
        {/* Left Column: Facts, Context, Market Snapshot */}
        <div className="flex-col gap-6">
          {/* Verified Facts Card */}
          <div className="card flex-col gap-3">
            <div className="card-header mb-1">
              <span className="card-title">Verified Facts ({facts.length})</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="form-input"
                placeholder="Add a verified fact..."
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFact()}
              />
              <button onClick={handleAddFact} className="btn btn-secondary btn-sm">
                <Plus size={14} /> Add
              </button>
            </div>

            <div className="flex-col gap-2 mt-2">
              {facts.map((f, i) => (
                <div key={i} className="p-3 bg-surface border-subtle rounded-md text-xs text-primary flex items-start gap-2">
                  <Check size={14} className="text-green flex-shrink-0 mt-0.5" />
                  <span>{f.fact}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Context News */}
          <div className="card flex-col gap-3">
            <div className="card-header mb-1">
              <span className="card-title">Context News & Articles ({newsList.length})</span>
            </div>

            <div className="flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Article Headline"
                  value={newsTitle}
                  onChange={(e) => setNewsTitle(e.target.value)}
                  style={{ flex: '1 1 180px', minWidth: 0 }}
                />
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://..."
                  value={newsUrl}
                  onChange={(e) => setNewsUrl(e.target.value)}
                  style={{ flex: '1 1 160px', minWidth: 0 }}
                />
                <button onClick={handleAddNews} className="btn btn-secondary btn-sm flex-shrink-0">
                  <Plus size={14} /> Add Link
                </button>
              </div>

              <div className="flex-col gap-2 mt-2">
                {newsList.map((n) => (
                  <a
                    key={n.id}
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-surface border-subtle rounded-md text-xs text-primary flex items-center justify-between"
                    style={{ textDecoration: 'none' }}
                  >
                    <span className="font-medium truncate">{n.title}</span>
                    <ExternalLink size={12} className="text-muted flex-shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Synthesis & Editorial Decisions */}
        <div className="flex-col gap-6">
          {/* Market Thesis & Synthesis */}
          <div className="card flex-col gap-4">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber" size={18} />
                <span className="card-title" style={{ color: 'var(--text-primary)' }}>
                  Market Thesis & Intelligence
                </span>
              </div>
              {card.confidence != null && (
                <span className="badge badge-amber">Confidence: {card.confidence}/10</span>
              )}
            </div>

            {card.thesis ? (
              <div className="flex-col gap-3">
                <div className="p-4 bg-surface border-subtle rounded-lg text-sm text-primary leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0 }}>
                  {card.thesis}
                </div>

                {card.ai_analysis?.what_changed && (
                  <div className="flex-col gap-2">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider">Key Shifts Detected</span>
                    <ul className="text-xs text-secondary flex-col gap-1 pl-4">
                      {card.ai_analysis.what_changed.map((shift, idx) => (
                        <li key={idx} style={{ listStyleType: 'disc' }}>{shift}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state p-6">
                <Bot className="empty-state-icon" />
                <div className="empty-state-title">No AI Analysis Attached Yet</div>
                <div className="empty-state-desc">
                  Click "Generate ChatGPT Package", copy it to ChatGPT, and paste the response back.
                </div>
              </div>
            )}
          </div>

          {/* Editorial Decision Panel */}
          <div className="card flex-col gap-4">
            <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Editorial Decision</h3>
            <div className="flex flex-wrap gap-2">
              {['publish_now', 'research_further', 'monitor', 'reject'].map((dec) => (
                <button
                  key={dec}
                  onClick={() => handleUpdateEditorialDecision(dec)}
                  className={`btn ${card.editorial_decision === dec ? 'btn-primary' : 'btn-secondary'} btn-sm capitalize`}
                >
                  {dec.replace('_', ' ')}
                </button>
              ))}
            </div>

            {card.editorial_decision === 'publish_now' && (
              <div className="pt-3 border-t border-subtle">
                <button
                  onClick={() => setShowDraftModal(true)}
                  className="btn btn-success btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Wand2 size={14} /> Generate AI Intelligence Draft
                </button>
              </div>
            )}
          </div>

          {/* AI Draft Quick Generate (always visible) */}
          <div className="card flex-col gap-3" style={{ border: '1px solid rgba(35,247,221,0.15)', background: 'rgba(35,247,221,0.03)' }}>
            <div className="flex items-center gap-2">
              <Wand2 size={16} style={{ color: '#23F7DD' }} />
              <span className="card-title" style={{ color: 'var(--text-primary)' }}>AI Content Draft Engine</span>
            </div>
            <p className="text-xs text-muted">
              Auto-generate a publication-ready intelligence draft from this research card. Uses your configured AI provider (Gemini / OpenAI) or falls back to a structured template.
            </p>
            <div className="form-group">
              <label className="form-label">Content Format</label>
              <select
                className="form-select"
                value={draftFormat}
                onChange={(e) => setDraftFormat(e.target.value as ContentFormat)}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label} - {f.desc}</option>
                ))}
              </select>
            </div>
            {draftResult ? (
              <div className="flex-col gap-2">
                <div className="flex-col gap-1 p-3 rounded-md text-xs" style={{ background: 'rgba(35,247,221,0.1)', border: '1px solid rgba(35,247,221,0.2)' }}>
                  <div className="flex items-center gap-2" style={{ color: '#23F7DD' }}>
                    <Zap size={14} />
                    <span className="font-semibold">{draftResult.generatedByAi ? 'AI draft generated successfully!' : 'Structured draft created (configure AI API key for AI generation)'}</span>
                  </div>
                  {(draftResult.etfRows > 0 || draftResult.macroEvents > 0) && (
                    <div style={{ color: 'rgba(35,247,221,0.7)', marginTop: '4px', paddingLeft: '22px' }}>
                      Live data injected: {draftResult.etfRows > 0 && `${draftResult.etfRows} ETF flow rows`}{draftResult.etfRows > 0 && draftResult.macroEvents > 0 && ' · '}{draftResult.macroEvents > 0 && `${draftResult.macroEvents} macro events`}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => router.push(`/content/${draftResult.id}`)}
                  className="btn btn-primary btn-sm"
                >
                  <FileText size={14} /> Open Draft Editor →
                </button>
                <button
                  onClick={() => setDraftResult(null)}
                  className="btn btn-ghost btn-sm"
                >
                  Generate Another
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateAiDraft}
                className="btn btn-primary"
                disabled={draftGenerating}
                style={{
                  background: draftGenerating ? undefined : 'linear-gradient(135deg, #23F7DD22, #8E33FF33)',
                  border: '1px solid rgba(35,247,221,0.4)',
                  color: '#23F7DD',
                }}
              >
                {draftGenerating ? (
                  <><span className="spin" style={{ display: 'inline-block' }}>◌</span> Generating Draft...</>
                ) : (
                  <><Wand2 size={15} /> Generate AI Draft</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div className="card-glass flex-col gap-4" style={{ width: '100%', maxWidth: '700px', maxHeight: '85vh' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <Code className="text-blue" size={20} /> ChatGPT Export Package
              </h2>
              <button onClick={() => setShowExportModal(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <p className="text-xs text-muted">
              Copy this structured JSON package and send it to ChatGPT. ChatGPT will synthesize the data and output a matching JSON analysis object.
            </p>
            <div className="relative" style={{ flex: 1, overflow: 'hidden' }}>
              <textarea
                readOnly
                className="form-textarea font-mono text-xs"
                style={{ height: '350px', background: 'var(--bg-base)', color: '#a6accd' }}
                value={exportPackage}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowExportModal(false)} className="btn btn-ghost">
                Close
              </button>
              <button onClick={handleCopyPackage} className="btn btn-primary">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Package JSON'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste AI Response Modal */}
      {showPasteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div className="card-glass flex-col gap-4" style={{ width: '100%', maxWidth: '650px' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <Bot className="text-amber" size={20} /> Paste ChatGPT Response JSON
              </h2>
              <button onClick={() => setShowPasteModal(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <p className="text-xs text-muted">
              Paste the exact JSON output returned by ChatGPT below.
            </p>

            {pasteError && (
              <div className="badge badge-red p-3 rounded-md text-xs w-full text-center">
                {pasteError}
              </div>
            )}

            <textarea
              className="form-textarea font-mono text-xs"
              placeholder='{"what_changed": [...], "market_thesis": "...", "confidence_score": 8}'
              style={{ height: '280px', background: 'var(--bg-base)' }}
              value={aiJsonInput}
              onChange={(e) => setAiJsonInput(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowPasteModal(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button onClick={handleSaveAiAnalysis} className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save AI Analysis to Card'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
