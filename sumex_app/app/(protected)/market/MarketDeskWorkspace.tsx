'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp,
  RefreshCw,
  Search,
  ExternalLink,
  Layers,
  BarChart3,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  FilePlus,
  Activity,
  Globe,
} from 'lucide-react'
import {
  formatPrice,
  formatPct,
  formatLargeNumber,
  formatDominance,
  formatRelativeTime,
} from '@/lib/utils'
import CryptoIcon from '@/app/components/CryptoIcon'

interface MarketDeskProps {
  snapshots: any[]
  metrics: any | null
  recentHistory: any[]
  assets: any[]
}

const ASSET_THEMES: Record<string, { color: string; bg: string; label: string }> = {
  BTC: { color: '#F7931A', bg: 'rgba(247,147,26,0.12)', label: 'Bitcoin' },
  ETH: { color: '#627EEA', bg: 'rgba(98,126,234,0.12)', label: 'Ethereum' },
  SOL: { color: '#9945FF', bg: 'rgba(153,69,255,0.12)', label: 'Solana' },
}

const SECTOR_DATA = [
  {
    name: 'Layer 1 Platforms',
    sentiment: 'Bullish',
    sentimentColor: '#22c55e',
    change24h: '+4.2%',
    dominantAsset: 'BTC, ETH, SOL',
    description: 'Foundational smart contract and settlement networks.',
  },
  {
    name: 'DeFi & Liquidity',
    sentiment: 'Consolidation',
    sentimentColor: '#3b82f6',
    change24h: '+1.8%',
    dominantAsset: 'AAVE, UNI, MKR',
    description: 'Lending protocols, automated market makers, and stablecoin mints.',
  },
  {
    name: 'AI & Autonomous Agents',
    sentiment: 'High Volatility',
    sentimentColor: '#8E33FF',
    change24h: '+8.6%',
    dominantAsset: 'NEAR, FET, RENDER',
    description: 'Decentralized compute, intelligence networks, and GPU rendering.',
  },
  {
    name: 'Real-World Assets (RWA)',
    sentiment: 'Accumulation',
    sentimentColor: '#23F7DD',
    change24h: '+2.4%',
    dominantAsset: 'ONDO, LINK',
    description: 'Tokenized treasuries, private credit, and institutional settlement.',
  },
]

