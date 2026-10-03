// Estado abierto/cerrado de las sesiones de mercado, por zona horaria real (Intl.DateTimeFormat
// aplica el horario de verano solo, sin tablas de cambio de hora a mano) — plan 009 §2.1.

export interface CentroSesion {
  id: string
  nombreClave: string // clave de lib/i18n/dictionaries -> home.globoSesiones
  lat: number
  lon: number
  timeZone: string
  horaApertura: number // hora local, 0-23 (+ fraccion si hace falta, ej 8.5 = 08:30)
  horaCierre: number
}

export const CENTROS_SESION: CentroSesion[] = [
  { id: 'sidney', nombreClave: 'sidney', lat: -33.87, lon: 151.21, timeZone: 'Australia/Sydney', horaApertura: 8, horaCierre: 17 },
  { id: 'tokio', nombreClave: 'tokio', lat: 35.68, lon: 139.69, timeZone: 'Asia/Tokyo', horaApertura: 9, horaCierre: 18 },
  { id: 'hongkong', nombreClave: 'hongkong', lat: 22.32, lon: 114.17, timeZone: 'Asia/Hong_Kong', horaApertura: 9, horaCierre: 17 },
  { id: 'londres', nombreClave: 'londres', lat: 51.51, lon: -0.13, timeZone: 'Europe/London', horaApertura: 8, horaCierre: 17 },
  { id: 'frankfurt', nombreClave: 'frankfurt', lat: 50.11, lon: 8.68, timeZone: 'Europe/Berlin', horaApertura: 8, horaCierre: 17.5 },
  { id: 'nuevayork', nombreClave: 'nuevayork', lat: 40.71, lon: -74.0, timeZone: 'America/New_York', horaApertura: 8, horaCierre: 17 },
]

export interface EstadoSesion {
  id: string
  abierto: boolean
  // Minutos hasta el proximo cambio de estado (si abierto, hasta que cierra; si cerrado, hasta
  // que abre). Null si no se pudo calcular (timeZone invalida, etc.)
  minutosProximoCambio: number | null
}

// Hora local decimal (0-23.999) en `timeZone`, para el instante `ahora`. Intl.DateTimeFormat
// con 'en-US' + hourCycle 'h23' da un formato predecible de parsear sin ambiguedad de AM/PM.
function horaLocalDecimal(ahora: Date, timeZone: string): { hora: number; diaSemana: number } {
  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const partes = formateador.formatToParts(ahora)
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  const hora = Number(obtener('hour'))
  const minuto = Number(obtener('minute'))
  const diasSemana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const diaSemana = diasSemana.indexOf(obtener('weekday'))
  return { hora: hora + minuto / 60, diaSemana }
}

// El FX global cierra desde el viernes 17:00 de Nueva York hasta el domingo 17:00 de Nueva York
// — asi lo tratan casi todos los brokers, independiente de que algun centro puntual "abriria"
// en ese rango segun su propio huso horario.
function esFinDeSemanaForex(ahora: Date): boolean {
  const { hora, diaSemana } = horaLocalDecimal(ahora, 'America/New_York')
  if (diaSemana === 6) return true // sabado entero
  if (diaSemana === 5 && hora >= 17) return true // viernes desde las 17:00
  if (diaSemana === 0 && hora < 17) return true // domingo antes de las 17:00
  return false
}

function estaAbierto(centro: CentroSesion, ahora: Date): boolean {
  const { hora, diaSemana } = horaLocalDecimal(ahora, centro.timeZone)
  if (diaSemana === 0 || diaSemana === 6) return false
  return hora >= centro.horaApertura && hora < centro.horaCierre
}

// Minutos hasta que `objetivo` (hora local decimal, puede ser del dia siguiente) se alcance,
// recorriendo hacia adelante desde `hora` dentro del mismo huso horario.
function minutosHasta(hora: number, objetivo: number): number {
  const diff = objetivo - hora
  return Math.round((diff >= 0 ? diff : diff + 24) * 60)
}

export function estadoSesiones(ahora: Date): EstadoSesion[] {
  const finDeSemana = esFinDeSemanaForex(ahora)
  return CENTROS_SESION.map((centro) => {
    if (finDeSemana) {
      return { id: centro.id, abierto: false, minutosProximoCambio: null }
    }
    const { hora } = horaLocalDecimal(ahora, centro.timeZone)
    const abierto = estaAbierto(centro, ahora)
    const minutosProximoCambio = minutosHasta(hora, abierto ? centro.horaCierre : centro.horaApertura)
    return { id: centro.id, abierto, minutosProximoCambio }
  })
}
