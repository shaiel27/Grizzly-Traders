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
import { extraerImageData, muestrearPuntosTierra, type PuntosTierra } from './muestrearTierra'
import { useArrastreGlobo, type EstadoArrastreGlobo } from './useArrastreGlobo'
import { PinesActivos } from './PinesActivos'
import { TarjetaActivo, precargarNoticias, type PosicionPin } from './TarjetaActivo'
import { NodosSesion } from './NodosSesion'
import { MARCADORES, simboloNoticias } from '@/lib/globe/marcadores'
import type { EstadoSesion } from '@/lib/globe/sesiones'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'
import type { MutableRefObject } from 'react'

const COLOR_PUNTOS = '#7fd4ff'
const COLOR_BORDE = '#4fc3ff'
const COLOR_BASE = '#020a18'
// V2 — el anillo HUD del delta de BTC se pintaba siempre en cian pese a que datos.deltaPositivo
// ya dice el signo: un -2.4% se leia identico a un +2.4% y el color no comunicaba nada. Hex
// local con el token al lado (mismo patron que PinesActivos.tsx/NodosSesion.tsx/shaders.ts):
// THREE.Color y el canvas 2D no leen variables CSS, asi que el mapa hex -> token va explicito.
const COLOR_DELTA_POSITIVO = '#22c55e' // --semantic-success
const COLOR_DELTA_NEGATIVO = '#ff3b30' // --semantic-danger
// V5 — segunda linea de la etiqueta del tercer anillo: --accent-cyan-soft (#7fd4ff = 127,212,255)
// atenuado para que el subtexto quede un escalon por debajo del dato principal sin salirse de la
// familia cian del HUD.
//
// V8 — 0.65 -> 0.68. NO es un cambio de jerarquia: es la compensacion exacta de que el relleno
// de la placa pase de 0.88 a opaco (ver F0-21 abajo). Este color se compone en el canvas 2D
// SOBRE el relleno, asi que su pixel final depende del alpha del relleno:
//   relleno 0.88 + subtexto 0.65 -> rgb(88,148,179)
//   relleno 1.00 + subtexto 0.68 -> rgb(88,148,180)
// o sea el subtexto se dibuja con el MISMO pixel que hoy (1 nivel de diferencia en azul); lo
// unico que cambia es que ese pixel deja de depender de lo que haya detras de la placa. Sin
// este ajuste, el relleno opaco le quitaria al subtexto el aporte que hoy recibe del propio
// relleno translucido y perderia un 4.5% de contraste sobre negro (5.73:1 -> 5.47:1 por
// aritmetica del composite 2D) justo en el elemento mas debil del HUD. La jerarquia no se
// mueve: la separacion con la linea 1 la siguen cargando el tamanio (11 vs 14) y el peso
// (500 vs 600), y el salto de 0.03 en alpha es invisible al lado de eso.
const COLOR_SUBETIQUETA = 'rgba(127, 212, 255, 0.68)'

// ---------------------------------------------------------------------------
// V6 — los aros HUD: de orbita decorativa a instrumento
//
// Antes: tres lineLoop concentricos con lineDashedMaterial cian, los tres a opacidad 0.35, con
// inclinaciones (81.8/70.6/97.3), velocidades y desplazamientos distintos, cada uno con una
// esferita en [radio,0,0]. Dos problemas: (a) tres circulos DISCONTINUOS concentricos girando
// alrededor de un globo oscuro es la decoracion "holografica" por defecto, y el guion es el
// delator principal; (b) los tres aros llevan metricas reales pero las presentan como tres
// orbitas identicas, asi que la forma dice "adorno" mientras el contenido dice "instrumento".
//
// Ahora: trazo continuo, jerarquia por opacidad, el aro del delta convertido en gauge graduado
// de verdad, la esferita reconvertida en aguja del gauge (y eliminada donde no media nada), y
// las tres inclinaciones juntas en un abanico de 8 grados para que se lean como un solo
// ensamblaje apilado.
// ---------------------------------------------------------------------------

const grados = (g: number) => (g * Math.PI) / 180

// ---------------------------------------------------------------------------
// V7 — contener el gauge y devolver jerarquia a los aros
//
// V6 acerto en graficar la unica metrica con rango, y erro la DOSIS. En pantalla, con un delta
// de -2.5%, la banda dibujaba 160 grados de rojo saturado, con grosor real, en el aro mas
// externo del HUD y orbitando sin parar: el elemento mas llamativo de la home entera. Un -2.5%
// no es una emergencia y no puede leerse como una alarma. Cada decision de V6 era defendible
// por separado (grosor + color del signo + recorrido de 320 grados + radio exterior); juntas
// hacian una serpiente alrededor del planeta.
//
// Las cuatro palancas, en orden de impacto medido sobre el area de la banda a -2.5%:
//   arco    320 -> 135 grados de recorrido maximo (a -2.5%: 160 -> 67.5 grados)
//   radio   el gauge baja al aro INTERIOR (1.5 -> 1.35), enmarcado por los otros dos hairlines
//           en vez de ser la silueta exterior de la pagina
//   grosor  0.024 -> 0.016 (3.2 CSS px a 800px de alto de canvas, contra el hairline de 1px)
//   alpha   0.85 -> 0.72, el maximo recorte que deja la banda por encima de 3:1 (WCAG 1.4.11)
// Area de la banda a -2.5%: 0.1005 -> 0.0254 unidades^2 (-74.7%); "tinta" (area * alpha) -78.6%.
// El dato no se esconde: 67.5 grados de arco a 3.25:1 de contraste se leen de un vistazo, y la
// etiqueta de la misma placa sigue imprimiendo el numero exacto.
// ---------------------------------------------------------------------------

// Jerarquia de trazo. WebGL ignora linewidth > 1 (limitacion del driver, no de three), asi que
// el "peso" de un lineLoop no es ajustable: la jerarquia de los tres circulos de referencia la
// carga la OPACIDAD, y el unico peso real del HUD — una banda con grosor en unidades de mundo —
// se gasta entero en el gauge, que es lo unico que codifica un dato en su forma.
//
// V7 — la escalera de V6 (0.50 / 0.16 pista / 0.20 contexto) tenia dos defectos y por eso los
// tres aros se leian como circulos tenues sin jerarquia: (a) los dos tramos de abajo quedaban
// pegados (0.16 vs 0.20 son 1.31:1 y 1.43:1 sobre --globe-base: indistinguibles), y (b) la
// escalera iba al REVES de la importancia — el aro ambiental brillaba MAS que la pista del
// aro que lleva el dato. Ahora es monotona con la importancia y con pasos de ~2.5x medidos en
// contraste-sobre-fondo (ratio - 1), que es la unidad en la que el ojo compara hairlines:
//   0.55 precio    3.66:1 (ratio-1 = 2.66) — el dato ancla: dice QUE instrumento se esta
//                  leyendo (BTC/USD). Un precio no tiene rango natural: solo se etiqueta.
//   0.34 dial      2.08:1 (ratio-1 = 1.08) — la cara del instrumento: pista + graduacion del
//                  gauge, un solo peso porque son una sola cosa ("esta es la escala"). Queda
//                  muy por debajo de su propia banda de valor (anatomia de gauge), pero ya es
//                  una linea y no un fantasma.
//   0.18 contexto  1.37:1 (ratio-1 = 0.37) — recuentos de noticias/activos: ambiente. Es la
//                  orbita de su etiqueta, no un dato; la placa es la que se lee.
const OPACIDAD_ARO_PRECIO = 0.55
const OPACIDAD_DIAL_GAUGE = 0.34
const OPACIDAD_ARO_CONTEXTO = 0.18
// 0.72 es el piso: a 0.70 el rojo cae a 3.12:1 y a 0.65 a 2.82:1, por debajo del minimo 3:1 de
// WCAG 1.4.11 para indicadores no textuales. Medido compuesto sobre --globe-base (#020a18):
// rojo #ff3b30 -> rgb(184,45,41) = 3.25:1; verde #22c55e -> rgb(25,145,74) = 4.90:1. El fondo
// REAL detras del aro (el canvas es alpha:true sobre la seccion bg-black del hero) es un pelo
// mas oscuro, asi que ahi mide 3.39:1 / 4.99:1 — medir contra --globe-base es el caso adverso.
// Nota: la banda nunca florecia. Con luminancia compuesta 0.1223 esta por debajo del
// luminanceThreshold 0.3 del Bloom; lo que la hacia gritar era el AREA, no el postproceso.
const OPACIDAD_BANDA_GAUGE = 0.72

