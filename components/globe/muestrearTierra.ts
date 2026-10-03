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

/**
 * Muestrea `cantidadObjetivo` puntos sobre la tierra (uniforme en area esferica: lat = asin(2v-1)),
 * con mas densidad y brillo en la costa (un pixel de tierra con algun vecino de agua en radio 2px).
 */
export function muestrearPuntosTierra(mask: ImageData, cantidadObjetivo: number, seed = 1337, radio = 1): PuntosTierra {
  const rand = mulberry32(seed)
  const { width, height, data } = mask

  const esTierra = (x: number, y: number): boolean => {
    if (y < 0 || y >= height) return false
    const xi = ((x % width) + width) % width
    const idx = (y * width + xi) * 4
    return data[idx] > 128
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

  // x24 alcanza de sobra (~29% de la mascara es tierra) y corta casi a la mitad el costo
  // sincrono de este muestreo respecto al x60 original — se nota en cuanto tarda en aparecer.
  const intentosMax = cantidadObjetivo * 24
  let aceptados = 0

  for (let i = 0; i < intentosMax && aceptados < cantidadObjetivo; i++) {
    const u = rand()
    const v = rand()
    const lon = u * 2 * Math.PI - Math.PI
    const lat = Math.asin(2 * v - 1)

    const px = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * width)
    const py = Math.floor(((Math.PI / 2 - lat) / Math.PI) * height)

    if (!esTierra(px, py)) continue

    const costa = esCosta(px, py)
    const repeticiones = costa ? 2 + Math.floor(rand() * 2) : 1

    for (let r = 0; r < repeticiones && aceptados < cantidadObjetivo; r++) {
      const p = latLonAVector3(lat, lon, radio)
      positions.push(p.x, p.y, p.z)
      brillos.push(costa ? 0.85 + rand() * 0.15 : 0.35 + rand() * 0.35)
      fases.push(rand() * Math.PI * 2)
      velocidades.push(0.6 + rand() * 1.2)
      aceptados++
    }
  }

  return {
    positions: new Float32Array(positions),
    aBrillo: new Float32Array(brillos),
    aFase: new Float32Array(fases),
    aVel: new Float32Array(velocidades),
    count: aceptados,
  }
}
