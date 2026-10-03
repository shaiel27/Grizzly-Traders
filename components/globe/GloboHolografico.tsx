'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import * as THREE from 'three'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import {
  baseVertexShader,
  baseFragmentShader,
  puntosVertexShader,
  puntosFragmentShader,
  baseHologramaVertexShader,
  baseHologramaFragmentShader,
} from './shaders'
import { extraerImageData, muestrearPuntosTierra } from './muestrearTierra'
import { useArrastreGlobo, type EstadoArrastreGlobo } from './useArrastreGlobo'
import { PinesActivos } from './PinesActivos'
import { TarjetaActivo, precargarNoticias, type PosicionPin } from './TarjetaActivo'
import { NodosSesion } from './NodosSesion'
import { MARCADORES } from '@/lib/globe/marcadores'
import type { EstadoSesion } from '@/lib/globe/sesiones'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'
import type { MutableRefObject } from 'react'

const COLOR_PUNTOS = '#7fd4ff'
const COLOR_BORDE = '#4fc3ff'
const COLOR_BASE = '#020a18'

export interface DatosGlobo {
  precioBtc: string
  deltaBtc: string
  deltaPositivo: boolean
  posts: number
  assets: number
  etiquetaNoticias: string
  etiquetaActivos: string
  // Precio + variacion del dia por simbolo, para las tarjetas emergentes de los pines (plan 009
  // §1.4) — ya calculado en page.tsx/HomeHero.tsx con datos del ticker ya cacheado.
  cotizacionesPines: Record<string, { precio: number; cambio: number | null }>
}

interface GloboHolograficoProps {
  datos: DatosGlobo
  reducedMotion: boolean
  ariaLabel: string
  locale: Locale
  // El chip de riesgo global (plan 009 §3) se muestra en LeyendaGlobo.tsx, fuera del canvas —
  // este componente solo necesita el estado de sesiones, para los nodos 3D que giran con el
  // globo (estadosSesion abajo).
  estadosSesion: EstadoSesion[]
  onReady?: () => void
  onContextLost?: () => void
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function progreso(t: number, inicio: number, fin: number): number {
  return clamp01((t - inicio) / (fin - inicio))
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// --- Geometrias auxiliares (puras: sin Math.random, mismo resultado siempre) ---

function construirReticula(radio: number, segmentos = 48): THREE.BufferGeometry {
  const puntos: number[] = []
  for (let lonDeg = 0; lonDeg < 360; lonDeg += 15) {
    const lon = (lonDeg * Math.PI) / 180
    for (let i = 0; i < segmentos; i++) {
      const lat1 = -Math.PI / 2 + (i / segmentos) * Math.PI
      const lat2 = -Math.PI / 2 + ((i + 1) / segmentos) * Math.PI
      puntos.push(
        radio * Math.cos(lat1) * Math.cos(lon), radio * Math.sin(lat1), radio * Math.cos(lat1) * Math.sin(lon),
        radio * Math.cos(lat2) * Math.cos(lon), radio * Math.sin(lat2), radio * Math.cos(lat2) * Math.sin(lon)
      )
    }
  }
  for (let latDeg = -75; latDeg <= 75; latDeg += 15) {
    const lat = (latDeg * Math.PI) / 180
    for (let i = 0; i < segmentos; i++) {
      const lon1 = (i / segmentos) * Math.PI * 2
      const lon2 = ((i + 1) / segmentos) * Math.PI * 2
      puntos.push(
        radio * Math.cos(lat) * Math.cos(lon1), radio * Math.sin(lat), radio * Math.cos(lat) * Math.sin(lon1),
        radio * Math.cos(lat) * Math.cos(lon2), radio * Math.sin(lat), radio * Math.cos(lat) * Math.sin(lon2)
      )
    }
  }
  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3))
  return geometria
}

