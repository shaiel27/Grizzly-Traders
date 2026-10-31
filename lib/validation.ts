import { z } from 'zod'
import { briefTextLength, MAX_BRIEF_IMAGES } from './brief'

const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value)

const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable())

const optionalUrl = z.preprocess(
  emptyToNull,
  z.url({ protocol: /^https?$/ }).max(2000).nullable()
)

const optionalId = z.preprocess(emptyToNull, z.coerce.number().int().positive().nullable())

const idList = z.array(z.coerce.number().int().positive()).max(50).default([])

export const publishSchema = z.object({
  title: z.string().trim().min(1).max(300),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido'),
  content_html: z.string().min(1).max(500_000),
  locale: z.enum(['es', 'en']).default('es'),
  meta_title: optionalText(300),
  meta_description: optionalText(500),
  og_image_url: optionalUrl,
  cover_image_url: optionalUrl,
  source_url: optionalUrl,
  source_id: optionalId,
  category_id: optionalId,
  sentiment: z.enum(['bullish', 'bearish', 'neutral']).nullish(),
  status: z.enum(['draft', 'published', 'scheduled']).default('draft'),
  scheduled_at: z.preprocess(emptyToNull, z.iso.datetime({ local: true, offset: true }).nullable()),
  asset_ids: idList,
  tag_ids: idList,
  is_featured: z.boolean().default(false),
})

// Full edit: same shape as creation, plus the id of the post being updated
export const updatePostSchema = publishSchema.extend({
  id: z.string().uuid(),
})

export const patchPostSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(['draft', 'published', 'scheduled']).optional(),
    is_featured: z.boolean().optional(),
  })
  .refine((v) => v.status !== undefined || v.is_featured !== undefined, {
    message: 'Nada que actualizar',
  })

export const postIdSchema = z.string().uuid()

// ---- CMS asistido: contrato con el webhook editorial de n8n ----

// Lo unico que escribe el editor en modo asistido. El minimo de 200 caracteres del cuerpo lo fija
// el contrato: por debajo de eso el analisis no tiene material con el que redactar un articulo.
// Imagen del cuerpo: viaja aparte del texto, que solo lleva el marcador [[IMG:n]] (ver lib/brief.ts). Que la URL sea
// del bucket propio lo comprueba la ruta, que es código de servidor.
const briefImageSchema = z.object({
  n: z.number().int().min(1).max(MAX_BRIEF_IMAGES),
  url: z.string().url().max(500),
  alt: z.string().max(300).default(''),
  caption: z.string().max(300).default(''),
  width: z.number().int().positive().max(10_000).optional(),
  height: z.number().int().positive().max(10_000).optional(),
})

export const asistirSchema = z
  .object({
    titular: z.string().trim().min(1).max(200),
    cuerpo: z.string().trim().max(100_000),
    imagenes: z.array(briefImageSchema).max(MAX_BRIEF_IMAGES).default([]),
  })
  // El mínimo cuenta solo el texto visible: ni etiquetas HTML ni marcadores de imagen
  .refine((value) => briefTextLength(value.cuerpo) >= 200, { message: 'El cuerpo necesita al menos 200 caracteres', path: ['cuerpo'] })

export const etapaAsistenteSchema = z.enum(['analisis', 'imagen', 'storage', 'insercion', 'traduccion'])

// Respuesta del webhook. Lo que llega de n8n es dato ajeno, asi que se valida igual que la entrada
// del navegador. `ok` y `post_id` son lo unico indispensable: con el id se abre el borrador en el
// editor. El resto se acepta ausente para que un campo mal rellenado en el workflow no tire una
// generacion que si dejo el borrador escrito en la base.
export const asistirWebhookSchema = z.object({
  ok: z.boolean(),
  post_id: z.string().uuid().nullish(),
  slug: z.string().trim().max(200).nullish(),
  status: z.string().trim().max(40).nullish(),
  original_locale: z.enum(['es', 'en']).nullish(),
  cover_image_url: z.string().trim().max(2000).nullish(),
  traducciones: z.array(z.enum(['es', 'en'])).max(2).nullish(),
  error: z.string().trim().max(500).nullish(),
  etapa: etapaAsistenteSchema.nullish(),
})

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido')

export const categorySchema = z.object({
  type: z.literal('category'),
  name: z.string().trim().min(1).max(100),
  slug: slugField,
})

export const tagSchema = z.object({
  type: z.literal('tag'),
  name: z.string().trim().min(1).max(100),
  slug: slugField,
})

export const assetSchema = z.object({
  type: z.literal('asset'),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1).max(150),
  tipo_id: z.coerce.number().int().positive(),
})

export const sourceSchema = z.object({
  type: z.literal('source'),
  name: z.string().trim().min(1).max(150),
  url: optionalUrl,
  reliability_score: z.coerce.number().int().min(0).max(100).default(50),
})

export const catalogCreateSchema = z.discriminatedUnion('type', [
  categorySchema,
  tagSchema,
  assetSchema,
  sourceSchema,
])

export const catalogTypeSchema = z.enum(['category', 'tag', 'asset', 'source'])
export const catalogIdSchema = z.coerce.number().int().positive()

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  const path = issue?.path.join('.')
  return path ? `${path}: ${issue.message}` : (issue?.message ?? 'Datos inválidos')
}
