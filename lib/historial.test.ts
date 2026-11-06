import { describe, expect, it } from 'vitest'
import { cambioRelevante, evaluarGuardado, resumenVersion, type VersionTexto } from './historial'

const base: VersionTexto = { title: 'Ueno Bank', content_html: '<p>Hola mundo</p>', meta_title: null, meta_description: 'desc' }
const conFecha = (v: VersionTexto, updated_at: string | null) => ({ ...v, updated_at })

describe('cambio relevante', () => {
  it('guardar sin tocar nada no cuenta (ni por espacios sobrantes ni por null frente a vacío)', () => {
    expect(cambioRelevante(base, { ...base })).toBe(false)
    expect(cambioRelevante(base, { ...base, title: '  Ueno Bank  ' })).toBe(false)
    expect(cambioRelevante(base, { ...base, meta_title: '' })).toBe(false)
  })

  it('el título, el texto o las descripciones sí cuentan', () => {
    expect(cambioRelevante(base, { ...base, title: 'Ueno Bank: cambio' })).toBe(true)
    expect(cambioRelevante(base, { ...base, content_html: '<p>Hola mundo.</p>' })).toBe(true)
    expect(cambioRelevante(base, { ...base, meta_title: 'otro' })).toBe(true)
    expect(cambioRelevante(base, { ...base, meta_description: 'otra' })).toBe(true)
  })
})

describe('evaluar el guardado', () => {
  const nuevo = { ...base, content_html: '<p>Texto corregido</p>' }

  it('un idioma que aún no existe se crea sin conflicto ni versión anterior', () => {
    expect(evaluarGuardado(null, '2026-11-06T10:00:00Z', nuevo)).toEqual({ conflicto: false, guardarVersionAnterior: false })
  })

  it('si nadie lo tocó, guarda y conserva la versión anterior', () => {
    const r = evaluarGuardado(conFecha(base, '2026-11-06T10:00:00.123456+00:00'), '2026-11-06T10:00:00.123456+00:00', nuevo)
    expect(r).toEqual({ conflicto: false, guardarVersionAnterior: true })
  })

  it('detecta un cambio ajeno entre que se abrió y se guardó, y NO guarda encima', () => {
    const r = evaluarGuardado(conFecha(base, '2026-11-06T10:05:00Z'), '2026-11-06T10:00:00Z', nuevo)
    expect(r).toEqual({ conflicto: true, guardarVersionAnterior: false })
  })

  it('el mismo instante escrito con otro formato (Z o +00:00) no es conflicto', () => {
    expect(evaluarGuardado(conFecha(base, '2026-11-06T10:00:00+00:00'), '2026-11-06T10:00:00.000Z', nuevo).conflicto).toBe(false)
  })

  it('sin fecha esperada (un cliente viejo) no se bloquea, pero igual se guarda la versión anterior', () => {
    expect(evaluarGuardado(conFecha(base, '2026-11-06T10:05:00Z'), null, nuevo)).toEqual({ conflicto: false, guardarVersionAnterior: true })
    expect(evaluarGuardado(conFecha(base, '2026-11-06T10:05:00Z'), undefined, nuevo).conflicto).toBe(false)
  })

  it('una fecha ilegible no inventa un conflicto', () => {
    expect(evaluarGuardado(conFecha(base, 'no es fecha'), '2026-11-06T10:00:00Z', nuevo).conflicto).toBe(false)
  })

  it('si no cambió nada relevante, no ensucia el historial', () => {
    expect(evaluarGuardado(conFecha(base, '2026-11-06T10:00:00Z'), '2026-11-06T10:00:00Z', { ...base }).guardarVersionAnterior).toBe(false)
  })
})

describe('resumen de una versión', () => {
  it('quita etiquetas, colapsa espacios y recorta con puntos suspensivos', () => {
    expect(resumenVersion('<p>Hola&nbsp;<b>mundo</b></p><p>otra   frase</p>')).toBe('Hola mundo otra frase')
    const largo = resumenVersion('<p>' + 'palabra '.repeat(60) + '</p>', 50)
    expect(largo.length).toBeLessThanOrEqual(50)
    expect(largo.endsWith('…')).toBe(true)
  })
})
