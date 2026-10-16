'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserProfile, UserRole } from '@/lib/types'
import { Sliders, Shield, RefreshCw, Database, Users } from 'lucide-react'

export default function SettingsWorkspace({
  settings,
  users,
  assets = [],
}: {
  settings: any[]
  users: UserProfile[]
  assets?: any[]
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState<string | null>(null)
  const [userList, setUserList] = useState(users)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Extract threshold settings
  const thresholdObj = settings.find((s) => s.key === 'signal_thresholds')?.value ?? {
    btc_24h_pct: 4,
    eth_24h_pct: 5,
    sol_24h_pct: 7,
    btc_dominance_pp: 0.7,
    volume_change_pct: 25,
  }

  const [thresholds, setThresholds] = useState(thresholdObj)
  const [savingSettings, setSavingSettings] = useState(false)

  const handleSaveThresholds = async () => {
    setSavingSettings(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'signal_thresholds',
          value: thresholds,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 4000)
        router.refresh()
      } else {
        setSaveError(data.error || 'Failed to save settings')
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error saving settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleManualSync = async (type: 'market' | 'etf' | 'all') => {
    setSyncing(type)
    try {
      const endpoint =
        type === 'all'
          ? '/api/cron/sync-all'
          : type === 'market'
          ? '/api/cron/fetch-market-data'
          : '/api/cron/fetch-etf-flows'
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        alert(
          type === 'all'
            ? 'Universal sync completed: All intelligence feeds and signals updated.'
            : `Sync completed: ${data.records ?? 0} records updated.`
        )
        router.refresh()
      } else {
        alert(`Sync error: ${data.error}`)
      }
    } catch {
      alert('Error triggering sync')
    } finally {
      setSyncing(null)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })
      if (res.ok) {
        setUserList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        )
      } else {
        alert('Failed to update role')
      }
    } catch (err) {
      alert('Error updating user role')
    }
  }

  return (
    <div className="flex-col gap-6">
      {/* Manual Sync Triggers */}
      <div className="card flex-col gap-4">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <RefreshCw className="text-blue" size={18} />
            <span className="card-title" style={{ color: 'var(--text-primary)' }}>
              Manual Data Sync Triggers
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleManualSync('all')}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
            disabled={syncing != null}
            style={{
              background: 'linear-gradient(135deg, #23F7DD 0%, #8E33FF 100%)',
              color: '#080d1a',
              fontWeight: 700,
              border: 'none',
            }}
          >
            <RefreshCw size={13} className={syncing === 'all' ? 'spin' : ''} />
            {syncing === 'all' ? 'Syncing All Feeds...' : 'Sync All Feeds (Universal)'}
          </button>
          <button
            onClick={() => handleManualSync('market')}
            className="btn btn-secondary btn-sm"
            disabled={syncing != null}
          >
            {syncing === 'market' ? 'Syncing CoinGecko...' : 'Sync Prices Only'}
          </button>
          <button
            onClick={() => handleManualSync('etf')}
            className="btn btn-secondary btn-sm"
            disabled={syncing != null}
          >
            {syncing === 'etf' ? 'Scraping Farside...' : 'Sync ETF Flows Only'}
          </button>
        </div>
      </div>

      {/* Signal Threshold Settings */}
      <div className="card flex-col gap-4">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="text-amber" size={18} />
            <span className="card-title" style={{ color: 'var(--text-primary)' }}>
              Signal Engine Sensitivity Thresholds
            </span>
          </div>
          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="badge badge-green text-xs font-semibold">
                ✓ Settings Saved to Database
              </span>
            )}
            {saveError && (
              <span className="badge badge-red text-xs font-semibold">
                Error: {saveError}
              </span>
            )}
            <button
              onClick={handleSaveThresholds}
              className="btn btn-primary btn-sm"
              disabled={savingSettings}
            >
              {savingSettings ? 'Saving...' : 'Save Thresholds'}
            </button>
          </div>
        </div>

        <div className="grid-4">
          <div className="form-group">
            <label className="form-label">BTC 24h Threshold (% move)</label>
            <input
              type="number"
              className="form-input"
              value={thresholds.btc_24h_pct == null || isNaN(thresholds.btc_24h_pct) ? '' : thresholds.btc_24h_pct}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  btc_24h_pct: e.target.value === '' ? 0 : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">ETH 24h Threshold (% move)</label>
            <input
              type="number"
              className="form-input"
              value={thresholds.eth_24h_pct == null || isNaN(thresholds.eth_24h_pct) ? '' : thresholds.eth_24h_pct}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  eth_24h_pct: e.target.value === '' ? 0 : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">SOL 24h Threshold (% move)</label>
            <input
              type="number"
              className="form-input"
              value={thresholds.sol_24h_pct == null || isNaN(thresholds.sol_24h_pct) ? '' : thresholds.sol_24h_pct}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  sol_24h_pct: e.target.value === '' ? 0 : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">HYPE 24h Threshold (% move)</label>
            <input
              type="number"
              className="form-input"
              value={(thresholds as any).hype_24h_pct == null || isNaN((thresholds as any).hype_24h_pct) ? '' : (thresholds as any).hype_24h_pct}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  hype_24h_pct: e.target.value === '' ? 0 : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">BTC Dominance Delta (percentage points)</label>
            <input
              type="number"
              step="0.1"
              className="form-input"
              value={thresholds.btc_dominance_pp == null || isNaN(thresholds.btc_dominance_pp) ? '' : thresholds.btc_dominance_pp}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  btc_dominance_pp: e.target.value === '' ? 0 : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Volume Spike Threshold (% change)</label>
            <input
              type="number"
              className="form-input"
              value={thresholds.volume_change_pct == null || isNaN(thresholds.volume_change_pct) ? '' : thresholds.volume_change_pct}
              onChange={(e) =>
                setThresholds({
                  ...thresholds,
                  volume_change_pct: e.target.value === '' ? 0 : parseFloat(e.target.value),
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Monitored Watchlist Assets */}
      {assets && assets.length > 0 && (
        <div className="card flex-col gap-4">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Database className="text-cyan" size={18} color="#23F7DD" />
              <span className="card-title" style={{ color: 'var(--text-primary)' }}>
                Monitored Market Watchlist ({assets.length})
              </span>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Symbol</th>
                  <th>Asset Name</th>
                  <th>CoinGecko ID</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a: any) => (
                  <tr key={a.id}>
                    <td className="td-mono text-muted text-xs">#{a.sort_order ?? 1}</td>
                    <td className="font-bold td-mono" style={{ color: '#23F7DD' }}>{a.symbol}</td>
                    <td className="font-semibold text-primary">{a.name}</td>
                    <td className="td-mono text-muted text-xs">{a.coingecko_id}</td>
                    <td><span className="badge badge-purple">{a.category}</span></td>
                    <td>
                      <span className={`badge ${a.active ? 'badge-green' : 'badge-muted'}`}>
                        {a.active ? 'Active Tracking' : 'Paused'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Management */}
      <div className="card flex-col gap-4">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Users className="text-purple" size={18} />
            <span className="card-title" style={{ color: 'var(--text-primary)' }}>
              Team Roles & Permissions ({userList.length})
            </span>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Assigned Role</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => (
                <tr key={u.id}>
                  <td className="td-mono text-xs text-muted">{u.id}</td>
                  <td className="font-semibold text-primary">{u.full_name ?? 'Analyst'}</td>
                  <td>
                    <select
                      className="form-select btn-sm"
                      style={{ width: '130px', padding: '4px 8px' }}
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                    >
                      <option value="admin">admin</option>
                      <option value="editor">editor</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </td>
                  <td className="text-muted text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
