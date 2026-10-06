// Convierte la mascara de tierra (PNG blanco=tierra, negro=agua) en posiciones 3D para los
// puntos del globo. Usa un PRNG con semilla (mulberry32) en vez de Math.random(): la regla
// react-hooks/purity del repo prohibe llamadas impuras en el cuerpo de render, y ademas asi
// el resultado es siempre el mismo entre renders (y entre servidor/cliente, si alguna vez
// hiciera falta), sin tener que memorizar nada fuera de React.

import { latLonAVector3 } from '@/lib/globe/geo'

function mulberry32(seed: number) {
  let s = seed | 0
  return function random() {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface PuntosTierra {
  positions: Float32Array
  aBrillo: Float32Array
  aFase: Float32Array
  aVel: Float32Array
  // Id de region de sentimiento (0 = ninguna, 1-6, ver scripts/build-globe-mask.mjs) por punto —
  // plan 009 §3.2. Queda en 0 para todos si no se pasa `maskRegiones`.
  aRegion: Float32Array
  count: number
}

// Dibuja la imagen cargada sobre un canvas fuera de pantalla y devuelve sus pixeles.
export function extraerImageData(image: CanvasImageSource, width: number, height: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No se pudo crear el contexto 2D para muestrear la mascara')
  ctx.drawImage(image, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

// Cuantos intentos del loop de abajo corren antes de ceder el hilo principal una vez. Medido con
// Lighthouse (auditoria de calidad): el muestreo completo (36k puntos, intentosMax ~864k) tardaba
// ~2.7s sincronicos sin ceder nunca — una sola tarea bloqueando TODO el hilo principal (scroll,
// clicks, el resto de la pagina sin pintar), el culpable confirmado de un Total Blocking Time de
// 14-18s y, en cascada, un Cumulative Layout Shift de ~0.93 (el resto de la pagina "saltaba" de
// una vez al desbloquearse recien). 1500 cede cada ~5ms en el caso tipico, bien por debajo del
// umbral de 50ms que cuenta como "tarea larga".
const INTENTOS_POR_TRAMO = 1500

function cederHiloPrincipal(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Muestrea `cantidadObjetivo` puntos sobre la tierra (uniforme en area esferica: lat = asin(2v-1)),
 * con mas densidad y brillo en la costa (un pixel de tierra con algun vecino de agua en radio 2px).
 * `maskRegiones`, si se pasa, debe tener el MISMO ancho/alto que `mask` y venir de la misma
 * proyeccion (scripts/build-globe-mask.mjs genera ambas asi a proposito) — se lee en el mismo
 * pixel que la mascara de tierra, sin una segunda conversion lat/lon.
 *
 * Async: cede el hilo principal cada INTENTOS_POR_TRAMO iteraciones (ver comentario arriba) en
 * vez de correr de un tiro — el resultado es identico (mismo PRNG con semilla, mismo orden de
 * llamadas), solo que repartido en tramos que dejan respirar al navegador entre uno y otro.
 */
export async function muestrearPuntosTierra(mask: ImageData, cantidadObjetivo: number, seed = 1337, radio = 1, maskRegiones?: ImageData): Promise<PuntosTierra> {
  const rand = mulberry32(seed)
  const { width, height, data } = mask
  const dataRegiones = maskRegiones?.data

  const esTierra = (x: number, y: number): boolean => {
    if (y < 0 || y >= height) return false
    const xi = ((x % width) + width) % width
    const idx = (y * width + xi) * 4
    return data[idx] > 128
  }

  // El canal R de regiones-2048.png guarda id*40 (ver scripts/build-globe-mask.mjs) — redondear
  // al multiplo de 40 mas cercano absorbe el antialiasing de los bordes de pais sin confundir
  // una region con otra (los pasos de 40 estan bien separados).
  const regionEn = (x: number, y: number): number => {
    if (!dataRegiones) return 0
    const xi = ((x % width) + width) % width
    const idx = (y * width + xi) * 4
    return Math.round(dataRegiones[idx] / 40)
  }

  const esCosta = (x: number, y: number): boolean => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue
        if (!esTierra(x + dx, y + dy)) return true
      }
    }
    return false
  }

  const positions: number[] = []
  const brillos: number[] = []
  const fases: number[] = []
  const velocidades: number[] = []
  const regiones: number[] = []

  // x24 alcanza de sobra (~29% de la mascara es tierra) y corta casi a la mitad el costo
  // sincrono de este muestreo respecto al x60 original — se nota en cuanto tarda en aparecer.
  const intentosMax = cantidadObjetivo * 24
  let aceptados = 0

  for (let i = 0; i < intentosMax && aceptados < cantidadObjetivo; i++) {
    if (i > 0 && i % INTENTOS_POR_TRAMO === 0) await cederHiloPrincipal()

    const u = rand()
    const v = rand()
    const lon = u * 2 * Math.PI - Math.PI
    const lat = Math.asin(2 * v - 1)

    const px = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * width)
    const py = Math.floor(((Math.PI / 2 - lat) / Math.PI) * height)

    if (!esTierra(px, py)) continue

    const costa = esCosta(px, py)
    const repeticiones = costa ? 2 + Math.floor(rand() * 2) : 1
    const region = regionEn(px, py)

    for (let r = 0; r < repeticiones && aceptados < cantidadObjetivo; r++) {
      const p = latLonAVector3(lat, lon, radio)
      positions.push(p.x, p.y, p.z)
      brillos.push(costa ? 0.85 + rand() * 0.15 : 0.35 + rand() * 0.35)
      fases.push(rand() * Math.PI * 2)
      velocidades.push(0.6 + rand() * 1.2)
      regiones.push(region)
      aceptados++
    }
  }

  return {
    positions: new Float32Array(positions),
    aBrillo: new Float32Array(brillos),
    aFase: new Float32Array(fases),
    aVel: new Float32Array(velocidades),
    aRegion: new Float32Array(regiones),
    count: aceptados,
  }
}
