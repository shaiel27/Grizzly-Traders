import { createHash, timingSafeEqual } from 'node:crypto'

// Límite de intentos por clave (IP), solo en memoria: cada instancia del servidor lleva su propia cuenta.
// Es el mismo criterio que ya tenía /api/subscribe; si el sitio pasa a varias instancias habrá que moverlo
// a un almacén compartido.
export function createRateLimiter({ windowMs, max, now = () => Date.now() }: { windowMs: number; max: number; now?: () => number }) {
  const attempts = new Map<string, number[]>()

  return {
    // true cuando la clave ya superó el máximo dentro de la ventana
    exceeded(key: string): boolean {
      const time = now()
      const recent = (attempts.get(key) ?? []).filter((at) => time - at < windowMs)
      recent.push(time)
      attempts.set(key, recent)
      // Barrido oportunista para que el mapa no crezca sin límite con una IP distinta por intento
      if (attempts.size > 5_000) attempts.clear()
      return recent.length > max
    },
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

// Compara "Authorization: Bearer <secreto>" en tiempo constante, para no filtrar el secreto por tiempos de respuesta
export function bearerMatches(header: string | null, secret: string): boolean {
  const match = header?.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  const given = createHash('sha256').update(match[1]).digest()
  const expected = createHash('sha256').update(secret).digest()
  return timingSafeEqual(given, expected)
}
