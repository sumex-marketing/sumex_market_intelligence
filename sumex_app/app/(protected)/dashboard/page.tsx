import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  formatPrice,
  formatPct,
  formatLargeNumber,
  formatDominance,
  formatRelativeTime,
  formatSignalType,
  getSignalScoreBadge,
  formatSignalStatus,
} from '@/lib/utils'
import {
  Zap,
  TrendingUp,
  Activity,
  Globe,
  BarChart2,
  DollarSign,
  Clock,
  Circle,
  ChevronRight,
  Landmark,
  FileText,
  Edit3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import DashboardQuickActions from './DashboardQuickActions'
import CryptoIcon from '@/app/components/CryptoIcon'

export const dynamic = 'force-dynamic'

/* ── Inline badge helper ─────────────────────────────────── */
function PctBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="badge badge-muted">N/A</span>
  const up = value >= 0
  return (
    <span
      className={`badge ${up ? 'badge-green' : 'badge-red'}`}
      style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
    </span>
  )
}

function ChangeRow({ label, value }: { label: string; value: number | null }) {
  const up = value != null && value >= 0
  return (
    <div className="flex items-center justify-between" style={{ fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          color: value == null ? 'var(--text-muted)' : up ? 'var(--green)' : 'var(--red)',
          fontWeight: 600,
        }}
      >
        {value == null ? 'N/A' : `${up ? '+' : ''}${value.toFixed(2)}%`}
      </span>
    </div>
  )
}