// Mapeo magnitud -> angulo del gauge del delta. LINEAL (el angulo es proporcional al valor: una
// escala no lineal mentiria sobre la magnitud) y ACOTADO: el tope son 5 puntos porcentuales, que
// para BTC ya es "dia grande". Un delta de 15% no se sale del tope — queda clavado ahi, y el
// valor exacto nunca se pierde porque la etiqueta de la misma placa sigue imprimiendo el numero.
//
// V7 — el recorrido maximo baja de 320 a 135 grados. 320 grados es casi una vuelta completa: un
// gauge que rodea el objeto que mide deja de leerse como gauge y pasa a ser el contorno del
// objeto. 135 grados (3/8 de vuelta) es un sector abierto inequivoco, mantiene 27 grados de
// resolucion por punto porcentual — suficiente para distinguir a ojo 1% de 2% — y deja la banda
// en proporcion con el resto del HUD en vez de dominarlo. El caso topado sigue distinguiendose
// de la pista completa por construccion, asi que el margen de 40 grados que justificaba el 320
// deja de hacer falta.
const DELTA_TOPE_PCT = 5
const ARCO_TOPE_RAD = grados(135)
// Grosor de la banda en unidades de mundo. A z=5.2 con fov 42 el semi-alto visible es ~2.0: en
// un canvas de 800px de alto esto son 3.2 CSS px (2.4 px en el canvas minimo de 590) contra el
// hairline de 1px de los otros aros. Sigue siendo la unica diferencia de PESO real del HUD — y
// por eso la banda sigue mandando dentro del gauge — pero ya no es un listón de 4.8 px.
const GRUESO_BANDA_GAUGE = 0.016
// Graduacion: un tick por punto porcentual, hacia DENTRO de la pista (la banda crece hacia
// fuera, asi que escala y relleno nunca se tapan). El del tope va mas largo porque marca el
// techo. Con 135 grados de recorrido los cinco ticks quedan a 27 grados uno de otro — antes, a
// 320 grados, estaban a 64 y la escala se leia mas como adorno radial que como graduacion.
const LARGO_TICK_MENOR = 0.02
const LARGO_TICK_TOPE = 0.038
// Aguja: caja radial que cruza la pista y la banda en la punta del arco. Un tick radial lee como
// indicador de instrumento; la esferita de antes, en [radio,0,0] fijo, no media nada.
//
// V7 — 0.07 -> 0.052 para que siga sobresaliendo de la banda (eso es lo que la hace aguja y no
// un trozo de banda) sin convertirse en una espina: asi cubre exactamente la franja graduada,
// de la punta de los ticks menores (radio - 0.02) al borde externo de la banda. Es el UNICO
// elemento del gauge que conserva color pleno (5.59:1 el rojo, 8.70:1 el verde): mide ~10 x 2.6
// CSS px, asi que concentra la saliencia donde esta el valor exacto en vez de repartirla por 67
// grados de arco. Es la dosis que V6 gasto en la banda, devuelta al elemento mas chico.
const LARGO_AGUJA = 0.052
const ANCHO_AGUJA = 0.013
const ESPESOR_AGUJA = 0.01

// Una sola velocidad para los tres aros, no tres. Con velocidades distintas los aros se leen como
// tres orbitas sueltas que casualmente comparten centro; con una sola giran como un ensamblaje
// rigido, que es la lectura buscada. Ademas es lo que hace demostrable la separacion de etiquetas
// (ver FASES_AROS). Nota: al quitar el guion, la rotacion de un circulo continuo es invisible por
// definicion (un circulo girando sobre su propio eje no cambia de forma) — lo que se ve girar son
// las ETIQUETAS y la banda del gauge, es decir los datos, no el adorno.
const VELOCIDAD_AROS = 0.08
// Fases fijas a 120 grados. Con una velocidad comun la separacion angular es rigida para siempre,
// y eso convierte el solape de etiquetas de "inherente al diseño" a imposible: medido sobre el
// barrido completo de phi, la holgura minima entre cualquier par de placas es de +225 px en un
// canvas de 800 (con las tres velocidades distintas de antes, 7.1% de los estados de fase se
// solapaban, el peor caso con las placas pisandose ~30px). La placa opaca de F0-21 deja de ser
// un parche para los cruces y pasa a ser solo contraste.
//
// V7 — ni la velocidad ni las fases se tocan. Si se cambian las INCLINACIONES o que metrica va
// en que radio (las dos cosas pasaron en V7) hay que re-correr el barrido, porque las placas
// cambian de tamanio y de orbita aunque la separacion angular siga siendo 120 grados: el numero
// de arriba es el del barrido ya re-corrido para 66/73/86, ver el bloque de `anillos`.
const FASES_AROS = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]
// La etiqueta se ancla al radio de SU aro (0.88 del radio, antes 0.78): asi queda dentro de la
// banda de su propio aro en vez de flotar a media altura entre el globo y el aro, que es parte
// de por que las tres se leian como texto suelto y no como la lectura de ese aro. De paso la del
// aro interior sale de encima de los puntos de tierra, donde su contraste era el peor.
const FACTOR_RADIO_ETIQUETA = 0.88
// Un solo desplazamiento Y para los tres (antes 0.1/0.16/0.22 escalonados). El escalonamiento
// buscaba separar las etiquetas en pantalla, pero con inclinaciones cercanas a 90 grados el eje Y
// local mapea casi entero a PROFUNDIDAD, no a altura de pantalla: aportaba 2-5px de separacion
// vertical y, de paso, tres sesgos de profundidad distintos, o sea tres tamanios de texto en
// pantalla levemente distintos. Unificado en 0.22 (el MAYOR de los tres anteriores) la separacion
// la hace FASES_AROS y el tamanio del texto queda identico en los tres aros.
// V7 — con el abanico abierto a 66/73/86 el tamanio en pantalla ya NO es identico en los tres
// aros: el eje Y local vuelve a tener componente de altura y, sobre todo, la orbita del aro
// interior gana profundidad real (ver el bloque de `anillos`). F0-01 re-verificado ahi con el
// piso de pixeles medido, no con escalas normalizadas.
const DESPLAZAMIENTO_ETIQUETA_Y = 0.22

// Scratch de raycastPin reutilizados entre frames (F5): Array.from(hitsRef.values()) alocaba
// un array de 8 refs y raycaster.intersectObjects() otro de resultados EN CADA frame mientras
// hay puntero sobre la zona del globo (60fps). Se vacian y rellenan en su propio sitio: el
// raycast nunca se anida ni corre en dos hilos, asi que el reuse es seguro. intersectObjects
// NO limpia el tercer argumento por si solo (ver three/src/core/Raycaster.js), por eso el
// length=0 explicito antes de llamarlo.
const objetosRaycast: THREE.Object3D[] = []
const hitsRaycast: THREE.Intersection[] = []

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
  // Score -1..1 por region (1=EEUU, 2=Eurozona, 3=Reino Unido, 4=Japon, 5=China, 6=Australia —
  // ver scripts/build-globe-mask.mjs) para el mapa de calor del sentimiento (plan 009 §3.2).
  sentimientoPorRegion: Record<number, number>
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

// Banda de valor del gauge: un RingGeometry parcial, que es la unica forma de tener GROSOR real
// (un lineLoop queda clavado en 1px). Crece hacia FUERA desde el radio de la pista, nunca hacia
// dentro: la pista es la linea base y la banda es relleno sobre esa base, igual que una barra
// apoyada en su eje. thetaSegments proporcional al arco para no gastar 128 segmentos en un
// arco de 20 grados ni dejar poligonal el arco del tope (135 grados -> 60 segmentos, 2.25 por
// segmento).
function construirBandaGauge(radio: number, grosor: number, inicio: number, extension: number): THREE.BufferGeometry {
  const segmentos = Math.max(6, Math.round((160 * extension) / (Math.PI * 2)))
  return new THREE.RingGeometry(radio, radio + grosor, segmentos, 1, inicio, extension)
}

// Graduacion del gauge: un tick radial corto por punto porcentual, hacia dentro de la pista, en
// el MISMO sentido en que barre la banda (el gauge muestra su escala solo del lado que esta
// leyendo — una escala simetrica a los dos lados serian 10 ticks y una lectura ambigua). Sin esto
// la banda seria una extension vaga; con esto se puede leer el valor del aro, que es lo que
// separa un instrumento de un adorno.
function construirGraduacionGauge(radio: number, sentido: number): THREE.BufferGeometry {
  const puntos: number[] = []
  for (let paso = 1; paso <= DELTA_TOPE_PCT; paso++) {
    const a = sentido * (paso / DELTA_TOPE_PCT) * ARCO_TOPE_RAD
    const largo = paso === DELTA_TOPE_PCT ? LARGO_TICK_TOPE : LARGO_TICK_MENOR
    const cos = Math.cos(a)
    const sen = Math.sin(a)
    puntos.push(radio * cos, 0, radio * sen, (radio - largo) * cos, 0, (radio - largo) * sen)
  }
  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3))
  return geometria
}

// Extension angular de la banda: lineal y acotada (ver DELTA_TOPE_PCT/ARCO_TOPE_RAD).
function extensionGauge(magnitud: number | null): number {
  if (magnitud === null || !Number.isFinite(magnitud)) return 0
  return (ARCO_TOPE_RAD * Math.min(Math.abs(magnitud), DELTA_TOPE_PCT)) / DELTA_TOPE_PCT
}

// V2 — el trazo de la placa estaba fijo en rgba(79,195,255,0.25) (--accent-cyan con alpha), asi
// que un delta en rojo quedaba enmarcado en cian: el hairline y el texto se contradecian. Ahora
// se tiñe desde el MISMO hex del texto manteniendo alpha 0.25, y la placa se lee como una pieza
// (texto verde -> borde verde). Para los anillos 0 y 2 el cambio es #4fc3ff -> #7fd4ff al 25% en
// una linea de 1px: el hairline pasa a ser el cian emisivo de los puntos del globo, que es el
// color que ya tiene su propio texto. El RELLENO (rgba(5,12,20,0.88)) no se toca: es el contrato
// de legibilidad de F0-21. El fallback cubre un hex que no sea #rrggbb, porque un strokeStyle
// invalido no lanza — el canvas lo ignora en silencio y pinta el negro por defecto.
// P5 — base del tamaño del punto de tierra y el alto de lienzo para el que esta calibrada (el
// lienzo asentado de desktop). Ver el useEffect de uTam: el punto escala con el lienzo porque el
// shader lo mide contra una constante dura y el globo si encoge.
const TAM_PUNTO_BASE = 0.09
const ALTO_LIENZO_REF = 655

// Fuera del componente a proposito: el compilador de React no deja mutar desde el hook un valor
// memoizado, y aqui escribir el uniform directamente es justo lo que se quiere (mismo motivo y
// mismo remedio que ponerTransform en useIntroInicio.ts).
function ponerTamPunto(uniforms: { uTam: { value: number } }, alto: number) {
  uniforms.uTam.value = TAM_PUNTO_BASE * Math.max(0.5, Math.min(1, alto / ALTO_LIENZO_REF))
}

