// Historial de versiones y control de cambios simultáneos al editar un artículo en el CMS (ver supabase/migrations/0014_historial_articulos.sql).

export const MAX_VERSIONES = 20

export interface VersionTexto {
  title: string
  content_html: string
  meta_title: string | null
  meta_description: string | null
}

const norm = (v: string | null | undefined) => (v ?? '').trim()

// ¿Cambió algo que merezca guardar la versión anterior? Guardar sin tocar nada no ensucia el historial.
export function cambioRelevante(anterior: VersionTexto, nueva: VersionTexto): boolean {
  return norm(anterior.title) !== norm(nueva.title) || norm(anterior.content_html) !== norm(nueva.content_html) || norm(anterior.meta_title) !== norm(nueva.meta_title) || norm(anterior.meta_description) !== norm(nueva.meta_description)
}

export interface EvaluacionGuardado {
  conflicto: boolean
  guardarVersionAnterior: boolean
}

// `existente`: la traducción tal como está AHORA en la base (null si ese idioma aún no existe).
// `esperado`: el `updated_at` que tenía cuando el editor abrió el artículo (null si no lo mandó).
// Hay conflicto si alguien más (o el flujo automático) cambió ese texto mientras tanto: guardar encima lo pisaría.
export function evaluarGuardado(existente: (VersionTexto & { updated_at: string | null }) | null, esperado: string | null | undefined, nueva: VersionTexto): EvaluacionGuardado {
  if (!existente) return { conflicto: false, guardarVersionAnterior: false }
  let conflicto = false
  if (esperado && existente.updated_at) {
    const a = Date.parse(esperado)
    const b = Date.parse(existente.updated_at)
    conflicto = Number.isFinite(a) && Number.isFinite(b) && a !== b
  }
  return { conflicto, guardarVersionAnterior: !conflicto && cambioRelevante(existente, nueva) }
}

export function resumenVersion(contenidoHtml: string, largo = 140): string {
  const texto = contenidoHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return texto.length > largo ? texto.slice(0, largo - 1).trimEnd() + '…' : texto
}

export interface VersionListada {
  id: number
  created_at: string
  editado_por: string | null
  motivo: 'edicion' | 'restauracion'
  title: string
  resumen: string
}
