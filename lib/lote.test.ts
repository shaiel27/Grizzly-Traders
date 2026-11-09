import { describe, expect, it } from 'vitest'
import { loteSchema, MAX_LOTE, parecido, palabrasClave, titulosParecidos } from './lote'

const ID = 'be1f67f1-5e1a-4fa4-ad12-ad727059cca2'
const ID2 = '11111111-1111-4111-8111-111111111111'

describe('lote', () => {
  it('acepta acciones válidas, quita ids repetidos y limita el tamaño', () => {
    expect(loteSchema.parse({ accion: 'publicar', ids: [ID, ID, ID2] }).ids).toEqual([ID, ID2])
    expect(loteSchema.safeParse({ accion: 'publicar', ids: [] }).success).toBe(false)
    expect(loteSchema.safeParse({ accion: 'explotar', ids: [ID] }).success).toBe(false)
    expect(loteSchema.safeParse({ accion: 'borrar', ids: ['no-uuid'] }).success).toBe(false)
    const muchos = Array.from({ length: MAX_LOTE + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect(loteSchema.safeParse({ accion: 'borrar', ids: muchos }).success).toBe(false)
  })
})

describe('títulos parecidos', () => {
  it('ignora acentos, mayúsculas y palabras vacías', () => {
    expect(palabrasClave('El Banco de España: ¡Sube las tasas!')).toEqual(['banco', 'espana', 'sube', 'tasas'])
  })
  it('el mismo título es 1; títulos sin relación, 0', () => {
    expect(parecido('Ueno Bank y la quiebra bancaria', 'ueno bank y la QUIEBRA bancaria')).toBe(1)
    expect(parecido('Bitcoin cae a 79k', 'La FED sube las tasas')).toBe(0)
  })
  it('detecta reescrituras cercanas, excluye el propio artículo y ordena por parecido', () => {
    const c = [
      { post_id: 'a', title: 'Bitcoin se retrae a 79k tras la liquidación', slug: 'a' },
      { post_id: 'b', title: 'Bitcoin se retrae a 79k', slug: 'b' },
      { post_id: 'c', title: 'Oro marca nuevo récord', slug: 'c' },
    ]
    expect(titulosParecidos('Bitcoin se retrae a 79k', c).map((x) => x.post_id)).toEqual(['b', 'a'])
    expect(titulosParecidos('Bitcoin se retrae a 79k', c, 'b').map((x) => x.post_id)).toEqual(['a'])
    expect(titulosParecidos('', c)).toEqual([])
  })
})