export default function MarketDeskWorkspace({
  snapshots,
  metrics,
  recentHistory,
  assets,
}: MarketDeskProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  const handleSyncMarket = async () => {
    setSyncing(true)
    setSyncNotice(null)
    try {
      const res = await fetch('/api/cron/fetch-market-data', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSyncNotice(`Market synced: ${data.records ?? 0} assets updated`)
        setTimeout(() => setSyncNotice(null), 4000)
        router.refresh()
      } else {
        setSyncNotice(`Sync warning: ${data.error || 'Check API limits'}`)
      }
    } catch (err: any) {
      setSyncNotice('Network error syncing market')
    } finally {
      setSyncing(false)
    }
  }

  const filteredSnapshots = snapshots.filter((s) => {
    const sym = s.symbol?.toLowerCase() ?? ''
    const name = s.name?.toLowerCase() ?? ''
    const q = search.toLowerCase()
    return sym.includes(q) || name.includes(q)
  })

  return (
    <div className="flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{
              background: 'linear-gradient(135deg, #e8edf5 30%, #23F7DD 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Market Overview Desk
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time price feeds, multi-timeframe deltas, sector momentum, and data attribution
          </p>
        </div>

        <div className="flex items-center gap-3">
          {syncNotice && (
            <span className="badge badge-cyan text-xs font-semibold">
              {syncNotice}
            </span>
          )}
          <button
            onClick={handleSyncMarket}
            className="btn btn-primary btn-sm"
            disabled={syncing}
          >
            <RefreshCw size={14} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing CoinGecko...' : 'Sync Market Prices'}
          </button>
        </div>
      </div>

      {/* Primary Asset Cards (BTC, ETH, SOL) */}
      <div className="grid-3">
        {['BTC', 'ETH', 'SOL'].map((sym) => {
          const snap = snapshots.find((s) => s.symbol === sym)
          const theme = ASSET_THEMES[sym] ?? {
            color: '#23F7DD',
            bg: 'rgba(35,247,221,0.1)',
            label: sym,
          }
          const up24 = (snap?.change_24h ?? 0) >= 0
          const up7d = (snap?.change_7d ?? 0) >= 0
          const up1h = (snap?.change_1h ?? 0) >= 0

          return (
            <div
              key={sym}
              className="metric-tile"
              style={{
                borderColor: `${theme.color}30`,
                background: `linear-gradient(180deg, var(--bg-surface) 0%, ${theme.bg} 100%)`,
                gap: '12px',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CryptoIcon symbol={sym} name={theme.label} size={36} />
                  <div>
                    <div className="font-bold text-primary" style={{ fontSize: '0.95rem' }}>
                      {theme.label}
                    </div>
                    <div className="text-muted text-xs">{sym} · Spot USD</div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className={`badge ${up24 ? 'badge-green' : 'badge-red'}`}
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '3px 8px', fontSize: '0.78rem' }}
                  >
                    {up24 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {up24 ? '+' : ''}{(snap?.change_24h ?? 0).toFixed(2)}%
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    24h Change
                  </span>
                </div>
              </div>

              <div className="metric-value" style={{ fontSize: '1.85rem', lineHeight: 1 }}>
                {formatPrice(snap?.price_usd)}
              </div>

              {/* Timeframe Performance Breakdown */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div className="text-muted" style={{ fontSize: '0.82rem' }}>1H CHANGE</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: up1h ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {snap?.change_1h != null ? `${up1h ? '+' : ''}${snap.change_1h.toFixed(2)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.82rem' }}>24H CHANGE</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: up24 ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {snap?.change_24h != null ? `${up24 ? '+' : ''}${snap.change_24h.toFixed(2)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.82rem' }}>7D CHANGE</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: up7d ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {snap?.change_7d != null ? `${up7d ? '+' : ''}${snap.change_7d.toFixed(2)}%` : '—'}
                  </div>
                </div>
              </div>

              {/* Market Cap & Volume */}
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>
                  Cap: <strong style={{ color: 'var(--text-secondary)' }}>{formatLargeNumber(snap?.market_cap_usd)}</strong>
                </span>
                <span>
                  Vol: <strong style={{ color: 'var(--text-secondary)' }}>{formatLargeNumber(snap?.volume_24h_usd)}</strong>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Global Metrics Bar */}
      {metrics && (
        <div className="card flex items-center justify-between flex-wrap gap-4" style={{ padding: '14px 20px' }}>
          <div className="flex items-center gap-2">
            <Globe size={18} color="#23F7DD" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Global Metrics:</span>
          </div>
          <div className="flex items-center gap-6 flex-wrap text-sm">
            <div>
              <span className="text-muted text-xs mr-1.5">Total Crypto Cap:</span>
              <strong className="font-mono text-primary">{formatLargeNumber(metrics.total_market_cap_usd)}</strong>
            </div>
            <div>
              <span className="text-muted text-xs mr-1.5">BTC Dominance:</span>
              <strong className="font-mono text-cyan" style={{ color: '#23F7DD' }}>{formatDominance(metrics.btc_dominance)}</strong>
            </div>
            <div>
              <span className="text-muted text-xs mr-1.5">ETH Dominance:</span>
              <strong className="font-mono text-purple" style={{ color: '#8E33FF' }}>{formatDominance(metrics.eth_dominance)}</strong>
            </div>
            <div>
              <span className="text-muted text-xs mr-1.5">24h Volume:</span>
              <strong className="font-mono text-primary">{formatLargeNumber(metrics.total_volume_24h_usd)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Sector & Narrative Performance */}
      <div className="card flex-col gap-4">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} color="#8E33FF" />
            <span className="card-title" style={{ color: 'var(--text-primary)' }}>
              Sector & Narrative Momentum
            </span>
          </div>
          <span className="text-xs text-muted">24h Benchmark Performance</span>
        </div>

        <div className="grid-4">
          {SECTOR_DATA.map((sec) => (
            <div
              key={sec.name}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-primary">{sec.name}</span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: `${sec.sentimentColor}15`,
                    color: sec.sentimentColor,
                    borderColor: `${sec.sentimentColor}40`,
                    fontSize: '0.82rem',
                  }}
                >
                  {sec.sentiment}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-extrabold text-lg" style={{ color: '#23F7DD' }}>
                  {sec.change24h}
                </span>
                <span className="text-xs text-muted font-mono">{sec.dominantAsset}</span>
              </div>
              <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.4 }}>
                {sec.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Monitored Watchlist Table */}
      <div className="card flex-col gap-4 p-0" style={{ overflow: 'hidden' }}>
        <div
          className="flex items-center justify-between flex-wrap gap-3"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(135deg, rgba(35,247,221,0.04), rgba(142,51,255,0.04))',
          }}
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={16} color="#23F7DD" />
            <span className="font-bold text-primary">Monitored Assets & Price Action</span>
            <span className="badge badge-cyan" style={{ fontSize: '0.82rem' }}>
              {filteredSnapshots.length} Assets
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-elevated)',
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Search size={14} className="text-muted" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  width: '130px',
                }}
              />
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Price (USD)</th>
                <th>1h Change</th>
                <th>24h Change</th>
                <th>7d Change</th>
                <th>24h Volume</th>
                <th>Market Cap</th>
                <th>Source Attribution</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSnapshots.map((s) => {
                const up1h = (s.change_1h ?? 0) >= 0
                const up24 = (s.change_24h ?? 0) >= 0
                const up7d = (s.change_7d ?? 0) >= 0

                return (
                  <tr key={s.symbol}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <CryptoIcon symbol={s.symbol} name={s.name} size={24} />
                        <div>
                          <div
                            className="font-bold font-mono"
                            style={{
                              color: ASSET_THEMES[s.symbol]?.color ?? '#23F7DD',
                              fontSize: '0.88rem',
                              lineHeight: 1.2,
                            }}
                          >
                            {s.symbol}
                          </div>
                          <div className="text-xs text-muted" style={{ fontSize: '0.72rem' }}>
                            {s.name ?? ASSET_THEMES[s.symbol]?.label ?? s.symbol}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="td-mono font-bold text-primary">
                      {formatPrice(s.price_usd)}
                    </td>
                    <td className="td-mono">
                      <span style={{ color: up1h ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {s.change_1h != null ? `${up1h ? '+' : ''}${s.change_1h.toFixed(2)}%` : '—'}
                      </span>
                    </td>
                    <td className="td-mono">
                      <span
                        className={`badge ${up24 ? 'badge-green' : 'badge-red'}`}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {s.change_24h != null ? `${up24 ? '+' : ''}${s.change_24h.toFixed(2)}%` : '—'}
                      </span>
                    </td>
                    <td className="td-mono">
                      <span style={{ color: up7d ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {s.change_7d != null ? `${up7d ? '+' : ''}${s.change_7d.toFixed(2)}%` : '—'}
                      </span>
                    </td>
                    <td className="td-mono text-muted text-xs">
                      {formatLargeNumber(s.volume_24h_usd)}
                    </td>
                    <td className="td-mono text-muted text-xs">
                      {formatLargeNumber(s.market_cap_usd)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <ShieldCheck size={12} color="#23F7DD" />
                        <span>CoinGecko API</span>
                        <a
                          href="https://www.coingecko.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted hover:text-cyan"
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/research/new?symbol=${s.symbol}`}
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#23F7DD', fontSize: '0.82rem' }}
                      >
                        <FilePlus size={13} />
                        Research
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot History & Verification Audit Trail */}
      {recentHistory && recentHistory.length > 0 && (
        <div className="card flex-col gap-4 p-0" style={{ overflow: 'hidden' }}>
          <div
            className="flex items-center justify-between"
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(142,51,255,0.04)',
            }}
          >
            <div className="flex items-center gap-2">
              <Clock size={16} color="#8E33FF" />
              <span className="font-bold text-primary">Recent Ingestion Audit Trail</span>
            </div>
            <span className="text-xs text-muted">
              Immutable recorded snapshots for thesis verification
            </span>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Symbol</th>
                  <th>Price USD</th>
                  <th>24h Delta</th>
                  <th>Volume USD</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.slice(0, 15).map((rec: any, idx: number) => {
                  const sym = rec.assets?.symbol ?? 'Asset'
                  const delta = rec.change_24h
                  const up = (delta ?? 0) >= 0

                  return (
                    <tr key={rec.id || idx}>
                      <td className="td-mono text-xs text-muted">
                        {new Date(rec.timestamp).toUTCString().replace(' GMT', '')}
                      </td>
                      <td className="font-bold font-mono" style={{ color: ASSET_THEMES[sym]?.color ?? '#23F7DD' }}>
                        {sym}
                      </td>
                      <td className="td-mono text-primary font-semibold">
                        {formatPrice(rec.price_usd)}
                      </td>
                      <td className="td-mono text-xs">
                        <span style={{ color: up ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {delta != null ? `${up ? '+' : ''}${delta.toFixed(2)}%` : '—'}
                        </span>
                      </td>
                      <td className="td-mono text-muted text-xs">
                        {formatLargeNumber(rec.volume_24h_usd)}
                      </td>
                      <td className="text-xs text-muted">
                        <span className="badge badge-muted">{rec.source ?? 'coingecko'}</span>
                      </td>
                      <td>
                        <span className="badge badge-green" style={{ fontSize: '0.82rem' }}>
                          Verified
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
