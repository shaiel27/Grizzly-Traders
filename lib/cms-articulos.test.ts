import { describe, expect, it } from 'vitest'
import { esFilaDeError, hayFalta, leerParametrosLista, limpiarBusqueda, rangoDePagina, tipoDeError, totalPaginas, POR_PAGINA } from './cms-articulos'

const p = (extra: Record<string, unknown> = {}) => ({ origen: 'rss', status: 'draft', slug: 'algo', pipeline_error: null, ...extra })

describe('qué es una fila de error del pipeline', () => {
  it('reconoce las reservas sin terminar, los duplicados y los fallos guardados', () => {
    expect(tipoDeError('pendiente-aea73a5be9fa961071dc654fa69c59bd', null)).toBe('pendiente')
    expect(tipoDeError('duplicado-1k2j3h', 'duplicado: otro titular')).toBe('duplicado')
    expect(tipoDeError('algo', 'checklist: el titulo es una copia')).toBe('checklist')
    expect(tipoDeError('algo', 'error: HTTP 500')).toBe('fallo')
    expect(tipoDeError('algo', 'sin prefijo conocido')).toBe('fallo')
  })

  it('un artículo normal no es error', () => {
    expect(tipoDeError('el-oro-sube', null)).toBeNull()
    expect(tipoDeError('el-oro-sube', '   ')).toBeNull()
    expect(tipoDeError(undefined, undefined)).toBeNull()
  })

  it('un duplicado se reconoce por su slug aunque tenga mensaje de error (no se reintenta)', () => {
    expect(tipoDeError('duplicado-x', 'checklist: lo que sea')).toBe('duplicado')
  })

  it('solo son «error» los borradores del pipeline: nunca un artículo publicado ni uno escrito en el CMS', () => {
    expect(esFilaDeError(p({ slug: 'pendiente-abc' }))).toBe(true)
    expect(esFilaDeError(p({ slug: 'duplicado-abc' }))).toBe(true)
    expect(esFilaDeError(p({ pipeline_error: 'error: x' }))).toBe(true)
    expect(esFilaDeError(p({ slug: 'pendiente-abc', status: 'published' }))).toBe(false)
    expect(esFilaDeError(p({ slug: 'pendiente-abc', origen: 'cms' }))).toBe(false)
    expect(esFilaDeError(p())).toBe(false)
  })
})

describe('parámetros de la lista', () => {
  const leer = (qs: string) => leerParametrosLista(new URLSearchParams(qs))

  it('por defecto: «mis artículos», todos los estados, página 1', () => {
    expect(leer('')).toEqual({ ambito: 'mis', estado: 'todos', q: '', categoria: undefined, fuente: undefined, pagina: 1 })
  })

  it('acepta los valores válidos', () => {
    expect(leer('ambito=auto&estado=published&q=oro&categoria=3&fuente=4&pagina=2')).toEqual({ ambito: 'auto', estado: 'published', q: 'oro', categoria: 3, fuente: 4, pagina: 2 })
    expect(leer('ambito=errores').ambito).toBe('errores')
  })

  it('un valor inválido vuelve al predeterminado en vez de romper', () => {
    const r = leer('ambito=todos&estado=borrado&categoria=abc&fuente=-1&pagina=0')
    expect(r).toMatchObject({ ambito: 'mis', estado: 'todos', categoria: undefined, fuente: undefined, pagina: 1 })
    expect(leer('pagina=2.5').pagina).toBe(1)
    expect(leer('pagina=x').pagina).toBe(1)
  })

  it('la búsqueda se limpia: sin comodines de LIKE, espacios colapsados y con tope de largo', () => {
    expect(limpiarBusqueda('  50%   _off\\ ')).toBe('50 off')
    expect(limpiarBusqueda('a'.repeat(300))).toHaveLength(100)
    expect(limpiarBusqueda(undefined)).toBe('')
  })
})

describe('paginación', () => {
  it('calcula el rango y el número de páginas', () => {
    expect(rangoDePagina(1)).toEqual([0, POR_PAGINA - 1])
    expect(rangoDePagina(3)).toEqual([2 * POR_PAGINA, 3 * POR_PAGINA - 1])
    expect(rangoDePagina(0)).toEqual([0, POR_PAGINA - 1])
    expect(totalPaginas(0)).toBe(1)
    expect(totalPaginas(POR_PAGINA)).toBe(1)
    expect(totalPaginas(POR_PAGINA + 1)).toBe(2)
  })
})

describe('faltantes', () => {
  it('hayFalta ignora el aviso de anuncio: solo cuenta portada, categoría y traducción', () => {
    expect(hayFalta({ portada: false, categoria: false, traduccion: false })).toBe(false)
    expect(hayFalta({ portada: true, categoria: false, traduccion: false })).toBe(true)
    expect(hayFalta(undefined)).toBe(false)
  })
})