const ALPHA_TRAZO_PLACA = 0.25
function trazoPlacaDesde(colorHex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(colorHex)) return `rgba(79, 195, 255, ${ALPHA_TRAZO_PLACA})`
  const n = parseInt(colorHex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${ALPHA_TRAZO_PLACA})`
}

// Radio de esquina FIJO en unidades CSS, no proporcional al alto (V5): para una linea vale
// exactamente lo mismo que el `alto * 0.3` de antes (30*4*0.3 = 36 = 9*4), pero la placa de dos
// lineas mide 46*escala y con la formula proporcional su esquina habria crecido a 55 — las tres
// placas del HUD son el mismo componente y tienen que compartir el radio absoluto, o la de dos
// lineas se lee como una pastilla de otra familia.
const RADIO_PLACA_CSS = 9
const ALTO_PLACA_CSS = 30
const ALTO_PLACA_DOS_LINEAS_CSS = 46

// Las 3 etiquetas giran cada una a su propia velocidad — en algun momento dos se van a cruzar
// en pantalla, es inherente al diseño. La placa de fondo (en vez de texto transparente puro)
// es lo que evita que el cruce se lea como texto ilegible superpuesto.
//
// V5 — `subtexto` opcional en vez de un array de lineas con estilos: es el cambio minimo que no
// obliga a tocar los otros dos llamadores. Sin subtexto la geometria es identica a la de antes
// (placa de 30*escala, radio 36, una sola linea centrada en alto/2 — mismo pixel), asi que los
// anillos 0 y 2 no regresan; lo unico que les cambia es el tinte del hairline de V2, arriba.
// `factorAlto` sale al llamador para que pueda compensar el alto de mundo del sprite (ver
// altoEtiqueta en AnilloHud): la placa mas alta NO debe traducirse en texto mas chico en pantalla.
function crearTexturaEtiqueta(
  texto: string,
  color = COLOR_PUNTOS,
  subtexto?: string
): { textura: THREE.CanvasTexture; proporcion: number; factorAlto: number } {
  const escala = 4
  const dosLineas = Boolean(subtexto)
  const altoCss = dosLineas ? ALTO_PLACA_DOS_LINEAS_CSS : ALTO_PLACA_CSS
  const alto = altoCss * escala
  const fuentePrincipal = `600 ${14 * escala}px Inter, sans-serif`
  const fuenteSecundaria = `500 ${11 * escala}px Inter, sans-serif`
  const medidor = document.createElement('canvas').getContext('2d')
  let anchoTexto = 160 * escala
  if (medidor) {
    medidor.font = fuentePrincipal
    anchoTexto = Math.ceil(medidor.measureText(texto).width)
    // La placa se mide contra la MAS ANCHA de las dos lineas: la secundaria usa una fuente mas
    // chica pero puede llevar mas caracteres, y midiendo solo la primera se recortaria.
    if (subtexto) {
      medidor.font = fuenteSecundaria
      anchoTexto = Math.max(anchoTexto, Math.ceil(medidor.measureText(subtexto).width))
    }
  }
  const padding = 14 * escala
  const ancho = anchoTexto + padding * 2
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const radio = RADIO_PLACA_CSS * escala
    // F0-21 — placa alpha 0.72 -> 0.88 (mismo fondo que la tarjeta de activo): con el texto
    // moviendose sobre los puntos del globo, al 0.72 el fondo no aislaba suficiente y las
    // etiquetas se leian encima del continente.
    //
    // V8 — 0.88 -> 1. F0-21 permite SUBIR la opacidad, y aqui hay que subirla hasta el tope.
    //
    // Las tres etiquetas ORBITAN, y el punto mas bajo de su orbita cae sobre el nucleo del halo
    // del suelo holografico (la base aditiva de radio 1.9 en y=-1.35). Medido en captura real,
    // hero 1600x900, los MISMOS pixeles antes y despues, con la placa de noticias en su peor
    // fase (centro al 87.5% del alto del canvas):
    //   halo desnudo al lado de la placa   rgb(76,188,246)  L = 0.4416   (sin cambio: 0.4309)
    //   cuerpo de la placa, alpha 0.88     rgb(15, 45, 63)  L = 0.02337
    //   cuerpo de la placa, alpha 1.00     rgb( 6, 15, 23)  L = 0.00442  (x5.3 mas oscuro)
    // Contra un fondo a L=0.44, el 12% que dejaba pasar el 0.88 multiplicaba por 5 la
    // luminancia del cuerpo de la placa; y como el halo es un degradado, la placa no se aclaraba
    // de forma pareja — recogia el gradiente del resplandor por dentro y dejaba de leerse como
    // una pieza solida. Contraste del texto en esa misma fase:
    //   linea 1 (14px/600)   10.19:1 -> 13.76:1
    //   linea 2 (11px/500)    6.78:1 ->  8.95:1
    // Lo que importa no es solo que suba, es que deja de MOVERSE: a lo largo de la orbita la
    // linea 2 variaba un 27.3% (9.32:1 sobre negro vs 6.78:1 sobre el halo) y ahora varia un
    // 2.0% (9.13 vs 8.95). Un readout que orbita tiene que leerse igual en toda la vuelta.
    //
    // Alternativa descartada: mover la ORBITA. La banda de pantalla donde el halo tiene cuerpo
    // empieza en el 76% del alto y el punto bajo de la etiqueta esta en el 87.5%; subirlo al 76%
    // exige bajar la amplitud world-Y de 1.475 a 0.996, o sea FACTOR_RADIO_ETIQUETA 0.594 (la
    // placa quedaria a radio de mundo 0.998, DENTRO de la silueta del globo — la regresion que
    // V5 arreglo subiendo 0.78 -> 0.88) o inclinacion 42 grados en el aro exterior (achatamiento
    // 0.673, que invierte la escalera monotona 0.914/0.956/0.998 de V7). El halo ocupa justo la
    // banda por la que pasa el fondo de CUALQUIER aro concentrico con el globo: no hay orbita
    // que lo esquive, asi que la legibilidad tiene que dejar de depender del fondo.
    ctx.fillStyle = 'rgba(5, 12, 20, 1)'
    ctx.beginPath()
    ctx.roundRect(0, alto * 0.12, ancho, alto * 0.76, radio)
    ctx.fill()
    ctx.strokeStyle = trazoPlacaDesde(color)
    ctx.lineWidth = 1 * escala
    ctx.stroke()

    // Bloque de texto centrado en la placa como una unidad, no linea por linea: cada linea ocupa
    // una caja de su propio tamanio de fuente y el separador son 4 CSS px entre cajas (con
    // textBaseline 'middle' eso deja 16.5 CSS px de baseline a baseline — 4px literales entre
    // baselines de 14px y 11px harian que los glifos se pisaran). Con una sola linea el bloque ES
    // la linea, el centro cae en alto/2 y sale el mismo pixel que antes.
    const altoLinea1 = 14 * escala
    const altoLinea2 = 11 * escala
    const separacion = 4 * escala
    const altoBloque = dosLineas ? altoLinea1 + separacion + altoLinea2 : altoLinea1
    const topeBloque = alto / 2 - altoBloque / 2

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = fuentePrincipal
    ctx.fillStyle = color
    ctx.fillText(texto, ancho / 2, topeBloque + altoLinea1 / 2)
    if (subtexto) {
      ctx.font = fuenteSecundaria
      ctx.fillStyle = COLOR_SUBETIQUETA
      ctx.fillText(subtexto, ancho / 2, topeBloque + altoLinea1 + separacion + altoLinea2 / 2)
    }
  }
  const textura = new THREE.CanvasTexture(canvas)
  textura.needsUpdate = true
  textura.colorSpace = THREE.SRGBColorSpace
  return { textura, proporcion: ancho / alto, factorAlto: altoCss / ALTO_PLACA_CSS }
}

interface ConfigAnillo {
  // V6 — key estable, antes se usaba `etiqueta`: con el precio de BTC dentro del texto, cada
  // tick de cotizacion cambiaba la key y REMONTABA el AnilloHud entero, tirando y recreando sus
  // geometrias en GPU por un cambio de dato. La textura ya se rehace sola por useMemo.
  id: string
  radio: number
  inclinacionX: number
  // V6 — fase angular fija del aro (FASES_AROS). La velocidad ya no es por aro: es una sola
  // constante compartida, ver VELOCIDAD_AROS.
  faseInicial: number
  // V6 — opacidad del circulo de referencia. Antes los tres estaban clavados en 0.35, asi que
  // ninguno mandaba; ahora cada aro trae la suya (ver OPACIDAD_ARO_*).
  opacidadLinea: number
  etiqueta: string
  retraso: number
  // V2 — opcional: sin color, la etiqueta sigue en COLOR_PUNTOS (anillos 0 y 2, que no llevan
  // signo y no tienen nada que comunicar con el color). Solo el delta de BTC lo define.
  color?: string
  // V5 — opcional: segunda linea de la MISMA placa, un escalon tipografico por debajo de
  // `etiqueta`. Sin subetiqueta la placa queda exactamente como antes (30*escala, una linea).
  subetiqueta?: string
  // V6 — presente SOLO en el aro del delta: es la unica de las tres metricas con rango natural y
  // con signo, o sea la unica que se puede graficar y no solo etiquetar. `magnitud` viene con
  // signo; null cuando no hay cotizacion (datos.deltaBtc = '—') y ahi el gauge queda en cero.
  gauge?: { magnitud: number | null }
}

// Gauge del delta de BTC. Cuatro piezas, en orden INVERSO de saliencia — cuanto mas chico el
// elemento, mas fuerte puede ser, que es la regla que V6 no respeto:
//   pista         el circulo de referencia del propio AnilloHud, a OPACIDAD_DIAL_GAUGE (2.08:1)
//   graduacion    ticks radiales hacia dentro, un punto porcentual cada uno, al mismo peso
//   banda         el valor: 135 grados de recorrido maximo, grosor 0.016, alpha 0.72 (3.25:1 el
//                 rojo) — el unico elemento con grosor real, pero acotado en arco y en radio
//   aguja         tick radial de ~10x2.6 px en la punta de la banda, a color pleno (5.59:1): el
//                 indicador puntual, y el sitio donde se concentra la intensidad del gauge
// El sentido del barrido tambien lleva el signo: positivo barre en angulo local NEGATIVO, que con
// estas inclinaciones es antihorario en pantalla (sube desde la etiqueta); negativo barre horario
// (baja). Asi el signo viaja por tres canales a la vez — texto de la etiqueta, color y sentido —
// y ninguno es el unico (contrato WCAG 1.4.1).
function GaugeDelta({ radio, magnitud, color }: { radio: number; magnitud: number | null; color: string }) {
  const extension = extensionGauge(magnitud)
  const sentido = magnitud !== null && magnitud < 0 ? 1 : -1
  // Arco degenerado: con extension 0 (delta de 0.0% o sin cotizacion) RingGeometry devolveria una
  // tira vacia. Se omite la banda y queda la aguja sobre la pista, en el ancla — que es
  // exactamente la lectura correcta de "plano".
  const geoBanda = useMemo(
    () => (extension > 1e-4 ? construirBandaGauge(radio, GRUESO_BANDA_GAUGE, Math.min(0, sentido * extension), extension) : null),
    [radio, extension, sentido]
  )
  const geoGraduacion = useMemo(() => construirGraduacionGauge(radio, sentido), [radio, sentido])
  const geoAguja = useMemo(() => new THREE.BoxGeometry(LARGO_AGUJA, ESPESOR_AGUJA, ANCHO_AGUJA), [])

  // Mismo patron de limpieza que el resto del fichero, pero UN efecto por geometria y no uno
  // compartido: la banda se reconstruye en cada cambio de delta y con las tres en el mismo efecto
  // ese cambio disparaba la limpieza de las OTRAS dos, liberando en GPU geometrias que siguen
  // montadas (dispose() no rompe el render — three re-sube los buffers desde los arrays de CPU —
  // pero es trabajo de GPU regalado en cada tick de cotizacion).
  useEffect(() => {
    if (!geoBanda) return
    return () => geoBanda.dispose()
  }, [geoBanda])
  useEffect(() => () => geoGraduacion.dispose(), [geoGraduacion])
  useEffect(() => () => geoAguja.dispose(), [geoAguja])

  const anguloAguja = sentido * extension
  const radioAguja = radio + GRUESO_BANDA_GAUGE / 2

  return (
    <>
      {/* RingGeometry nace en el plano XY; rotation [PI/2,0,0] lo lleva al XZ con el MISMO mapeo
          angulo->posicion que construirAnillo (angulo a -> (cos a, 0, sin a)), asi que el arco y
          la pista comparten sistema de referencia. DoubleSide porque esa rotacion invierte la
          normal (mismo caso que la base holografica del suelo). */}
      {geoBanda && (
        <mesh geometry={geoBanda} rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={color} transparent opacity={OPACIDAD_BANDA_GAUGE} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* V7 — la graduacion comparte opacidad con la pista (OPACIDAD_DIAL_GAUGE): son la cara
          del instrumento, una sola cosa. A 0.22 los ticks eran invisibles y la escala no se
          podia leer, lo que dejaba la banda como una extension vaga en vez de una medida. */}
      <lineSegments geometry={geoGraduacion}>
        <lineBasicMaterial color={COLOR_BORDE} transparent opacity={OPACIDAD_DIAL_GAUGE} toneMapped={false} />
      </lineSegments>
      {/* rotation [0,-angulo,0] alinea el eje largo de la caja con la direccion radial. */}
      <mesh
        geometry={geoAguja}
        position={[radioAguja * Math.cos(anguloAguja), 0, radioAguja * Math.sin(anguloAguja)]}
        rotation={[0, -anguloAguja, 0]}
      >
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </>
  )
}

function AnilloHud({ config, reducedMotion }: { config: ConfigAnillo; reducedMotion: boolean }) {
  const grupoEntradaRef = useRef<THREE.Group>(null)
  const grupoRef = useRef<THREE.Group>(null)
  const geometria = useMemo(() => construirAnillo(config.radio), [config.radio])
  // V2/V5 — config.color y config.subetiqueta entran en las dependencias: sin ellas, un cambio
  // de signo del delta (cian -> rojo) o de la segunda linea reusaria la textura vieja, porque
  // la etiqueta de arriba puede no haber cambiado (ej. el delta se mantiene en 2.40% y solo gira
  // el signo). La textura anterior se libera en el cleanup del useEffect de abajo, que ya
  // depende de `textura`.
  const { textura, proporcion, factorAlto } = useMemo(
    () => crearTexturaEtiqueta(config.etiqueta, config.color ?? COLOR_PUNTOS, config.subetiqueta),
    [config.etiqueta, config.color, config.subetiqueta]
  )
  // F0-01 — a 0.09 la etiqueta quedaba en ~3.6-7.6px de alto en pantalla (ilegible): 0.16 la
  // deja por encima del minimo legible a la camara del hero.
  // V5 — el alto de mundo se escala por factorAlto (1 con una linea, 46/30 = 1.533 con dos), asi
  // que el anillo de dos lineas pasa de 0.16 a 0.2453. Si se quedara en 0.16 fijos, el canvas de
  // 46*escala se comprimiria en el mismo alto de mundo y la linea principal caeria al 65% de su
  // tamanio en pantalla — una regresion directa del contrato de legibilidad F0-01. Escalando los
  // dos a la par, la densidad canvas->mundo queda en 750px por unidad en ambos casos: la linea 1
  // se ve EXACTAMENTE igual que hoy y la 2 a 11/14 de ella, que es la jerarquia buscada.
  const altoEtiqueta = 0.16 * factorAlto
  // F0-01 — bajo 590px de alto de canvas (movil apaisado, hero muy recortado) las etiquetas
  // HUD no alcanzan tamanio legible ni con altoEtiqueta subido: se ocultan y el anillo solo
  // conserva su linea. Se lee del size del Canvas, no del contenedor DOM (mismo rectangulo).
  // V5 — el umbral sigue siendo uno solo para los tres anillos: con altoEtiqueta compensado, la
  // linea PRINCIPAL del anillo de dos lineas mide lo mismo en pantalla que la de los otros dos,
  // asi que 590px la cubre igual. La linea 2 queda a 11/14 de eso (~8.7px justo en el umbral, ~10-13px
  // en alturas de escritorio normales): es contexto secundario y bajarle la jerarquia es
  // precisamente el objetivo, subir altoEtiqueta hasta que la linea 2 tocara el piso de la 1 la
  // dejaria 27% mas grande que las etiquetas de los otros dos anillos y romperia el HUD.
  const tamanoCanvas = useThree((estado) => estado.size)
  const etiquetaVisible = tamanoCanvas.height >= 590

  // Sin esto, cada remount (navegacion away/back, Fast Refresh en dev) deja geometrias y
  // texturas de canvas huerfanas en la GPU — nunca se liberan solas.
  // V6 — separados en dos efectos. `textura` se rehace en CADA tick de cotizacion y `geometria`
  // nunca (depende solo de config.radio): en un efecto compartido, el cambio de textura disparaba
  // tambien geometria.dispose() sobre el aro que sigue en pantalla. Antes no se notaba porque la
  // key del AnilloHud era config.etiqueta y un cambio de precio REMONTABA el componente entero
  // (la limpieza corria de verdad al desmontar); con la key estable de V6 el remonte ya no pasa y
  // la limpieza compartida quedaria liberando lo que no toca.
  useEffect(() => () => geometria.dispose(), [geometria])
  useEffect(() => () => textura.dispose(), [textura])

  useFrame((state, dt) => {
    // F0-06: la ROTACION del anillo no se pausa con reducedMotion — decision explicita del
    // usuario (giro persistente de elementos decorativos, ver useArrastreGlobo.ts:169-174).
    // V6 — una sola velocidad compartida en vez de config.velocidad: los tres aros giran como
    // un ensamblaje rigido y eso es lo que fija la separacion de 120 grados entre etiquetas.
    if (grupoRef.current) grupoRef.current.rotation.y += VELOCIDAD_AROS * dt
    if (grupoEntradaRef.current) {
      const inicio = config.retraso / 1000
      // F0-15 — entra desde 0.7 (no desde scale 0): el pop desde 0 se leia como un circulo
      // dibujandose desde la nada; el tramo 0.7 -> 1 ya comunica "llega" sin perder la forma.
      const escala = reducedMotion ? 1 : 0.7 + 0.3 * easeOutCubic(progreso(state.clock.getElapsedTime(), inicio, inicio + 0.5))
      grupoEntradaRef.current.scale.setScalar(escala)
    }
  })

  return (
    <group ref={grupoEntradaRef} rotation={[config.inclinacionX, 0, 0]} scale={0.7}>
      {/* La fase vive en un grupo APARTE del que gira: grupoRef acumula su rotacion dentro de
          useFrame y si la fase se escribiera en el mismo nodo, un re-render que volviera a
          aplicar la prop `rotation` le pisaria lo acumulado y el aro saltaria. */}
      <group rotation={[0, config.faseInicial, 0]}>
        <group ref={grupoRef}>
          {/* V6 — se fue el lineDashedMaterial. El guion era el delator sci-fi numero uno y de
              paso obligaba a computeLineDistances() en un ref callback. Trazo continuo, y el
              peso lo da la opacidad de cada aro (WebGL ignora linewidth > 1). */}
          <lineLoop geometry={geometria}>
            <lineBasicMaterial color={COLOR_BORDE} transparent opacity={config.opacidadLinea} toneMapped={false} />
          </lineLoop>
          {/* V6 — la esferita de [radio,0,0] se fue de los aros sin rango (precio y contexto):
              no marcaba ningun valor, era decoracion. Sobrevive solo como AGUJA del gauge. */}
          {config.gauge && <GaugeDelta radio={config.radio} magnitud={config.gauge.magnitud} color={config.color ?? COLOR_PUNTOS} />}
          <sprite
            position={[config.radio * FACTOR_RADIO_ETIQUETA, DESPLAZAMIENTO_ETIQUETA_Y, 0]}
            scale={[altoEtiqueta * proporcion, altoEtiqueta, 1]}
            visible={etiquetaVisible}
          >
            <spriteMaterial map={textura} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
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

function PuntosTierraCapa({
  urlMascara,
  urlRegiones,
  calidadAlta,
  sentimientoPorRegion,
  reducedMotion,
}: {
  urlMascara: string
  urlRegiones: string
  calidadAlta: boolean
  sentimientoPorRegion: Record<number, number>
  reducedMotion: boolean
}) {
  // Array de URLs: carga las dos texturas en paralelo, un solo Suspense (el de Escena) cubre
  // ambas en vez de anidar un <Suspense> por textura.
  const [textura, texturaRegiones] = useLoader(THREE.TextureLoader, [urlMascara, urlRegiones])
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const [puntos, setPuntos] = useState<PuntosTierra | null>(null)

  // Diferido a un efecto, NO useMemo durante el render: muestrear 36k puntos (con chequeo de
  // costa vecino-a-vecino por candidato) tarda ~1-3s de CPU sincronicos — confirmado con
  // Lighthouse (auditoria de calidad, plan de diseño): una sola tarea bloqueaba el hilo principal
  // 10s bajo el throttling movil por defecto (~2.7s sin throttling), y como useMemo corre DURANTE
  // el render, bloqueaba el primer paint de TODA la pagina (header, ticker, texto del hero), no
  // solo del globo. Diferido asi, el resto de la pagina ya esta pintada e interactiva cuando esto
  // corre; el globo (que de todos modos ya espera su propio Suspense por las texturas) aparece un
  // instante despues con sus puntos, en vez de retener el primer paint del sitio entero.
  useEffect(() => {
    // setTimeout, no una llamada directa (react-hooks/set-state-in-effect): de paso, cede el
    // hilo principal al navegador un tick antes de arrancar el muestreo pesado, asi el paint ya
    // en curso (header, ticker, texto del hero) no espera a que esto termine para salir en pantalla.
    // muestrearPuntosTierra es async y cede el hilo varias veces mas por dentro (ver su propio
    // comentario) — `cancelado` evita escribir el resultado si el componente ya se desmonto o
    // cambiaron las texturas mientras tanto, dado que ahora puede tardar varios tramos en volver.
    let cancelado = false
    const id = setTimeout(async () => {
      const datosImagen = extraerImageData(textura.image as CanvasImageSource, 2048, 1024)
      const datosRegiones = extraerImageData(texturaRegiones.image as CanvasImageSource, 2048, 1024)
      const resultado = await muestrearPuntosTierra(datosImagen, PUNTOS_OBJETIVO, 1337, 1, datosRegiones)
      if (!cancelado) setPuntos(resultado)
    }, 0)
    return () => {
      cancelado = true
      clearTimeout(id)
    }
  }, [textura, texturaRegiones])

  const geometria = useMemo(() => {
    if (!puntos) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(puntos.positions, 3))
    geo.setAttribute('aBrillo', new THREE.BufferAttribute(puntos.aBrillo, 1))
    geo.setAttribute('aFase', new THREE.BufferAttribute(puntos.aFase, 1))
    geo.setAttribute('aVel', new THREE.BufferAttribute(puntos.aVel, 1))
    geo.setAttribute('aRegion', new THREE.BufferAttribute(puntos.aRegion, 1))
    return geo
  }, [puntos])

  useEffect(() => {
    if (!puntos || !geometria) return
    // F0-16 (revisado, documentado en vez de implementado): el corte 36k -> 18k es un salto de
    // densidad de un solo frame, no un corte geografico — muestrearTierra rellena en orden PRNG
    // uniforme sobre toda la esfera, asi que los primeros 18k puntos son un subconjunto repartido
    // por todo el globo y la mitad de densidad se nota como un thinning suave. Un cross-fade de
    // 400ms via uReveal excluiria fundir TODOS los puntos a 0 (uReveal no selecciona subrango) y
    // un dip visible del continente entero peor que el cambio de densidad que pretende tapar.
    geometria.setDrawRange(0, calidadAlta ? puntos.count : Math.min(puntos.count, PUNTOS_OBJETIVO_BAJA))
  }, [calidadAlta, puntos, geometria])

  useEffect(() => {
    if (!geometria) return
    return () => {
      geometria.dispose()
    }
  }, [geometria])

  // Hora en que empieza la rampa de reveal (F0-08): el primer frame en que el material existe
  // — que es exactamente el frame en que PuntosTierraCapa asigna geometria y deja de returnear
  // null. Desde ahi, uReveal hace 0 -> 1 en 800ms easeOutCubic en el bloque de abajo.
  const inicioRevealRef = useRef<number | null>(null)
  useFrame((state) => {
    if (!materialRef.current) return
    const uniforms = materialRef.current.uniforms
    // F0-06 — con reducedMotion el reloj del shader se congela en 0: parpadeo/pulso de los
    // puntos queda un patron estatico (la forma de cada punto y su brillo base siguen ahi).
    // El reveal ademas arranca ya completado (sin rampa de entrada).
    if (reducedMotion) {
      uniforms.uTiempo.value = 0
      uniforms.uReveal.value = 1
      return
    }
    const t = state.clock.getElapsedTime()
    uniforms.uTiempo.value = t
    if (inicioRevealRef.current === null) inicioRevealRef.current = t
    uniforms.uReveal.value = easeOutCubic(progreso(t, inicioRevealRef.current, inicioRevealRef.current + 0.8))
  })

  // Array de 8 (indice 0 sin usar, 1-6 = regiones) para que coincida con uniform float
  // uSentimiento[8] del shader — WebGL no acepta un array mas chico que el declarado.
  const arregloSentimiento = useMemo(() => {
    const arr = new Array(8).fill(0)
    for (let i = 1; i <= 6; i++) arr[i] = sentimientoPorRegion[i] ?? 0
    return arr
  }, [sentimientoPorRegion])

  const uniforms = useMemo(
    () => ({
      uTiempo: { value: 0 },
      uTam: { value: TAM_PUNTO_BASE },
      uColor: { value: new THREE.Color(COLOR_PUNTOS) },
      // uReveal (F0-08): arranca en 0 (rampa en useFrame al montar el material) o ya en 1 con
      // reducedMotion — sin el frame intermedio invisible.
      uReveal: { value: reducedMotion ? 1 : 0 },
      uSentimiento: { value: arregloSentimiento },
    }),
    [arregloSentimiento, reducedMotion]
  )

  // P5 — el tamaño del punto de tierra tiene que escalar con el lienzo, y no lo hacia.
  // `gl_PointSize` en shaders.ts multiplica por una constante dura `300.0 / -mvPosition.z`, asi
  // que el punto mide lo mismo en pixeles pase lo que pase... pero el GLOBO si encoge: el lienzo
  // asentado son 655px en desktop y 343px en movil (0.524x). Resultado medido sobre capturas,
  // normalizando por diametro de globo: en movil la cobertura de puntos de tierra es del 33.5%
  // contra el 10.7% de desktop (x3.1) y la luminancia mediana del punto casi dobla. Esa trama
  // sobresaturada es lo que se tragaba los pines en movil — contra un punto quemado a blanco el
  // techo de contraste de cualquier tinta clara es 1.65:1, asi que ningun rediseño del pin podia
  // ganar esa pelea desde dentro.
  // Se corrige escalando uTam con el lienzo en vez de tocar el shader: `min(1, alto/655)` es
  // no-op exacto en desktop (655/655 = 1) y deja la cobertura movil en ~10%, la misma que
  // desktop. El suelo de 0.5 evita que en un lienzo diminuto los puntos caigan bajo el clamp de
  // 1px del shader, donde dejarian de verse del todo.
  // Via useEffect y NO en las deps del useMemo de arriba a proposito: recrear el objeto uniforms
  // reiniciaria uReveal a 0 y la rampa de 800ms (F0-08) volveria a dispararse en cada resize.
  const altoLienzoPuntos = useThree((estado) => estado.size.height)
  useEffect(() => {
    ponerTamPunto(uniforms, altoLienzoPuntos)
  }, [altoLienzoPuntos, uniforms])

  // Nada que dibujar todavia (el muestreo del efecto de arriba no termino): el resto del globo
  // (esfera base, anillos, pines) ya se ve, los puntos de tierra aparecen apenas esten listos —
  // y entonces con la rampa de reveal de 800ms (F0-08), no de golpe.
  if (!geometria) return null

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
  // Vectores pre-asignados para la proyeccion del pin seleccionado (patron posicionMundoPin):
  // el bloque de abajo corria 1x por frame mientras hay tarjeta abierta y alocaba 3 Vector3
  // nuevos por frame con .clone() (dos para los dot, uno para .project()).
  const direccionPin = useMemo(() => new THREE.Vector3(), [])
  const direccionCamara = useMemo(() => new THREE.Vector3(), [])
  const proyeccionPin = useMemo(() => new THREE.Vector3(), [])
  const avisoListo = useRef(false)
  // Ultimo id que llego a onResaltar: el raycast de hover corre 1x por frame y sin esto se le
  // pasaba el MISMO id 60 veces/s, disparando 4 setState (resaltadoId, seleccionId,
  // autoenfocar, tarjetaCerrando) por frame — a lo sumo re-bailaban en React, pero seguian
  // siendo llamadas y dispatches sin necesidad. Solo cambia la accion cuando cambia el pin.
  const resaltadoPrevioRef = useRef<string | null>(null)

  // Comparte el raycaster del frame actual contra el registro de pines — usado tanto para el
  // tap (seleccion) como el hover (resaltado). Devuelve el id del pin mas cercano o null.
  const raycastPin = (raycaster: THREE.Raycaster, camera: THREE.Camera, domElement: HTMLElement, clientX: number, clientY: number): string | null => {
    const rect = domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    ndcToque.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(ndcToque, camera)
    objetosRaycast.length = 0
    for (const obj of hitsRef.current.values()) objetosRaycast.push(obj)
    hitsRaycast.length = 0
    const hits = raycaster.intersectObjects(objetosRaycast, false, hitsRaycast)
    if (hits.length === 0) return null
    if (hits.length === 1) return (hits[0].object.userData.id as string | undefined) ?? null
    // F0-09 — con la esfera de golpe tactil (0.12) dos pines vecinos pueden solapar esferas
    // (WTI y gasLuisiana estan a ~0.138 de corda): el primero en profundidad no siempre es el
    // que se toco, asi que entre varios hits gana el pin cuyo centro queda MAS CENTRADO bajo el
    // dedo (menor distancia perpendicular del rayo a su centro). Preferencia en raycastPin, no
    // en el radio: subirlo mas empeoraria el solape.
    let mejorId: string | null = null
    let mejorDistancia = Infinity
    for (const hit of hits) {
      hit.object.getWorldPosition(posicionMundoPin)
      const distancia = raycaster.ray.distanceToPoint(posicionMundoPin)
      if (distancia < mejorDistancia) {
        mejorDistancia = distancia
        mejorId = (hit.object.userData.id as string | undefined) ?? null
      }
    }
    return mejorId
  }

  // V6 saco las tres inclinaciones de 81.8/70.6/97.3 (27 grados de dispersion NO monotona — el
  // 97.3 inclina para el otro lado — que es lo que las hacia leer como tres orbitas sueltas) y
  // las junto en 78/82/86. La monotonia arreglo el problema; el abanico de 8 grados creo otro.
  //
  // V7 — el abanico pasa a 66/73/86. El aro visto desde la camara es una elipse de semieje menor
  // radio*sin(inclinacion): con 78/82/86 las proporciones eran 0.978 / 0.990 / 0.998, o sea TRES
  // CIRCUNFERENCIAS CONCENTRICAS a efectos practicos — exactamente el cliche que V6 queria matar,
  // y la mitad de por que el conjunto se leia como ruido tenue. Cerca de 90 grados la derivada
  // del seno es casi cero, asi que ahi los grados no compran forma: no sobraba abanico, faltaba,
  // y faltaba en la zona equivocada del rango. 66/73/86 da 0.914 / 0.956 / 0.998: pasos PAREJOS
  // de 0.042 en achatamiento (que es lo que mide el ojo, no los grados), monotonos y crecientes
  // con el radio. De paso la excursion de profundidad de la etiqueta interior pasa de +-0.247 a
  // +-0.483, asi que su orbita se ve ir y venir en z y el aro se lee inclinado de verdad.
  //
  // Y el DELTA baja al aro interior (1.35; el precio sube a 1.5). Dos motivos:
  //   1. saca el gauge del borde exterior del HUD, que es donde su banda era la silueta de la
  //      pagina entera: ahora queda enmarcado por los hairlines de 1.5 y 1.68, dentro del
  //      instrumento en vez de alrededor de el.
  //   2. la placa del delta ("-2.5%", 0.35 de ancho de mundo) es la mas angosta de las tres y la
  //      del precio ("BTC/USD 104,231", 0.80) la mas ancha. Al radio interior la ancha penetraba
  //      35 px dentro del disco del globo, donde su contraste es el peor; intercambiadas, la
  //      penetracion maxima baja a 7.4 px (barrido completo de phi, canvas 800px).
  // Las inclinaciones y los retrasos siguen atados a la POSICION radial, no a la metrica: la
  // cascada de entrada sigue siendo 900 (interior) / 1020 / 1140 (exterior), contrato intacto.
  //
  // Re-verificacion numerica de FASES_AROS tras mover inclinaciones y metricas (barrido de 7200
  // pasos de phi, las 3 parejas, canvas 800px): holgura MINIMA entre placas 225.3 px
  // (delta/precio), 249.8 px (contexto/precio), 255.1 px (contexto/delta) — con 78/82/86 eran
  // 234.8 / 235.3 / 279.7 px. El solape sigue siendo imposible, no apretado: con velocidad comun
  // la fase relativa es rigida y 120 grados de separacion dejan las placas a mas de 200 px.
  // F0-01 (piso de tamanio en pantalla, canvas en el umbral de 590px): alto de sprite 22.4 px
  // interior / 22.9 px medio / 37.1 px exterior, o sea 10.5 / 10.7 / 17.3 px para la linea
  // principal. V6 daba 23.5 / 23.8 / 37.1 y el diseño PRE-V6 ya enviado daba 22.6 / 23.4 / 36.6:
  // el piso nuevo queda 0.9% por debajo del peor caso que ya estaba en produccion antes de V6,
  // o sea dentro del envelope ya aceptado, y a cambio los tres aros vuelven a tener profundidad.
  //
  // Nota: los retrasos 900/1020/1140 y la entrada desde scale 0.7 quedan intactos (contrato).
  const anillos = useMemo<ConfigAnillo[]>(() => {
    // datos.deltaBtc viene CON SIGNO y un decimal desde HomeHero.tsx ('—' si no hay cotizacion),
    // asi que el parseo ya sirve directo al gauge. Antes llegaba en valor absoluto y aqui se le
    // recomponia el signo desde datos.deltaPositivo; ese Math.abs del origen era en realidad un
    // bug — borraba el menos de la ETIQUETA, no solo del gauge — y al arreglarlo en HomeHero la
    // recomposicion sobra. Dejarla seria peor que inutil: negaria un valor ya negativo y el arco
    // barreria al reves.
    const magnitudParseada = Number.parseFloat(datos.deltaBtc)
    const magnitudConSigno = Number.isFinite(magnitudParseada) ? magnitudParseada : null
    return [
      // V2 — el signo ya estaba en el texto ('+' o el '-' que trae deltaBtc) pero el color no lo
      // acompanaba: se suma verde/rojo semantico. El '+' se queda igual, el color es refuerzo
      // redundante y no el unico canal (contrato WCAG 1.4.1). Contraste sobre la placa a 0.88:
      // verde ~8.8:1, rojo ~5.6:1 — los dos pasan AA para texto de 14px/600.
      // V6 — y ahora la GEOMETRIA tambien lleva el dato: ver GaugeDelta.
      // V7 — al aro INTERIOR, para que el gauge quede enmarcado y no sea la silueta del hero.
      {
        id: 'delta',
        radio: 1.35,
        inclinacionX: grados(66),
        faseInicial: FASES_AROS[0],
        opacidadLinea: OPACIDAD_DIAL_GAUGE,
        etiqueta: `${datos.deltaPositivo ? '+' : ''}${datos.deltaBtc}%`,
        retraso: 900,
        color: datos.deltaPositivo ? COLOR_DELTA_POSITIVO : COLOR_DELTA_NEGATIVO,
        gauge: { magnitud: magnitudConSigno },
      },
      {
        id: 'precio',
        radio: 1.5,
        inclinacionX: grados(73),
        faseInicial: FASES_AROS[1],
        opacidadLinea: OPACIDAD_ARO_PRECIO,
        etiqueta: `BTC/USD ${datos.precioBtc}`,
        retraso: 1020,
      },
      // V5 — eran dos datos distintos unidos por un punto medio en una sola linea (el tell de
      // «metadatos concatenados»: aplana la jerarquia y alarga la placa hasta cruzarse con las
      // otras dos). Ahora van en dos lineas de la misma placa: el recuento de noticias manda y
      // el de activos queda como contexto atenuado. De paso la placa se angosta a la mas ancha
      // de las dos lineas (antes sumaba ambas + el separador), asi que cruza menos pantalla.
      {
        id: 'contexto',
        radio: 1.68,
        inclinacionX: grados(86),
        // (sin cambio de inclinacion en V7: el aro exterior ya era el extremo del abanico)
        faseInicial: FASES_AROS[2],
        opacidadLinea: OPACIDAD_ARO_CONTEXTO,
        etiqueta: datos.etiquetaNoticias,
        subetiqueta: datos.etiquetaActivos,
        retraso: 1140,
      },
    ]
  }, [datos])

  const reticula = useMemo(() => construirReticula(1.001), [])

  // Uniforms de la esfera base y de la base holografica pre-asignados (F5). En JSX literales
  // cada render de Escena (hover/seleccion de pin, cotizaciones cada 60s, estados de sesion
  // cada 30s) creaba 2 objetos uniforms + 3 THREE.Color nuevos; R3F los fusiona en los uniformes
  // reales del material (applyProps: "ShaderMaterial uniforms must keep a stable target
  // reference") y de paso reseteaba uOpacidad/uTiempo a 0 hasta el siguiente useFrame. Con esta
  // referencia estable R3F ni siquiera toca el material en los re-renders.
  const uniformesBase = useMemo(
    () => ({
      uColorBase: { value: new THREE.Color(COLOR_BASE) },
      uColorBorde: { value: new THREE.Color(COLOR_BORDE) },
      uOpacidad: { value: 0 },
    }),
    []
  )
  const uniformesHolograma = useMemo(
    () => ({
      uColor: { value: new THREE.Color(COLOR_BORDE) },
      uTiempo: { value: 0 },
      uOpacidad: { value: 0 },
    }),
    []
  )

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
      // F0-06/F6 P2-1 — bajo reducedMotion el reloj se congela igual que en los puntos: el
      // pulso de la base (±7.5% cada ~7.85s) deja de respirar y queda su valor medio.
      materialHolograma.current.uniforms.uTiempo.value = reducedMotion ? 0 : t
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
    // dedo es incidental, no una intencion de mirarlo). Solo se notifica el CAMBIO de id: el
    // raycast se corre igual cada frame (el globo gira y el pin debajo del puntero puede
    // cambiar), pero onResaltar deja de recibirse 60 veces/s con el mismo valor.
    if (!estadoArrastreRef.current.arrastrando) {
      const puntero = hoverClienteRef.current
      const idResaltado = puntero ? raycastPin(state.raycaster, state.camera, state.gl.domElement, puntero.x, puntero.y) : null
      if (idResaltado !== resaltadoPrevioRef.current) {
        resaltadoPrevioRef.current = idResaltado
        onResaltar(idResaltado)
      }
    }

    // Posicion en pantalla del pin seleccionado, para la tarjeta HTML (fuera del canvas) que la
    // lee por su cuenta en TarjetaActivo.tsx — se corre a traves de un ref, sin setState.
    if (seleccionId) {
      const obj = hitsRef.current.get(seleccionId)
      if (obj) {
        // Sin .clone(): direccionPin/direccionCamara/proyeccionPin ya estan pre-asignados arriba
        // y .copy()/.project() trabajan sobre ellos (mismos valores que antes, cero allocations).
        obj.getWorldPosition(posicionMundoPin)
        direccionPin.copy(posicionMundoPin).normalize()
        direccionCamara.copy(state.camera.position).normalize()
        const dot = direccionPin.dot(direccionCamara)
        const proyeccion = proyeccionPin.copy(posicionMundoPin).project(state.camera)
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
            uniforms={uniformesBase}
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
          <PuntosTierraCapa
            urlMascara="/globo/tierra-mascara-2048.png"
            urlRegiones="/globo/regiones-2048.png"
            calidadAlta={calidadAlta}
            sentimientoPorRegion={datos.sentimientoPorRegion}
            reducedMotion={reducedMotion}
          />
        </Suspense>

        {/* Pines de activos: hijos de grupoGlobo para que giren con el planeta (plan 009 §1.2).
            Cableado F1: reducedMotion (en scope de Escena) y las cotizaciones para el badge
            live ±% del pin. Coreografia F3 (F0-08): entradaRetrasoMs 1600 = el primer pin
            arranca tras la ventana del ultimo anillo HUD (900/1020/1140ms) y los siguientes
            suman 60ms cada uno — la cascada completa (~2.02s) cierra la entrada del hero. */}
        <PinesActivos
          seleccionId={seleccionId}
          resaltadoId={resaltadoId}
          registrarHit={registrarHit}
          reducedMotion={reducedMotion}
          entradaRetrasoMs={1600}
          cotizaciones={datos.cotizacionesPines}
        />

        {/* Nodos de sesion: mismo motivo, giran con el planeta (plan 009 §2.2). reducedMotion
            (F0-06) pausa el ciclo radar y congela el puente abierto<->cerrado a snap. */}
        <NodosSesion estados={estadosSesion} reducedMotion={reducedMotion} />
      </group>

      {anillos.map((config) => (
        <AnilloHud key={config.id} config={config} reducedMotion={reducedMotion} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
        <ringGeometry args={[0, 1.9, 64]} />
        <shaderMaterial
          ref={materialHolograma}
          vertexShader={baseHologramaVertexShader}
          fragmentShader={baseHologramaFragmentShader}
          uniforms={uniformesHolograma}
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

// Durante la intro el canvas ocupa casi toda la pantalla: a dpr 2 son ~4.5 millones de pixeles con Bloom, que una GPU integrada no sostiene.
// Se limita a 1.5 solo mientras dura (el globo se ve igual de nitido: se encoge enseguida) y se restaura al terminar.
const DPR_MAX_INTRO = 1.5
function AjusteDpr({ alta, intro }: { alta: boolean; intro: boolean }) {
  const { gl, setDpr } = useThree()
  useEffect(() => {
    const max = alta ? Math.min(intro ? DPR_MAX_INTRO : 2, window.devicePixelRatio || 1) : 1
    setDpr(max)
    gl.setPixelRatio(max)
  }, [alta, intro, gl, setDpr])
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
  // Objeto pre-asignado para el puntero de hover: onPointerMove puede llegar a 120Hz y el
  // literal { x, y } de antes alocaba uno por evento (se reescribia entero, nunca se compara
  // por referencia). Los consumidores (raycastPin, dentro del useFrame) leen x/y en el mismo
  // frame, sin retener el objeto.
  const punteroHover = useRef({ x: 0, y: 0 })
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

  // Abrir (tap/clic/teclado) y cierre animado de la tarjeta (contrato F3 <-> E): la ENTRADA la
  // hace E dentro de TarjetaActivo; la SALIDA vive aca, en el wrapper de abajo. iniciarCierre()
  // activa las clases de salida del wrapper (opacity/transform 150ms) y recien a los ~130ms
  // borra seleccionId (desmonta) — un setSeleccionId(null) seco desmontaba la tarjeta sin
  // puente, como un teletransporte. reducedMotion: cierre casi instantaneo (0ms de espera).
  const [tarjetaCerrando, setTarjetaCerrando] = useState(false)
  const tarjetaCerrandoRef = useRef(false)
  const cierreTarjetaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Espejo de seleccionId para poder consultar "hay tarjeta abierta?" dentro de callbacks
  // estables sin agregarlo como dependencia (que re-crearia los callbacks cada apertura).
  const seleccionIdRef = useRef<string | null>(null)
  useEffect(() => {
    seleccionIdRef.current = seleccionId
  }, [seleccionId])

  const cancelarCierreTarjeta = useCallback(() => {
    if (cierreTarjetaTimeoutRef.current) {
      clearTimeout(cierreTarjetaTimeoutRef.current)
      cierreTarjetaTimeoutRef.current = null
    }
    tarjetaCerrandoRef.current = false
    setTarjetaCerrando(false)
  }, [])

  // Interrumpible por diseno: si mientras la tarjeta sale el usuario abre otro pin (o re-entra
  // al mismo), cancelarCierreTarjeta revierte el wrapper y nunca llega a borrarse.
  const iniciarCierre = useCallback(() => {
    if (!seleccionIdRef.current || tarjetaCerrandoRef.current) return
    tarjetaCerrandoRef.current = true
    setTarjetaCerrando(true)
    cierreTarjetaTimeoutRef.current = setTimeout(
      () => {
        cierreTarjetaTimeoutRef.current = null
        tarjetaCerrandoRef.current = false
        setTarjetaCerrando(false)
        setSeleccionId(null)
      },
      reducedMotionRef.current ? 0 : 130
    )
  }, [])

  // Sin timeouts colgando que hagan setState tras un unmount (navegacion away con tarjeta abierta).
  useEffect(() => {
    return () => {
      if (cierreTarjetaTimeoutRef.current) clearTimeout(cierreTarjetaTimeoutRef.current)
    }
  }, [])

  // Abrir por tap, clic o la lista de botones sr-only (teclado): lleva el foco. Cerrar (tap en
  // el globo sin pin encima) pasa por la salida animada, no por un unmount seco.
  const abrirPorAccion = useCallback(
    (id: string | null) => {
      if (id === null) {
        iniciarCierre()
        return
      }
      cancelarCierreTarjeta()
      setAutoenfocar(true)
      setSeleccionId(id)
    },
    [cancelarCierreTarjeta, iniciarCierre]
  )

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
      // Salida animada (wrapper), igual que el boton X — todos los cierres por una sola via.
      if (!sobreTarjetaRef.current) iniciarCierre()
    }, 220)
  }, [iniciarCierre])

  const onResaltar = useCallback(
    (id: string | null) => {
      setResaltadoId(id)
      if (!esHoverCapaz.current) return
      if (id) {
        cancelarCierre()
        // Re-entrar a un pin mientras la tarjeta esta saliendo revierte el cierre (contrato
        // de salida interrumpible) — corre en cada frame de hover, es un no-op si no hay cierre.
        cancelarCierreTarjeta()
        setAutoenfocar(false)
        setSeleccionId(id)
      } else {
        programarCierre()
      }
    },
    [cancelarCierre, cancelarCierreTarjeta, programarCierre]
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

  // Mientras hay una tarjeta abierta O esta corriendo la intro de primera carga, el auto-giro
  // se congela (useArrastreGlobo.ts ya respeta estado.pausado). Sin esto, el globo giraba solo
  // TODO el tiempo que dura la intro (useIntroInicio.ts) a la vez que se encoge y se reposiciona
  // via FLIP — dos movimientos simultaneos e independientes (giro 3D + traslado/escalado 2D) que
  // en la practica se leian como una animacion confusa, "se va a un lado", aunque el centro del
  // contenedor nunca se mueve del centro (verificado: el delta horizontal del FLIP es 0 en
  // mobile). Pausar el giro deja un solo movimiento legible: el globo se achica y acomoda en su
  // lugar sin girar de encima. `data-intro` se saca de <html> al terminar la intro (sin cambiar
  // su valor, se remueve el atributo entero), asi que hace falta un MutationObserver, no un
  // simple chequeo de estado de React.
  const [introActiva, setIntroActiva] = useState(false)
  useEffect(() => {
    const html = document.documentElement
    const sincronizar = () => setIntroActiva(html.dataset.intro === 'activo')
    const id = setTimeout(sincronizar, 0)
    const observer = new MutationObserver(sincronizar)
    observer.observe(html, { attributes: true, attributeFilter: ['data-intro'] })
    return () => {
      clearTimeout(id)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    arrastre.setPausado(seleccionId !== null || introActiva)
  }, [seleccionId, introActiva, arrastre])

  // Precarga las noticias del pin apenas se resalta (hover) — para cuando el usuario de verdad
  // lo toca/clickea, probablemente ya este la respuesta.
  useEffect(() => {
    if (!resaltadoId) return
    const marcador = MARCADORES.find((m) => m.id === resaltadoId)
    if (marcador) precargarNoticias(simboloNoticias(marcador), locale)
  }, [resaltadoId, locale])

  // Sin useCallback: no hay un hijo memoizado que necesite que esta referencia sea estable, y
  // envolverla disparaba react-hooks/preserve-manual-memoization (lee estadoRef.current dentro
  // del callback, el compilador no puede verificar que [arrastre] alcance como dependencia).
  const onPointerMoveZona = (e: React.PointerEvent<HTMLDivElement>) => {
    arrastre.handlers.onPointerMove(e)
    if (arrastre.estadoRef.current.arrastrando) {
      hoverClienteRef.current = null
    } else {
      punteroHover.current.x = e.clientX
      punteroHover.current.y = e.clientY
      hoverClienteRef.current = punteroHover.current
    }
  }
  const onPointerLeaveZona = () => {
    hoverClienteRef.current = null
  }

  const marcadorSeleccionado = seleccionId ? MARCADORES.find((m) => m.id === seleccionId) : undefined

  return (
    <div ref={contenedorRef} data-calidad={calidadAlta ? 'alta' : 'baja'} className="relative h-full w-full">
      <Canvas
        className="absolute inset-0"
        // P3 — el className de arriba NUNCA tuvo efecto: R3F escribe `position:relative` y
        // `height:100%` como estilo INLINE en su contenedor, y el inline gana a la clase. El
        // resultado era un div en flujo con altura porcentual dentro de una caja con
        // aspect-ratio: un bucle de dimensionado (la caja espera a su contenido, el contenido
        // pide el 100% de la caja) que en movil resolvia la altura contra max-w-[420px] y dejaba
        // la caja en 343x420 — el globo estirado un 22% en vertical. Antes no se veia porque el
        // canvas se medía con el rect ya transformado y el doble encogimiento lo tapaba. `style`
        // SI se fusiona con el inline de R3F, asi que esto saca el canvas del flujo de verdad.
        style={{ position: 'absolute', inset: 0 }}
        dpr={[1, 2]}
        // P3 — DOBLE ENCOGIMIENTO durante la intro. R3F mide su contenedor con react-use-measure,
        // que por defecto usa getBoundingClientRect, y ESE rect ya incluye los transforms de los
        // ancestros. Durante la intro [data-globo-caja] lleva un scale de FLIP (useIntroInicio.ts),
        // asi que R3F leia el ancho YA escalado (p.ej. 654px de una caja de 1062), dimensionaba el
        // canvas a ese valor, y entonces el mismo transform volvia a escalarlo: el globo acababa
        // ocupando el 62% de su propio hueco. Al terminar la intro el transform desaparecia y el
        // canvas recuperaba su tamaño real de golpe — el globo casi DOBLABA de tamaño en un frame,
        // que es el "cambia de tamaño al terminar el zoom" que reporto el usuario (medido: canvas
        // 403px -> 643px entre el ultimo frame de la intro y el primero de despues).
        // offsetSize usa offsetWidth/offsetHeight, que NO se ven afectados por transforms.
        resize={{ offsetSize: true }}
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
        {/* El monitor SOLO mide cuando el globo se ve y la intro ya termino. Antes medía siempre: durante la intro (canvas enorme) y
            al volver a la pantalla tras un scroll (los primeros cuadros tras reanudar son lentos) los fps caian por debajo del umbral
            por defecto (50) y la calidad bajaba sin que la GPU tuviera ningun problema real. Montar/desmontar reinicia la medida.
            Bajar de calidad ya NO apaga el brillo (Bloom) ni el viñeteado: solo rebaja resolucion y cantidad de puntos, y solo si de
            verdad se sostiene por debajo de 28 fps; vuelve a calidad alta por encima de 55. */}
        {visible && !introActiva && (
          <PerformanceMonitor bounds={() => [28, 55]} onDecline={() => setCalidadAlta(false)} onIncline={() => setCalidadAlta(true)} flipflops={2} />
        )}
        <AjusteDpr alta={calidadAlta} intro={introActiva} />
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
            (lo prueba) y dejaba una estela/smear detras de lo que gira. Tampoco se desactiva por calidad (`enabled={calidadAlta}` apagaba las
            luces del globo en cuanto los fps bajaban un momento): el brillo es parte de su identidad, lo que se rebaja es dpr y puntos. El rectangulo blanco
            original durante la carga ya se soluciono por otro lado: NaN clamps en los shaders,
            renderOrder explicito y toneMapping/colorSpace fijos en el Canvas. */}
        <EffectComposer>
          {/* El halo blanco no era la atmosfera (geometria, ya eliminada) — era el `radius` del
              propio Bloom (default 0.85, bastante ancho) esparciendo el brillo de los puntos/
              anillos hacia afuera, en el negro alrededor del globo. radius=0.2 lo mantiene
              pegado a los elementos brillantes en vez de formar un aura difusa por fuera. */}
          <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.3} radius={0.2} levels={5} />
          <Vignette darkness={0.5} />
        </EffectComposer>
      </Canvas>

      {/* Zona de arrastre: solo el circulo del globo, no todo el canvas, para que el scroll
          tactil fuera de el siga funcionando. Durante la intro esta MISMA zona (72% del
          contenedor, que ahi es casi toda la pantalla — ver --intro-globo en globals.css) cubre
          la mayor parte del viewport, asi que cualquier swipe para hacer scroll caia DENTRO de
          ella y touch-action:none se lo tragaba entero como si fuera un arrastre manual del
          globo — eso, no el auto-giro (ya corregido aparte), era la causa real de "el globo se
          va a un lado" reportada en celular: cada intento de scroll durante la intro giraba el
          globo en vez de avanzar la pagina. pointer-events-none mientras introActiva deja pasar
          el scroll nativo sin estorbo; arrastrar/tocar pines vuelve a funcionar normal apenas
          termina la intro. */}
      <div
        className={clsx(
          'absolute left-1/2 top-1/2 size-[72%] -translate-x-1/2 -translate-y-1/2 touch-none rounded-full outline-none active:cursor-grabbing',
          introActiva ? 'pointer-events-none' : resaltadoId ? 'cursor-pointer' : 'cursor-grab'
        )}
        style={{ touchAction: 'none' }}
        tabIndex={introActiva ? -1 : 0}
        // F0-20 — role="img" describia como estatica una zona interactiva (arrastre + tap en
        // pines): application es el rol correcto para un widget con gestos propios. El
        // aria-label (arrastrar para girar...) queda intacto.
        role="application"
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
              // F0-19 — con left-1/2 + translate el badge saltaba al centro exacto del globo
              // (encima de la tarjeta) al recibir foco: ahora se apila arriba a la izquierda
              // (left-4/top-4), sin translate.
              className="focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-accent-cyan focus:px-3 focus:py-1.5 focus:text-micro focus:font-semibold focus:text-canvas"
              onClick={() => abrirPorAccion(m.id)}
            >
              {dict.home.globoMarcadores[m.nombreClave as keyof typeof dict.home.globoMarcadores] ?? m.simbolo}
            </button>
          </li>
        ))}
      </ul>

      {marcadorSeleccionado && (
        // Wrapper de salida de la tarjeta (contrato F3 <-> E): E anima la ENTRADA dentro de
        // TarjetaActivo; este div es el puente de SALIDA — opacity-0 + scale-[0.98] durante
        // los 130ms de transition (misma duracion que el desmontaje de iniciarCierre, para que
        // el ultimo tramo de la curva si se pinte), con --ease-out (no la curva por defecto de
        // Tailwind, que arranca lenta y difuminaba el momento de la salida — F6 P1-2).
        // absolute inset-0 conserva el bloque contenedor de la tarjeta (que es absolute con
        // translate en pixeles): sin esto, al aplicarse el scale del wrapper la tarjeta
        // saltaria al origen del wrapper. pointer-events-none deja pasar el arrastre/tap del
        // globo (el wrapper tapa todo el contenedor); la tarjeta re-activa los suyos con su
        // pointerEvents inline por frame. scale-[0.98] escribe la propiedad CSS `scale` (Tailwind
        // v4), por eso la transition lista `scale` y no `transform`.
        <div
          className={clsx(
            'pointer-events-none absolute inset-0 transition-[opacity,scale] duration-[130ms] ease-[var(--ease-out)]',
            tarjetaCerrando && 'scale-[0.98] opacity-0'
          )}
        >
          <TarjetaActivo
            key={marcadorSeleccionado.id}
            marcador={marcadorSeleccionado}
            locale={locale}
            cotizacion={datos.cotizacionesPines[marcadorSeleccionado.simbolo]}
            posicionRef={posicionPinRef}
            autoenfocar={autoenfocar}
            onHover={onHoverTarjeta}
            onCerrar={iniciarCierre}
          />
        </div>
      )}
    </div>
  )
}
