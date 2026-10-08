import { describe, expect, it } from 'vitest'
import { ASSETS } from './assets-catalog'

describe('ASSETS', () => {
  it('has the full 64-asset catalog', () => {
    expect(ASSETS).toHaveLength(64)
  })

  // Fase 5 del plan de cobertura en inglés (PLAN-API-ACTIVOS.md): todo activo debe tener un
  // nombre en inglés, aunque sea igual al español, para que los consumidores nunca tengan que
  // mostrar el nombre en español a un visitante en /en.
  it('has a non-empty nameEn for every asset', () => {
    const missing = ASSETS.filter((asset) => !asset.nameEn || asset.nameEn.trim() === '')
    expect(missing.map((asset) => asset.plain)).toEqual([])
  })
})
