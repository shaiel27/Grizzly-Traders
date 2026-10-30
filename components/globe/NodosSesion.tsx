'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CENTROS_SESION, type EstadoSesion } from '@/lib/globe/sesiones'
import { latLonAVector3, gradosARadianes } from '@/lib/globe/geo'

// THREE.Color no lee variables CSS: hex local con el token al lado (mismo patron que
// PinesActivos.tsx) para que el mapa old-hex -> token quede explicito.
const COLOR_ABIERTO = '#4fc3ff' // --accent-cyan
// V4 — contraste del nodo cerrado (bug de accesibilidad, no de gusto). El viejo #444748
// (--outline-variant) compuesto a opacidad 0.5 sobre --globe-base (#020a18, el COLOR_BASE del
// material del globo) daba 1.35:1: muy por debajo del 3:1 que WCAG 1.4.11 exige a un indicador
// de estado no textual. En la practica el nodo cerrado era invisible, justo lo contrario de lo
// que este componente existe para comunicar. El calculo hay que hacerlo sobre el color
// COMPUESTO a la opacidad real de render (el piso de abajo, 0.7), no a alpha plena: a alpha 1
// cualquier gris aprueba y el render sigue fallando — asi se colo el valor anterior.
//   #444748 @0.5 -> 1.35:1  (fallaba)   · #5c6b82 @0.7 -> 2.35:1 (seguia fallando)
//   #6b7d96 @0.7 -> 2.85:1  (falla por poco) · #788ca8 @0.7 -> 3.34:1  OK
// Se deja margen sobre el 3:1 exacto (#6f829c daria 3.00) porque el fondo real no siempre es
// --globe-base puro: los nodos caen sobre ciudades, y los puntos de tierra del shader suben el
// fondo y bajan la razon. No habia token que cubriera este azul-pizarra desaturado (el gris mas
// cercano, --ink-subtle #808080, es neutro y rompe la familia de color del globo), asi que la
// ronda le declaro uno propio: --globe-sesion-cerrada en globals.css.
const COLOR_CERRADO = '#788ca8' // --globe-sesion-cerrada

// Amortiguacion del puente abierto<->cerrado (F0-05): 1-exp(-14*dt) asienta en ~240ms — el
// mismo orden que una transicion UI corta, sin hard-cut de color ni de opacidad.
const K_PUENTE = 14

function NodoSesion({
  lat,
  lon,
  abierto,
  reducedMotion,
}: {
  lat: number
  lon: number
  abierto: boolean
  reducedMotion: boolean
}) {
  const pos = useMemo(() => latLonAVector3(gradosARadianes(lat), gradosARadianes(lon), 1.004), [lat, lon])
  const posicion: [number, number, number] = [pos.x, pos.y, pos.z]
  const nucleoRef = useRef<THREE.Mesh>(null)
  const nucleoMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const anilloRef = useRef<THREE.Mesh>(null)
  const anilloMatRef = useRef<THREE.MeshBasicMaterial>(null)

  // Estado visual continuo del puente: el progreso (0=cerrado, 1=abierto) y el color actual se
  // amortiguan hacia el objetivo en cada frame — el color no puede "lerpearse" solo via props
  // de React sin cortar en seco en el commit.
  const progresoRef = useRef(abierto ? 1 : 0)
  const colorActualRef = useRef(new THREE.Color(abierto ? COLOR_ABIERTO : COLOR_CERRADO))
  const colorObjetivo = useMemo(
    () => ({ abierto: new THREE.Color(COLOR_ABIERTO), cerrado: new THREE.Color(COLOR_CERRADO) }),
    []
  )

  useFrame((state, dt) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-K_PUENTE * Math.min(dt, 0.1))
    progresoRef.current += ((abierto ? 1 : 0) - progresoRef.current) * k
    const progreso = progresoRef.current
    colorActualRef.current.lerp(abierto ? colorObjetivo.abierto : colorObjetivo.cerrado, k)

    if (nucleoRef.current) {
      // Sin pulso de nucleo infinito (F0-05): el nucleo queda quieto a escala 1 — el "abierto"
      // ya lo comunica el color y el anillo radar, el latido decorativo sobraba.
      nucleoRef.current.scale.setScalar(1)
    }
    if (nucleoMatRef.current) {
      nucleoMatRef.current.color.copy(colorActualRef.current)
      // Opacidad puente: piso 0.7 en cerrado (V4: a 0.5 el compuesto no llegaba a 3:1 con
      // ningun gris-azul que siguiera leyendose como "apagado"), 1.0 en abierto. El rango
      // util baja de 0.5 a 0.3, pero el abierto no depende de la opacidad para distinguirse:
      // lo que cambia de verdad es el salto de color a cian y el anillo radar.
      nucleoMatRef.current.opacity = 0.7 + 0.3 * progreso
    }

    if (anilloRef.current && anilloMatRef.current) {
      // El anillo radar se apaga/apaga con el mismo puente en vez de desaparecer de golpe al
      // cerrar; el return temprano viejo dejaba la escala congelada en el maximo del ciclo
      // (bug F0-05) — ahora al llegar a ~0 se resetea a 1 para el proximo ciclo.
      if (progreso < 0.01) {
        anilloRef.current.visible = false
        anilloRef.current.scale.setScalar(1)
      } else {
        anilloRef.current.visible = true
        // Con reducedMotion el ciclo se congela a un estado fijo (F0-06): anillo visible pero
        // estatico, sin expansion infinita.
        const ciclo = reducedMotion ? 0.35 : (state.clock.getElapsedTime() * 0.5) % 1
        anilloRef.current.scale.setScalar((1 + ciclo * 2.2) * (0.6 + 0.4 * progreso))
        anilloMatRef.current.opacity = 0.5 * (1 - ciclo) * progreso
      }
    }
  })

  return (
    <group position={posicion}>
      <mesh ref={nucleoRef}>
        <sphereGeometry args={[0.014, 8, 8]} />
        {/* El color/opacity de JSX es solo el valor de montaje: useFrame los sobreescribe antes
            de cada draw con el valor amortiguado (colorActualRef). El 0.7 del cerrado tiene que
            ser el mismo piso que el puente de arriba (V4): si aqui quedara el 0.5 viejo, el
            primer frame se pintaria con el valor de montaje y el nodo parpadearia al entrar. */}
        <meshBasicMaterial
          ref={nucleoMatRef}
          color={abierto ? COLOR_ABIERTO : COLOR_CERRADO}
          toneMapped={false}
          transparent
          opacity={abierto ? 1 : 0.7}
        />
      </mesh>
      <mesh ref={anilloRef} visible={false}>
        <ringGeometry args={[0.014, 0.02, 16]} />
        <meshBasicMaterial ref={anilloMatRef} color={COLOR_ABIERTO} toneMapped={false} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export function NodosSesion({ estados, reducedMotion = false }: { estados: EstadoSesion[]; reducedMotion?: boolean }) {
  return (
    <>
      {CENTROS_SESION.map((centro) => (
        <NodoSesion
          key={centro.id}
          lat={centro.lat}
          lon={centro.lon}
          abierto={estados.find((e) => e.id === centro.id)?.abierto ?? false}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  )
}
