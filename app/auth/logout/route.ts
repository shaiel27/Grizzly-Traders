import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Cierra la sesión del editor EN EL SERVIDOR.
//
// Por qué no basta el cliente del navegador: las cookies de sesión (`sb-*`) se emiten como httpOnly (lib/supabase/server.ts y proxy.ts),
// así que JavaScript no las ve. `createClient().auth.signOut()` en el navegador no encuentra sesión que cerrar y no puede borrar las
// cookies; /login entonces ve la sesión viva y devuelve al editor a /cms: el botón "parecía no hacer nada".
export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  // Solo desde nuestro propio sitio: otra página no puede cerrar la sesión del editor con un formulario oculto. Se compara el host (detrás de Caddy
  // la URL interna es http://127.0.0.1:3000 y no el dominio público).
  const sitio = request.headers.get('sec-fetch-site')
  if (sitio && sitio !== 'same-origin' && sitio !== 'none') {
    return NextResponse.json({ success: false, error: 'Origen no permitido' }, { status: 403, headers: SIN_CACHE })
  }
  const origen = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origen && host) {
    let hostOrigen = ''
    try {
      hostOrigen = new URL(origen).host
    } catch {
      // un Origin ilegible se trata como no permitido
    }
    if (hostOrigen !== host) return NextResponse.json({ success: false, error: 'Origen no permitido' }, { status: 403, headers: SIN_CACHE })
  }

  // Revoca la sesión en Supabase (solo esta; no cierra las de otros dispositivos). Si falla, se borran las cookies igualmente.
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) console.error('Logout: no se pudo revocar la sesión en Supabase:', error.message)

  // Refuerzo: se expiran todas las cookies de sesión (incluidas las partidas en trozos: sb-…-auth-token.0, .1…)
  const almacen = await cookies()
  for (const { name } of almacen.getAll()) {
    if (name.startsWith('sb-')) almacen.set(name, '', { maxAge: 0, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production' })
  }

  return NextResponse.json({ success: true }, { headers: SIN_CACHE })
}
