import { createHash, createHmac, randomBytes } from 'node:crypto'

// Vigencia del enlace de confirmación y de baja
export const TOKEN_TTL_MS = 48 * 60 * 60 * 1000
// Mínimo entre dos correos al mismo suscriptor: evita usar el formulario para inundar una bandeja ajena
export const RESEND_COOLDOWN_MS = 60 * 1000

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

// En la base solo se guarda el hash: quien lea la tabla no puede confirmar ni dar de baja a nadie
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// La IP no se guarda en claro; con sal propia el hash no se puede revertir con una tabla de IPs conocidas
export function hashIp(ip: string, salt: string): string {
  return createHmac('sha256', salt).update(ip).digest('hex')
}

export function isExpired(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return true
  const time = Date.parse(expiresAt)
  return Number.isNaN(time) || time <= now.getTime()
}

export function withinCooldown(sentAt: string | null, now: Date): boolean {
  if (!sentAt) return false
  const time = Date.parse(sentAt)
  return !Number.isNaN(time) && now.getTime() - time < RESEND_COOLDOWN_MS
}
