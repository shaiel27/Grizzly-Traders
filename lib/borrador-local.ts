// Borrador local del editor del CMS: copia de lo que se está escribiendo, en el navegador, para no perderlo si se cierra la pestaña por error.
// Vive en localStorage (clave por artículo). Nunca sustituye al guardado: es solo una red de seguridad que se ofrece restaurar.

export const PREFIJO_BORRADOR = 'gt_cms_borrador:'
export const ESPERA_AUTOGUARDADO_MS = 1500

export const claveBorrador = (idArticulo: string | null) => PREFIJO_BORRADOR + (idArticulo ?? 'nuevo')

export interface BorradorLocal<T> {
  v: 1
  guardadoEn: string
  datos: T
}

// «Huella» de un estado del formulario: sirve para saber si algo cambió y si un borrador difiere de lo que hay abierto
export const huella = (datos: unknown): string => JSON.stringify(datos)

export function serializarBorrador<T>(datos: T, ahora = Date.now()): string {
  const borrador: BorradorLocal<T> = { v: 1, guardadoEn: new Date(ahora).toISOString(), datos }
  return JSON.stringify(borrador)
}

// Devuelve null ante cualquier cosa que no sea un borrador válido de esta versión (datos corruptos, formato antiguo, etc.)
export function leerBorrador<T = unknown>(crudo: string | null | undefined): BorradorLocal<T> | null {
  if (!crudo) return null
  try {
    const x = JSON.parse(crudo) as Partial<BorradorLocal<T>> | null
    if (!x || typeof x !== 'object' || x.v !== 1 || typeof x.guardadoEn !== 'string' || !Number.isFinite(Date.parse(x.guardadoEn)) || !x.datos || typeof x.datos !== 'object') return null
    return x as BorradorLocal<T>
  } catch {
    return null
  }
}

// ¿Vale la pena ofrecer el borrador? Solo si difiere de lo que hay abierto ahora
export const esRestaurable = (borrador: BorradorLocal<unknown> | null, estadoActual: unknown): borrador is BorradorLocal<unknown> => borrador !== null && huella(borrador.datos) !== huella(estadoActual)

export type Antiguedad = { unidad: 'ahora' } | { unidad: 'min' | 'h' | 'd'; n: number }

export function antiguedad(guardadoEn: string, ahora = Date.now()): Antiguedad {
  const min = Math.max(0, Math.floor((ahora - Date.parse(guardadoEn)) / 60_000))
  if (min < 1) return { unidad: 'ahora' }
  if (min < 60) return { unidad: 'min', n: min }
  if (min < 60 * 24) return { unidad: 'h', n: Math.floor(min / 60) }
  return { unidad: 'd', n: Math.floor(min / (60 * 24)) }
}

// Un borrador más viejo que esto casi seguro ya no interesa (y dejarlo ocuparía espacio para siempre)
export const CADUCIDAD_BORRADOR_DIAS = 14

export function estaCaducado(guardadoEn: string, ahora = Date.now()): boolean {
  return ahora - Date.parse(guardadoEn) > CADUCIDAD_BORRADOR_DIAS * 86_400_000
}
