import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Ventana fija por IP y ruta, solo en memoria: cada instancia del servidor (y cada réplica
// en despliegues multi-instancia) aplica su propio presupuesto; no hay estado compartido.
const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/api/candles': { limit: 30, windowMs: 60_000 },
  '/api/quote': { limit: 60, windowMs: 60_000 },
  '/api/markets': { limit: 10, windowMs: 60_000 },
}
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(request: NextRequest): NextResponse | null {
  const rule = RATE_LIMITS[request.nextUrl.pathname]
  if (!rule) return null

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const key = `${ip}|${request.nextUrl.pathname}`
  let bucket = rateBuckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + rule.windowMs }
    rateBuckets.set(key, bucket)
  }

  // Barrido oportunista: sin él el mapa crecería sin límite con una IP por ventana
  if (rateBuckets.size > 5_000) {
    for (const [entryKey, entry] of rateBuckets) {
      if (now >= entry.resetAt) rateBuckets.delete(entryKey)
    }
  }

  bucket.count += 1
  if (bucket.count <= rule.limit) return null

  return NextResponse.json(
    { success: false, error: 'Demasiadas peticiones. Espera un momento.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000)) } }
  )
}

// Only refreshes the Supabase session cookie. Authorization is enforced in each
// page and route handler (see lib/auth.ts), never here.
export async function proxy(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited

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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
            })
          )
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
  matcher: ['/cms/:path*', '/login', '/api/posts/:path*', '/api/candles', '/api/quote', '/api/markets'],
}
