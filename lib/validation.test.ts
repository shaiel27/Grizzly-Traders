import { describe, expect, it } from 'vitest'
import { patchPostSchema, publishSchema } from './validation'

// Shape sent by components/ui/CMSPanel.tsx: every optional field is an empty string
const cmsPayload = {
  title: 'Bitcoin supera los 100.000',
  slug: 'bitcoin-supera-100000',
  content_html: '<p>Texto</p>',
  locale: 'es',
  meta_title: '',
  meta_description: '',
  og_image_url: '',
  sentiment: 'neutral',
  cover_image_url: '',
  source_url: '',
  source_id: '',
  status: 'draft',
  scheduled_at: '',
  category_id: '2',
  asset_ids: ['1', '3'],
  tag_ids: [],
  is_featured: false,
}

describe('publishSchema', () => {
  it('accepts the CMS payload and normalizes empty strings and numeric ids', () => {
    const parsed = publishSchema.parse(cmsPayload)
    expect(parsed.source_url).toBeNull()
    expect(parsed.source_id).toBeNull()
    expect(parsed.scheduled_at).toBeNull()
    expect(parsed.category_id).toBe(2)
    expect(parsed.asset_ids).toEqual([1, 3])
  })

  it.each([
    ['slug with spaces', { slug: 'no valido' }],
    ['slug with uppercase', { slug: 'Mayusculas' }],
    ['javascript: cover image', { cover_image_url: 'javascript:alert(1)' }],
    ['unknown status', { status: 'archived' }],
    ['unknown locale', { locale: 'fr' }],
    ['empty title', { title: '   ' }],
    ['non-numeric asset id', { asset_ids: ['abc'] }],
  ])('rejects %s', (_label, override) => {
    expect(publishSchema.safeParse({ ...cmsPayload, ...override }).success).toBe(false)
  })

  it('accepts an https source url', () => {
    const parsed = publishSchema.parse({ ...cmsPayload, source_url: 'https://example.com/nota' })
    expect(parsed.source_url).toBe('https://example.com/nota')
  })
})

describe('patchPostSchema', () => {
  const id = '3f1968c6-f500-47ef-9c23-0dab9382549d'

  it('requires a uuid and at least one field to update', () => {
    expect(patchPostSchema.safeParse({ id: 'x', status: 'draft' }).success).toBe(false)
    expect(patchPostSchema.safeParse({ id }).success).toBe(false)
    expect(patchPostSchema.safeParse({ id, is_featured: true }).success).toBe(true)
  })
})
