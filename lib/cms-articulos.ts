import { z } from 'zod'
import type { Faltantes } from '@/lib/completar'

// Lista de artículos del CMS: ámbitos, filtros y reglas compartidas entre la API y el panel.
//
// Tres ámbitos, que no se mezclan:
//   mis      lo escrito en el CMS (origen "cms": manual o asistido). Es lo que más usa quien escribe: siempre visible, nunca enterrado.
//   auto     lo que publica la automatización (origen "rss"), sin sus restos de error.
//   errores  restos del pipeline: reservas sin terminar («pendiente-…»), duplicados («duplicado-…») y borradores con un fallo guardado.
//            No se ven en el sitio; el pipeline los usa como marca de «esta noticia ya se trató», por eso no se borran al instante: se
//            limpian solos a los 7 días (migración 0013), que es más de lo que el pipeline mira hacia atrás en las fuentes con ventana corta.

export const AMBITOS = ['mis', 'auto', 'errores'] as const
export type Ambito = (typeof AMBITOS)[number]

export const ESTADOS = ['todos', 'published', 'draft', 'scheduled'] as const
export type EstadoFiltro = (typeof ESTADOS)[number]

export const POR_PAGINA = 25
// Los restos de error se borran solos pasado este tiempo (función SQL limpiar_errores_pipeline y botón «Limpiar» del CMS)
export const DIAS_LIMPIEZA_ERRORES = 7

export const PREFIJO_PENDIENTE = 'pendiente-'
export const PREFIJO_DUPLICADO = 'duplicado-'

// Filtros de PostgREST. «Fila de error» = borrador del pipeline con slug de reserva/duplicado o con un fallo guardado.
export const FILTRO_ES_ERROR = `slug.like.${PREFIJO_PENDIENTE}*,slug.like.${PREFIJO_DUPLICADO}*,pipeline_error.not.is.null`
export const FILTRO_NO_ES_ERROR = `status.neq.draft,and(slug.not.like.${PREFIJO_PENDIENTE}*,slug.not.like.${PREFIJO_DUPLICADO}*,pipeline_error.is.null)`

export type TipoError = 'pendiente' | 'duplicado' | 'checklist' | 'fallo'

export function tipoDeError(slug: string | null | undefined, pipelineError: string | null | undefined): TipoError | null {
  if (slug?.startsWith(PREFIJO_DUPLICADO)) return 'duplicado'
  if (pipelineError?.trim()) return /^checklist\s*:/i.test(pipelineError.trim()) ? 'checklist' : 'fallo'
  if (slug?.startsWith(PREFIJO_PENDIENTE)) return 'pendiente'
  return null
}

export function esFilaDeError(post: { origen?: string | null; status?: string | null; slug?: string | null; pipeline_error?: string | null }): boolean {
  return post.origen === 'rss' && post.status === 'draft' && tipoDeError(post.slug, post.pipeline_error) !== null
}

// Quita del texto de búsqueda lo que no aporta (y limita su largo); el valor va como parámetro de ilike, no se interpola en un filtro
export function limpiarBusqueda(texto: string | null | undefined): string {
  return String(texto ?? '').replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}

const entero = z.coerce.number().int().positive()
export const parametrosListaSchema = z.object({
  ambito: z.enum(AMBITOS).catch('mis'),
  estado: z.enum(ESTADOS).catch('todos'),
  q: z.string().optional().transform(limpiarBusqueda),
  categoria: entero.optional().catch(undefined),
  fuente: entero.optional().catch(undefined),
  pagina: entero.catch(1),
})
export type ParametrosLista = z.infer<typeof parametrosListaSchema>

export function leerParametrosLista(busqueda: URLSearchParams): ParametrosLista {
  return parametrosListaSchema.parse({
    ambito: busqueda.get('ambito') ?? undefined,
    estado: busqueda.get('estado') ?? undefined,
    q: busqueda.get('q') ?? undefined,
    categoria: busqueda.get('categoria') ?? undefined,
    fuente: busqueda.get('fuente') ?? undefined,
    pagina: busqueda.get('pagina') ?? undefined,
  })
}

export function rangoDePagina(pagina: number, porPagina = POR_PAGINA): [number, number] {
  const desde = (Math.max(1, pagina) - 1) * porPagina
  return [desde, desde + porPagina - 1]
}

export function totalPaginas(total: number, porPagina = POR_PAGINA): number {
  return Math.max(1, Math.ceil(total / porPagina))
}

export interface ArticuloLista {
  id: string
  title: string
  slug: string
  status: string
  origen: string | null
  sentiment: string
  view_count: number
  published_at: string | null
  created_at: string
  updated_at?: string | null
  is_featured: boolean
  ai_assisted?: boolean | null
  category: { name: string; slug: string } | null
  author: { full_name: string } | null
  source: { name: string } | null
  source_url: string | null
  assets: { symbol: string; name: string }[]
  tags: { name: string; slug: string }[]
  translations: { locale: 'es' | 'en'; slug: string }[]
  pipeline_error?: string | null
  pipeline_attempts?: number | null
  faltantes?: Faltantes
  // Solo en el ámbito «errores»
  tipo_error?: TipoError | null
}

export interface Conteos {
  mis: number
  auto: number
  errores: number
}

export interface RespuestaLista {
  success: boolean
  data: ArticuloLista[]
  total: number
  pagina: number
  porPagina: number
  conteos: Conteos
  error?: string
}

export const hayFalta = (f?: Pick<Faltantes, 'portada' | 'categoria' | 'traduccion'>) => !!f && (f.portada || f.categoria || f.traduccion)
