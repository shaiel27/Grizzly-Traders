import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Only refreshes the Supabase session cookie. Authorization is enforced in each
// page and route handler (see lib/auth.ts), never here.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data } = await supabase.auth.getUser()

  // Optimistic redirect only; the allowlist check happens in the page (lib/auth.ts)
  if (!data.user && request.nextUrl.pathname.startsWith('/cms')) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    // Propagar cookies refrescadas (setAll) que quedaron en `response`
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    return redirect
  }

  return response
}

export const config = {
  matcher: ['/cms/:path*', '/login', '/api/posts/:path*'],
}
