'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordMode, setIsPasswordMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setMessage(null)

    const supabase = createClient()

    if (isPasswordMode) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setMessage({ text: error.message, type: 'error' })
      } else {
        window.location.href = '/dashboard'
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setMessage({ text: error.message, type: 'error' })
      } else {
        setMessage({
          text: 'Magic link sent! Please check your email to sign in.',
          type: 'success',
        })
      }
    }
    setLoading(false)
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
      <div className="card-glass" style={{ width: '100%', maxWidth: '420px' }}>
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

        {message && (
          <div className={`badge badge-${message.type === 'success' ? 'green' : 'red'}`} style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            justifyContent: 'center',
            textAlign: 'center',
            whiteSpace: 'normal',
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex-col gap-4">
          <div className="form-group">
            <label className="form-label">Work Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="analyst@sumex.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {isPasswordMode && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg mt-2"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Processing...' : isPasswordMode ? 'Sign In with Password' : 'Send Magic Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsPasswordMode(!isPasswordMode)}
            style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
          >
            {isPasswordMode ? 'Use Magic Link instead' : 'Use Password instead'}
          </button>
        </div>
      </div>
    </div>
  )
}
