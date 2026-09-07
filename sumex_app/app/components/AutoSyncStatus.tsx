'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle2, ChevronDown, Radio } from 'lucide-react'

const SYNC_INTERVAL_STORAGE_KEY = 'sumex_auto_sync_interval'

export default function AutoSyncStatus() {
  const router = useRouter()
  // Intervals in seconds: 60 (1m), 120 (2m), 300 (5m), 0 (Paused)
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
    setShowDropdown(false)
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
      const res = await fetch('/api/cron/fetch-market-data', { method: 'POST' })
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

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all"
        style={{
          background: 'rgba(17, 24, 39, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'var(--text-secondary)',
        }}
        onClick={() => setShowDropdown(!showDropdown)}
        title="Live Market & Signal Sync Engine"
      >
        <div className="flex items-center gap-1.5">
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: intervalSec === 0 ? '#f59e0b' : '#23F7DD',
              boxShadow: intervalSec === 0 ? 'none' : '0 0 8px #23F7DD',
              animation: intervalSec === 0 ? 'none' : 'pulse 2s infinite',
            }}
          />
          <span className="font-mono text-[11px]" style={{ color: intervalSec === 0 ? '#f59e0b' : '#23F7DD' }}>
            {isSyncing
              ? 'SYNCING...'
              : intervalSec === 0
              ? 'PAUSED'
              : `SYNC ${formatCountdown(secondsRemaining)}`}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            triggerSync(true)
          }}
          className="p-0.5 rounded hover:bg-white/10 text-muted hover:text-white transition-colors"
          disabled={isSyncing}
          title="Force Sync Now"
        >
          <RefreshCw
            size={11}
            style={{
              animation: isSyncing ? 'spin 1s linear infinite' : 'none',
              color: isSyncing ? '#23F7DD' : undefined,
            }}
          />
        </button>

        <ChevronDown size={11} className="text-muted" />
      </div>

      {showDropdown && (
        <div
          className="absolute right-0 mt-1.5 w-56 rounded-lg shadow-2xl py-1.5 z-50 text-xs flex flex-col gap-0.5"
          style={{
            background: '#0d131f',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
          }}
        >
          <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] text-muted font-semibold tracking-wider uppercase">
            <span>Sync Frequency</span>
            <button
              onClick={() => triggerSync(true)}
              className="text-[#23F7DD] hover:underline flex items-center gap-1"
            >
              <RefreshCw size={10} className={isSyncing ? 'spin' : ''} />
              Sync Now
            </button>
          </div>

          {[
            { label: 'Every 1 minute (Fast)', value: 60 },
            { label: 'Every 2 minutes', value: 120 },
            { label: 'Every 3 minutes (Standard)', value: 180 },
            { label: 'Every 5 minutes (Conserve)', value: 300 },
            { label: 'Paused (Manual only)', value: 0 },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelectInterval(opt.value)}
              className="flex items-center justify-between px-3 py-1.5 text-left hover:bg-white/5 transition-colors"
              style={{
                color: intervalSec === opt.value ? '#23F7DD' : 'var(--text-secondary)',
                fontWeight: intervalSec === opt.value ? 600 : 400,
              }}
            >
              <span>{opt.label}</span>
              {intervalSec === opt.value && <CheckCircle2 size={13} className="text-[#23F7DD]" />}
            </button>
          ))}

          {lastSyncedAt && (
            <div className="px-3 py-1 border-t border-white/5 text-[10px] text-muted text-right">
              Last synced: {lastSyncedAt.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
