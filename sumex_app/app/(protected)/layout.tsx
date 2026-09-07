import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SidebarNav from '@/app/components/SidebarNav'
import UserMenu from '@/app/components/UserMenu'
import AutoSyncStatus from '@/app/components/AutoSyncStatus'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile for role badge
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'viewer'
  const fullName = profile?.full_name ?? user.email?.split('@')[0] ?? 'User'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="sidebar-logo">
          <img src="/sumex_logo.png" alt="Sumex Logo" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px' }} />
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">SUMEX</span>
            <span className="sidebar-logo-sub">Market Intelligence</span>
          </div>
        </Link>

        <SidebarNav userRole={role} />

        <div className="sidebar-footer">
          <UserMenu email={user.email ?? ''} fullName={fullName} role={role} />
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Sumex Intelligence Platform
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <AutoSyncStatus />
            <span className={`badge badge-${role === 'admin' ? 'purple' : role === 'editor' ? 'blue' : 'muted'}`}>
              Role: {role}
            </span>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
