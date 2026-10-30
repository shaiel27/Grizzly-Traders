'use client'

import { useEffect, type RefObject } from 'react'

export interface RefsIntro {
  pista: RefObject<HTMLDivElement | null>
  caja: RefObject<HTMLDivElement | null>
  destino: RefObject<HTMLDivElement | null>
  texto: RefObject<HTMLDivElement | null>
  titulo: RefObject<HTMLHeadingElement | null>
}

const CLAVE_VISTO = 'gt-intro-visto'

// La limpieza al desmontar se difiere un tick: en desarrollo StrictMode desmonta y vuelve a montar los efectos
// al instante, y limpiar en ese desmontaje simulado borraria data-intro antes de que el segundo montaje lo lea.
let limpiezaPendiente: ReturnType<typeof setTimeout> | null = null

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function tramo(p: number, inicio: number, fin: number): number {
  const t = clamp01((p - inicio) / (fin - inicio))
  return t * t * (3 - 2 * t)
}

// Fuera del hook a proposito: el compilador de React no deja mutar desde el hook lo que llega por argumentos
// (los refs), y aqui escribir el estilo directamente es justo lo que se quiere (sin re-renders por frame).
function ponerTransform(el: HTMLElement | null, valor: string) {
  if (el) el.style.transform = valor
}

// easeOutQuint: la curva de --ease-out de globals.css (cubic-bezier(0.23,1,0.32,1)).
// Antes esto era easeInOutCubic y era la causa de que la intro se sintiera brusca: una curva de
// la familia ease-in dedica su primer tercio a casi no moverse y despues pega un tiron por el
// medio. En una animacion raspada por scroll el usuario mira desde el primer pixel, asi que la
// fase lenta inicial no "prepara" nada — solo hace que el globo parezca trabado y luego salte.
// Con ease-out el globo responde al instante y asienta, que es como debe sentirse algo que
// llega a su sitio.
// Medido sobre capturas reales, no elegido a ojo. El easeInOutCubic original tenia una fase
// ease-in que dejaba el globo casi quieto el primer tercio y luego pegaba un tiron: brusco. Al
// cambiarlo por easeOutQuint (la curva de --ease-out) se fue al extremo contrario — el 92% del
// encogimiento ocurria en el primer 40% del scroll y el 60% restante del recorrido era zona
// muerta: igual de brusco, por el otro lado. La cuadratica reparte el movimiento a lo largo de
// TODO el recorrido (t=0.2 -> 36%, 0.4 -> 64%, 0.6 -> 84%, 0.8 -> 96%) y sigue asentando al
// final. En un scrub de scroll el usuario controla la linea de tiempo, asi que lo que se busca
// no es una curva expresiva sino una que no mienta sobre cuanto queda por recorrer.
function suaveSalida(t: number): number {
  return 1 - Math.pow(1 - t, 2)
}

interface Medidas {
  recorrido: number
  globoDx: number
  globoDy: number
  globoEscala: number
  textoDx: number
  textoDy: number
}

/**
 * Intro de primera carga de la home: el globo ocupa la pantalla con solo el titulo y, al hacer scroll,
 * se encoge hasta su sitio mientras entran el header (ticker y luego la navegacion) y el resto del texto.
 *
 * Solo actua si el script de app/layout.tsx puso html[data-intro="activo"] antes del primer pintado. El
 * progreso del scroll se suaviza (lerp por frame) para que una rueda de raton a saltos de 100 px se vea
 * continua. Al llegar al final, quita data-intro y descuenta la pista del scroll en el mismo frame: la
 * pagina queda exactamente igual que sin intro y no se vuelve a reproducir en la sesion.
 */
