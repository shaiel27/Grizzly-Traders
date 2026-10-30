import { describe, expect, it } from 'vitest'
import { permiteAnuncios } from './ads-zonas'

describe('permiteAnuncios', () => {
  it.each(['/articulos/mi-articulo', '/articulos/mi-articulo/', '/autor', '/autor/shai', '/aprende', '/articulos/x?utm=1'])(
    'permite anuncios en %s',
    (ruta) => expect(permiteAnuncios(ruta)).toBe(true)
  )

  it.each(['/', '/markets', '/pivot-points', '/calendario', '/herramientas', '/buscar', '/articulos', '/articulos/', '/legal/privacidad', '/legal/cookies', '/login', '/cms'])(
    'no permite anuncios en %s (datos de mercado)',
    (ruta) => expect(permiteAnuncios(ruta)).toBe(false)
  )

  it('no confunde prefijos parecidos', () => {
    expect(permiteAnuncios('/autores')).toBe(false)
    expect(permiteAnuncios('/aprendemas')).toBe(false)
    expect(permiteAnuncios('/articulosx/y')).toBe(false)
  })
})
