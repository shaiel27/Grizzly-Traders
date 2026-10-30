'use client'

import { clsx } from 'clsx'
import { CENTROS_SESION, type EstadoSesion } from '@/lib/globe/sesiones'
import type { ResultadoSentimiento } from '@/lib/globe/sentimiento'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'

// ---------------------------------------------------------------------------
// V8 — de pie de foto a barra de estado de instrumento
//
// Antes: UNA linea de mono a 12px con todo al mismo peso —
//   "● Londres abierta · cierra en 2h 51min   ● Fráncfort abierta · cierra en 2h 21min  [NEUTRAL ▼]"
// Cuatro problemas, todos de estructura y no de estilo:
//
//  (a) Jerarquia plana: el dato mas perecedero y accionable (cuanto falta para el cierre) pesaba
//      lo mismo que la palabra "abierta", que es redundante con el punto verde de al lado.
//  (b) Metadatos unidos por puntos medios ("A · B"), el mismo patron que esta ronda ya corrigio
//      en las etiquetas HUD del globo (ver V5 en GloboHolografico.tsx): aplana la estructura y
//      obliga a leer la frase entera para encontrar el numero.
//  (c) El chip de riesgo iba pegado al final de la fila, como si fuera una tercera sesion. Es
//      otra CLASE de informacion: una lectura global, no un centro financiero con horario.
//  (d) El punto de sesion abierta usaba .splash-mark, un latido infinito decorativo: llamaba la
//      atencion sobre el dato MENOS perecedero (abierto/cerrado, que cambia una vez al dia) en
//      vez de sobre la cuenta atras.
//
// Ahora: una placa con RANURAS. Cada ranura es un par etiqueta/lectura en dos lineas —
//   linea 1 = identidad (punto de estado + nombre de la plaza), 12px sans en --ink-muted
//   linea 2 = lectura    (cuenta atras + a que evento), mono 15px semibold en --ink
// Las ranuras de sesion van separadas entre si por --hairline-soft; el grupo de sesiones y la
// lectura global van separados por --hairline, un escalon MAS marcado: la jerarquia del divisor
// es la que dice "esto de aca es otra cosa", sin necesidad de leer la etiqueta. La ranura de
// riesgo repite la misma rejilla (etiqueta arriba, lectura abajo) pero no lleva punto de estado
// y su etiqueta nombra una lectura, no una plaza — rima visual con diferencia semantica.
//
// Por que una placa solida y no texto suelto: justo encima vive el halo cian del globo y el
// campo de estrellas de FondoHero, asi que el fondo real detras de la leyenda NO es uniforme.
// La placa (--surface-1 sobre el negro del hero) fija el fondo y con el los contrastes medidos.
// El radio de 10px y el hairline son los de las placas HUD que orbitan el globo
// (RADIO_PLACA_CSS = 9 en GloboHolografico.tsx): la leyenda se lee como el miembro a ras de
// suelo de esa misma familia de placas, no como un widget de otro sistema.
//
// Tipografia: mono SOLO en las lecturas numericas (+ tabular-nums, para que los digitos no
// bailen al cambiar el minuto) y sans en las etiquetas. Antes todo era mono, que es el atajo
// facil de "esto es tecnico"; aqui la mono se gana su lugar alineando cifras.
// ---------------------------------------------------------------------------

// Minutos a dos digitos cuando hay horas delante ("2h 06min", no "2h 6min"): con tabular-nums la
// cuenta atras conserva EXACTAMENTE el mismo ancho mientras corre, asi que la micro-etiqueta de al
// lado ("al cierre") no da un salto lateral cada vez que el minuto baja de 10. Es la misma
// convencion de un reloj digital. Por debajo de la hora no hay nada con que alinear, asi que ahi se
// deja el numero crudo. El reparto horas/minutos no cambia.
function formatearMinutos(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto === 0 ? `${h}h` : `${h}h ${String(resto).padStart(2, '0')}min`
}

interface LeyendaGloboProps {
  estados: EstadoSesion[]
  riesgo: ResultadoSentimiento | null
  locale: Locale
}

interface Ranura {
  id: string
  nombre: string
  abierto: boolean
  tiempo: string
  // Micro-etiqueta visible: a QUE evento cuenta el numero ("al cierre" / "a la apertura").
  evento: string
  // Frase completa para lectores de pantalla: el punto de estado es aria-hidden, asi que sin
  // esto el estado abierto/cerrado se perderia al quitar la palabra "abierta" de la vista.
  descripcion: string
}

