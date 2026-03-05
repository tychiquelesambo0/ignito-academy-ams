import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './lib/supabase/types'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes for applicants (dashboard)
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/apply', request.url))
  }

  // Protected routes for admissions officers (admin)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Allow the login and forbidden pages through without auth checks
    const isPublicAdminRoute =
      request.nextUrl.pathname === '/admin/login' ||
      request.nextUrl.pathname === '/admin/forbidden'

    if (isPublicAdminRoute) {
      // If already authenticated as an officer, skip straight to dashboard
      if (user && request.nextUrl.pathname === '/admin/login') {
        const { data: officer } = await supabase
          .from('admissions_officers')
          .select('id, is_active')
          .eq('id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        if (officer) {
          return NextResponse.redirect(new URL('/admin', request.url))
        }
      }
      return response
    }

    // All other /admin/* routes require authentication
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Verify the user is an active admissions officer
    const { data: officer, error } = await supabase
      .from('admissions_officers')
      .select('id, is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (error || !officer || !officer.is_active) {
      return NextResponse.redirect(new URL('/admin/forbidden', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
