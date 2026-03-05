import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (code) {
    // OAuth / PKCE flow
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return redirectToDashboard(request, origin)
    }
  }

  if (token_hash && type === 'signup') {
    // Email confirmation flow
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'signup' })
    if (!error && data.user) {
      return redirectToDashboard(request, origin)
    }
  }

  if (token_hash && type === 'recovery') {
    // Password reset flow — redirect to reset page
    return NextResponse.redirect(`${origin}/auth/reset?token_hash=${token_hash}&type=recovery`)
  }

  // Fallback — something went wrong
  return NextResponse.redirect(`${origin}/apply?error=confirmation_failed`)
}

async function redirectToDashboard(request: NextRequest, origin: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/apply`)
  }

  // Fetch their applicant_id to redirect straight to academic history
  const { data: app } = await admin
    .from('applications')
    .select('applicant_id, ecole_provenance')
    .eq('user_id', user.id)
    .single()

  // If academic history is already filled, go to dashboard
  if (app?.ecole_provenance) {
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Otherwise, continue with academic history form
  if (app?.applicant_id) {
    return NextResponse.redirect(
      `${origin}/apply/academic-history?applicant_id=${app.applicant_id}`
    )
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
