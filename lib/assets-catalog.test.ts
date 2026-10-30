import { describe, expect, it } from 'vitest'
import { ASSETS, ASSET_BY_PLAIN, ASSET_CLASS_TIPO_ID, intercalarPorClase } from './assets-catalog'

describe('ASSETS', () => {
  it('has the full 84-asset catalog', () => {
    expect(ASSETS).toHaveLength(84)
  })

  // Fase 5 del plan de cobertura en inglés (PLAN-API-ACTIVOS.md): todo activo debe tener un
  // nombre en inglés, aunque sea igual al español, para que los consumidores nunca tengan que
  // mostrar el nombre en español a un visitante en /en.
  it('has a non-empty nameEn for every asset', () => {
    const missing = ASSETS.filter((asset) => !asset.nameEn || asset.nameEn.trim() === '')
    expect(missing.map((asset) => asset.plain)).toEqual([])
  })

  it('has a unique plain across the whole catalog', () => {
    const plains = ASSETS.map((asset) => asset.plain)
    expect(new Set(plains).size).toBe(plains.length)
  })
})

// PLAN-FUTUROS.md §1/§4: 20 contratos continuos con pestaña propia (`future`).
describe('futuros (cls: future)', () => {
  const futuros = ASSETS.filter((asset) => asset.cls === 'future')

  it('has the 20 contracts of the plan', () => {
    expect(futuros).toHaveLength(20)
  })

  it('uses the continuous contract ticker (ends with 1!) for every future', () => {
    const noContinuos = futuros.filter((asset) => !asset.tv.endsWith('1!'))
    expect(noContinuos.map((asset) => asset.plain)).toEqual([])
  })

  it('has a non-empty nameEn for every future', () => {
    const missing = futuros.filter((asset) => !asset.nameEn || asset.nameEn.trim() === '')
    expect(missing.map((asset) => asset.plain)).toEqual([])
  })

  it('points underlying, when present, to a spot asset that exists in the catalog', () => {
    const rotos = futuros.filter(
      (asset) => asset.underlying !== undefined && ASSET_BY_PLAIN.get(asset.underlying)?.cls !== 'index',
    )
    expect(rotos.map((asset) => asset.plain)).toEqual([])
  })

  it('maps the key underlyings of the plan (D7)', () => {
    expect(ASSET_BY_PLAIN.get('ES')?.underlying).toBe('SPX')
    expect(ASSET_BY_PLAIN.get('FDAX')?.underlying).toBe('DAX')
    expect(ASSET_BY_PLAIN.get('VX')?.underlying).toBe('VIX')
    expect(ASSET_BY_PLAIN.get('ZN')?.underlying).toBe('US10Y')
    expect(ASSET_BY_PLAIN.get('RTY')?.underlying).toBeUndefined()
  })

  it('has Yahoo candles exactly for the 11 contracts verified live', () => {
    const conYahoo = futuros.filter((asset) => asset.yahoo).map((asset) => asset.plain)
    expect(conYahoo.sort()).toEqual(
      ['ES', 'NQ', 'YM', 'RTY', 'NKD', 'MES', 'MNQ', 'MYM', 'M2K', 'NIY', 'ZN'].sort(),
    )
  })

  it('formats futures as points, not dollars', () => {
    expect(futuros.every((asset) => asset.currency === false)).toBe(true)
  })

  it('maps the future class to tipos_activo id 6', () => {
    expect(ASSET_CLASS_TIPO_ID.future).toBe(6)
  })

  it('includes futures in the interleaved order (ticker)', () => {
    const intercalado = intercalarPorClase(ASSETS)
    expect(intercalado).toHaveLength(84)
    expect(intercalado.filter((asset) => asset.cls === 'future')).toHaveLength(20)
  })
})
