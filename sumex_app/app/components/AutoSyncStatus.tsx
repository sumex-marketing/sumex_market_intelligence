'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle2, ChevronDown, Clock, Activity, Zap, Play, Pause } from 'lucide-react'

const SYNC_INTERVAL_STORAGE_KEY = 'sumex_auto_sync_interval'

export default function AutoSyncStatus() {
  const router = useRouter()
  // Intervals in seconds: 60 (1m), 120 (2m), 180 (3m), 300 (5m), 0 (Paused)
  const [intervalSec, setIntervalSec] = useState<number>(180) // 3 minutes default
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [showDropdown, setShowDropdown] = useState<boolean>(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load user preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SYNC_INTERVAL_STORAGE_KEY)
      if (saved !== null) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed)) {
          setIntervalSec(parsed)
          setSecondsRemaining(parsed)
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Save preference
  const handleSelectInterval = (sec: number) => {
    setIntervalSec(sec)
    setSecondsRemaining(sec)
    try {
      localStorage.setItem(SYNC_INTERVAL_STORAGE_KEY, sec.toString())
    } catch {
      // Ignore
    }
  }

  // Trigger sync
  const triggerSync = useCallback(async (isManual = false) => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const res = await fetch('/api/cron/sync-all', { method: 'POST' })
      if (res.ok) {
        setLastSyncedAt(new Date())
        router.refresh()
      }
    } catch (err) {
      console.warn('Auto-sync notice:', err)
    } finally {
      setIsSyncing(false)
      if (intervalSec > 0) {
        setSecondsRemaining(intervalSec)
      }
    }
  }, [isSyncing, intervalSec, router])

  // Countdown timer loop
  useEffect(() => {
    if (intervalSec <= 0) return

    const timer = setInterval(() => {
      // Only decrement if tab is visible
      if (typeof document !== 'undefined' && document.hidden) return

      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          triggerSync(false)
          return intervalSec
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [intervalSec, triggerSync])

  // Sync when tab becomes visible if it was inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && secondsRemaining <= 5 && intervalSec > 0) {
        triggerSync(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [secondsRemaining, intervalSec, triggerSync])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = intervalSec > 0 ? Math.max(0, Math.min(100, ((intervalSec - secondsRemaining) / intervalSec) * 100)) : 0

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button in Topbar */}
      <button
        type="button"
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all hover:border-[#23F7DD]/50"
        style={{
          background: showDropdown
            ? 'rgba(20, 30, 48, 0.95)'
            : 'rgba(15, 23, 42, 0.85)',
          border: showDropdown
            ? '1px solid rgba(35, 247, 221, 0.4)'
            : '1px solid rgba(255, 255, 255, 0.15)',
          color: '#FFFFFF',
          boxShadow: showDropdown ? '0 0 12px rgba(35, 247, 221, 0.2)' : 'none',
        }}
        onClick={() => setShowDropdown(!showDropdown)}
        title="Click to configure live auto-sync schedule & manual refresh"
      >
        <div className="flex items-center gap-1.5">
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: intervalSec === 0 ? '#f59e0b' : '#23F7DD',
              boxShadow: intervalSec === 0 ? '0 0 6px rgba(245,158,11,0.6)' : '0 0 10px #23F7DD',
              animation: intervalSec === 0 ? 'none' : 'pulse 2s infinite',
            }}
          />
          <span
            className="font-mono text-xs font-semibold tracking-wide"
            style={{ color: intervalSec === 0 ? '#fbbf24' : '#23F7DD' }}
          >
            {isSyncing
              ? 'SYNCING...'
              : intervalSec === 0
              ? 'SYNC PAUSED'
              : `SYNC ${formatCountdown(secondsRemaining)}`}
          </span>
        </div>

        <span
          className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            triggerSync(true)
          }}
          title="Force Sync All Feeds Now (Prices, News, ETFs, Macro, Signals)"
        >
          <RefreshCw
            size={12}
            style={{
              animation: isSyncing ? 'spin 1s linear infinite' : 'none',
              color: isSyncing ? '#23F7DD' : '#94a3b8',
            }}
          />
        </span>

        <ChevronDown
          size={12}
          className="text-white/60 transition-transform"
          style={{ transform: showDropdown ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {/* Upgraded High-Contrast Timer Dialog / Popover */}
      {showDropdown && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-xl shadow-2xl p-3.5 z-50 flex flex-col gap-3"
          style={{
            background: 'linear-gradient(180deg, #111a2e 0%, #0c1220 100%)',
            border: '1px solid rgba(35, 247, 221, 0.3)',
            boxShadow: '0 20px 45px -5px rgba(0, 0, 0, 0.9), 0 0 25px rgba(35, 247, 221, 0.12)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: 'rgba(35, 247, 221, 0.15)', color: '#23F7DD' }}
              >
                <Clock size={13} />
              </div>
              <span className="font-bold text-xs text-white tracking-wide">
                Auto-Sync Schedule
              </span>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
              style={{
                background: intervalSec === 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(35, 247, 221, 0.15)',
                color: intervalSec === 0 ? '#fbbf24' : '#23F7DD',
                border: intervalSec === 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(35, 247, 221, 0.3)',
              }}
            >
              {intervalSec === 0 ? 'Paused' : 'Active'}
            </span>
          </div>

          {/* Live Status Card with Countdown & Progress */}
          <div
            className="rounded-lg p-2.5 flex flex-col gap-2"
            style={{
              background: 'rgba(5, 10, 20, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/70 font-medium">Next Live Sync</span>
              <span className="font-mono text-xs font-extrabold text-[#23F7DD]">
                {intervalSec === 0 ? 'Manual Only' : formatCountdown(secondsRemaining)}
              </span>
            </div>

            {/* Countdown Progress Bar */}
            {intervalSec > 0 && (
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #23F7DD, #8E33FF)',
                  }}
                />
              </div>
            )}
          </div>

          {/* Interval Selection Options */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider px-1">
              Select Sync Frequency
            </span>

            {[
              { label: 'Every 1 minute', detail: 'Real-time scalping', value: 60, tag: '60s' },
              { label: 'Every 2 minutes', detail: 'Active intraday', value: 120, tag: '2m' },
              { label: 'Every 3 minutes', detail: 'Standard cadence', value: 180, tag: '3m' },
              { label: 'Every 5 minutes', detail: 'Conserve bandwidth', value: 300, tag: '5m' },
              { label: 'Pause Auto-Sync', detail: 'Manual refresh only', value: 0, tag: 'OFF' },
            ].map((opt) => {
              const isSelected = intervalSec === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelectInterval(opt.value)}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer"
                  style={{
                    background: isSelected
                      ? 'rgba(35, 247, 221, 0.12)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected
                      ? '1px solid rgba(35, 247, 221, 0.45)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-all"
                      style={{
                        borderColor: isSelected ? '#23F7DD' : 'rgba(255, 255, 255, 0.3)',
                        background: isSelected ? '#23F7DD' : 'transparent',
                      }}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#0c1220]" />}
                    </div>
                    <div className="flex flex-col">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: isSelected ? '#FFFFFF' : '#CBD5E1' }}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-white/50">{opt.detail}</span>
                    </div>
                  </div>

                  <span
                    className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: isSelected ? 'rgba(35, 247, 221, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      color: isSelected ? '#23F7DD' : '#94a3b8',
                    }}
                  >
                    {opt.tag}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Actions & Last Synced Footer */}
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={() => triggerSync(true)}
              disabled={isSyncing}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(35, 247, 221, 0.2) 0%, rgba(142, 51, 255, 0.2) 100%)',
                border: '1px solid rgba(35, 247, 221, 0.4)',
                color: '#23F7DD',
              }}
            >
              <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
              {isSyncing ? 'Syncing All Feeds (Prices, News, ETFs, Macro)...' : 'Sync All Feeds Now'}
            </button>

            <div className="flex items-center justify-between text-[10px] text-white/60 px-0.5">
              <span>Coverage: Prices, News, ETFs, Macro, Signals</span>
              <span>
                {lastSyncedAt ? `Synced ${lastSyncedAt.toLocaleTimeString()}` : 'Connected'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
