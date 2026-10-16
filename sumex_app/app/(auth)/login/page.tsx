'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type LoginMode = 'password' | 'magic-link' | 'otp-verify'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [mode, setMode] = useState<LoginMode>('password')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Listen for hash tokens or error params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const errorParam = params.get('error')
      if (errorParam) {
        setMessage({
          text: decodeURIComponent(errorParam),
          type: 'error',
        })
      }

      // Check for hash tokens (#access_token=...)
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const supabase = createClient()
        supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            window.location.href = '/dashboard'
          }
        })
      }
    }
  }, [])

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage({ text: error.message, type: 'error' })
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setMessage(null)

    const supabase = createClient()
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (error) {
      if (error.message.toLowerCase().includes('rate limit') || error.message.toLowerCase().includes('too many')) {
        setMessage({
          text: 'Email rate limit reached. Please wait an hour before requesting another magic link, or use password sign-in instead.',
          type: 'error',
        })
      } else {
        setMessage({ text: error.message, type: 'error' })
      }
    } else {
      setMode('otp-verify')
      setMessage({
        text: `Login link & 6-digit code sent to ${email}. Click the link in your email, or enter the code below.`,
        type: 'success',
      })
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode || !email) return
    setLoading(true)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: 'email',
    })

    if (error) {
      setMessage({ text: error.message, type: 'error' })
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  const resetToMain = () => {
    setMode('password')
    setOtpCode('')
    setMessage(null)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '24px',
    }}>
      <div className="card-glass" style={{ width: '100%', maxWidth: '440px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img src="/sumex_logo.png" alt="Sumex Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Sumex Intelligence
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Sign in to access your research command centre
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`badge badge-${message.type === 'success' ? 'green' : message.type === 'info' ? 'cyan' : 'red'}`} style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            justifyContent: 'center',
            textAlign: 'center',
            whiteSpace: 'normal',
            lineHeight: 1.4,
          }}>
            {message.text}
          </div>
        )}

        {/* OTP Code Verify Mode */}
        {mode === 'otp-verify' ? (
          <form onSubmit={handleVerifyOtp} className="flex-col gap-4">
            <div className="form-group">
              <label className="form-label">Enter 6-Digit Email Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
                maxLength={6}
                inputMode="numeric"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.5rem',
                  letterSpacing: '0.4em',
                  textAlign: 'center',
                }}
              />
              <span className="text-xs text-muted" style={{ marginTop: 4 }}>
                Check your inbox for the code sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg mt-1"
              disabled={loading || otpCode.length < 6}
              style={{ width: '100%' }}
            >
              {loading ? 'Verifying...' : 'Verify Code & Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={resetToMain}
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
              >
                ← Back to sign in
              </button>
            </div>
          </form>

        ) : mode === 'password' ? (
          /* Password Sign In (Primary) */
          <form onSubmit={handlePasswordSignIn} className="flex-col gap-4">
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="analyst@sumex.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg mt-2"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setMode('magic-link'); setMessage(null) }}
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
              >
                Use magic link / email code instead →
              </button>
            </div>
          </form>

        ) : (
          /* Magic Link Mode */
          <form onSubmit={handleSendMagicLink} className="flex-col gap-4">
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="analyst@sumex.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg mt-2"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Sending...' : 'Send Magic Link / Code'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setMode('password'); setMessage(null) }}
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
              >
                ← Use password instead
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
