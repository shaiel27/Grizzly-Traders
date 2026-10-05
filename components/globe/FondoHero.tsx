'use client'

import { useEffect, useRef } from 'react'

// Fondo estrellado de TODA la seccion del hero, no solo el cuadrado del Canvas de Three.js
// (plan 009 B4: antes <CampoEstrellas> vivia dentro del <Canvas> del globo, una caja de a lo
// sumo 720px — en pantallas anchas se notaba el borde recto del campo de estrellas contra el
// negro liso de alrededor). Canvas 2D aparte, no WebGL: no compite por el mismo contexto/GPU
// que el globo y es mucho mas barato para unos puntos que titilan y derivan despacio.

interface Estrella {
  x: number // 0..1, fraccion del ancho
  y: number // 0..1, fraccion del alto
  radio: number
  capa: 0 | 1 | 2
  fase: number
  periodo: number
  color: string
}

const CONFIG_CAPAS = [
  { radio: 0.6, derivaPxS: 2, parallaxPx: 6, color: 'rgba(255,255,255,alpha)' },
  { radio: 1.0, derivaPxS: 5, parallaxPx: 12, color: 'rgba(255,255,255,alpha)' },
  { radio: 1.6, derivaPxS: 9, parallaxPx: 20, color: 'rgba(127,212,255,alpha)' },
] as const

const CANTIDAD_DESKTOP = [120, 60, 25]
const CANTIDAD_MOBIL = [60, 30, 12]

// mulberry32: mismo PRNG con semilla que ya usa components/globe/muestrearTierra.ts — resultado
// reproducible, y aunque esto corre en un efecto (no en el render, donde react-hooks/purity SI
// prohibiria Math.random()) conviene seguir la misma convencion del resto de esta carpeta.
function mulberry32(semilla: number) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function crearEstrellas(anchoMovil: boolean): Estrella[] {
  const rng = mulberry32(20260930)
  const cantidades = anchoMovil ? CANTIDAD_MOBIL : CANTIDAD_DESKTOP
  const estrellas: Estrella[] = []
  cantidades.forEach((n, capa) => {
    const cfg = CONFIG_CAPAS[capa]
    for (let i = 0; i < n; i++) {
      estrellas.push({
        x: rng(),
        y: rng(),
        radio: cfg.radio * (0.7 + rng() * 0.6),
        capa: capa as 0 | 1 | 2,
        fase: rng() * Math.PI * 2,
        periodo: 2 + rng() * 4,
        color: cfg.color,
      })
    }
  })
  return estrellas
}

interface EstrellaFugaz {
  activa: boolean
  x: number
  y: number
  angulo: number
  t: number
  proximaEn: number
}

export function FondoHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const contenedor = canvas?.parentElement
    if (!canvas || !contenedor) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Deliberately no prefers-reduced-motion check here, same call as the ticker (ver el
    // comentario de .ticker-flash-down en este archivo): en Windows con "Efectos de animacion"
    // desactivado, CUALQUIER navegador (no solo uno) reporta reduced-motion=true, y antes esto
    // dejaba el fondo completamente congelado en el primer frame para siempre — no es un
    // deterioro sutil de una animacion decorativa, es un fondo estatico sin aviso de que existe
    // una preferencia de por medio. Sigue siendo decorativo y no bloquea nada (WCAG 2.2.2 ya
    // esta cubierto por el resto de animaciones del sitio, que si se congelan).
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let ancho = 0
    let alto = 0
    let estrellas = crearEstrellas(window.innerWidth < 1024)
    const rngFugaz = mulberry32(777)
    const fugaz: EstrellaFugaz = { activa: false, x: 0, y: 0, angulo: 0, t: 0, proximaEn: 8 + rngFugaz() * 7 }

    let puntero = { x: 0.5, y: 0.5 }
    const onPointerMove = (e: PointerEvent) => {
      const r = contenedor.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      puntero = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
    }

    function medir() {
      if (!canvas || !contenedor) return
      const r = contenedor.getBoundingClientRect()
      ancho = r.width
      alto = r.height
      canvas.width = Math.round(ancho * dpr)
      canvas.height = Math.round(alto * dpr)
    }

    function dibujar(tiempoS: number) {
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, ancho, alto)

      for (const e of estrellas) {
        const cfg = CONFIG_CAPAS[e.capa]
        const derivaPx = ((tiempoS * cfg.derivaPxS) % (ancho + 40)) - 20
        const parX = (puntero.x - 0.5) * cfg.parallaxPx
        const parY = (puntero.y - 0.5) * cfg.parallaxPx * 0.6
        const x = (((e.x * ancho - derivaPx + parX) % ancho) + ancho) % ancho
        const y = e.y * alto + parY
        const opacidad = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(tiempoS * (Math.PI * 2) / e.periodo + e.fase))

        ctx.beginPath()
        ctx.fillStyle = cfg.color.replace('alpha', opacidad.toFixed(3))
        ctx.arc(x, y, e.radio, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!fugaz.activa) {
        fugaz.proximaEn -= 1 / 60
        if (fugaz.proximaEn <= 0) {
          fugaz.activa = true
          fugaz.t = 0
          // Nace en la mitad derecha (donde esta el globo, no el texto) y cae en diagonal.
          fugaz.x = ancho * (0.55 + rngFugaz() * 0.4)
          fugaz.y = alto * (0.05 + rngFugaz() * 0.2)
          fugaz.angulo = (35 + rngFugaz() * 20) * (Math.PI / 180)
        }
      } else {
        fugaz.t += 1 / 60
        const duracion = 0.3
        const p = fugaz.t / duracion
        if (p >= 1) {
          fugaz.activa = false
          fugaz.proximaEn = 8 + rngFugaz() * 7
        } else {
          const largo = 90
          const x1 = fugaz.x + Math.cos(fugaz.angulo) * largo * p
          const y1 = fugaz.y + Math.sin(fugaz.angulo) * largo * p
          const x0 = x1 - Math.cos(fugaz.angulo) * largo * 0.5
          const y0 = y1 - Math.sin(fugaz.angulo) * largo * 0.5
          const grad = ctx.createLinearGradient(x0, y0, x1, y1)
          grad.addColorStop(0, 'rgba(127,212,255,0)')
          grad.addColorStop(1, `rgba(220,245,255,${1 - p})`)
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x1, y1)
          ctx.stroke()
        }
      }
    }

    let visible = true
    let frame = 0
    const t0 = performance.now()
    function loop() {
      frame = requestAnimationFrame(loop)
      if (!visible || document.hidden) return
      dibujar((performance.now() - t0) / 1000)
    }

    medir()
    dibujar(0)

    const resizeObserver = new ResizeObserver(() => {
      estrellas = crearEstrellas(window.innerWidth < 1024)
      medir()
      dibujar(0)
    })
    resizeObserver.observe(contenedor)

    let intersectionObserver: IntersectionObserver | undefined
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(([entrada]) => {
        visible = entrada.isIntersecting
      })
      intersectionObserver.observe(contenedor)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    loop()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver?.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 -z-10"
      style={{
        // Mismo tramo que el degradado de HomeHero.tsx (§10.4): las estrellas se apagan justo
        // donde empieza la transicion de color hacia --canvas, para que no "corten" contra ese
        // borde en vez de desvanecerse con el.
        maskImage: 'linear-gradient(to bottom, black calc(100% - 220px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 220px), transparent 100%)',
      }}
    />
  )
}
