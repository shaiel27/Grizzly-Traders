// Reglas de qué eventos del calendario económico se muestran y cuál es "el próximo".
//
// Dos problemas del calendario original (reportados 2026-10-22):
//  - mostraba los eventos de AYER: la API devuelve desde hace 24 h y la lista nunca filtraba los
//    días ya pasados;
//  - los sábados aparecía "Daylight Saving Time Shift": ForexFactory lo publica como un aviso
//    informativo (impacto 'Holiday') de las 21:00 ET del sábado, no como una publicación de mercado.
// Además se agrupaba por la fecha en ET de la fila (event_date), no por el día local del visitante.

export interface CalendarLike {
  event_date: string
  event_timestamp: string | null
  impact: string
  is_all_day: boolean
}

// yyyy-MM-dd del instante en la zona dada (por defecto, la del navegador)
function dayKeyOf(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

// Día local del evento: el del instante si lo tiene; si es de todo el día, la fecha de la fila
export function localDayKey(event: CalendarLike, timeZone?: string): string {
  if (event.event_timestamp) {
    const date = new Date(event.event_timestamp)
    if (!Number.isNaN(date.getTime())) return dayKeyOf(date, timeZone)
  }
  return event.event_date
}

function isWeekendKey(key: string): boolean {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

// ¿Es hoy sábado o domingo (en la zona dada)?
export function isWeekend(now: Date, timeZone?: string): boolean {
  return isWeekendKey(dayKeyOf(now, timeZone))
}

// Fin de semana: el mercado está cerrado, así que solo se conservan los eventos de impacto
export function isWeekendNoise(event: CalendarLike, timeZone?: string): boolean {
  return isWeekendKey(localDayKey(event, timeZone)) && event.impact !== 'high' && event.impact !== 'medium'
}

// Eventos a mostrar: desde hoy (los ya pasados de hoy se conservan), sin ruido de fin de semana
export function visibleEvents<T extends CalendarLike>(events: T[], now: Date, timeZone?: string): T[] {
  const today = dayKeyOf(now, timeZone)
  return events.filter((event) => localDayKey(event, timeZone) >= today && !isWeekendNoise(event, timeZone))
}

// Próxima publicación real: futura, ni feriado ni ruido de fin de semana
export function nextRelease<T extends CalendarLike>(events: T[], now: Date, timeZone?: string): T | null {
  return (
    events.find(
      (event) =>
        event.event_timestamp !== null &&
        new Date(event.event_timestamp).getTime() > now.getTime() &&
        event.impact !== 'holiday' &&
        !isWeekendNoise(event, timeZone)
    ) ?? null
  )
}
