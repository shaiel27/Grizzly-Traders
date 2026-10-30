import { describe, expect, it } from 'vitest'
import { bearerMatches, clientIp, createRateLimiter } from './guards'

describe('createRateLimiter', () => {
  it('permite hasta el máximo y bloquea el siguiente intento', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 })
    expect(limiter.exceeded('ip')).toBe(false)
    expect(limiter.exceeded('ip')).toBe(false)
    expect(limiter.exceeded('ip')).toBe(true)
  })

  it('cada clave lleva su propia cuenta', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 })
    expect(limiter.exceeded('a')).toBe(false)
    expect(limiter.exceeded('b')).toBe(false)
  })

  it('vuelve a permitir cuando pasa la ventana', () => {
    let time = 0
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => time })
    limiter.exceeded('ip')
    expect(limiter.exceeded('ip')).toBe(true)
    time = 5000
    expect(limiter.exceeded('ip')).toBe(false)
  })
})

describe('clientIp', () => {
  it('toma la primera IP de x-forwarded-for', () => {
    expect(clientIp(new Request('https://x.example', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }))).toBe('203.0.113.7')
  })

  it('cae a "unknown" sin la cabecera', () => {
    expect(clientIp(new Request('https://x.example'))).toBe('unknown')
  })
})

describe('bearerMatches', () => {
  const secret = 'a'.repeat(32)

  it('acepta el secreto correcto', () => {
    expect(bearerMatches(`Bearer ${secret}`, secret)).toBe(true)
  })

  it('rechaza uno distinto, vacío o sin el prefijo', () => {
    expect(bearerMatches(`Bearer ${'b'.repeat(32)}`, secret)).toBe(false)
    expect(bearerMatches('Bearer ', secret)).toBe(false)
    expect(bearerMatches(secret, secret)).toBe(false)
    expect(bearerMatches(null, secret)).toBe(false)
  })
})
