import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') as EmailOtpType) || 'email'
  const next = searchParams.get('next') ?? '/dashboard'
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // If Supabase returned an explicit error in the redirect query params
  if (errorParam || errorDescription) {
    const errorMsg = errorDescription || errorParam || 'Authentication failed'
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component write fallback
          }
        },
      },
    }
  )

  // 1. Try PKCE code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.warn('[auth/callback] code exchange failed:', error.message)
  }

  // 2. Try OTP token_hash verification
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.warn('[auth/callback] token_hash verifyOtp failed:', error.message)
  }

  // If both failed or neither parameter was present
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Magic link session could not be established. Please use the 6-digit code from your email or sign in below.')}`
  )
}
