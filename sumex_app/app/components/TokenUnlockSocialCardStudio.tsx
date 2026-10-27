'use client'

import { useState, useRef, useEffect } from 'react'
import { Copy, Check, Download, Sparkles, X, Edit3, RefreshCw, Palette } from 'lucide-react'
import { TokenUnlock } from '@/lib/types'
import { formatUnlockValue } from '@/lib/services/token-unlock-service'

export function XIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

interface TokenUnlockSocialCardStudioProps {
  unlocks: TokenUnlock[]
  weekLabel?: string
  asModal?: boolean
  onClose?: () => void
}

export default function TokenUnlockSocialCardStudio({
  unlocks,
  weekLabel = 'Oct 26 - Nov 1',
  asModal = false,
  onClose,
}: TokenUnlockSocialCardStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [headline, setHeadline] = useState(`Top Token Unlocks This Week (${weekLabel})`)
  const [asOfDate, setAsOfDate] = useState('Oct 26, 2026 UTC')
  const [theme, setTheme] = useState<'cmc_blue' | 'sumex_dark'>('cmc_blue')

  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Top 8 unlocks sorted by value
  const top8 = [...unlocks]
    .sort((a, b) => (b.est_value_usd ?? 0) - (a.est_value_usd ?? 0))
    .slice(0, 8)

  // Generate Tweet copy
  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣']
  const defaultTweet =
    `🔓 ${headline}\n\n` +
    top8
      .map(
        (u, i) =>
          `${numberEmojis[i] || `${i + 1}.`} ${u.token_name} (${u.token_symbol}) - ${formatUnlockValue(
            u.est_value_usd
          )}; ${u.pct_circulating_supply}% circ supply`
      )
      .join('\n')

  const [tweetText, setTweetText] = useState(defaultTweet)

  useEffect(() => {
    setTweetText(
      `🔓 ${headline}\n\n` +
        top8
          .map(
            (u, i) =>
              `${numberEmojis[i] || `${i + 1}.`} ${u.token_name} (${u.token_symbol}) - ${formatUnlockValue(
                u.est_value_usd
              )}; ${u.pct_circulating_supply}% circ supply`
          )
          .join('\n')
    )
  }, [headline, unlocks])

  // Draw High-Res Canvas Graphic (1200 x 920)
  const renderCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = 1200
    const height = 920
    canvas.width = width
    canvas.height = height

    const isBlue = theme === 'cmc_blue'

    // ── 1. Background ───────────────────────────────────────────────────────────
    if (isBlue) {
      // Vibrant royal blue gradient matching the screenshot
      const grad = ctx.createLinearGradient(0, 0, width, height)
      grad.addColorStop(0, '#0052FF')
      grad.addColorStop(0.5, '#0B51E6')
      grad.addColorStop(1, '#003AC7')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)

      // Subtle background ambient light
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.beginPath()
      ctx.arc(width * 0.85, 100, 300, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Sleek Sumex Cyber Dark
      const grad = ctx.createLinearGradient(0, 0, width, height)
      grad.addColorStop(0, '#06090F')
      grad.addColorStop(1, '#0C1322')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)

      // Ambient cyan glow
      ctx.fillStyle = 'rgba(35, 247, 221, 0.04)'
      ctx.beginPath()
      ctx.arc(100, 100, 350, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── 2. Top Header ───────────────────────────────────────────────────────────
    // Logo Pill
    const pillY = 50
    ctx.save()
    ctx.fillStyle = isBlue ? 'rgba(255, 255, 255, 0.15)' : 'rgba(35, 247, 221, 0.12)'
    ctx.strokeStyle = isBlue ? 'rgba(255, 255, 255, 0.3)' : 'rgba(35, 247, 221, 0.3)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(60, pillY, 195, 34, 17)
    ctx.fill()
    ctx.stroke()

    // Logo icon & text
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText('⚡ SUMEX', 75, pillY + 22)

    // Tag badge inside pill
    ctx.fillStyle = isBlue ? '#23F7DD' : '#8E33FF'
    ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText('RESEARCH', 160, pillY + 22)
    ctx.restore()

    // Main Title
    ctx.save()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '900 42px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(headline, 60, 140)
    ctx.restore()

    // ── 3. Cards Grid (2 rows x 4 columns) ──────────────────────────────────────
    const startX = 60
    const startY = 175
    const cardW = 250
    const cardH = 310
    const gapX = 26
    const gapY = 26

    top8.forEach((token, index) => {
      const col = index % 4
      const row = Math.floor(index / 4)
      const x = startX + col * (cardW + gapX)
      const y = startY + row * (cardH + gapY)

      ctx.save()

      // Card Background
      if (isBlue) {
        ctx.fillStyle = '#FFFFFF'
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.14)'
        ctx.shadowBlur = 16
        ctx.shadowOffsetY = 6
      } else {
        ctx.fillStyle = '#101828'
        ctx.strokeStyle = 'rgba(35, 247, 221, 0.18)'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 14
        ctx.shadowOffsetY = 4
      }

      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(x, y, cardW, cardH, 16)
      ctx.fill()
      ctx.shadowColor = 'transparent' // reset shadow
      ctx.stroke()

      // ── Card Header: Token Avatar + Name + Ticker + Vesting Tag ──
      const avatarX = x + 20
      const avatarY = y + 22
      const avatarR = 19

      // Avatar circle
      const avatarColors = [
        ['#F59E0B', '#D97706'],
        ['#10B981', '#059669'],
        ['#3B82F6', '#2563EB'],
        ['#8B5CF6', '#7C3AED'],
        ['#EC4899', '#DB2777'],
        ['#6366F1', '#4F46E5'],
        ['#14B8A6', '#0D9488'],
        ['#F97316', '#EA580C'],
      ]
      const [col1, col2] = avatarColors[index % avatarColors.length]
      const avatarGrad = ctx.createLinearGradient(avatarX - avatarR, avatarY - avatarR, avatarX + avatarR, avatarY + avatarR)
      avatarGrad.addColorStop(0, col1)
      avatarGrad.addColorStop(1, col2)
      ctx.fillStyle = avatarGrad
      ctx.beginPath()
      ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2)
      ctx.fill()

      // Avatar Initials
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const initial = token.token_symbol.slice(0, 2)
      ctx.fillText(initial, avatarX + avatarR, avatarY + avatarR + 1)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'

      // Token Name
      ctx.fillStyle = isBlue ? '#0F172A' : '#FFFFFF'
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      const truncName = token.token_name.length > 13 ? token.token_name.slice(0, 12) + '…' : token.token_name
      ctx.fillText(truncName, x + 66, y + 36)

      // Token Ticker
      ctx.fillStyle = isBlue ? '#64748B' : '#94A3B8'
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(token.token_symbol, x + 66, y + 54)

      // Vesting type tag (e.g. Linear ◢)
      ctx.fillStyle = isBlue ? '#64748B' : '#64748B'
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      const typeStr = token.unlock_type === 'cliff' ? 'Cliff' : 'Linear'
      ctx.fillText(typeStr, x + cardW - 62, y + 42)

      // Geometric Triangle
      ctx.fillStyle = '#3B82F6'
      ctx.beginPath()
      ctx.moveTo(x + cardW - 20, y + 32)
      ctx.lineTo(x + cardW - 20, y + 44)
      ctx.lineTo(x + cardW - 32, y + 44)
      ctx.closePath()
      ctx.fill()

      // Subtle divider line
      ctx.strokeStyle = isBlue ? '#F1F5F9' : '#1E293B'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + 20, y + 74)
      ctx.lineTo(x + cardW - 20, y + 74)
      ctx.stroke()

      // ── Metric 1: % Of Circ. Supply ──
      ctx.fillStyle = isBlue ? '#64748B' : '#94A3B8'
      ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText('% Of Circ. Supply', x + 20, y + 102)

      // Value
      const isHighDilution = token.pct_circulating_supply >= 5.0
      ctx.fillStyle = isHighDilution
        ? '#0052FF'
        : isBlue
        ? '#0F172A'
        : '#23F7DD'
      ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(`${token.pct_circulating_supply.toFixed(2)}%`, x + 20, y + 134)

      // ── Metric 2: Est. Value (USD) ──
      ctx.fillStyle = isBlue ? '#64748B' : '#94A3B8'
      ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText('Est. Value (USD)', x + 20, y + 172)

      // Value
      ctx.fillStyle = isBlue ? '#0F172A' : '#FFFFFF'
      ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(formatUnlockValue(token.est_value_usd), x + 20, y + 204)

      // ── Card Footer: Date Pill ──
      const pillW = cardW - 40
      const pillH = 34
      const pillBoxX = x + 20
      const pillBoxY = y + cardH - 52

      ctx.fillStyle = isBlue ? '#F8FAFC' : 'rgba(35, 247, 221, 0.06)'
      ctx.strokeStyle = isBlue ? '#E2E8F0' : 'rgba(35, 247, 221, 0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(pillBoxX, pillBoxY, pillW, pillH, 8)
      ctx.fill()
      ctx.stroke()

      // Calendar icon emoji + date
      ctx.fillStyle = isBlue ? '#475569' : '#CBD5E1'
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`🗓️  ${token.unlock_date}`, pillBoxX + pillW / 2, pillBoxY + 22)
      ctx.textAlign = 'left'

      ctx.restore()
    })

    // ── 4. Bottom Footer ────────────────────────────────────────────────────────
    ctx.save()
    ctx.fillStyle = isBlue ? 'rgba(255, 255, 255, 0.8)' : 'rgba(203, 213, 225, 0.7)'
    ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText('Source: Sumex Market Intelligence', 60, height - 38)

    ctx.textAlign = 'right'
    ctx.fillText(`*Data as of ${asOfDate}`, width - 60, height - 38)
    ctx.restore()
  }

  // Redraw when settings change
  useEffect(() => {
    renderCanvas()
  }, [headline, asOfDate, theme, unlocks])

  // Copy Image to Clipboard as PNG
  const handleCopyImage = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setCopiedImage(false)

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ])
        setCopiedImage(true)
        setTimeout(() => setCopiedImage(false), 2200)
      }, 'image/png')
    } catch (err) {
      alert('Unable to copy directly. Use Download PNG instead.')
    }
  }

  // Download PNG file
  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setDownloading(true)

    try {
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `sumex_token_unlocks_${weekLabel.replace(/\s+/g, '_').toLowerCase()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setTimeout(() => setDownloading(false), 1000)
    }
  }

  // Copy Tweet copy
  const handleCopyTweet = () => {
    navigator.clipboard.writeText(tweetText)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const content = (
    <div className="flex-col gap-6">
      {/* Studio Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-purple">
              <Sparkles size={12} /> Social Graphics Studio
            </span>
            <span className="badge badge-green">1200 x 920 HD</span>
          </div>
          <h2 className="text-xl font-black text-primary mt-1">
            Token Unlocks Weekly Social Card
          </h2>
          <p className="text-xs text-muted">
            High-res branded visual graphic & copy ready for instant X / Twitter publishing
          </p>
        </div>

        {/* Studio Controls */}
        <div className="flex items-center gap-2">
          {/* Theme Switcher */}
          <button
            onClick={() => setTheme(theme === 'cmc_blue' ? 'sumex_dark' : 'cmc_blue')}
            className="btn btn-sm btn-ghost"
            style={{ gap: 6 }}
            title="Toggle Theme"
          >
            <Palette size={14} />
            <span>{theme === 'cmc_blue' ? 'CMC Classic Blue' : 'Sumex Cyber Dark'}</span>
          </button>

          {/* Copy Image Button */}
          <button
            onClick={handleCopyImage}
            className="btn btn-sm btn-primary"
            style={{ gap: 6, fontWeight: 700 }}
          >
            {copiedImage ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedImage ? 'Image Copied!' : 'Copy Image'}</span>
          </button>

          {/* Download PNG Button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn btn-sm btn-ghost"
            style={{ gap: 6 }}
          >
            <Download size={14} />
            <span>Download PNG</span>
          </button>

          {asModal && onClose && (
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Workspace: Canvas on Left/Top, Controls & Tweet Copy on Right */}
      <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        {/* Left: Interactive Canvas Preview */}
        <div
          className="card flex-col items-center justify-center"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            padding: 16,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '100%',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </div>
          <div className="flex items-center justify-between w-full mt-3 text-xs text-muted">
            <span>Click &apos;Copy Image&apos; to paste directly into X/Twitter</span>
            <span>HD PNG 1200×920</span>
          </div>
        </div>

        {/* Right: Graphic Settings & Tweet Copy Box */}
        <div className="flex-col gap-4">
          {/* Headline & Date Customization */}
          <div
            className="card flex-col gap-3"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              padding: 16,
            }}
          >
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Edit3 size={14} />
              <span>Customize Card Text</span>
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Graphic Main Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">As of Date (Footer)</label>
              <input
                type="text"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Tweet / Social Copy */}
          <div
            className="card flex-col gap-3"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              padding: 16,
              flex: 1,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <XIcon size={14} />
                <span>Ready-to-Post Tweet Copy</span>
              </div>
              <button
                onClick={handleCopyTweet}
                className="btn btn-sm btn-ghost"
                style={{
                  gap: 4,
                  fontSize: '0.75rem',
                  color: copiedText ? '#22c55e' : 'var(--brand-primary)',
                }}
              >
                {copiedText ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>

            <textarea
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              className="form-textarea font-mono"
              rows={11}
              style={{
                fontSize: '0.78rem',
                lineHeight: 1.5,
                background: 'var(--bg-elevated)',
                resize: 'none',
              }}
            />

            <div className="flex items-center justify-between text-xs text-muted">
              <span>{tweetText.length} characters</span>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
                style={{
                  background: 'rgba(29, 155, 240, 0.15)',
                  color: '#1d9bf0',
                  borderColor: 'rgba(29, 155, 240, 0.35)',
                  gap: 5,
                  fontSize: '0.75rem',
                }}
              >
                <XIcon size={12} />
                <span>Publish to X</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (asModal) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 24,
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: 1100,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            padding: 24,
            borderRadius: 16,
          }}
        >
          {content}
        </div>
      </div>
    )
  }

  return content
}
