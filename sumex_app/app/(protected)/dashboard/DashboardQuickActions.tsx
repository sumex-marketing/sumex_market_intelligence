'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, RefreshCw, LineChart, Sparkles } from 'lucide-react'

export default function DashboardQuickActions({
  dataTimestamp,
}: {
  dataTimestamp: string | null
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const handleSyncMarket = async () => {
    setSyncing(true)
    setNotice(null)
    try {
      const res = await fetch('/api/cron/fetch-market-data', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setNotice(`Prices synced: ${data.records ?? 0} updated`)
        setTimeout(() => setNotice(null), 4000)
        router.refresh()
      } else {
        setNotice(`Sync note: ${data.error || 'Check limits'}`)
      }
    } catch {
      setNotice('Network error syncing')
    } finally {
      setSyncing(false)
    }
  }

  const handleRunScan = async () => {
    setScanning(true)
    setNotice(null)
    try {
      const res = await fetch('/api/signals/scan', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setNotice(`Scan done: ${data.signalsCreated ?? 0} signals`)
        setTimeout(() => setNotice(null), 4000)
        router.refresh()
      } else {
        setNotice(`Scan note: ${data.error || 'Done'}`)
      }
    } catch {
      setNotice('Error running scan')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {notice && (
        <span className="badge badge-cyan text-xs font-semibold">
          {notice}
        </span>
      )}
      {dataTimestamp && (
        <div className="flex items-center gap-2" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span className="live-dot">LIVE</span>
          <span>Updated {dataTimestamp}</span>
        </div>
      )}
      <button
        onClick={handleSyncMarket}
        className="btn btn-ghost btn-sm"
        style={{ color: '#23F7DD', border: '1px solid rgba(35,247,221,0.25)' }}
        disabled={syncing}
        title="Trigger live price ingestion"
      >
        <RefreshCw size={13} className={syncing ? 'spin' : ''} />
        {syncing ? 'Syncing...' : 'Sync Prices'}
      </button>
      <button
        onClick={handleRunScan}
        className="btn btn-ghost btn-sm"
        style={{ color: '#8E33FF', border: '1px solid rgba(142,51,255,0.25)' }}
        disabled={scanning}
        title="Run signal threshold scanner"
      >
        <Sparkles size={13} className={scanning ? 'spin' : ''} />
        {scanning ? 'Scanning...' : 'Scan Signals'}
      </button>
      <Link href="/market" prefetch={true} className="btn btn-secondary btn-sm">
        <LineChart size={14} />
        Market Desk
      </Link>
      <Link href="/signals" prefetch={true} className="btn btn-primary btn-sm">
        <Zap size={14} />
        Signal Feed
      </Link>
    </div>
  )
}
