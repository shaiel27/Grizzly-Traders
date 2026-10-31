import { describe, expect, it } from 'vitest'
import { COINGECKO_BASE, coingeckoHeaders } from './coingecko'

describe('coingeckoHeaders', () => {
  it('sin llave solo pide JSON', () => {
    expect(coingeckoHeaders({})).toEqual({ Accept: 'application/json' })
    expect(coingeckoHeaders({ COINGECKO_API_KEY: '   ' })).toEqual({ Accept: 'application/json' })
  })

  it('con llave la manda en la cabecera de la API Demo', () => {
    expect(coingeckoHeaders({ COINGECKO_API_KEY: ' CG-abc ' })).toEqual({ Accept: 'application/json', 'x-cg-demo-api-key': 'CG-abc' })
  })

  it('la base es la de la API pública y Demo', () => {
    expect(COINGECKO_BASE).toBe('https://api.coingecko.com/api/v3')
  })
})
