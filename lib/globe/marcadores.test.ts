import { describe, expect, it } from 'vitest'
import { MARCADORES } from './marcadores'
import { ASSETS } from '../assets-catalog'
import es from '../i18n/dictionaries/es.json'
import en from '../i18n/dictionaries/en.json'

describe('catalogo de marcadores del globo', () => {
  it('son exactamente 8 (maximo del plan 009: mas se amontonan)', () => {
    expect(MARCADORES).toHaveLength(8)
  })

  it('ids y nombreClave son unicos', () => {
    expect(new Set(MARCADORES.map((m) => m.id)).size).toBe(MARCADORES.length)
    expect(new Set(MARCADORES.map((m) => m.nombreClave)).size).toBe(MARCADORES.length)
  })

  it('hay 3 pines de futuros de indices: ES, FDAX y NKD', () => {
    const indices = MARCADORES.filter((m) => m.tipo === 'indice')
    expect(indices.map((m) => m.simbolo).sort()).toEqual(['ES', 'FDAX', 'NKD'])
    expect(indices.map((m) => m.id).sort()).toEqual(['esChicago', 'fdaxFrankfurt', 'nikkeiTokio'])
  })

  it('las coordenadas de los futuros son las de Chicago, Fráncfort y Tokio', () => {
    const por = Object.fromEntries(MARCADORES.map((m) => [m.id, m]))
    expect([por.esChicago.lat, por.esChicago.lon]).toEqual([41.88, -87.63])
    expect([por.fdaxFrankfurt.lat, por.fdaxFrankfurt.lon]).toEqual([50.11, 8.68])
    expect([por.nikkeiTokio.lat, por.nikkeiTokio.lon]).toEqual([35.68, 139.69])
  })

  it('los duplicados de crudo y oro ya no estan: cada pin de materia prima es de una plaza distinta', () => {
    const ids = MARCADORES.map((m) => m.id)
    for (const viejo of ['crudoOriente', 'oroVenezuela', 'oroAustralia']) expect(ids).not.toContain(viejo)
    const simbolos = MARCADORES.map((m) => m.simbolo)
    expect(new Set(simbolos).size).toBe(simbolos.length)
  })

  it('las coordenadas son validas', () => {
    for (const m of MARCADORES) {
      expect(m.lat).toBeGreaterThanOrEqual(-90)
      expect(m.lat).toBeLessThanOrEqual(90)
      expect(m.lon).toBeGreaterThanOrEqual(-180)
      expect(m.lon).toBeLessThanOrEqual(180)
    }
  })

  it('cada simbolo existe en el catalogo (el ticker indexa por `plain`) y cada nombreClave en es y en', () => {
    const plains = new Set(ASSETS.map((a) => a.plain))
    for (const m of MARCADORES) {
      expect(plains.has(m.simbolo), m.simbolo).toBe(true)
      expect(Object.keys(es.home.globoMarcadores), m.nombreClave).toContain(m.nombreClave)
      expect(Object.keys(en.home.globoMarcadores), m.nombreClave).toContain(m.nombreClave)
    }
  })
})
