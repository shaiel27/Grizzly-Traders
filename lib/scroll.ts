// Desplazamiento suave a una ancla, con destino recalculado en cada frame (el hero sigue
// animando mientras se hace scroll: el globo se encoge, las tarjetas entran) y que respeta
// `prefers-reduced-motion` con su propia duración corta en vez de depender de la propiedad CSS
// `scroll-behavior`, que Windows con "reducir movimiento" ya activa sin que el usuario lo note
// (ver plan 009, B1).

const DURACION_MIN_MS = 450
const DURACION_MAX_MS = 900
const DURACION_REDUCIDA_MS = 250
const PX_POR_MS = 0.6

function prefiereMovimientoReducido(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// --header-scroll-offset es un calc(var(--header-h-real) + 24px) que getComputedStyle devuelve SIN
// resolver ("calc(...)"): parseFloat daba NaN y el destino nunca descontaba el header, así que el
// ancla quedaba tapada por él. Se reconstruye con las dos variables numéricas (px) que sí resuelven.
const MARGEN_BAJO_HEADER_PX = 24

function alturaHeaderReal(): number {
  if (typeof window === 'undefined') return 0
  const estilos = getComputedStyle(document.documentElement)
  const medida = parseFloat(estilos.getPropertyValue('--header-h-real'))
  const base = Number.isFinite(medida) ? medida : parseFloat(estilos.getPropertyValue('--header-height'))
  return (Number.isFinite(base) ? base : 0) + MARGEN_BAJO_HEADER_PX
}

function calcularDestino(elemento: HTMLElement): number {
  return elemento.getBoundingClientRect().top + window.scrollY - alturaHeaderReal()
}

// Misma forma que --ease-in-out (cubic-bezier(0.77,0,0.175,1)) pero evaluada en JS: no hay forma
// nativa de leer un cubic-bezier del CSS y aplicarlo a un scroll manual.
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

// Al terminar la intro del hero, Hero/useIntroInicio.ts descuenta la "pista" con un scrollTo propio
// y mueve la posición final DESPUÉS de que termina esta animación: el destino quedaba ~150 px más
// arriba de lo previsto (bajo el header) y "Ver más" no aterrizaba donde empieza el contenido. Un
// segundo cálculo repetido hasta que la página se asienta corrige lo que falte. Si el usuario toca la rueda,
// la pantalla o el teclado en ese lapso, no se corrige nada.
const PASO_ASENTAMIENTO_MS = 100
const PASOS_MAX = 14
const PASOS_ESTABLES = 3
const TOLERANCIA_PX = 3

function corregirAlAsentarse(elemento: HTMLElement): void {
  let interrumpido = false
  const parar = () => {
    interrumpido = true
  }
  const eventos = ['wheel', 'touchstart', 'keydown'] as const
  eventos.forEach((evento) => window.addEventListener(evento, parar, { once: true, passive: true }))

  let pasos = 0
  let estables = 0
  const id = window.setInterval(() => {
    pasos += 1
    const diferencia = calcularDestino(elemento) - window.scrollY
    if (!interrumpido && Math.abs(diferencia) > TOLERANCIA_PX) {
      window.scrollTo(0, window.scrollY + diferencia)
      estables = 0
    } else {
      estables += 1
    }
    // La página "se asienta" cuando el destino deja de moverse unos pasos seguidos
    if (interrumpido || estables >= PASOS_ESTABLES || pasos >= PASOS_MAX) {
      window.clearInterval(id)
      eventos.forEach((evento) => window.removeEventListener(evento, parar))
    }
  }, PASO_ASENTAMIENTO_MS)
}

export interface OpcionesScrollSuave {
  onTerminar?: () => void
}

/**
 * Hace scroll hasta `elemento`, cancelable por el usuario (rueda, toque o teclado) y sin pelear
 * con una interacción real. Devuelve una función para cancelarlo a mano si hace falta.
 */
export function scrollSuaveA(elemento: HTMLElement, opciones: OpcionesScrollSuave = {}): () => void {
  const reducido = prefiereMovimientoReducido()
  const inicio = window.scrollY
  const distancia = Math.abs(calcularDestino(elemento) - inicio)
  const duracion = reducido ? DURACION_REDUCIDA_MS : Math.min(DURACION_MAX_MS, Math.max(DURACION_MIN_MS, distancia * PX_POR_MS))
  const t0 = performance.now()
  let cancelado = false
  let idFrame = 0

  const eventosCancelacion = ['wheel', 'touchstart', 'keydown'] as const

  function limpiar() {
    cancelAnimationFrame(idFrame)
    eventosCancelacion.forEach((evento) => window.removeEventListener(evento, cancelar))
  }

  function cancelar() {
    if (cancelado) return
    cancelado = true
    limpiar()
  }

  function paso(ahora: number) {
    if (cancelado) return
    const t = Math.min(1, (ahora - t0) / duracion)
    const progreso = easeInOut(t)
    // El destino se recalcula cada frame (no una sola vez al inicio): el globo se encoge y las
    // tarjetas entran mientras se hace scroll, así que la posición final real se mueve.
    const destinoActual = calcularDestino(elemento)
    window.scrollTo(0, inicio + (destinoActual - inicio) * progreso)

    if (t >= 1) {
      limpiar()
      corregirAlAsentarse(elemento)
      opciones.onTerminar?.()
      return
    }
    idFrame = requestAnimationFrame(paso)
  }

  eventosCancelacion.forEach((evento) => window.addEventListener(evento, cancelar, { once: true, passive: true }))
  idFrame = requestAnimationFrame(paso)

  return cancelar
}