function formatFlow(usd: number | null) {
  if (usd == null) return 'N/A'
  const abs = Math.abs(usd)
  const prefix = usd > 0 ? '+' : usd < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${prefix}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(0)}K`
  return `${prefix}$${abs.toFixed(0)}`
}

const ASSET_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  BTC: { color: '#F7931A', bg: 'rgba(247,147,26,0.12)', label: 'Bitcoin' },
  ETH: { color: '#627EEA', bg: 'rgba(98,126,234,0.12)', label: 'Ethereum' },
  SOL: { color: '#9945FF', bg: 'rgba(153,69,255,0.12)', label: 'Solana' },
  HYPE: { color: '#23F7DD', bg: 'rgba(35,247,221,0.12)', label: 'Hyperliquid' },
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    snapshotsRes,
    metricsRes,
    signalsRes,
    macroRes,
    sourcesRes,
    etfTotalsRes,
    researchRes,
    draftsRes,
  ] = await Promise.all([
    supabase.from('latest_market_snapshots').select('*'),
    supabase.from('latest_market_metrics').select('*').single(),
    supabase.from('open_signals').select('*').limit(6),
    supabase
      .from('macro_events')
      .select('*')
      .in('status', ['planned', 'upcoming'])
      .order('event_time_utc', { ascending: true })
      .limit(4),
    supabase.from('source_health').select('*'),
    supabase
      .from('etf_daily_totals')
      .select('*')
      .order('date', { ascending: false })
      .limit(20),
    supabase
      .from('research_cards')
      .select('id, question, observation, confidence, editorial_decision, created_at')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('content_drafts')
      .select('id, research_id, format, title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const snapshots = snapshotsRes.data ?? []
  const metrics = metricsRes.data ?? null
  const signals = signalsRes.data ?? []
  const upcomingMacro = macroRes.data ?? []
  const sources = sourcesRes.data ?? []
  const etfTotals = etfTotalsRes.data ?? []
  const recentResearch = researchRes.data ?? []
  const recentDrafts = draftsRes.data ?? []

  const latestBtcFlow = etfTotals.find((t: any) => t.asset === 'BTC')
  const latestEthFlow = etfTotals.find((t: any) => t.asset === 'ETH')
  const latestSolFlow = etfTotals.find((t: any) => t.asset === 'SOL')
  const latestHypeFlow = etfTotals.find((t: any) => t.asset === 'HYPE')

  const dataTimestamp = snapshots[0]?.timestamp
    ? new Date(snapshots[0].timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null

  return (
    <div className="flex-col gap-6">
      {/* Page Header with Quick Actions */}
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
            Market Intelligence
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time asset monitoring · Algorithmic signals · ETF flows · Macro calendar
          </p>
        </div>
        <DashboardQuickActions dataTimestamp={dataTimestamp} />
      </div>

      {/* Asset Ticker Row */}
      <div className="grid-3">
        {['BTC', 'ETH', 'SOL'].map((sym) => {
          const snap = snapshots.find((s: any) => s.symbol === sym)
          const style = ASSET_STYLES[sym] ?? {
            color: '#23F7DD',
            bg: 'rgba(35,247,221,0.08)',
            label: sym,
          }
          const up1h = (snap?.change_1h ?? 0) >= 0
          const up24 = (snap?.change_24h ?? 0) >= 0
          const up7d = (snap?.change_7d ?? 0) >= 0

          return (
            <div
              key={sym}
              className="metric-tile"
              style={{
                gap: '12px',
                borderColor: `${style.color}25`,
                background: `linear-gradient(180deg, rgba(20,24,33,0.85) 0%, ${style.bg} 100%)`,
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              {/* Card Header: Official Coin Logo, Name, & Labeled 24h Delta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CryptoIcon symbol={sym} name={style.label} size={36} />
                  <div>
                    <div className="metric-label" style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {style.label}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {sym} / USD · Spot
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span
                    className={`badge ${up24 ? 'badge-green' : 'badge-red'}`}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: 0,
                      fontWeight: 700,
                      padding: '3px 8px',
                      fontSize: '0.78rem',
                    }}
                  >
                    {up24 ? '▲ +' : '▼ '}{Math.abs(snap?.change_24h ?? 0).toFixed(2)}%
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      marginTop: 3,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    24h Change
                  </span>
                </div>
              </div>

              {/* Live Spot Price */}
              <div className="metric-value" style={{ fontSize: '1.75rem', lineHeight: 1.1, margin: '2px 0' }}>
                {formatPrice(snap?.price_usd)}
              </div>

              {/* Timeframe Performance Breakdown (1h, 24h, 7d Clearly Labeled) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.28)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex-col">
                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    1H CHANGE
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: up1h ? 'var(--green)' : 'var(--red)',
                      marginTop: 2,
                    }}
                  >
                    {snap?.change_1h != null ? `${up1h ? '+' : ''}${snap.change_1h.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>

                <div className="flex-col">
                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    24H CHANGE
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: up24 ? 'var(--green)' : 'var(--red)',
                      marginTop: 2,
                    }}
                  >
                    {snap?.change_24h != null ? `${up24 ? '+' : ''}${snap.change_24h.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>

                <div className="flex-col">
                  <span
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    7D CHANGE
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: up7d ? 'var(--green)' : 'var(--red)',
                      marginTop: 2,
                    }}
                  >
                    {snap?.change_7d != null ? `${up7d ? '+' : ''}${snap.change_7d.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Market Cap & 24h Volume Footer */}
              <div
                className="flex items-center justify-between"
                style={{
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  Market Cap:&nbsp;
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {formatLargeNumber(snap?.market_cap_usd)}
                  </span>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  24h Vol:&nbsp;
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {formatLargeNumber(snap?.volume_24h_usd)}
                  </span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Global Market Metrics & ETF Snapshot Bar */}
      <div className="grid-4">
        {[
          {
            label: 'Total Market Cap',
            value: formatLargeNumber(metrics?.total_market_cap_usd),
            sub: 'Global crypto valuation',
            icon: Globe,
            accent: '#23F7DD',
          },
          {
            label: 'BTC Dominance',
            value: formatDominance(metrics?.btc_dominance),
            sub: 'Bitcoin market share',
            icon: BarChart2,
            accent: '#F7931A',
          },
          {
            label: 'ETH Dominance',
            value: formatDominance(metrics?.eth_dominance),
            sub: 'Ethereum market share',
            icon: Activity,
            accent: '#627EEA',
          },
          {
            label: '24h Global Volume',
            value: formatLargeNumber(metrics?.total_volume_24h_usd),
            sub: 'Cross-exchange volume',
            icon: DollarSign,
            accent: '#8E33FF',
          },
        ].map(({ label, value, sub, icon: Icon, accent }) => (
          <div
            key={label}
            className="card"
            style={{ padding: '18px 20px', borderColor: `${accent}18` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="card-title" style={{ fontSize: '0.82rem' }}>
                {label}
              </div>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: `${accent}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={14} color={accent} />
              </div>
            </div>
            <div className="metric-value" style={{ fontSize: '1.4rem' }}>
              {value}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Spot ETF Flows Snapshot Bar */}
      <div
        className="card flex items-center justify-between flex-wrap gap-4"
        style={{
          padding: '14px 20px',
          borderColor: 'rgba(142,51,255,0.25)',
          background: 'linear-gradient(135deg, rgba(35,247,221,0.03), rgba(142,51,255,0.05))',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(142,51,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Landmark size={16} color="#8E33FF" />
          </div>
          <div>
            <div className="font-bold text-sm text-primary">Spot ETF & Institutional ETP Snapshot</div>
            <div className="text-xs text-muted">Latest reported institutional daily net flows</div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.2)' }}>
            <CryptoIcon symbol="BTC" size={18} />
            <span style={{ fontSize: '0.78rem', color: '#F7931A', fontWeight: 700 }}>BTC</span>
            <span
              className={`badge ${(latestBtcFlow?.net_flow_usd ?? 0) >= 0 ? 'badge-green' : 'badge-red'}`}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', padding: '2px 6px' }}
            >
              {(latestBtcFlow?.net_flow_usd ?? 0) >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {formatFlow(latestBtcFlow?.net_flow_usd ?? null)}
            </span>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(98,126,234,0.06)', border: '1px solid rgba(98,126,234,0.2)' }}>
            <CryptoIcon symbol="ETH" size={18} />
            <span style={{ fontSize: '0.78rem', color: '#8299F8', fontWeight: 700 }}>ETH</span>
            <span
              className={`badge ${(latestEthFlow?.net_flow_usd ?? 0) >= 0 ? 'badge-green' : 'badge-red'}`}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', padding: '2px 6px' }}
            >
              {(latestEthFlow?.net_flow_usd ?? 0) >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {formatFlow(latestEthFlow?.net_flow_usd ?? null)}
            </span>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(153,69,255,0.06)', border: '1px solid rgba(153,69,255,0.2)' }}>
            <CryptoIcon symbol="SOL" size={18} />
            <span style={{ fontSize: '0.78rem', color: '#A855F7', fontWeight: 700 }}>SOL</span>
            <span
              className={`badge ${(latestSolFlow?.net_flow_usd ?? 0) >= 0 ? 'badge-green' : 'badge-red'}`}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', padding: '2px 6px' }}
            >
              {(latestSolFlow?.net_flow_usd ?? 0) >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {formatFlow(latestSolFlow?.net_flow_usd ?? null)}
            </span>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(35,247,221,0.06)', border: '1px solid rgba(35,247,221,0.2)' }}>
            <CryptoIcon symbol="HYPE" size={18} />
            <span style={{ fontSize: '0.78rem', color: '#23F7DD', fontWeight: 700 }}>HYPE</span>
            <span
              className={`badge ${(latestHypeFlow?.net_flow_usd ?? 0) >= 0 ? 'badge-green' : 'badge-red'}`}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', padding: '2px 6px' }}
            >
              {(latestHypeFlow?.net_flow_usd ?? 0) >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {formatFlow(latestHypeFlow?.net_flow_usd ?? null)}
            </span>
          </div>

          <Link href="/macro?tab=etf" className="btn btn-ghost btn-sm" style={{ color: '#8E33FF', fontSize: '0.75rem' }}>
            Full ETF Desk <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* Main Grid: Signals & Research vs Macro & Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Left Column: Signals & Recent Research */}
        <div className="flex-col gap-6">
          {/* Signals Feed */}
          <div className="card flex-col gap-0" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              className="flex items-center justify-between"
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'linear-gradient(135deg, rgba(35,247,221,0.04), rgba(142,51,255,0.04))',
              }}
            >
              <div className="flex items-center gap-2">
                <Zap size={16} color="#23F7DD" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Open Market Signals
                </span>
                {signals.length > 0 && (
                  <span className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>
                    {signals.length}
                  </span>
                )}
              </div>
              <Link
                href="/signals"
                className="btn btn-ghost btn-sm"
                style={{ color: '#23F7DD', fontSize: '0.82rem' }}
              >
                View All <ChevronRight size={12} />
              </Link>
            </div>

            {signals.length === 0 ? (
              <div className="empty-state">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: 'rgba(35,247,221,0.08)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Zap size={22} color="#23F7DD" />
                </div>
                <div className="empty-state-title">No Active Signals</div>
                <div className="empty-state-desc">
                  Markets are within normal parameters. Signals appear when thresholds are crossed.
                </div>
              </div>
            ) : (
              <div className="flex-col gap-0">
                {signals.map((sig: any, idx: number) => {
                  const scoreBadge = getSignalScoreBadge(sig.score)
                  const typeInfo = formatSignalType(sig.signal_type)
                  const statusInfo = formatSignalStatus(sig.status)
                  return (
                  <Link
                    key={sig.id}
                    href={`/signals/${sig.id}`}
                    style={{
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '14px 20px',
                      transition: 'background var(--transition-fast)',
                      borderBottom:
                        idx < signals.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    {/* Priority Score pill */}
                    <div
                      style={{
                        width: 78,
                        minWidth: 78,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        flexShrink: 0,
                      }}
                      title={`Priority Score: ${sig.score ? sig.score.toFixed(1) : 'N/A'} / 10 - ${scoreBadge.description}`}
                    >
                      <div
                        style={{
                          padding: '3px 8px',
                          borderRadius: 7,
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 2,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          background: scoreBadge.bg,
                          color: scoreBadge.color,
                          border: `1px solid ${scoreBadge.color}45`,
                        }}
                      >
                        <span>{sig.score ? sig.score.toFixed(1) : 'N/A'}</span>
                        <span style={{ fontSize: '0.62rem', opacity: 0.75, fontWeight: 600 }}>/10</span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.66rem',
                          color: scoreBadge.color,
                          fontWeight: 700,
                          textAlign: 'center',
                          lineHeight: 1.15,
                          whiteSpace: 'normal',
                          maxWidth: 78,
                        }}
                      >
                        {scoreBadge.label}
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Type chip + subject */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 5,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: typeInfo.bg,
                            color: typeInfo.color,
                            border: `1px solid ${typeInfo.color}33`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {typeInfo.label}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color: '#23F7DD' }}>
                          {sig.subject}
                        </span>
                      </div>

                      {/* Title */}
                      <div
                        className="truncate"
                        style={{
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {sig.title}
                      </div>

                      {/* Meta row */}
                      <div
                        className="flex items-center gap-2 mt-1 flex-wrap"
                        style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                      >
                        <Clock size={10} />
                        <span>{formatRelativeTime(sig.created_at)}</span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: statusInfo.bg,
                        color: statusInfo.color,
                        border: `1px solid ${statusInfo.color}33`,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                        marginTop: 2,
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Research & Content Drafts */}
          <div className="card flex-col gap-0" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              className="flex items-center justify-between"
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(35,247,221,0.03)',
              }}
            >
              <div className="flex items-center gap-2">
                <FileText size={16} color="#23F7DD" />
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  Active Intelligence Pipeline
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/research" className="btn btn-ghost btn-sm" style={{ color: '#23F7DD', fontSize: '0.82rem' }}>
                  Research Cards →
                </Link>
                <Link href="/content" className="btn btn-ghost btn-sm" style={{ color: '#8E33FF', fontSize: '0.82rem' }}>
                  Content Drafts →
                </Link>
              </div>
            </div>

            <div className="flex-col gap-0">
              {recentResearch.map((r: any, idx: number) => (
                <Link
                  key={r.id}
                  href={`/research/${r.id}`}
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                    <div className="truncate font-semibold text-sm text-primary">
                      {r.question || r.observation || 'Research Card'}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Created {formatRelativeTime(r.created_at)} · {r.editorial_decision ? `Decision: ${r.editorial_decision}` : 'Pending review'}
                    </div>
                  </div>
                  <span className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>
                    {r.confidence ? `${r.confidence}% Conf.` : 'In Analysis'}
                  </span>
                </Link>
              ))}

              {recentDrafts.map((d: any) => (
                <Link
                  key={d.id}
                  href={`/content/${d.id}`}
                  style={{
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                    <div className="truncate font-semibold text-sm text-primary">
                      <Edit3 size={12} className="inline mr-1.5 text-purple" color="#8E33FF" />
                      {d.title}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Format: <span className="text-purple font-mono uppercase">{d.format.replace('_', ' ')}</span> · {formatRelativeTime(d.created_at)}
                    </div>
                  </div>
                  <span className={`badge ${d.status === 'approved' ? 'badge-green' : 'badge-amber'}`}>
                    {d.status}
                  </span>
                </Link>
              ))}

              {recentResearch.length === 0 && recentDrafts.length === 0 && (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No research cards generated yet. Convert an open signal to create your first card.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Macro Calendar & Data Health */}
        <div className="flex-col gap-4">
          {/* Macro Calendar */}
          <div className="card flex-col gap-0" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              className="flex items-center justify-between"
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(142,51,255,0.05)',
              }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={15} color="#8E33FF" />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Macro Calendar
                </span>
              </div>
              <Link
                href="/macro"
                className="btn btn-ghost btn-sm"
                style={{ color: '#8E33FF', fontSize: '0.82rem' }}
              >
                Full Calendar →
              </Link>
            </div>
            {upcomingMacro.length === 0 ? (
              <div
                style={{
                  padding: '24px 18px',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                }}
              >
                No upcoming macro releases scheduled.
              </div>
            ) : (
              upcomingMacro.map((event: any, idx: number) => (
                <div
                  key={event.id}
                  style={{
                    padding: '12px 18px',
                    borderBottom:
                      idx < upcomingMacro.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {event.title}
                    </span>
                    <span className={`badge badge-${event.importance}`}>{event.importance}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {new Date(event.event_time_utc).toUTCString()}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Data Feed Health */}
          <div className="card flex-col gap-0" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              className="flex items-center justify-between"
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(35,247,221,0.04)',
              }}
            >
              <div className="flex items-center gap-2">
                <Activity size={15} color="#23F7DD" />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Data Feed Health
                </span>
              </div>
              <Link
                href="/settings"
                className="btn btn-ghost btn-sm"
                style={{ color: '#23F7DD', fontSize: '0.78rem', padding: '2px 8px' }}
                title="Manage data sources in settings"
              >
                Configure →
              </Link>
            </div>
            {sources.length === 0 ? (
              <div style={{ padding: '18px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                No ingestion sources configured.
              </div>
            ) : (
              sources.map((src: any, idx: number) => {
                const isHealthy = src.health_status === 'healthy'
                const isStale = src.health_status === 'stale'
                const statusColor = isHealthy ? '#22c55e' : isStale ? '#eab308' : '#ef4444'
                const typeLabel =
                  src.type === 'market_data'
                    ? 'API'
                    : src.type === 'etf'
                    ? 'ETF'
                    : src.type === 'macro'
                    ? 'Macro'
                    : 'Engine'

                const ageText =
                  src.data_age_minutes != null
                    ? src.data_age_minutes < 1
                      ? 'Live (< 1m)'
                      : `${Math.round(src.data_age_minutes)}m ago`
                    : 'Active'

                return (
                  <div
                    key={src.id}
                    className="flex items-center justify-between"
                    style={{
                      padding: '12px 18px',
                      fontSize: '0.8rem',
                      borderBottom:
                        idx < sources.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: statusColor,
                          boxShadow: `0 0 8px ${statusColor}`,
                        }}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.82rem' }}>
                            {src.name}
                          </span>
                          <span
                            className="font-mono text-[10px] px-1.5 py-0.2 rounded"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              color: 'var(--text-muted)',
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            {typeLabel}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {ageText} {src.last_http_status ? `· ${src.last_http_status} OK` : ''}
                        </span>
                      </div>
                    </div>

                    <span className={`badge badge-${src.health_status}`}>
                      {src.health_status}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
