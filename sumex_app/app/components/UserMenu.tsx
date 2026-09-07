'use client'

import { createClient } from '@/lib/supabase/client'
import { LogOut, User } from 'lucide-react'

interface UserMenuProps {
  email: string
  fullName: string
  role: string
}

export default function UserMenu({ email, fullName, role }: UserMenuProps) {
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 p-1">
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}>
          <User size={16} />
        </div>
        <div className="flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
          <span className="text-xs font-semibold text-primary truncate">
            {fullName}
          </span>
          <span className="text-xs text-muted truncate" style={{ fontSize: '0.65rem' }}>
            {email}
          </span>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="btn btn-ghost btn-sm text-muted justify-start"
        style={{ width: '100%', padding: '6px 8px' }}
      >
        <LogOut size={14} />
        <span>Sign out</span>
      </button>
    </div>
  )
}