export function LeyendaGlobo({ estados, riesgo, locale }: LeyendaGloboProps) {
  const dict = getDictionary(locale)
  if (estados.length === 0) return null

  // Hasta 2 sesiones abiertas; si no hay ninguna, la que abre mas pronto — asi la leyenda
  // siempre dice algo util, no solo "todo cerrado". (Comportamiento intacto.)
  const abiertas = estados.filter((e) => e.abierto).slice(0, 2)
  const destacadas =
    abiertas.length > 0
      ? abiertas
      : [...estados]
          .filter((e) => e.minutosProximoCambio != null)
          .sort((a, b) => (a.minutosProximoCambio ?? 0) - (b.minutosProximoCambio ?? 0))
          .slice(0, 1)

  const ranuras: Ranura[] = destacadas.flatMap((e) => {
    const centro = CENTROS_SESION.find((c) => c.id === e.id)
    if (!centro || e.minutosProximoCambio == null) return []
    const tiempo = formatearMinutos(e.minutosProximoCambio)
    const plantilla = e.abierto ? dict.home.globoSesionAbierta : dict.home.globoSesionCerrada
    return [
      {
        id: e.id,
        nombre: dict.home.globoSesiones[centro.nombreClave as keyof typeof dict.home.globoSesiones] ?? centro.id,
        abierto: e.abierto,
        tiempo,
        evento: e.abierto ? dict.home.globoSesionAlCierre : dict.home.globoSesionALaApertura,
        descripcion: plantilla.replace('{tiempo}', tiempo),
      },
    ]
  })
  if (ranuras.length === 0 && !riesgo) return null

  // Riesgo neutral en el cian EMISIVO del globo (--accent-cyan-soft) y no en --accent-cyan: es
  // una lectura de estado sobre el lienzo, no un acento interactivo, y el tono claro sube el
  // contraste (11.20:1 vs 9.28:1 sobre la placa --surface-1).
  const riesgoClase =
    riesgo?.clasificacion === 'RISK-ON'
      ? 'text-semantic-success'
      : riesgo?.clasificacion === 'RISK-OFF'
        ? 'text-semantic-danger'
        : 'text-accent-cyan-soft'
  const riesgoLabel =
    riesgo?.clasificacion === 'RISK-ON' ? dict.home.globoRiskOn : riesgo?.clasificacion === 'RISK-OFF' ? dict.home.globoRiskOff : dict.home.globoRiskNeutral
  const flecha = riesgo && riesgo.score !== 0 ? (riesgo.score > 0 ? '▲' : '▼') : ''

  return (
    <div
      aria-live="polite"
      // Ancla estable para el arnes de captura (Playwright): mide y recorta la leyenda sin
      // depender de clases de Tailwind, que cambian en cada rediseño.
      data-leyenda-globo
      // F0-14: la leyenda monta cuando llegan los estados de sesion (vacio -> lleno), asi que sin
      // puente aparecia de golpe. starting:* (@starting-style) + transition-[opacity,transform]
      // le da la entrada: sube 4px y aparece, una sola vez, como un instrumento que se enciende.
      // Las propiedades van NOMBRADAS, nunca transition-all. Bajo prefers-reduced-motion el
      // catch-all de globals.css fuerza transition-property:opacity/150ms: el translate se
      // resuelve en el primer frame (4px, imperceptible) y queda solo el fundido.
      className={clsx(
        'pointer-events-none inline-flex max-w-full flex-col overflow-hidden rounded-[10px] border border-hairline bg-surface-1',
        'divide-y divide-hairline sm:flex-row sm:divide-x sm:divide-y-0',
        'transition-[opacity,transform] duration-300 ease-[var(--ease-out)] starting:translate-y-1 starting:opacity-0'
      )}
    >
      {ranuras.length > 0 && (
        <div className="flex divide-x divide-hairline-soft">
          {ranuras.map((r) => (
            <div key={r.id} className="px-3 py-2 sm:px-4">
              <span className="sr-only">
                {r.nombre}. {r.descripcion}
              </span>
              <div aria-hidden="true">
                <div className="flex items-center gap-1.5">
                  {/* Sin .splash-mark: el latido infinito gritaba el dato que menos cambia.
                      Relleno = en vivo, aro vacio = parada; ambos >= 3:1 sobre --surface-1
                      (WCAG 1.4.11 para indicadores no textuales). */}
                  <span className={clsx('size-1.5 shrink-0 rounded-full', r.abierto ? 'bg-semantic-success' : 'border border-ink-subtle')} />
                  <span className="whitespace-nowrap text-[12px] font-medium leading-none tracking-[-0.01em] text-ink-muted">{r.nombre}</span>
                </div>
                <p className="mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="font-mono text-[14px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink sm:text-[15px]">{r.tiempo}</span>
                  <span className="text-[11px] leading-none text-ink-subtle">{r.evento}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {riesgo && (
        // Misma rejilla etiqueta/lectura que una ranura de sesion, pero al otro lado del divisor
        // fuerte y sin punto de estado. En movil la placa se apila y esta ranura se convierte en
        // una fila etiqueta-izquierda / lectura-derecha: ahorra el alto de una linea justo donde
        // el hero va mas justo, sin perder ninguno de los dos datos.
        <div className="flex items-baseline justify-between gap-6 px-3 py-2 sm:block sm:px-4 sm:pl-5">
          {/* sm:block: en escritorio el padre es un bloque y un <span> inline heredaria el strut de
              line-height del body, dejando la etiqueta ~7px mas abajo que los nombres de sesion (que
              son items de un flex y por eso si aplican su propio leading-none). Como bloque, las tres
              etiquetas de la placa arrancan en la misma linea. */}
          <span className="text-[12px] font-medium leading-none tracking-[-0.01em] text-ink-muted sm:block">{dict.home.globoRiesgoEtiqueta}</span>
          {/* Cambia de color cuando vira el sentimiento: transition-colors 200ms (propiedad
              nombrada) para que se lea como actualizacion de estado, no como un parpadeo seco. */}
          <span
            className={clsx(
              'whitespace-nowrap font-mono text-[13px] font-semibold leading-none tracking-[-0.01em] transition-colors duration-200 sm:mt-1.5 sm:block',
              riesgoClase
            )}
          >
            {riesgoLabel} <span aria-hidden="true">{flecha}</span>
          </span>
        </div>
      )}
    </div>
  )
}
