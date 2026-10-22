'use client'

import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import { stripMarkdown } from '@/lib/utils'

export function XIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

interface EtfFlowItem {
  asset: string
  flowFormatted: string
  flowNum: number
}

interface EtfSocialCardStudioProps {
  date: string
  headline?: string
  tweetText: string
  flows?: EtfFlowItem[]
}

export default function EtfSocialCardStudio({
  date,
  headline: _headline,
  tweetText: initialTweetText,
  flows = [],
}: EtfSocialCardStudioProps) {
  const [tweetText, setTweetText] = useState(stripMarkdown(initialTweetText))
  const [copiedText, setCopiedText] = useState(false)
  const [downloadingCard, setDownloadingCard] = useState<string | null>(null)
  const [copiedImage, setCopiedImage] = useState<string | null>(null)
  const [activeCardTab, setActiveCardTab] = useState<'asset_cards' | 'scorecard' | 'banner'>('asset_cards')

  // Parse flow items if not passed in props
  const parsedFlows: EtfFlowItem[] = flows.length > 0 ? flows : (() => {
    const list: EtfFlowItem[] = []
    const lines = tweetText.split('\n')
    for (const l of lines) {
      const match = l.match(/^(BTC|ETH|SOL|HYPE):\s*([+\-]?\$[0-9.]+[MB])/i)
      if (match) {
        const asset = match[1].toUpperCase()
        const flowFormatted = match[2]
        const numStr = flowFormatted.replace(/[^0-9.-]/g, '')
        const mult = flowFormatted.toUpperCase().includes('B') ? 1000 : 1
        const sign = flowFormatted.includes('-') ? -1 : 1
        const flowNum = sign * Math.abs(parseFloat(numStr) * mult)
        list.push({ asset, flowFormatted, flowNum })
      }
    }
    return list
  })()

  const handleCopyTweet = () => {
    const clean = stripMarkdown(tweetText)
    navigator.clipboard.writeText(clean)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  // Draw Asset Duo Card on Canvas (Card 1: BTC & ETH)
  const drawCard1 = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Pitch black background matching Cointelegraph
    ctx.fillStyle = '#060709'
    ctx.fillRect(0, 0, width, height)

    // Subtle dark border
    ctx.strokeStyle = '#1F2430'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, width - 4, height - 4)

    // Bitcoin symbol (left side)
    const centerX1 = width * 0.32
    const centerY = height * 0.5

    ctx.save()
    ctx.font = 'bold 150px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('₿', centerX1, centerY)
    ctx.restore()

    // Ethereum symbol (right side - geometric diamond)
    const centerX2 = width * 0.68
    ctx.save()
    ctx.translate(centerX2, centerY)

    // Draw Ethereum diamond top
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.moveTo(0, -90)
    ctx.lineTo(55, 0)
    ctx.lineTo(0, 32)
    ctx.lineTo(-55, 0)
    ctx.closePath()
    ctx.fill()

    // Draw Ethereum diamond bottom
    ctx.fillStyle = '#C0C5D0'
    ctx.beginPath()
    ctx.moveTo(0, 48)
    ctx.lineTo(55, 12)
    ctx.lineTo(0, 95)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.moveTo(0, 48)
    ctx.lineTo(-55, 12)
    ctx.lineTo(0, 95)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  // Draw Solana Card on Canvas (Card 2: Solana gradient logo + typography)
  const drawCard2 = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Pitch black background matching Cointelegraph
    ctx.fillStyle = '#060709'
    ctx.fillRect(0, 0, width, height)

    // Subtle dark border
    ctx.strokeStyle = '#1F2430'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, width - 4, height - 4)

    const cx = width * 0.5
    const cy = height * 0.42

    // Solana gradient bars
    const gradient = ctx.createLinearGradient(cx - 130, cy - 80, cx + 130, cy + 80)
    gradient.addColorStop(0, '#00FFA3') // Solana cyan/green
    gradient.addColorStop(0.5, '#7F5AF0')
    gradient.addColorStop(1, '#DC1FFF') // Solana purple

    ctx.save()
    ctx.fillStyle = gradient

    // Helper for Solana parallelogram bar
    const drawBar = (y: number, invert: boolean) => {
      const barW = 200
      const barH = 34
      const slant = invert ? -32 : 32
      ctx.beginPath()
      ctx.moveTo(cx - barW / 2 + slant, y - barH / 2)
      ctx.lineTo(cx + barW / 2 + slant, y - barH / 2)
      ctx.lineTo(cx + barW / 2 - slant, y + barH / 2)
      ctx.lineTo(cx - barW / 2 - slant, y + barH / 2)
      ctx.closePath()
      ctx.fill()
    }

    drawBar(cy - 52, false)
    drawBar(cy, true)
    drawBar(cy + 52, false)

    // "SOLANA" text below
    ctx.font = '900 44px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '6px'
    ctx.fillText('SOLANA', cx, height * 0.78)

    ctx.restore()
  }

  // Draw Scorecard Card (Institutional ETF Net Flow breakdown)
  const drawScorecard = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Rich obsidian gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, '#090B10')
    bgGrad.addColorStop(1, '#11141D')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // Glass panel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(40, 40, width - 80, height - 80, 24)
    ctx.fill()
    ctx.stroke()

    // Header badge
    ctx.fillStyle = '#23F7DD'
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('🇺🇸 US SPOT ETF NET FLOWS', 80, 110)

    // Date
    ctx.fillStyle = '#94A3B8'
    ctx.font = '600 20px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(date, width - 80, 110)

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(80, 140)
    ctx.lineTo(width - 80, 140)
    ctx.stroke()

    // Flow items
    const startY = 200
    const rowHeight = 90
    parsedFlows.forEach((item, idx) => {
      const y = startY + idx * rowHeight
      const isPositive = (item.flowNum ?? 0) >= 0

      // Asset Symbol Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.beginPath()
      ctx.roundRect(80, y - 36, 120, 60, 12)
      ctx.fill()

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 28px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(item.asset, 140, y + 4)

      // Flow Badge Pill
      const pillBg = isPositive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'
      const pillBorder = isPositive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'
      const pillColor = isPositive ? '#22C55E' : '#EF4444'

      ctx.fillStyle = pillBg
      ctx.strokeStyle = pillBorder
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(width - 320, y - 34, 240, 56, 28)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = pillColor
      ctx.font = 'bold 30px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(item.flowFormatted, width - 200, y + 5)
    })

    // Footer Watermark
    ctx.fillStyle = '#64748B'
    ctx.font = '600 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SUMEX MARKET INTELLIGENCE • FARSIDE INVESTORS VERIFIED', width / 2, height - 70)
  }

  // Handle Export to PNG
  const handleDownload = (cardType: 'card1' | 'card2' | 'scorecard') => {
    setDownloadingCard(cardType)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 800
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (cardType === 'card1') drawCard1(ctx, 800, 800)
      else if (cardType === 'card2') drawCard2(ctx, 800, 800)
      else drawScorecard(ctx, 800, 800)

      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.download = `etf-flows-${date}-${cardType}.png`
      a.href = url
      a.click()
    } finally {
      setTimeout(() => setDownloadingCard(null), 1000)
    }
  }

  // Copy Image directly to clipboard
  const handleCopyImage = async (cardType: 'card1' | 'card2' | 'scorecard') => {
    setCopiedImage(cardType)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 800
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (cardType === 'card1') drawCard1(ctx, 800, 800)
      else if (cardType === 'card2') drawCard2(ctx, 800, 800)
      else drawScorecard(ctx, 800, 800)

      canvas.toBlob(async (blob) => {
        if (!blob) return
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          setTimeout(() => setCopiedImage(null), 2500)
        } catch {
          alert('Image copying not supported by this browser. Use "Download Image" instead.')
          setCopiedImage(null)
        }
      }, 'image/png')
    } catch {
      setCopiedImage(null)
    }
  }

  const charCount = tweetText.length
  const charLimit = 280
  const isOverLimit = charCount > charLimit

  return (
    <div className="card flex-col gap-6" style={{ background: '#0D0E12', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Studio Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-subtle">
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #23F7DD 0%, #8E33FF 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontWeight: 900,
            }}
          >
            <XIcon size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              Social Media &amp; Graphic Cards Studio
              <span className="badge badge-blue text-xs uppercase">Auto-Generated</span>
            </h2>
            <p className="text-xs text-muted">
              Matches institutional Cointelegraph / X flash format with one-click copy &amp; visual media export.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyTweet}
            className="btn btn-primary btn-sm"
            style={{ gap: 6 }}
          >
            {copiedText ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedText ? 'Post Copied!' : 'Copy Post Text'}</span>
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Live Tweet Preview */}
        <div className="flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold text-primary uppercase tracking-wider">Twitter / X Post Preview</span>
            <span style={{ color: isOverLimit ? '#EF4444' : '#64748B', fontWeight: 600 }}>
              {charCount} / {charLimit} chars
            </span>
          </div>

          {/* Twitter Card Mockup */}
          <div
            style={{
              background: '#000000',
              border: '1px solid #2F3336',
              borderRadius: 16,
              padding: '16px 20px',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              color: '#E7E9EA',
            }}
          >
            {/* Author Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #23F7DD, #8E33FF)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.1rem',
                    color: '#000',
                  }}
                >
                  S
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: '#F7F9F9' }}>
                    <span>Sumex Intelligence</span>
                    <span style={{ color: '#1D9BF0' }}>✓</span>
                  </div>
                  <div className="text-xs" style={{ color: '#71767B' }}>
                    @SumexIntel · Just now
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Tweet Body */}
            <textarea
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#E7E9EA',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                resize: 'vertical',
                fontFamily: 'inherit',
                marginBottom: 14,
              }}
              placeholder="Post text..."
            />

            {/* Attached Media Grid in Tweet */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid #2F3336',
                background: '#060709',
              }}
            >
              {/* Image 1: Dual Asset (BTC + ETH) */}
              <div
                style={{
                  aspectRatio: '1/1',
                  background: '#060709',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  borderRight: '1px solid #2F3336',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: '3rem', fontWeight: 900, color: '#FFFFFF' }}>₿</span>
                <span style={{ fontSize: '2.5rem', color: '#FFFFFF' }}>⬨</span>
              </div>

              {/* Image 2: Solana Brand */}
              <div
                style={{
                  aspectRatio: '1/1',
                  background: '#060709',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 40,
                    background: 'linear-gradient(135deg, #00FFA3, #DC1FFF)',
                    clipPath: 'polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)',
                  }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 900, letterSpacing: 3, color: '#FFFFFF' }}>
                  SOLANA
                </span>
              </div>
            </div>

            {/* Tweet Action Icons */}
            <div className="flex items-center justify-between mt-3 text-xs" style={{ color: '#71767B', paddingTop: 8 }}>
              <span>💬 36</span>
              <span>🔁 12</span>
              <span>❤️ 80</span>
              <span>📊 21K</span>
            </div>
          </div>
        </div>

        {/* Right Column: High-Res Visual Graphics Generator */}
        <div className="flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold text-primary uppercase tracking-wider">Visual Share Graphics</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveCardTab('asset_cards')}
                className={`btn btn-xs ${activeCardTab === 'asset_cards' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Asset Cards
              </button>
              <button
                onClick={() => setActiveCardTab('scorecard')}
                className={`btn btn-xs ${activeCardTab === 'scorecard' ? 'btn-primary' : 'btn-ghost'}`}
              >
                Scorecard
              </button>
            </div>
          </div>

          {activeCardTab === 'asset_cards' ? (
            <div className="flex-col gap-3">
              {/* Asset Cards Preview */}
              <div className="grid-2" style={{ gap: 12 }}>
                {/* Card 1: BTC + ETH */}
                <div
                  className="card flex-col items-center justify-center gap-3 p-4"
                  style={{
                    background: '#060709',
                    border: '1px solid #1F2430',
                    borderRadius: 12,
                    aspectRatio: '1/1',
                    position: 'relative',
                  }}
                >
                  <div className="flex items-center justify-center gap-5 my-auto">
                    <span style={{ fontSize: '3.6rem', fontWeight: 900, color: '#FFF' }}>₿</span>
                    <span style={{ fontSize: '3rem', color: '#FFF' }}>⬨</span>
                  </div>
                  <div className="flex items-center justify-between w-full pt-2 border-t border-subtle">
                    <span className="text-xs text-muted">BTC &amp; ETH Card</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyImage('card1')}
                        className="btn btn-ghost btn-xs"
                        title="Copy to clipboard"
                      >
                        {copiedImage === 'card1' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <button
                        onClick={() => handleDownload('card1')}
                        className="btn btn-secondary btn-xs"
                        disabled={downloadingCard === 'card1'}
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card 2: Solana */}
                <div
                  className="card flex-col items-center justify-center gap-3 p-4"
                  style={{
                    background: '#060709',
                    border: '1px solid #1F2430',
                    borderRadius: 12,
                    aspectRatio: '1/1',
                    position: 'relative',
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-2 my-auto">
                    <div
                      style={{
                        width: 70,
                        height: 48,
                        background: 'linear-gradient(135deg, #00FFA3, #DC1FFF)',
                        clipPath: 'polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)',
                      }}
                    />
                    <span style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: 4, color: '#FFF' }}>
                      SOLANA
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full pt-2 border-t border-subtle">
                    <span className="text-xs text-muted">Solana Card</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyImage('card2')}
                        className="btn btn-ghost btn-xs"
                        title="Copy to clipboard"
                      >
                        {copiedImage === 'card2' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <button
                        onClick={() => handleDownload('card2')}
                        className="btn btn-secondary btn-xs"
                        disabled={downloadingCard === 'card2'}
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-glass p-3 flex items-center justify-between text-xs text-secondary">
                <span>💡 Download PNGs and attach directly to your X/Twitter or Telegram post.</span>
              </div>
            </div>
          ) : (
            /* Scorecard View */
            <div className="flex-col gap-3">
              <div
                className="card p-4 flex-col gap-3"
                style={{
                  background: 'linear-gradient(135deg, #090B10, #11141D)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14,
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-subtle">
                  <span className="text-xs font-bold" style={{ color: '#23F7DD' }}>
                    🇺🇸 US SPOT ETF NET FLOWS
                  </span>
                  <span className="text-xs text-muted">{date}</span>
                </div>

                <div className="flex-col gap-2 py-1">
                  {parsedFlows.map((f) => {
                    const isPos = f.flowNum >= 0
                    return (
                      <div key={f.asset} className="flex items-center justify-between p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <span className="font-bold text-sm text-primary">{f.asset}</span>
                        <span
                          className="font-bold text-sm px-2.5 py-0.5 rounded-full"
                          style={{
                            background: isPos ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: isPos ? '#22C55E' : '#EF4444',
                            border: `1px solid ${isPos ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          }}
                        >
                          {f.flowFormatted}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-subtle">
                  <span className="text-xs text-muted">Sumex Institutional Scorecard</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyImage('scorecard')}
                      className="btn btn-ghost btn-xs"
                      title="Copy to clipboard"
                    >
                      {copiedImage === 'scorecard' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button
                      onClick={() => handleDownload('scorecard')}
                      className="btn btn-primary btn-xs"
                      disabled={downloadingCard === 'scorecard'}
                    >
                      <Download size={12} /> Download Scorecard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