export function useIntroInicio(refs: RefsIntro) {
  useEffect(() => {
    const html = document.documentElement
    if (limpiezaPendiente) {
      clearTimeout(limpiezaPendiente)
      limpiezaPendiente = null
    }
    if (html.dataset.intro !== 'activo') return
    html.setAttribute('data-intro-control', '')

    let medidas: Medidas | null = null
    let objetivo = 0
    let actual = 0
    let raf = 0
    let ultimoFrame = 0
    let terminado = false

    const medir = () => {
      const pista = refs.pista.current
      const caja = refs.caja.current
      const destino = refs.destino.current
      const texto = refs.texto.current
      const titulo = refs.titulo.current
      if (!pista || !caja || !destino || !texto || !titulo) return

      ponerTransform(caja, '')
      ponerTransform(texto, '')
      const espaciador = pista.querySelector<HTMLElement>('[data-intro-espaciador]')
      const recorrido = espaciador?.offsetHeight || window.innerHeight * 0.9
      // Todo relativo a la escena (sticky en top:0), asi da igual en que punto del scroll se mida
      const escenaTop = (pista.firstElementChild ?? pista).getBoundingClientRect().top
      const rc = caja.getBoundingClientRect()
      const rd = destino.getBoundingClientRect()
      const rt = titulo.getBoundingClientRect()

      medidas = {
        recorrido,
        globoDx: rd.left + rd.width / 2 - (rc.left + rc.width / 2),
        globoDy: rd.top + rd.height / 2 - (rc.top + rc.height / 2),
        globoEscala: rc.width > 0 ? rd.width / rc.width : 1,
        // En la intro el titulo va centrado y apoyado en la parte baja de la pantalla, sobre el globo, dejando
        // sitio debajo para la pista "desliza para explorar". 150px (antes 110): con el titulo en
        // 4 lineas (movil angosto, title wrapea) el hueco quedaba tan justo que "desliza para
        // explorar" tocaba la ultima linea — verificado visualmente con capturas en varios anchos.
        textoDx: window.innerWidth / 2 - (rt.left + rt.width / 2),
        textoDy: escenaTop + window.innerHeight - 150 - rt.bottom,
      }
    }

    const aplicar = (p: number) => {
      const m = medidas
      const caja = refs.caja.current
      const texto = refs.texto.current
      if (!m || !caja || !texto) return

      // El /0.85 que habia aqui creaba una zona muerta: q llegaba a 1 en p=0.85 y el ultimo 15%
      // del recorrido no movia nada, con el globo ya aparcado mientras el usuario seguia
      // haciendo scroll. Despues completar() cambiaba transform por layout de golpe, y esa
      // secuencia (tiron, aparcar, salto) era lo que se leia como "cambia de tamaño al terminar
      // el zoom". Con easeOutQuint sobre el recorrido completo el globo se acerca a su destino
      // de forma asintotica —en p=0.8 ya esta al 99.97%— asi que el tramo final es imperceptible
      // en vez de ser un tope duro, y en el umbral de completar() (0.994) el residuo es ~1e-11.
      const q = suaveSalida(clamp01(p))
      const escala = 1 + (m.globoEscala - 1) * q
      ponerTransform(caja, `translate3d(${m.globoDx * q}px, ${m.globoDy * q}px, 0) scale(${escala})`)
      ponerTransform(texto, `translate3d(${m.textoDx * (1 - q)}px, ${m.textoDy * (1 - q)}px, 0)`)

      const header = tramo(p, 0.45, 0.85)
      html.style.setProperty('--intro-header', header.toFixed(4))
      html.style.setProperty('--intro-ticker', tramo(p, 0.5, 0.8).toFixed(4))
      html.style.setProperty('--intro-nav', tramo(p, 0.6, 0.95).toFixed(4))
      html.style.setProperty('--intro-resto', tramo(p, 0.72, 1).toFixed(4))
      html.style.setProperty('--intro-cue', (1 - tramo(p, 0, 0.15)).toFixed(4))
      if (header < 0.02) html.setAttribute('data-intro-header', 'oculto')
      else html.removeAttribute('data-intro-header')
    }

    const limpiar = () => {
      html.removeAttribute('data-intro')
      html.removeAttribute('data-intro-header')
      html.removeAttribute('data-intro-control')
      for (const nombre of ['--intro-header', '--intro-ticker', '--intro-nav', '--intro-resto', '--intro-cue']) {
        html.style.removeProperty(nombre)
      }
      ponerTransform(refs.caja.current, '')
      ponerTransform(refs.texto.current, '')
    }

    const completar = () => {
      if (terminado) return
      terminado = true
      try {
        sessionStorage.setItem(CLAVE_VISTO, '1')
      } catch {}
      const recorrido = medidas?.recorrido ?? 0
      const y = window.scrollY
      limpiar()
      // Sin la pista, todo lo de abajo sube `recorrido` px: se descuenta en el mismo frame para que no salte
      window.scrollTo({ top: Math.max(0, y - recorrido), behavior: 'instant' })
    }

    const frame = (ahora: number) => {
      raf = 0
      const dt = ultimoFrame ? Math.min(0.1, (ahora - ultimoFrame) / 1000) : 1 / 60
      ultimoFrame = ahora
      actual += (objetivo - actual) * (1 - Math.exp(-dt * 9))
      if (Math.abs(objetivo - actual) < 0.0005) actual = objetivo
      aplicar(actual)
      // 0.995 y no 1: un scroll suave puede quedarse a una fraccion de pixel del final del recorrido
      if (actual >= 0.994 && objetivo >= 0.995) {
        completar()
        return
      }
      if (actual !== objetivo) raf = requestAnimationFrame(frame)
      else ultimoFrame = 0
    }

    const leerScroll = () => {
      if (!medidas || terminado) return
      objetivo = clamp01(window.scrollY / medidas.recorrido)
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const remedir = () => {
      if (terminado) return
      medir()
      aplicar(actual)
    }

    medir()
    // Si el navegador restauro el scroll (recarga a mitad de pagina) se arranca ahi, sin animar
    objetivo = actual = medidas ? clamp01(window.scrollY / (medidas as Medidas).recorrido) : 0
    aplicar(actual)
    if (actual >= 1) completar()

    window.addEventListener('scroll', leerScroll, { passive: true })
    window.addEventListener('resize', remedir)
    // Inter puede llegar despues del primer pintado y cambiar el ancho del titulo
    document.fonts?.ready.then(remedir).catch(() => {})

    return () => {
      window.removeEventListener('scroll', leerScroll)
      window.removeEventListener('resize', remedir)
      if (raf) cancelAnimationFrame(raf)
      // Navegar fuera de la home a mitad de la intro no debe dejar el header escondido
      if (!terminado) limpiezaPendiente = setTimeout(limpiar, 0)
    }
  }, [refs])
}
