import { describe, expect, it } from 'vitest'
import { calcularSentimiento } from './sentimiento'

describe('calcularSentimiento', () => {
  it('todos los indices en verde da RISK-ON', () => {
    const r = calcularSentimiento({ spx: 1.5, dax: 1.2, nikkei: 1.0, sse: 0.8, ftse: 0.9, vix: -3 })
    expect(r.clasificacion).toBe('RISK-ON')
    expect(r.score).toBeGreaterThan(0.3)
  })

  it('todos los indices en rojo da RISK-OFF', () => {
    const r = calcularSentimiento({ spx: -1.5, dax: -1.2, nikkei: -1.0, sse: -0.8, ftse: -0.9, vix: 2 })
    expect(r.clasificacion).toBe('RISK-OFF')
    expect(r.score).toBeLessThan(-0.3)
  })

  it('movimientos chicos y mixtos dan NEUTRAL', () => {
    const r = calcularSentimiento({ spx: 0.1, dax: -0.1, nikkei: 0.05, sse: -0.05, ftse: 0.1, vix: 0 })
    expect(r.clasificacion).toBe('NEUTRAL')
  })

  it('un VIX que sube fuerte empuja el score hacia RISK-OFF aunque los indices esten parejos', () => {
    const base = { spx: 0.2, dax: 0.2, nikkei: 0.2, sse: 0.2, ftse: 0.2 }
    const sinMiedo = calcularSentimiento({ ...base, vix: 0 })
    const conMiedo = calcularSentimiento({ ...base, vix: 15 })
    expect(conMiedo.score).toBeLessThan(sinMiedo.score)
  })

  it('con indices faltantes, normaliza por los pesos disponibles en vez de diluir a 0', () => {
    const r = calcularSentimiento({ spx: 1.0, dax: null, nikkei: null, sse: null, ftse: null, vix: null })
    expect(r.score).toBeCloseTo(1.0, 5)
  })
})
