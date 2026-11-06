import { describe, expect, it } from 'vitest'
import { detectarHuerfanos, estadoUso, fechaDeCorte, nombreEnBucket, nombresEnTexto, planificarBorrado } from './portadas'

const URL = 'https://pudzvatuubywmwdmboiq.supabase.co/storage/v1/object/public/post-images/'

describe('nombre en el bucket', () => {
  it('extrae el nombre de una URL pública nuestra, sin parámetros', () => {
    expect(nombreEnBucket(`${URL}ueno-bank-a1b2c3d4.webp`)).toBe('ueno-bank-a1b2c3d4.webp')
    expect(nombreEnBucket(`${URL}ueno%20bank.webp?v=2#x`)).toBe('ueno bank.webp')
  })
  it('lo que no es nuestro o está en una carpeta (subidas del CMS) no cuenta: nunca se borra', () => {
    expect(nombreEnBucket('https://otro.com/foto.webp')).toBeNull()
    expect(nombreEnBucket(`${URL}cms/2026/foto.webp`)).toBeNull()
    expect(nombreEnBucket(null)).toBeNull()
    expect(nombreEnBucket('')).toBeNull()
    expect(nombreEnBucket(`${URL}%E0%A4%A.webp`)).toBeNull()
  })
})

describe('archivos usados dentro de un texto', () => {
  it('encuentra las imágenes del bucket en el HTML', () => {
    const html = `<p>x</p><img src="${URL}a.webp" alt=""><img src='${URL}b%20c.webp?w=3'>`
    expect(nombresEnTexto(html).sort()).toEqual(['a.webp', 'b c.webp'])
    expect(nombresEnTexto('<p>sin imágenes</p>')).toEqual([])
    expect(nombresEnTexto(null)).toEqual([])
  })
})

describe('planificar el borrado', () => {
  const c = (id: string, cover: string | null, og: string | null = cover) => ({ id, cover_image_url: cover, og_image_url: og })
  it('borra portada y og (aunque sean el mismo archivo, una sola vez) y deja la fila sin portada', () => {
    const r = planificarBorrado([c('1', `${URL}a.webp`), c('2', `${URL}b.webp`, `${URL}b-og.webp`)], new Set())
    expect(r.ids).toEqual(['1', '2'])
    expect(r.nombres.sort()).toEqual(['a.webp', 'b-og.webp', 'b.webp'])
  })
  it('si algo más usa el archivo (otro artículo o un texto), no se toca esa fila', () => {
    const r = planificarBorrado([c('1', `${URL}a.webp`), c('2', `${URL}b.webp`)], new Set(['a.webp']))
    expect(r).toEqual({ ids: ['2'], nombres: ['b.webp'], omitidos: 1 })
  })
  it('filas con imágenes ajenas o en carpetas se omiten', () => {
    const r = planificarBorrado([c('1', 'https://otro.com/x.webp'), c('2', `${URL}cms/x.webp`), c('3', null)], new Set())
    expect(r).toEqual({ ids: [], nombres: [], omitidos: 3 })
  })
})

describe('huérfanos', () => {
  const ahora = Date.parse('2026-11-06T12:00:00Z')
  const f = (name: string, createdAt: string | null) => ({ name, size: 1000, createdAt })
  it('solo los que nadie usa y llevan más de 24 h; los recién subidos esperan', () => {
    const r = detectarHuerfanos(
      [f('usado.webp', '2026-11-01T00:00:00Z'), f('huerfano.webp', '2026-11-01T00:00:00Z'), f('nuevo.webp', '2026-11-06T11:00:00Z'), f('sin-fecha.webp', null), f('carpeta/x.webp', '2026-11-01T00:00:00Z')],
      new Set(['usado.webp']),
      ahora
    )
    expect(r.map((a) => a.name)).toEqual(['huerfano.webp'])
  })
})

describe('uso y corte', () => {
  it('avisa a partir del 80 %', () => {
    expect(estadoUso(443_000_000)).toMatchObject({ mb: 443, porcentaje: 44.3, alerta: false })
    expect(estadoUso(800_000_000).alerta).toBe(true)
    expect(estadoUso(790_000_000).alerta).toBe(false)
  })
  it('la fecha de corte son 18 días atrás', () => {
    expect(fechaDeCorte(Date.parse('2026-11-20T00:00:00Z'))).toBe('2026-11-02T00:00:00.000Z')
  })
})
