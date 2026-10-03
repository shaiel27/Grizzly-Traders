'use client'

import { useCallback, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

const LIMITE_INCLINACION = (60 * Math.PI) / 180 // ±60°
const AUTO_GIRO_Y = 0.05 // rad/s, oeste a este, una vez en reposo
const INCLINACION_REPOSO = 0.25 // rad
// Con la orientacion de lib/globe/geo.ts, rotY=0 ya deja un meridiano de -90° (centro-oeste de
// EEUU) mirando a camara. -PI/4 lo corre a -45°: America queda mas centrada hacia el Atlantico,
// con un adelanto de Africa/Europa en el borde — el "America/Atlantico" que pide el plan 009
// §1.0, sin quedar tan cerrado sobre un solo continente.
const ROT_Y_INICIAL = -Math.PI / 4
const FRICCION_POR_FRAME_60FPS = 0.95
const EPSILON_VELOCIDAD = 0.0005
const DURACION_RETORNO_S = 1.2
const IMPULSO_TECLADO = 0.12
// Un toque que se movio menos de esto y duro menos de esto es un tap (abre un pin), no un
// arrastre — plan 009 §1.3.
const TOQUE_DIST_MAX_PX = 6
const TOQUE_DURACION_MAX_MS = 300

export interface EstadoArrastreGlobo {
  rotY: number
  rotX: number
  velY: number
  velX: number
  arrastrando: boolean
  retornando: boolean
  tRetorno: number
  rotXInicioRetorno: number
  pausado: boolean
}

export function crearEstadoArrastreGlobo(): EstadoArrastreGlobo {
  return {
    rotY: ROT_Y_INICIAL,
    rotX: INCLINACION_REPOSO,
    velY: 0,
    velX: 0,
    arrastrando: false,
    retornando: false,
    tRetorno: 0,
    rotXInicioRetorno: INCLINACION_REPOSO,
    pausado: false,
  }
}

/**
 * Arrastre + inercia + auto-giro para el globo. No usa useFrame aqui (este hook se llama fuera
 * del <Canvas>, sobre el div circular que captura los Pointer Events); expone `estadoRef` para
 * que un componente dentro del Canvas lo lea en su propio useFrame y los `handlers` para el div.
 * `step(dt)` avanza la fisica un frame y se invoca tambien desde ese useFrame.
 */
export function useArrastreGlobo(reducedMotionRef: { current: boolean }, onToque?: (clientX: number, clientY: number) => void) {
  const estadoRef = useRef<EstadoArrastreGlobo>(crearEstadoArrastreGlobo())
  const punteroAnterior = useRef<{ x: number; y: number } | null>(null)
  const inicioToque = useRef<{ x: number; y: number; t: number } | null>(null)

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    punteroAnterior.current = { x: e.clientX, y: e.clientY }
    inicioToque.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    const estado = estadoRef.current
    estado.arrastrando = true
    estado.retornando = false
    estado.pausado = false
    estado.velY = 0
    estado.velX = 0
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const estado = estadoRef.current
    if (!estado.arrastrando || !punteroAnterior.current) return

    const alto = e.currentTarget.clientHeight || 300
    const k = (Math.PI / alto) * 1.4
    const dx = e.clientX - punteroAnterior.current.x
    const dy = e.clientY - punteroAnterior.current.y
    punteroAnterior.current = { x: e.clientX, y: e.clientY }

    estado.velY = dx * k
    estado.velX = dy * k
    estado.rotY += estado.velY
    estado.rotX = Math.max(-LIMITE_INCLINACION, Math.min(LIMITE_INCLINACION, estado.rotX + estado.velX))
  }, [])

  const finalizarArrastre = useCallback(
    (e?: ReactPointerEvent<HTMLDivElement>) => {
      const estado = estadoRef.current
      estado.arrastrando = false

      const inicio = inicioToque.current
      inicioToque.current = null
      if (e && inicio && onToque) {
        const dist = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y)
        const duracion = performance.now() - inicio.t
        if (dist < TOQUE_DIST_MAX_PX && duracion < TOQUE_DURACION_MAX_MS) {
          onToque(e.clientX, e.clientY)
        }
      }
      punteroAnterior.current = null
    },
    [onToque]
  )

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => finalizarArrastre(e), [finalizarArrastre])
  const onPointerCancel = useCallback(() => finalizarArrastre(), [finalizarArrastre])

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const estado = estadoRef.current
    switch (e.key) {
      case 'ArrowLeft':
        estado.rotY -= IMPULSO_TECLADO
        break
      case 'ArrowRight':
        estado.rotY += IMPULSO_TECLADO
        break
      case 'ArrowUp':
        estado.rotX = Math.max(-LIMITE_INCLINACION, estado.rotX - IMPULSO_TECLADO)
        break
      case 'ArrowDown':
        estado.rotX = Math.min(LIMITE_INCLINACION, estado.rotX + IMPULSO_TECLADO)
        break
      default:
        return
    }
    estado.retornando = false
    estado.pausado = false
    e.preventDefault()
  }, [])

  // Avanza la fisica un paso `dt` (segundos). Se llama una vez por frame desde el useFrame
  // del componente de escena (dentro del Canvas). Con prefers-reduced-motion no hay auto-giro,
  // inercia ni retorno — el arrastre en vivo (arriba) sigue funcionando 1:1 igual.
  const step = useCallback((dt: number) => {
    const estado = estadoRef.current
    if (estado.arrastrando) return
    // Con una tarjeta de activo abierta, el auto-giro se congela (plan 009 §1.3) — arrastrar
    // (arriba, estado.arrastrando) retoma el control igual, eso cierra la tarjeta desde
    // GloboHolografico.tsx, no desde aca.
    if (estado.pausado) return

    if (reducedMotionRef.current) {
      // El giro de base sigue constante aun con prefers-reduced-motion: es un elemento
      // decorativo persistente (pedido explicito, dos veces), no una transicion que pueda
      // sobresaltar — los anillos del HUD (AnilloHud, mas abajo en components/globe/
      // GloboHolografico.tsx) ya giraban sin mirar esta preferencia; esto los iguala en vez
      // de dejar al globo quieto mientras todo lo demas se mueve alrededor. Lo que SI se
      // desactiva: inercia del arrastre y el recentrado animado de la inclinacion (salta
      // directo al reposo en vez de interpolar).
      estado.rotY += AUTO_GIRO_Y * dt
      estado.rotX = INCLINACION_REPOSO
      estado.velY = 0
      estado.velX = 0
      estado.retornando = false
      return
    }

    const friccion = Math.pow(FRICCION_POR_FRAME_60FPS, dt * 60)
    estado.velY *= friccion
    estado.velX *= friccion

    const magnitud = Math.abs(estado.velY) + Math.abs(estado.velX)
    if (!estado.retornando && magnitud < EPSILON_VELOCIDAD) {
      estado.retornando = true
      estado.tRetorno = 0
      estado.rotXInicioRetorno = estado.rotX
    }

    if (estado.retornando) {
      // El giro en Y es SIEMPRE a velocidad constante (AUTO_GIRO_Y rad/s, sin rampa) — antes se
      // multiplicaba por `suavizado`, la misma curva cubica que recentra la inclinacion X, asi
      // que el giro aceleraba de 0 a velocidad plena junto con ese recentrado en vez de ser
      // constante de entrada. `suavizado` ahora solo controla el recentrado de X.
      estado.tRetorno = Math.min(DURACION_RETORNO_S, estado.tRetorno + dt)
      const t = estado.tRetorno / DURACION_RETORNO_S
      const suavizado = 1 - Math.pow(1 - t, 3)
      estado.rotX = estado.rotXInicioRetorno + (INCLINACION_REPOSO - estado.rotXInicioRetorno) * suavizado
      estado.rotY += AUTO_GIRO_Y * dt
    } else {
      estado.rotY += estado.velY
      estado.rotX = Math.max(-LIMITE_INCLINACION, Math.min(LIMITE_INCLINACION, estado.rotX + estado.velX))
    }
  }, [reducedMotionRef])

  // Mutar estadoRef.current directo desde AFUERA del hook (p.ej. GloboHolografico.tsx pausando
  // el auto-giro mientras una tarjeta de activo esta abierta) rompe react-hooks/immutability —
  // el lint no deja modificar un valor que devolvio un hook desde afuera de el. Este setter
  // hace la mutacion ADENTRO del hook, que es donde esta permitida.
  const setPausado = useCallback((valor: boolean) => {
    estadoRef.current.pausado = valor
  }, [])

  return {
    estadoRef,
    step,
    setPausado,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown },
  }
}
