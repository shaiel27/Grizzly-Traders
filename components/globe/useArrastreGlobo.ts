'use client'

import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)

const AUTO_GIRO_Y = 0.05 // rad/s, oeste a este, una vez en reposo
const INCLINACION_REPOSO = 0.25 // rad, solo para la orientacion inicial
// Con la orientacion de lib/globe/geo.ts, rotY=0 ya deja un meridiano de -90° (centro-oeste de
// EEUU) mirando a camara. -PI/4 lo corre a -45°: America queda mas centrada hacia el Atlantico,
// con un adelanto de Africa/Europa en el borde — el "America/Atlantico" que pide el plan 009
// §1.0, sin quedar tan cerrado sobre un solo continente.
const ROT_Y_INICIAL = -Math.PI / 4
const FRICCION_POR_FRAME_60FPS = 0.95
const EPSILON_VELOCIDAD = 0.0005
const IMPULSO_TECLADO = 0.12
// Un toque que se movio menos de esto y duro menos de esto es un tap (abre un pin), no un
// arrastre — plan 009 §1.3.
const TOQUE_DIST_MAX_PX = 6
const TOQUE_DURACION_MAX_MS = 300

export interface EstadoArrastreGlobo {
  // Orientacion COMPLETA como quaternion, no dos angulos (yaw/pitch) guardados por separado.
  // Antes el globo se reconstruia cada frame como qX(rotX_total) * qY(rotY_total) — SIEMPRE con
  // todo el yaw acumulado aplicado "adentro" y todo el pitch "afuera", sin importar en que orden
  // real arrastro el usuario. Mientras el pitch estuvo limitado a ±60° eso no se notaba, pero
  // sin limite (rotacion libre, pedido explicito) esa recomposicion de dos totales en un orden
  // fijo rompe la sensacion: despues de inclinar mucho, arrastrar horizontal dejaba de verse
  // como giro horizontal. La correccion es un quaternion que se va componiendo INCREMENTO A
  // INCREMENTO (girar(), mas abajo) en el orden real en que el usuario arrastra — ver ahi el
  // porque con mas detalle.
  orientacion: THREE.Quaternion
  velY: number // ultimo delta de arrastre en el eje vertical de pantalla (yaw), por frame
  velX: number // idem, eje horizontal de pantalla (pitch)
  arrastrando: boolean
  pausado: boolean
}

function orientacionInicial(): THREE.Quaternion {
  const qY = new THREE.Quaternion().setFromAxisAngle(UP, ROT_Y_INICIAL)
  const qX = new THREE.Quaternion().setFromAxisAngle(RIGHT, INCLINACION_REPOSO)
  return qX.multiply(qY)
}

export function crearEstadoArrastreGlobo(): EstadoArrastreGlobo {
  return {
    orientacion: orientacionInicial(),
    velY: 0,
    velX: 0,
    arrastrando: false,
    pausado: false,
  }
}

const qDeltaY = new THREE.Quaternion()
const qDeltaX = new THREE.Quaternion()
const qDelta = new THREE.Quaternion()

// Rota la orientacion ACTUAL por un incremento chico (deltaYaw alrededor del eje vertical de
// pantalla, deltaPitch alrededor del horizontal) — nunca recalcula desde angulos totales
// acumulados. premultiply() aplica el incremento en ejes fijos de camara/pantalla DESPUES de lo
// que ya habia, asi que arrastrar "hacia la derecha" siempre gira alrededor del eje vertical
// que se ve en pantalla en ESE instante, sin importar que tan girado o inclinado este el globo
// — eso es lo que permite que la rotacion se sienta igual en cualquier direccion y no se rompa
// nunca, a diferencia del modelo anterior (dos angulos totales recompuestos cada frame).
function girar(orientacion: THREE.Quaternion, deltaYaw: number, deltaPitch: number): void {
  qDeltaY.setFromAxisAngle(UP, deltaYaw)
  qDeltaX.setFromAxisAngle(RIGHT, deltaPitch)
  qDelta.multiplyQuaternions(qDeltaX, qDeltaY)
  orientacion.premultiply(qDelta)
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
    girar(estado.orientacion, estado.velY, estado.velX)
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
        girar(estado.orientacion, -IMPULSO_TECLADO, 0)
        break
      case 'ArrowRight':
        girar(estado.orientacion, IMPULSO_TECLADO, 0)
        break
      case 'ArrowUp':
        girar(estado.orientacion, 0, -IMPULSO_TECLADO)
        break
      case 'ArrowDown':
        girar(estado.orientacion, 0, IMPULSO_TECLADO)
        break
      default:
        return
    }
    estado.pausado = false
    e.preventDefault()
  }, [])

  // Avanza la fisica un paso `dt` (segundos). Se llama una vez por frame desde el useFrame
  // del componente de escena (dentro del Canvas). Con prefers-reduced-motion no hay inercia:
  // el arrastre en vivo (arriba) sigue funcionando 1:1 igual, solo se desactiva lo automatico.
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
      // sobresaltar — los anillos del HUD (AnilloHud, en GloboHolografico.tsx) ya giraban sin
      // mirar esta preferencia; esto los iguala. Lo que SI se desactiva: la inercia del
      // arrastre (frena en seco en vez de ir perdiendo velocidad).
      girar(estado.orientacion, AUTO_GIRO_Y * dt, 0)
      estado.velY = 0
      estado.velX = 0
      return
    }

    const friccion = Math.pow(FRICCION_POR_FRAME_60FPS, dt * 60)
    estado.velY *= friccion
    estado.velX *= friccion

    const magnitud = Math.abs(estado.velY) + Math.abs(estado.velX)
    if (magnitud < EPSILON_VELOCIDAD) {
      // En reposo: auto-giro constante (oeste a este), desde la orientacion donde haya quedado
      // el globo. Antes esto tambien volvia a enderezar la inclinacion a un valor fijo — con
      // rotacion libre eso ya no tiene sentido (contradiria "se puede rotar en todas las
      // direcciones" que se dejara girando libre pero lo fuerce a enderezarse solo).
      girar(estado.orientacion, AUTO_GIRO_Y * dt, 0)
    } else {
      // Inercia: sigue girando con la velocidad del ultimo arrastre, decayendo con la friccion.
      girar(estado.orientacion, estado.velY, estado.velX)
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
