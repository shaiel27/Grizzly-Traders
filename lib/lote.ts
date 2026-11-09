import { z } from 'zod'

// Acciones en lote del CMS (ver app/api/posts/lote/route.ts) y detección de títulos parecidos.

export const MAX_LOTE = 50
export const ACCIONES_LOTE = ['publicar', 'despublicar', 'borrar'] as const
export type AccionLote = (typeof ACCIONES_LOTE)[number]

export const loteSchema = z.object({
  accion: z.enum(ACCIONES_LOTE),
  ids: z
    .array(z.string().uuid())
    .min(1)
    .max(MAX_LOTE)
    .transform((ids) => [...new Set(ids)]),
})

const PALABRAS_VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'a', 'un', 'una', 'por', 'para', 'con', 'que', 'se', 'su', 'al', 'the', 'of', 'in', 'and', 'to', 'for', 'on', 'a', 'an', 'is'])

export function palabrasClave(titulo: string): string[] {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 1 && !PALABRAS_VACIAS.has(p))
}

// Parecido entre dos títulos (0 a 1): palabras clave en común sobre el total de palabras distintas
export function parecido(a: string, b: string): number {
  const A = new Set(palabrasClave(a))
  const B = new Set(palabrasClave(b))
  if (A.size === 0 || B.size === 0) return 0
  let comunes = 0
  for (const p of A) if (B.has(p)) comunes++
  return comunes / (A.size + B.size - comunes)
}

export const UMBRAL_PARECIDO = 0.6

export interface TituloCandidato {
  post_id: string
  title: string
  slug: string
}

export function titulosParecidos(titulo: string, candidatos: TituloCandidato[], excluirId?: string | null, max = 3): (TituloCandidato & { parecido: number })[] {
  return candidatos
    .filter((c) => c.post_id !== excluirId)
    .map((c) => ({ ...c, parecido: parecido(titulo, c.title) }))
    .filter((c) => c.parecido >= UMBRAL_PARECIDO)
    .sort((x, y) => y.parecido - x.parecido)
    .slice(0, max)
}

// Primeras palabras clave: sirven para buscar candidatos en la base antes de comparar con `parecido`
export const terminoDeBusqueda = (titulo: string) => palabrasClave(titulo).slice(0, 3).join(' ')
