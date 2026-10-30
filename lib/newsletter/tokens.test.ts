import { describe, expect, it } from 'vitest'
import { generateToken, hashIp, hashToken, isExpired, RESEND_COOLDOWN_MS, withinCooldown } from './tokens'

const now = new Date('2026-10-27T12:00:00Z')

describe('tokens', () => {
  it('genera tokens distintos y seguros para una URL', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('el hash es estable y no revela el token', () => {
    const token = generateToken()
    expect(hashToken(token)).toBe(hashToken(token))
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(token)).not.toContain(token)
  })

  it('el hash de la IP depende de la sal', () => {
    expect(hashIp('203.0.113.7', 'sal-1')).toBe(hashIp('203.0.113.7', 'sal-1'))
    expect(hashIp('203.0.113.7', 'sal-1')).not.toBe(hashIp('203.0.113.7', 'sal-2'))
  })

  it('detecta tokens vencidos, ausentes o con fecha inválida', () => {
    expect(isExpired('2026-10-27T11:59:59Z', now)).toBe(true)
    expect(isExpired('2026-10-27T12:00:00Z', now)).toBe(true)
    expect(isExpired('2026-10-27T12:00:01Z', now)).toBe(false)
    expect(isExpired(null, now)).toBe(true)
    expect(isExpired('no-es-una-fecha', now)).toBe(true)
  })

  it('aplica la espera mínima entre correos', () => {
    const justBefore = new Date(now.getTime() - RESEND_COOLDOWN_MS + 1000).toISOString()
    const longAgo = new Date(now.getTime() - RESEND_COOLDOWN_MS - 1000).toISOString()
    expect(withinCooldown(justBefore, now)).toBe(true)
    expect(withinCooldown(longAgo, now)).toBe(false)
    expect(withinCooldown(null, now)).toBe(false)
  })
})
