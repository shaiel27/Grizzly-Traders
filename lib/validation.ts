import { z } from 'zod'

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
