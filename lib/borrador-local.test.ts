import { describe, expect, it } from 'vitest'
import { antiguedad, claveBorrador, esRestaurable, estaCaducado, huella, leerBorrador, serializarBorrador } from './borrador-local'

const AHORA = Date.parse('2026-11-06T12:00:00Z')

describe('clave del borrador', () => {
  it('una por artículo, y una para el artículo nuevo', () => {
    expect(claveBorrador('be1f67f1-5e1a')).toBe('gt_cms_borrador:be1f67f1-5e1a')
    expect(claveBorrador(null)).toBe('gt_cms_borrador:nuevo')
  })
})

describe('guardar y leer', () => {
  it('lo que se guarda se lee igual, con la hora', () => {
    const datos = { titulo: 'Ueno', cuerpo: '<p>x</p>' }
    const b = leerBorrador<typeof datos>(serializarBorrador(datos, AHORA))!
    expect(b.datos).toEqual(datos)
    expect(b.guardadoEn).toBe('2026-11-06T12:00:00.000Z')
  })

  it('cualquier cosa que no sea un borrador válido se ignora en vez de romper el editor', () => {
    for (const malo of [null, undefined, '', 'no es json', '{}', '[]', 'null', '{"v":2,"guardadoEn":"2026-11-06T12:00:00Z","datos":{}}', '{"v":1,"guardadoEn":"ayer","datos":{}}', '{"v":1,"guardadoEn":"2026-11-06T12:00:00Z"}', '{"v":1,"guardadoEn":"2026-11-06T12:00:00Z","datos":"texto"}']) {
      expect(leerBorrador(malo as never)).toBeNull()
    }
  })
})

describe('¿ofrecer restaurar?', () => {
  const actual = { titulo: 'Ueno', cuerpo: '<p>x</p>' }
  it('no, si es idéntico a lo que hay abierto', () => {
    expect(esRestaurable(leerBorrador(serializarBorrador({ ...actual }, AHORA)), actual)).toBe(false)
  })
  it('sí, si difiere', () => {
    expect(esRestaurable(leerBorrador(serializarBorrador({ ...actual, cuerpo: '<p>más texto</p>' }, AHORA)), actual)).toBe(true)
  })
  it('no, si no hay borrador', () => {
    expect(esRestaurable(null, actual)).toBe(false)
  })
  it('la huella distingue cualquier cambio', () => {
    expect(huella({ a: 1 })).not.toBe(huella({ a: 2 }))
    expect(huella({ a: 1 })).toBe(huella({ a: 1 }))
  })
})

describe('antigüedad', () => {
  it('ahora, minutos, horas y días', () => {
    expect(antiguedad('2026-11-06T11:59:40Z', AHORA)).toEqual({ unidad: 'ahora' })
    expect(antiguedad('2026-11-06T11:45:00Z', AHORA)).toEqual({ unidad: 'min', n: 15 })
    expect(antiguedad('2026-11-06T09:00:00Z', AHORA)).toEqual({ unidad: 'h', n: 3 })
    expect(antiguedad('2026-11-03T12:00:00Z', AHORA)).toEqual({ unidad: 'd', n: 3 })
    expect(antiguedad('2026-11-06T12:30:00Z', AHORA)).toEqual({ unidad: 'ahora' })
  })
  it('caduca a los 14 días', () => {
    expect(estaCaducado('2026-10-30T12:00:00Z', AHORA)).toBe(false)
    expect(estaCaducado('2026-10-20T12:00:00Z', AHORA)).toBe(true)
  })
})
