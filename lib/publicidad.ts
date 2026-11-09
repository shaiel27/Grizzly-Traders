import { publicidadActiva } from '@/lib/analytics'

// Interruptor de la publicidad (Adsterra). Se fija al compilar (NEXT_PUBLIC_*): activarlo o apagarlo exige recompilar y reiniciar.
// Apagado (por defecto), el sitio no carga ni pide nada de publicidad y los textos legales dicen que no usamos cookies de publicidad.
// Ver docs/publicidad.md.
export const PUBLICIDAD_ACTIVA = publicidadActiva(process.env.NEXT_PUBLIC_ADS_ACTIVO)

// ---- Espacios publicitarios -------------------------------------------------------------------------------------------------------------
// Los códigos de Adsterra (clave de cada espacio y dirección del servidor que sirve el anuncio) vienen del panel y se configuran por variable de
// entorno, nunca en el código. Todo se valida: una clave o un servidor mal escritos dejan el espacio apagado, no una página rota.
//
//   NEXT_PUBLIC_ADS_SLOTS = {"articulo":{"tipo":"banner","clave":"abc123…","host":"www.ejemplo.com","ancho":300,"alto":250},
//                            "nativo":{"tipo":"nativo","clave":"def456…","host":"pl000.ejemplo.com"}}
//   NEXT_PUBLIC_ADS_HOSTS = servidores extra que usan los anuncios (script, imágenes, marcos), separados por comas (ver docs/publicidad.md)
export type Espacio =
  | { tipo: 'banner'; clave: string; host: string; ruta?: string; ancho: number; alto: number }
  | { tipo: 'nativo'; clave: string; host: string; ruta?: string }

const HOST = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
const CLAVE = /^[A-Za-z0-9]{8,64}$/
// Ruta del script del anuncio en su servidor, tal como la da el panel (p. ej. /21/<clave>). Sin ella: /<clave>/invoke.js
const RUTA = /^\/[A-Za-z0-9/_.-]{1,120}$/
const rutaValida = (r: unknown): r is string => typeof r === 'string' && RUTA.test(r) && !r.includes('..') && !r.includes('//')

export const esHostValido = (valor: unknown): valor is string => typeof valor === 'string' && HOST.test(valor)

export function hostsDeAnuncios(texto: string | null | undefined): string[] {
  return [...new Set((texto ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(esHostValido))]
}

export function espaciosDeAnuncios(json: string | null | undefined): Record<string, Espacio> {
  if (!json) return {}
  let crudo: unknown
  try {
    crudo = JSON.parse(json)
  } catch {
    return {}
  }
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return {}
  const espacios: Record<string, Espacio> = {}
  for (const [nombre, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9-]{0,30}$/.test(nombre) || !valor || typeof valor !== 'object') continue
    const v = valor as Record<string, unknown>
    // `*.` no vale para el servidor del código: ahí se escribe una dirección concreta
    if (typeof v.clave !== 'string' || !CLAVE.test(v.clave) || !esHostValido(v.host) || v.host.startsWith('*.')) continue
    if (v.ruta !== undefined && !rutaValida(v.ruta)) continue
    const ruta = v.ruta as string | undefined
    if (v.tipo === 'nativo') espacios[nombre] = { tipo: 'nativo', clave: v.clave, host: v.host.toLowerCase(), ...(ruta ? { ruta } : {}) }
    else if (v.tipo === 'banner' && Number.isInteger(v.ancho) && Number.isInteger(v.alto) && (v.ancho as number) > 0 && (v.alto as number) > 0 && (v.ancho as number) <= 970 && (v.alto as number) <= 600) {
      espacios[nombre] = { tipo: 'banner', clave: v.clave, host: v.host.toLowerCase(), ...(ruta ? { ruta } : {}), ancho: v.ancho as number, alto: v.alto as number }
    }
  }
  return espacios
}

export const urlDelAnuncio = (e: Espacio) => `https://${e.host}${e.ruta ?? `/${e.clave}/invoke.js`}`

export const ESPACIOS = espaciosDeAnuncios(process.env.NEXT_PUBLIC_ADS_SLOTS)

// Contenido de /ads.txt: líneas del panel de Adsterra en la variable ADS_TXT (con \n entre líneas). Solo líneas con forma de ads.txt.
export function contenidoAdsTxt(variable: string | null | undefined): string | null {
  const lineas = (variable ?? '')
    // El salto de línea puede venir como texto («\n» o «\\n», según cómo se guarde la variable) o como salto real
    .replace(/\\+n/g, '\n')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[a-z0-9.-]+\s*,\s*[A-Za-z0-9-]+\s*,\s*(DIRECT|RESELLER)(\s*,\s*[a-f0-9]+)?(\s*#.*)?$/i.test(l) || /^#[^\\]*$/.test(l))
  return lineas.length ? lineas.join('\n') + '\n' : null
}
