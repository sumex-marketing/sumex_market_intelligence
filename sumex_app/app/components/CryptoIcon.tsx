'use client'

import { useState } from 'react'

interface CryptoIconProps {
  symbol: string
  name?: string
  size?: number
  className?: string
}

const LOGO_PATHS: Record<string, string> = {
  BTC: '/crypto/btc.png',
  ETH: '/crypto/eth.png',
  SOL: '/crypto/sol.png',
  HYPE: '/crypto/hype.png',
}

const FALLBACK_THEMES: Record<string, { bg: string; color: string }> = {
  BTC: { bg: 'rgba(247,147,26,0.15)', color: '#F7931A' },
  ETH: { bg: 'rgba(98,126,234,0.15)', color: '#627EEA' },
  SOL: { bg: 'rgba(153,69,255,0.15)', color: '#9945FF' },
  HYPE: { bg: 'rgba(35,247,221,0.15)', color: '#23F7DD' },
}

export default function CryptoIcon({ symbol, name, size = 32, className = '' }: CryptoIconProps) {
  const [imgError, setImgError] = useState(false)
  const sym = symbol?.toUpperCase() ?? ''
  const src = LOGO_PATHS[sym]
  const fallback = FALLBACK_THEMES[sym] ?? { bg: 'rgba(35,247,221,0.1)', color: '#23F7DD' }

  if (src && !imgError) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.06)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        className={className}
      >
        <img
          src={src}
          alt={name ?? sym}
          width={size}
          height={size}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        background: fallback.bg,
        border: `1px solid ${fallback.color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size <= 24 ? '0.65rem' : '0.8rem',
        fontWeight: 800,
        color: fallback.color,
      }}
      className={className}
    >
      {sym.slice(0, 3)}
    </div>
  )
}
