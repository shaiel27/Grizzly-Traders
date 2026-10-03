'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import type { MutableRefObject } from 'react'

const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)
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
}

interface GloboHolograficoProps {
  datos: DatosGlobo
  reducedMotion: boolean
  ariaLabel: string
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

// 22k puntos (no 48k) y un sobremuestreo x24 (no x60): la primera carga ya no bloquea el
// hilo principal de forma perceptible. Con PerformanceMonitor en baja, se dibuja solo un
// subconjunto via setDrawRange — mucho mas barato que volver a muestrear.
const PUNTOS_OBJETIVO = 22000
const PUNTOS_OBJETIVO_BAJA = 11000

function PuntosTierraCapa({ urlMascara, calidadAlta }: { urlMascara: string; calidadAlta: boolean }) {
  const textura = useLoader(THREE.TextureLoader, urlMascara)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const puntos = useMemo(() => {
    const image = textura.image as CanvasImageSource
    const datosImagen = extraerImageData(image, 1024, 512)
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
}

function Escena({ datos, reducedMotion, calidadAlta, onReady, estadoArrastreRef, stepArrastre }: EscenaProps) {
  const grupoGlobo = useRef<THREE.Group>(null)
  const materialBase = useRef<THREE.ShaderMaterial>(null)
  const materialHolograma = useRef<THREE.ShaderMaterial>(null)

  const qY = useMemo(() => new THREE.Quaternion(), [])
  const qX = useMemo(() => new THREE.Quaternion(), [])
  const avisoListo = useRef(false)

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
    const { rotY, rotX } = estadoArrastreRef.current
    qY.setFromAxisAngle(UP, rotY)
    qX.setFromAxisAngle(RIGHT, rotX)
    if (grupoGlobo.current) {
      grupoGlobo.current.quaternion.copy(qX).multiply(qY)
      grupoGlobo.current.scale.setScalar(escalaGlobo)
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

export default function GloboHolografico({ datos, reducedMotion, ariaLabel, onReady, onContextLost }: GloboHolograficoProps) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const visible = useFrameloopVisible(contenedorRef)
  const [calidadAlta, setCalidadAlta] = useState(true)
  const reducedMotionRef = useRef(reducedMotion)
  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])
  // Una sola instancia: el div de abajo recibe los Pointer Events y actualiza `estadoRef`;
  // `Escena`, dentro del Canvas, lee ese mismo `estadoRef` en su useFrame para rotar el grupo.
  const arrastre = useArrastreGlobo(reducedMotionRef)

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
        className="absolute left-1/2 top-1/2 size-[72%] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full outline-none active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={arrastre.handlers.onPointerDown}
        onPointerMove={arrastre.handlers.onPointerMove}
        onPointerUp={arrastre.handlers.onPointerUp}
        onPointerCancel={arrastre.handlers.onPointerCancel}
        onKeyDown={arrastre.handlers.onKeyDown}
      />
    </div>
  )
}