function construirAnillo(radio: number, segmentos = 128): THREE.BufferGeometry {
  const puntos: THREE.Vector3[] = []
  for (let i = 0; i <= segmentos; i++) {
    const a = (i / segmentos) * Math.PI * 2
    puntos.push(new THREE.Vector3(radio * Math.cos(a), 0, radio * Math.sin(a)))
  }
  return new THREE.BufferGeometry().setFromPoints(puntos)
}

// Las 3 etiquetas giran cada una a su propia velocidad — en algun momento dos se van a cruzar
// en pantalla, es inherente al diseño. La placa de fondo (en vez de texto transparente puro)
// es lo que evita que el cruce se lea como texto ilegible superpuesto.
function crearTexturaEtiqueta(texto: string, color = COLOR_PUNTOS): { textura: THREE.CanvasTexture; proporcion: number } {
  const escala = 4
  const alto = 30 * escala
  const medidor = document.createElement('canvas').getContext('2d')
  let anchoTexto = 160 * escala
  if (medidor) {
    medidor.font = `600 ${14 * escala}px Inter, sans-serif`
    anchoTexto = Math.ceil(medidor.measureText(texto).width)
  }
  const padding = 14 * escala
  const ancho = anchoTexto + padding * 2
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const radio = alto * 0.3
    ctx.fillStyle = 'rgba(5, 12, 20, 0.72)'
    ctx.beginPath()
    ctx.roundRect(0, alto * 0.12, ancho, alto * 0.76, radio)
    ctx.fill()
    ctx.strokeStyle = 'rgba(79, 195, 255, 0.25)'
    ctx.lineWidth = 1 * escala
    ctx.stroke()

    ctx.font = `600 ${14 * escala}px Inter, sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(texto, ancho / 2, alto / 2)
  }
  const textura = new THREE.CanvasTexture(canvas)
  textura.needsUpdate = true
  textura.colorSpace = THREE.SRGBColorSpace
  return { textura, proporcion: ancho / alto }
}

interface ConfigAnillo {
  radio: number
  inclinacionX: number
  velocidad: number
  etiqueta: string
  retraso: number
  desplazamientoY: number
}

function AnilloHud({ config, reducedMotion }: { config: ConfigAnillo; reducedMotion: boolean }) {
  const grupoEntradaRef = useRef<THREE.Group>(null)
  const grupoRef = useRef<THREE.Group>(null)
  const geometria = useMemo(() => construirAnillo(config.radio), [config.radio])
  const marcadorGeom = useMemo(() => new THREE.SphereGeometry(0.012, 8, 8), [])
  const { textura, proporcion } = useMemo(() => crearTexturaEtiqueta(config.etiqueta), [config.etiqueta])
  const altoEtiqueta = 0.09
  const marcadorRef = useRef<THREE.Mesh>(null)

  // Sin esto, cada remount (navegacion away/back, Fast Refresh en dev) deja geometrias y
  // texturas de canvas huerfanas en la GPU — nunca se liberan solas.
  useEffect(() => {
    return () => {
      geometria.dispose()
      marcadorGeom.dispose()
      textura.dispose()
    }
  }, [geometria, marcadorGeom, textura])

  useFrame((state, dt) => {
    if (grupoRef.current) grupoRef.current.rotation.y += config.velocidad * dt
    if (grupoEntradaRef.current) {
      const inicio = config.retraso / 1000
      const escala = reducedMotion ? 1 : easeOutCubic(progreso(state.clock.getElapsedTime(), inicio, inicio + 0.5))
      grupoEntradaRef.current.scale.setScalar(escala)
    }
  })

  return (
    <group ref={grupoEntradaRef} rotation={[config.inclinacionX, 0, 0]} scale={0}>
      <group ref={grupoRef}>
        <lineLoop
          geometry={geometria}
          ref={(obj) => {
            if (obj) obj.computeLineDistances()
          }}
        >
          <lineDashedMaterial color={COLOR_BORDE} transparent opacity={0.35} dashSize={0.06} gapSize={0.045} toneMapped={false} />
        </lineLoop>
        <mesh ref={marcadorRef} geometry={marcadorGeom} position={[config.radio, 0, 0]}>
          <meshBasicMaterial color={COLOR_PUNTOS} toneMapped={false} />
        </mesh>
        <sprite position={[config.radio * 0.78, config.desplazamientoY, 0]} scale={[altoEtiqueta * proporcion, altoEtiqueta, 1]}>
          <spriteMaterial map={textura} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      </group>
    </group>
  )
}

// 36k puntos (antes 22k, el original sin tocar era 48k) y la mascara se lee a su resolucion
// real (2048x1024, antes se reducia a 1024x512 antes de muestrear) — mas definicion en las
// costas sin volver al x60 de sobremuestreo que si bloqueaba la carga. Con PerformanceMonitor
// en baja, se dibuja solo un subconjunto via setDrawRange — mucho mas barato que remuestrear.
const PUNTOS_OBJETIVO = 36000
const PUNTOS_OBJETIVO_BAJA = 18000

function PuntosTierraCapa({ urlMascara, calidadAlta }: { urlMascara: string; calidadAlta: boolean }) {
  const textura = useLoader(THREE.TextureLoader, urlMascara)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const puntos = useMemo(() => {
    const image = textura.image as CanvasImageSource
    const datosImagen = extraerImageData(image, 2048, 1024)
    return muestrearPuntosTierra(datosImagen, PUNTOS_OBJETIVO, 1337)
  }, [textura])

  const geometria = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(puntos.positions, 3))
    geo.setAttribute('aBrillo', new THREE.BufferAttribute(puntos.aBrillo, 1))
    geo.setAttribute('aFase', new THREE.BufferAttribute(puntos.aFase, 1))
    geo.setAttribute('aVel', new THREE.BufferAttribute(puntos.aVel, 1))
    return geo
  }, [puntos])

  useEffect(() => {
    geometria.setDrawRange(0, calidadAlta ? puntos.count : Math.min(puntos.count, PUNTOS_OBJETIVO_BAJA))
  }, [calidadAlta, puntos, geometria])

  useEffect(() => {
    return () => {
      geometria.dispose()
    }
  }, [geometria])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTiempo.value = state.clock.getElapsedTime()
    }
  })

  const uniforms = useMemo(
    () => ({
      uTiempo: { value: 0 },
      uTam: { value: 0.09 },
      uColor: { value: new THREE.Color(COLOR_PUNTOS) },
    }),
    []
  )

  return (
    <points geometry={geometria} renderOrder={1}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={puntosVertexShader}
        fragmentShader={puntosFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

interface EscenaProps {
  datos: DatosGlobo
  reducedMotion: boolean
  calidadAlta: boolean
  onReady?: () => void
  estadoArrastreRef: MutableRefObject<EstadoArrastreGlobo>
  stepArrastre: (dt: number) => void
  hitsRef: MutableRefObject<Map<string, THREE.Object3D>>
  toqueClienteRef: MutableRefObject<{ x: number; y: number } | null>
  hoverClienteRef: MutableRefObject<{ x: number; y: number } | null>
  seleccionId: string | null
  resaltadoId: string | null
  onSeleccionar: (id: string | null) => void
  onResaltar: (id: string | null) => void
  posicionPinRef: MutableRefObject<PosicionPin>
  registrarHit: (id: string, obj: THREE.Object3D | null) => void
  estadosSesion: EstadoSesion[]
}

function Escena({
  datos,
  reducedMotion,
  estadosSesion,
  calidadAlta,
  onReady,
  estadoArrastreRef,
  stepArrastre,
  hitsRef,
  toqueClienteRef,
  hoverClienteRef,
  seleccionId,
  resaltadoId,
  onSeleccionar,
  onResaltar,
  posicionPinRef,
  registrarHit,
}: EscenaProps) {
  const grupoGlobo = useRef<THREE.Group>(null)
  const materialBase = useRef<THREE.ShaderMaterial>(null)
  const materialHolograma = useRef<THREE.ShaderMaterial>(null)

  const ndcToque = useMemo(() => new THREE.Vector2(), [])
  const posicionMundoPin = useMemo(() => new THREE.Vector3(), [])
  const avisoListo = useRef(false)

  // Comparte el raycaster del frame actual contra el registro de pines — usado tanto para el
  // tap (seleccion) como el hover (resaltado). Devuelve el id del pin mas cercano o null.
  const raycastPin = (raycaster: THREE.Raycaster, camera: THREE.Camera, domElement: HTMLElement, clientX: number, clientY: number): string | null => {
    const rect = domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    ndcToque.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(ndcToque, camera)
    const objetos = Array.from(hitsRef.current.values())
    const hits = raycaster.intersectObjects(objetos, false)
    return hits.length > 0 ? ((hits[0].object.userData.id as string | undefined) ?? null) : null
  }

  const anillos = useMemo<ConfigAnillo[]>(
    () => [
      // desplazamientoY distinto por anillo: las 3 etiquetas giran a velocidades independientes
      // y antes apuntaban todas a la misma altura relativa — con alturas escalonadas se cruzan
      // mucho menos seguido en pantalla (la placa de fondo de arriba cubre el resto de los casos).
      { radio: 1.35, inclinacionX: Math.PI / 2.2, velocidad: 0.12, etiqueta: `BTC/USD ${datos.precioBtc}`, retraso: 900, desplazamientoY: 0.1 },
      { radio: 1.5, inclinacionX: Math.PI / 2.55, velocidad: -0.085, etiqueta: `${datos.deltaPositivo ? '+' : ''}${datos.deltaBtc}%`, retraso: 1020, desplazamientoY: 0.16 },
      { radio: 1.68, inclinacionX: Math.PI / 1.85, velocidad: 0.06, etiqueta: `${datos.etiquetaNoticias} · ${datos.etiquetaActivos}`, retraso: 1140, desplazamientoY: 0.22 },
    ],
    [datos]
  )

  const reticula = useMemo(() => construirReticula(1.001), [])

  useEffect(() => {
    return () => {
      reticula.dispose()
    }
  }, [reticula])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()

    if (!avisoListo.current) {
      avisoListo.current = true
      onReady?.()
    }

    // Secuencia de entrada
    const opacidadBase = reducedMotion ? 1 : easeOutCubic(progreso(t, 0.3, 1.3))
    const escalaGlobo = reducedMotion ? 1 : 0.6 + 0.4 * easeOutCubic(progreso(t, 0.3, 1.3))
    const opacidadHolograma = reducedMotion ? 1 : easeOutCubic(progreso(t, 0, 0.5))

    if (materialBase.current) materialBase.current.uniforms.uOpacidad.value = opacidadBase
    if (materialHolograma.current) {
      materialHolograma.current.uniforms.uOpacidad.value = opacidadHolograma
      materialHolograma.current.uniforms.uTiempo.value = t
    }

    stepArrastre(delta)
    if (grupoGlobo.current) {
      grupoGlobo.current.quaternion.copy(estadoArrastreRef.current.orientacion)
      grupoGlobo.current.scale.setScalar(escalaGlobo)
    }

    // Tap: se consume una sola vez. Tocar un pin lo selecciona; tocar el globo en cualquier
    // otro lado cierra la tarjeta que estuviera abierta (plan 009 §1.3).
    if (toqueClienteRef.current) {
      const { x, y } = toqueClienteRef.current
      toqueClienteRef.current = null
      onSeleccionar(raycastPin(state.raycaster, state.camera, state.gl.domElement, x, y))
    }

    // Hover (solo cuando no se esta arrastrando — mientras se arrastra, cualquier pin bajo el
    // dedo es incidental, no una intencion de mirarlo).
    if (!estadoArrastreRef.current.arrastrando) {
      const puntero = hoverClienteRef.current
      onResaltar(puntero ? raycastPin(state.raycaster, state.camera, state.gl.domElement, puntero.x, puntero.y) : null)
    }

    // Posicion en pantalla del pin seleccionado, para la tarjeta HTML (fuera del canvas) que la
    // lee por su cuenta en TarjetaActivo.tsx — se corre a traves de un ref, sin setState.
    if (seleccionId) {
      const obj = hitsRef.current.get(seleccionId)
      if (obj) {
        obj.getWorldPosition(posicionMundoPin)
        const dot = posicionMundoPin.clone().normalize().dot(state.camera.position.clone().normalize())
        const proyeccion = posicionMundoPin.clone().project(state.camera)
        const rect = state.gl.domElement.getBoundingClientRect()
        posicionPinRef.current.x = (proyeccion.x * 0.5 + 0.5) * rect.width
        posicionPinRef.current.y = (1 - (proyeccion.y * 0.5 + 0.5)) * rect.height
        posicionPinRef.current.visible = dot > -0.1 && proyeccion.z < 1
      } else {
        posicionPinRef.current.visible = false
      }
    }
  })

  return (
    <>
      <group ref={grupoGlobo}>
        {/* renderOrder=-1: la esfera base y los puntos quedan a la misma distancia de camara
            (ambos centrados en el origen), asi que el orden automatico por distancia de Three
            es ambiguo/inestable — a veces la esfera (transparente, depthWrite:false) se pintaba
            DESPUES de los puntos y los tapaba, dejando "una esfera gris lisa, sin continentes". */}
        <mesh renderOrder={-1}>
          <sphereGeometry args={[1, 64, 64]} />
          <shaderMaterial
            ref={materialBase}
            vertexShader={baseVertexShader}
            fragmentShader={baseFragmentShader}
            uniforms={{
              uColorBase: { value: new THREE.Color(COLOR_BASE) },
              uColorBorde: { value: new THREE.Color(COLOR_BORDE) },
              uOpacidad: { value: 0 },
            }}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <lineSegments geometry={reticula}>
          <lineBasicMaterial color={COLOR_BORDE} transparent opacity={0.06} toneMapped={false} />
        </lineSegments>

        {/* useLoader suspende hasta que la mascara carga — sin este limite, React no tiene
            donde atrapar esa suspension dentro del Canvas y la escena entera no pinta nada. */}
        <Suspense fallback={null}>
          <PuntosTierraCapa urlMascara="/globo/tierra-mascara-2048.png" calidadAlta={calidadAlta} />
        </Suspense>

        {/* Pines de activos: hijos de grupoGlobo para que giren con el planeta (plan 009 §1.2). */}
        <PinesActivos seleccionId={seleccionId} resaltadoId={resaltadoId} registrarHit={registrarHit} />

        {/* Nodos de sesion: mismo motivo, giran con el planeta (plan 009 §2.2). */}
        <NodosSesion estados={estadosSesion} />
      </group>

      {anillos.map((config) => (
        <AnilloHud key={config.etiqueta} config={config} reducedMotion={reducedMotion} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
        <ringGeometry args={[0.05, 1.9, 64]} />
        <shaderMaterial
          ref={materialHolograma}
          vertexShader={baseHologramaVertexShader}
          fragmentShader={baseHologramaFragmentShader}
          uniforms={{
            uColor: { value: new THREE.Color(COLOR_BORDE) },
            uTiempo: { value: 0 },
            uOpacidad: { value: 0 },
          }}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <ambientLight intensity={0.15} />
    </>
  )
}

// Ajusta el frameloop del Canvas segun si el hero esta en pantalla, para no gastar GPU
// mientras se lee el resto de la home.
function useFrameloopVisible(contenedorRef: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = contenedorRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entrada]) => setVisible(entrada.isIntersecting), { threshold: 0.05 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [contenedorRef])
  return visible
}

function AjusteDpr({ alta }: { alta: boolean }) {
  const { gl, setDpr } = useThree()
  useEffect(() => {
    const max = alta ? Math.min(2, window.devicePixelRatio || 1) : 1
    setDpr(max)
    gl.setPixelRatio(max)
  }, [alta, gl, setDpr])
  return null
}

export default function GloboHolografico({ datos, reducedMotion, ariaLabel, locale, estadosSesion, onReady, onContextLost }: GloboHolograficoProps) {
  const dict = getDictionary(locale)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const visible = useFrameloopVisible(contenedorRef)
  const [calidadAlta, setCalidadAlta] = useState(true)
  const reducedMotionRef = useRef(reducedMotion)
  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  // Pines de activos (plan 009 §1): registro de los objetos 3D para el raycast, posiciones de
  // toque/hover pendientes (se consumen dentro del useFrame de Escena) y la posicion en
  // pantalla del pin seleccionado (la lee TarjetaActivo.tsx, fuera del canvas, con su propio
  // rAF — ver el comentario ahi). Todo en refs: nada de esto debe re-renderizar 60 veces/s.
  const hitsRef = useRef(new Map<string, THREE.Object3D>())
  const toqueClienteRef = useRef<{ x: number; y: number } | null>(null)
  const hoverClienteRef = useRef<{ x: number; y: number } | null>(null)
  const posicionPinRef = useRef<PosicionPin>({ x: 0, y: 0, visible: false })
  const [seleccionId, setSeleccionId] = useState<string | null>(null)
  const [resaltadoId, setResaltadoId] = useState<string | null>(null)
  // true si el pin se abrio por tap/clic/teclado (hay que llevar el foco a la tarjeta, es la
  // unica forma de llegar a ella sin mouse); false si se abrio por hover (mover el foco ahi
  // solo porque el mouse paso por encima seria robarle el foco a quien este navegando con
  // teclado en otra parte de la pagina).
  const [autoenfocar, setAutoenfocar] = useState(true)
  // (hover:hover) refleja si el mecanismo de entrada PRINCIPAL puede hacer hover — en touch es
  // false, y ahi el tap sigue siendo la unica forma de abrir un pin (pedido explicito: en touch
  // no hay "pasar el mouse por encima").
  const esHoverCapaz = useRef(false)
  useEffect(() => {
    esHoverCapaz.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }, [])

  const registrarHit = useCallback((id: string, obj: THREE.Object3D | null) => {
    if (obj) hitsRef.current.set(id, obj)
    else hitsRef.current.delete(id)
  }, [])

  const onToque = useCallback((x: number, y: number) => {
    toqueClienteRef.current = { x, y }
  }, [])

  // Abrir/cerrar por tap, clic o la lista de botones sr-only (teclado): lleva el foco.
  const abrirPorAccion = useCallback((id: string | null) => {
    setAutoenfocar(true)
    setSeleccionId(id)
  }, [])

  // Hover (solo en dispositivos que pueden hacer hover de verdad): abre al instante, cierra con
  // un respiro corto para poder mover el mouse del pin a la tarjeta sin que se cierre en el
  // camino — sobreTarjetaRef cancela el cierre mientras el mouse esta sobre la tarjeta misma.
  const cierreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sobreTarjetaRef = useRef(false)
  const cancelarCierre = useCallback(() => {
    if (cierreTimeoutRef.current) {
      clearTimeout(cierreTimeoutRef.current)
      cierreTimeoutRef.current = null
    }
  }, [])
  // OJO: esto se llama desde el useFrame de Escena, una vez por frame, mientras el mouse este
  // fuera de cualquier pin — si reprogramara el timeout cada vez (cancelarCierre + setTimeout
  // de nuevo) nunca llegaria a cumplirse, se reinicia cada ~16ms. Por eso NO hace nada si ya
  // hay un cierre pendiente: deja que ese corra su curso.
  const programarCierre = useCallback(() => {
    if (cierreTimeoutRef.current) return
    cierreTimeoutRef.current = setTimeout(() => {
      cierreTimeoutRef.current = null
      if (!sobreTarjetaRef.current) setSeleccionId(null)
    }, 220)
  }, [])

  const onResaltar = useCallback(
    (id: string | null) => {
      setResaltadoId(id)
      if (!esHoverCapaz.current) return
      if (id) {
        cancelarCierre()
        setAutoenfocar(false)
        setSeleccionId(id)
      } else {
        programarCierre()
      }
    },
    [cancelarCierre, programarCierre]
  )

  const onHoverTarjeta = useCallback(
    (sobre: boolean) => {
      sobreTarjetaRef.current = sobre
      if (sobre) cancelarCierre()
      else programarCierre()
    },
    [cancelarCierre, programarCierre]
  )

  // Una sola instancia: el div de abajo recibe los Pointer Events y actualiza `estadoRef`;
  // `Escena`, dentro del Canvas, lee ese mismo `estadoRef` en su useFrame para rotar el grupo.
  const arrastre = useArrastreGlobo(reducedMotionRef, onToque)

  // Mientras hay una tarjeta abierta, el auto-giro se congela (useArrastreGlobo.ts ya respeta
  // estado.pausado). Volver a arrastrar retoma el control normal y cierra la tarjeta (abajo).
  useEffect(() => {
    arrastre.setPausado(seleccionId !== null)
  }, [seleccionId, arrastre])

  // Precarga las noticias del pin apenas se resalta (hover) — para cuando el usuario de verdad
  // lo toca/clickea, probablemente ya este la respuesta.
  useEffect(() => {
    if (!resaltadoId) return
    const marcador = MARCADORES.find((m) => m.id === resaltadoId)
    if (marcador) precargarNoticias(marcador.simbolo, locale)
  }, [resaltadoId, locale])

  // Sin useCallback: no hay un hijo memoizado que necesite que esta referencia sea estable, y
  // envolverla disparaba react-hooks/preserve-manual-memoization (lee estadoRef.current dentro
  // del callback, el compilador no puede verificar que [arrastre] alcance como dependencia).
  const onPointerMoveZona = (e: React.PointerEvent<HTMLDivElement>) => {
    arrastre.handlers.onPointerMove(e)
    hoverClienteRef.current = arrastre.estadoRef.current.arrastrando ? null : { x: e.clientX, y: e.clientY }
  }
  const onPointerLeaveZona = () => {
    hoverClienteRef.current = null
  }

  const marcadorSeleccionado = seleccionId ? MARCADORES.find((m) => m.id === seleccionId) : undefined
  const cerrarTarjeta = useCallback(() => setSeleccionId(null), [])

  return (
    <div ref={contenedorRef} className="relative h-full w-full">
      <Canvas
        className="absolute inset-0"
        dpr={[1, 2]}
        gl={{
          // alpha:true + clearColor alpha 0 (abajo): el canvas es un cuadrado/circulo que
          // flota sobre el fondo ambiental de la seccion (grilla + glows). Con alpha:false
          // pintaba negro solido opaco en todo su rectangulo — un cuadro negro bien marcado
          // chocando contra ese fondo en vez de fundirse con el.
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          // Sin esto, R3F aplica ACESFilmicToneMapping por defecto — comprime y desatura los
          // azules oscuros de la esfera base hacia gris. El espacio de color se fija aparte
          // porque el default de three a veces no alcanza a aplicar el correcto antes del
          // primer frame.
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000', 0)
          // Un reset de GPU o una pestaña mucho tiempo en segundo plano puede perder el
          // contexto sin lanzar ningun error de React (LimiteErrorGlobo no lo atrapa) — sin
          // esto el canvas se queda congelado en negro sin aviso. Se avisa al padre para que
          // haga el mismo fallback estatico que ya existe para "sin WebGL".
          gl.domElement.addEventListener('webglcontextlost', (evento) => {
            evento.preventDefault()
            onContextLost?.()
          })
        }}
        frameloop={visible ? 'always' : 'never'}
        // A z=3.1 con fov 42 el semi-alto visible es ~1.19 — el anillo mas externo (radio 1.68)
        // y la base holografica (radio 1.9) quedaban recortados fuera de camara. A z=5.2 el
        // semi-alto es ~2.0, suficiente para encuadrar todo con margen.
        camera={{ position: [0, 0, 5.2], fov: 42 }}
      >
        <PerformanceMonitor onDecline={() => setCalidadAlta(false)} onIncline={() => setCalidadAlta(true)} flipflops={2} />
        <AjusteDpr alta={calidadAlta} />
        <Escena
          datos={datos}
          reducedMotion={reducedMotion}
          calidadAlta={calidadAlta}
          onReady={onReady}
          estadoArrastreRef={arrastre.estadoRef}
          stepArrastre={arrastre.step}
          hitsRef={hitsRef}
          toqueClienteRef={toqueClienteRef}
          hoverClienteRef={hoverClienteRef}
          seleccionId={seleccionId}
          resaltadoId={resaltadoId}
          onSeleccionar={abrirPorAccion}
          onResaltar={onResaltar}
          posicionPinRef={posicionPinRef}
          registrarHit={registrarHit}
          estadosSesion={estadosSesion}
        />
        {/* Montado siempre, sin gate condicional: montar/desmontar el EffectComposer en
            runtime pisa el manejo interno de gl.autoClear de la libreria en la transicion
            (lo prueba) y dejaba una estela/smear detras de lo que gira. El rectangulo blanco
            original durante la carga ya se soluciono por otro lado: NaN clamps en los shaders,
            renderOrder explicito y toneMapping/colorSpace fijos en el Canvas. */}
        <EffectComposer enabled={calidadAlta}>
          {/* El halo blanco no era la atmosfera (geometria, ya eliminada) — era el `radius` del
              propio Bloom (default 0.85, bastante ancho) esparciendo el brillo de los puntos/
              anillos hacia afuera, en el negro alrededor del globo. radius=0.2 lo mantiene
              pegado a los elementos brillantes en vez de formar un aura difusa por fuera. */}
          <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.3} radius={0.2} levels={5} />
          <Vignette darkness={0.5} />
        </EffectComposer>
      </Canvas>

      {/* Zona de arrastre: solo el circulo del globo, no todo el canvas, para que el scroll
          tactil fuera de el siga funcionando. */}
      <div
        className={clsx(
          'absolute left-1/2 top-1/2 size-[72%] -translate-x-1/2 -translate-y-1/2 touch-none rounded-full outline-none active:cursor-grabbing',
          resaltadoId ? 'cursor-pointer' : 'cursor-grab'
        )}
        style={{ touchAction: 'none' }}
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={arrastre.handlers.onPointerDown}
        onPointerMove={onPointerMoveZona}
        onPointerUp={arrastre.handlers.onPointerUp}
        onPointerCancel={arrastre.handlers.onPointerCancel}
        onPointerLeave={onPointerLeaveZona}
        onKeyDown={arrastre.handlers.onKeyDown}
      />

      {/* Lista accesible por teclado: Tab llega a cada pin aunque no se pueda arrastrar/tocar
          con el mouse (plan 009 §1.3). Invisible hasta recibir foco, mismo patron que el
          "saltar al contenido" del header. */}
      <ul className="sr-only">
        {MARCADORES.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="focus:not-sr-only focus:absolute focus:left-1/2 focus:top-1/2 focus:z-30 focus:-translate-x-1/2 focus:-translate-y-1/2 focus:rounded-full focus:bg-accent-cyan focus:px-3 focus:py-1.5 focus:text-micro focus:font-semibold focus:text-canvas"
              onClick={() => abrirPorAccion(m.id)}
            >
              {dict.home.globoMarcadores[m.nombreClave as keyof typeof dict.home.globoMarcadores] ?? m.simbolo}
            </button>
          </li>
        ))}
      </ul>

      {marcadorSeleccionado && (
        <TarjetaActivo
          key={marcadorSeleccionado.id}
          marcador={marcadorSeleccionado}
          locale={locale}
          cotizacion={datos.cotizacionesPines[marcadorSeleccionado.simbolo]}
          posicionRef={posicionPinRef}
          autoenfocar={autoenfocar}
          onHover={onHoverTarjeta}
          onCerrar={cerrarTarjeta}
        />
      )}
    </div>
  )
}
