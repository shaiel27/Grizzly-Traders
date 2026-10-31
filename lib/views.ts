// Contador de vistas de los artículos. El artículo es una página que se puede cachear: la visita se cuenta con una
// petición aparte (components/ui/ViewBeacon.tsx → POST /api/views/[id]), no en el render.

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent)
}

const DEDUPE_MS = 30 * 60_000
const MAX_ENTRIES = 5_000
const seen = new Map<string, number>()

// Una misma IP no suma dos veces el mismo artículo en 30 minutos (recargas, pestañas duplicadas). En memoria de la
// instancia: frena el ruido, no es una defensa contra un ataque dirigido.
export function shouldCountView(ip: string, postId: string, now = Date.now()): boolean {
  const key = `${ip}|${postId}`
  const last = seen.get(key)
  if (last !== undefined && now - last < DEDUPE_MS) return false
  if (seen.size >= MAX_ENTRIES) {
    for (const [entry, time] of seen) if (now - time >= DEDUPE_MS) seen.delete(entry)
    if (seen.size >= MAX_ENTRIES) seen.clear()
  }
  seen.set(key, now)
  return true
}

export function resetViewDedupe(): void {
  seen.clear()
}
