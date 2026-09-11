import { createClient } from '@/lib/supabase/server'

/**
 * Validates whether an incoming request to an internal cron or sync route is authorized.
 *
 * A request is authorized if ANY of the following are true:
 * 1. Not in production mode, or CRON_SECRET is not configured.
 * 2. The URL query parameter `?secret=<CRON_SECRET>` matches process.env.CRON_SECRET.
 * 3. The `Authorization: Bearer <CRON_SECRET>` header matches process.env.CRON_SECRET (used by Netlify / Vercel scheduled functions).
 * 4. An active, authenticated user session exists in Supabase (triggered from inside the web app UI by a logged-in analyst).
 */
export async function isAuthorizedCronOrUser(request: Request): Promise<boolean> {
  // If CRON_SECRET is not configured or in local development, allow
  if (!process.env.CRON_SECRET || process.env.NODE_ENV !== 'production') {
    return true
  }

  const cronSecret = process.env.CRON_SECRET.trim()
  const { searchParams } = new URL(request.url)
  const secretParam = searchParams.get('secret')?.trim()
  const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()

  // 1. Check URL query parameter: ?secret=...
  if (secretParam && secretParam === cronSecret) {
    return true
  }

  // 2. Check Authorization header: Bearer ...
  if (authHeader && authHeader === cronSecret) {
    return true
  }

  // 3. Check if an authenticated user is triggering this from within the app (session cookies)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      return true
    }
  } catch {
    // Cookie reading or session check failed
  }

  return false
}
