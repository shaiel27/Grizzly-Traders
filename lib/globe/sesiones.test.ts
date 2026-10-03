import { describe, expect, it } from 'vitest'
import { estadoSesiones } from './sesiones'

function abierto(estados: ReturnType<typeof estadoSesiones>, id: string): boolean {
  const e = estados.find((s) => s.id === id)
  if (!e) throw new Error(`sesion ${id} no encontrada`)
  return e.abierto
}

describe('estadoSesiones', () => {
  it('Londres y Nueva York se solapan un miercoles a la tarde (UTC)', () => {
    // 2026-01-14T15:00Z: Londres 15:00 local (invierno, sin DST), Nueva York 10:00 local — ambos
    // dentro de su horario 08-17.
    const estados = estadoSesiones(new Date('2026-01-14T15:00:00Z'))
    expect(abierto(estados, 'londres')).toBe(true)
    expect(abierto(estados, 'nuevayork')).toBe(true)
  })

  it('un sabado, todo esta cerrado', () => {
    const estados = estadoSesiones(new Date('2026-01-17T12:00:00Z'))
    for (const e of estados) expect(e.abierto).toBe(false)
  })

  it('el domingo (UTC), Sidney ya abrio — su lunes local llego antes', () => {
    // 2026-01-18T22:00Z es domingo en UTC, pero ya es lunes 09:00 en Sidney (UTC+11 en enero).
    const estados = estadoSesiones(new Date('2026-01-18T22:00:00Z'))
    expect(abierto(estados, 'sidney')).toBe(true)
  })

  it('aplica el cambio de horario de verano europeo (marzo) sin tabla manual', () => {
    // A las 07:00 UTC, Londres marca 07:00 local antes del cambio (28/mar/2026) y 08:00
    // despues — el mismo codigo, sin ninguna tabla de fechas, via Intl.DateTimeFormat.
    const antes = estadoSesiones(new Date('2026-03-25T07:00:00Z')) // miercoles, Londres 07:00 -> cerrado
    const despues = estadoSesiones(new Date('2026-04-01T07:00:00Z')) // miercoles, Londres 08:00 (DST) -> abierto
    expect(abierto(antes, 'londres')).toBe(false)
    expect(abierto(despues, 'londres')).toBe(true)
  })

  it('aplica el fin del horario de verano de EEUU (octubre/noviembre) sin tabla manual', () => {
    const antes = estadoSesiones(new Date('2026-10-28T12:00:00Z')) // miercoles, NY 08:00 (DST) -> abierto
    const despues = estadoSesiones(new Date('2026-11-04T12:00:00Z')) // miercoles, NY 07:00 -> cerrado
    expect(abierto(antes, 'nuevayork')).toBe(true)
    expect(abierto(despues, 'nuevayork')).toBe(false)
  })
})
