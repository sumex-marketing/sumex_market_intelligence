import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import SettingsWorkspace from './SettingsWorkspace'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()

  // Verify Admin Access
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const serviceClient = createServiceClient()

  const [settingsRes, usersRes, assetsRes] = await Promise.all([
    serviceClient.from('app_settings').select('*'),
    serviceClient.from('user_profiles').select('*').order('created_at', { ascending: false }),
    serviceClient.from('assets').select('*').order('sort_order', { ascending: true }),
  ])

  return (
    <div className="flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-primary" style={{
          background: 'linear-gradient(135deg, #e8edf5 30%, #23F7DD 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          System Settings & Administration
        </h1>
        <p className="text-sm text-muted">Configure signal triggers, monitored watchlist, user permissions, & source health</p>
      </div>

      <SettingsWorkspace
        settings={settingsRes.data ?? []}
        users={usersRes.data ?? []}
        assets={assetsRes.data ?? []}
      />
    </div>
  )
}
