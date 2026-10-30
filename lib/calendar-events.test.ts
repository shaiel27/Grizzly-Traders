import { describe, expect, it } from 'vitest'
import { isWeekend, isWeekendNoise, localDayKey, nextRelease, visibleEvents, type CalendarLike } from './calendar-events'

const CCS = 'America/Caracas' // UTC-4 todo el año

function ev(over: Partial<CalendarLike> & { id: string }): CalendarLike & { id: string } {
  return { event_date: '2026-10-22', event_timestamp: null, impact: 'low', is_all_day: false, ...over }
}

describe('localDayKey', () => {
  it('agrupa por el día LOCAL del instante, no por la fecha en ET de la fila', () => {
    // 2026-10-23 01:00 UTC = jueves 22 a las 21:00 en Caracas, aunque la fila diga viernes
    const e = ev({ id: 'a', event_date: '2026-10-23', event_timestamp: '2026-10-23T01:00:00+00:00' })
    expect(localDayKey(e, CCS)).toBe('2026-10-22')
  })

  it('sin timestamp (todo el día) usa la fecha de la fila', () => {
    expect(localDayKey(ev({ id: 'b', event_date: '2026-10-22', is_all_day: true }), CCS)).toBe('2026-10-22')
  })
})

describe('visibleEvents', () => {
  const ahora = new Date('2026-10-22T18:00:00Z') // jueves 14:00 en Caracas
  const ayer = ev({ id: 'ayer', event_date: '2026-10-21', event_timestamp: '2026-10-21T14:30:00+00:00', impact: 'high' })
  const hoyPasado = ev({ id: 'hoy-pasado', event_timestamp: '2026-10-22T12:30:00+00:00', impact: 'medium' })
  const hoyFuturo = ev({ id: 'hoy-futuro', event_timestamp: '2026-10-22T22:00:00+00:00' })

  it('oculta los días anteriores a hoy y conserva los eventos ya pasados de hoy', () => {
    const ids = visibleEvents([ayer, hoyPasado, hoyFuturo], ahora, CCS).map((e) => e.id)
    expect(ids).toEqual(['hoy-pasado', 'hoy-futuro'])
  })

  it('en fin de semana oculta lo informativo (cambio de horario) pero no un evento de impacto', () => {
    const dst = ev({ id: 'dst', event_date: '2026-10-24', event_timestamp: '2026-10-25T01:00:00+00:00', impact: 'holiday' })
    const dstLow = ev({ id: 'dst-low', event_date: '2026-10-24', event_timestamp: '2026-10-25T01:00:00+00:00', impact: 'low' })
    const sabadoAlto = ev({ id: 'raro', event_date: '2026-10-24', event_timestamp: '2026-10-24T15:00:00+00:00', impact: 'high' })
    const lunes = ev({ id: 'lunes', event_date: '2026-10-26', event_timestamp: '2026-10-26T12:30:00+00:00' })
    const ids = visibleEvents([dst, dstLow, sabadoAlto, lunes], ahora, CCS).map((e) => e.id)
    expect(ids).toEqual(['raro', 'lunes'])
  })

  it('un feriado entre semana se conserva', () => {
    const feriado = ev({ id: 'fer', event_date: '2026-10-23', event_timestamp: null, impact: 'holiday', is_all_day: true })
    expect(visibleEvents([feriado], ahora, CCS).map((e) => e.id)).toEqual(['fer'])
  })
})

describe('isWeekendNoise', () => {
  it('es ruido un evento bajo o feriado en sábado o domingo local', () => {
    expect(isWeekendNoise(ev({ id: 'x', event_timestamp: '2026-10-25T01:00:00+00:00', impact: 'holiday' }), CCS)).toBe(true)
    expect(isWeekendNoise(ev({ id: 'x', event_timestamp: '2026-10-26T12:30:00+00:00', impact: 'low' }), CCS)).toBe(false)
  })
})

describe('nextRelease', () => {
  const ahora = new Date('2026-10-24T15:00:00Z') // sábado
  it('salta feriados y ruido de fin de semana y devuelve el primer evento real futuro', () => {
    const dst = ev({ id: 'dst', event_timestamp: '2026-10-25T01:00:00+00:00', impact: 'holiday' })
    const feriado = ev({ id: 'fer', event_timestamp: '2026-10-26T03:00:00+00:00', impact: 'holiday' })
    const lunes = ev({ id: 'lunes', event_timestamp: '2026-10-26T12:30:00+00:00' })
    expect(nextRelease([dst, feriado, lunes], ahora, CCS)?.id).toBe('lunes')
  })

  it('devuelve null si no queda ninguno', () => {
    expect(nextRelease([], ahora, CCS)).toBeNull()
  })
})

describe('isWeekend', () => {
  it('usa el día local: viernes 23:00 en Caracas sigue siendo día hábil aunque en UTC ya sea sábado', () => {
    expect(isWeekend(new Date('2026-10-24T03:00:00Z'), CCS)).toBe(false)
    expect(isWeekend(new Date('2026-10-24T15:00:00Z'), CCS)).toBe(true)
  })
})
