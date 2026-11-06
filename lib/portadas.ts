// Retención de portadas: el plan gratuito de Supabase da 1 GB de almacenamiento y las portadas (~574 KB cada una) lo llenarían en unas dos semanas.
// Se borran las portadas de las notas AUTOMÁTICAS publicadas hace más de RETENCION_DIAS días (el texto y la URL del artículo se mantienen).
// Ver docs/almacenamiento.md. Nada de lo de aquí toca la base de datos: es la parte pura, con pruebas.

export const BUCKET = 'post-images'
export const RETENCION_DIAS = 18
export const TOPE_POR_EJECUCION = 200
// Las notas más vistas conservan su portada aunque sean antiguas
export const CONSERVAR_MAS_VISTAS = 20
// Un archivo recién subido puede no estar enlazado aún (el pipeline sube la portada y luego crea la fila): no es huérfano hasta pasado este tiempo
export const HORAS_ANTES_DE_HUERFANO = 24
// 1 GB del plan gratuito, contado en decimal para quedarse del lado seguro
export const LIMITE_BYTES = 1_000_000_000
export const UMBRAL_ALERTA = 0.8

const RUTA_PUBLICA = `/storage/v1/object/public/${BUCKET}/`

// Nombre del archivo dentro del bucket a partir de su URL pública, o null si no es una imagen nuestra.
// Los archivos dentro de carpetas (las subidas del CMS) devuelven null: nunca se borran automáticamente.
export function nombreEnBucket(url: string | null | undefined): string | null {
  if (!url) return null
  const i = url.indexOf(RUTA_PUBLICA)
  if (i === -1) return null
  const crudo = url.slice(i + RUTA_PUBLICA.length).split(/[?#]/)[0]
  let nombre: string
  try {
    nombre = decodeURIComponent(crudo)
  } catch {
    return null
  }
  return nombre && !nombre.includes('/') ? nombre : null
}

// Archivos del bucket que un texto (HTML de un artículo) usa dentro de su contenido
export function nombresEnTexto(html: string | null | undefined): string[] {
  if (!html) return []
  const nombres: string[] = []
  const re = new RegExp(`${RUTA_PUBLICA.replace(/\//g, '\\/')}([^"'\\s)<>?#]+)`, 'g')
  for (const m of html.matchAll(re)) {
    try {
      nombres.push(decodeURIComponent(m[1]))
    } catch {
      nombres.push(m[1])
    }
  }
  return nombres
}

export const fechaDeCorte = (ahora: number, dias = RETENCION_DIAS) => new Date(ahora - dias * 86_400_000).toISOString()

export interface Candidato {
  id: string
  cover_image_url: string | null
  og_image_url: string | null
}

// De los candidatos, qué archivos borrar y qué filas dejar sin portada. `protegidos`: archivos que algo más sigue usando.
export function planificarBorrado(candidatos: Candidato[], protegidos: ReadonlySet<string>): { ids: string[]; nombres: string[]; omitidos: number } {
  const ids: string[] = []
  const nombres = new Set<string>()
  let omitidos = 0
  for (const c of candidatos) {
    const propios = [nombreEnBucket(c.cover_image_url), nombreEnBucket(c.og_image_url)].filter((n): n is string => n !== null)
    if (propios.length === 0 || propios.some((n) => protegidos.has(n))) {
      omitidos++
      continue
    }
    ids.push(c.id)
    for (const n of propios) nombres.add(n)
  }
  return { ids, nombres: [...nombres], omitidos }
}

export interface ArchivoBucket {
  name: string
  size: number
  createdAt: string | null
}

// Archivos del bucket que ninguna fila ni texto usa, y que ya llevan tiempo subidos
export function detectarHuerfanos(archivos: ArchivoBucket[], referenciados: ReadonlySet<string>, ahora: number): ArchivoBucket[] {
  const limite = ahora - HORAS_ANTES_DE_HUERFANO * 3_600_000
  return archivos.filter((a) => !a.name.includes('/') && !referenciados.has(a.name) && a.createdAt !== null && Date.parse(a.createdAt) < limite)
}

export function estadoUso(bytes: number, limite = LIMITE_BYTES) {
  const porcentaje = Math.round((bytes / limite) * 1000) / 10
  return { bytes, mb: Math.round(bytes / 1_000_000), porcentaje, alerta: bytes / limite >= UMBRAL_ALERTA }
}
