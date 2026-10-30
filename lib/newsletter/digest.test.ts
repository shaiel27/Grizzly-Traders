import { beforeEach, describe, expect, it } from 'vitest'
import { createMockProvider, type MockEmailProvider } from '@/lib/email/provider'
import { digestDateKey, runDigest, selectDigestPosts, toDigestPost, type DigestPost, type DigestRepo } from './digest'

const now = new Date('2026-10-27T12:00:00Z')

function hoursAgo(h: number) {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString()
}

function post(id: string, hours: number, extra: Partial<DigestPost> = {}): DigestPost {
  return {
    id,
    publishedAt: hoursAgo(hours),
    title: `Titular ${id}`,
    slug: `titular-${id}`,
    description: `Descripción ${id}`,
    category: 'Equities',
    readingMinutes: 3,
    sourceName: null,
    resolvedLocale: 'es',
    isFeatured: false,
    ...extra,
  }
}

describe('selectDigestPosts', () => {
  it('toma los más recientes de las últimas 24 horas, hasta 5', () => {
    const posts = [post('a', 1), post('b', 2), post('c', 3), post('d', 4), post('e', 5), post('f', 6), post('viejo', 30)]
    const selected = selectDigestPosts(posts, { locale: 'es', now })
    expect(selected?.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('no envía si hay menos artículos que el mínimo', () => {
    expect(selectDigestPosts([post('a', 1), post('b', 2)], { locale: 'es', now })).toBeNull()
    expect(selectDigestPosts([post('a', 1), post('b', 2)], { locale: 'es', now, min: 2 })).toHaveLength(2)
  })

  it('descarta los artículos sin traducción al idioma pedido', () => {
    const posts = [post('a', 1), post('b', 2), post('c', 3), post('solo-es', 4, { resolvedLocale: 'es' })]
    expect(selectDigestPosts(posts, { locale: 'en', now })).toBeNull()
  })

  it('descarta los publicados en el futuro y los duplicados', () => {
    const posts = [post('a', 1), post('a', 1), post('futuro', -2), post('b', 2), post('c', 3)]
    expect(selectDigestPosts(posts, { locale: 'es', now })?.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('pone primero la noticia destacada', () => {
    const posts = [post('a', 1), post('b', 2, { isFeatured: true }), post('c', 3)]
    expect(selectDigestPosts(posts, { locale: 'es', now })?.map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })

  it('descarta artículos sin título o sin slug', () => {
    const posts = [post('a', 1), post('b', 2), post('c', 3), post('sin-titulo', 4, { title: ' ' }), post('sin-slug', 5, { slug: '' })]
    expect(selectDigestPosts(posts, { locale: 'es', now })?.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('digestDateKey', () => {
  it('usa la fecha de la zona horaria del envío', () => {
    const lateUtc = new Date('2026-10-28T02:00:00Z')
    expect(digestDateKey(lateUtc, 'UTC')).toBe('2026-10-28')
    expect(digestDateKey(lateUtc, 'America/New_York')).toBe('2026-10-27')
  })
})

// Repositorio en memoria con la misma regla que la tabla: un intento por día e idioma
function memoryDigestRepo() {
  const rows = new Map<string, { status: 'sending' | 'sent' | 'failed'; broadcastId?: string; postIds?: string[] }>()
  const repo: DigestRepo = {
    async claim(dateKey, locale) {
      const key = `${dateKey}|${locale}`
      const current = rows.get(key)
      if (!current) {
        rows.set(key, { status: 'sending' })
        return true
      }
      if (current.status === 'failed') {
        rows.set(key, { status: 'sending' })
        return true
      }
      return false
    },
    async complete(dateKey, locale, info) {
      rows.set(`${dateKey}|${locale}`, { status: 'sent', ...info })
    },
    async fail(dateKey, locale) {
      rows.set(`${dateKey}|${locale}`, { status: 'failed' })
    },
  }
  return { repo, rows }
}

describe('runDigest', () => {
  let provider: MockEmailProvider
  let memory: ReturnType<typeof memoryDigestRepo>
  const posts = [post('a', 1), post('b', 2), post('c', 3)]

  function run(overrides: Partial<Parameters<typeof runDigest>[0]> = {}) {
    return runDigest({
      locale: 'es',
      now,
      siteUrl: 'https://grizzlytraders.example/',
      postalAddress: 'Calle 1, Miami, FL',
      timeZone: 'UTC',
      loadPosts: async () => posts,
      repo: memory.repo,
      provider,
      ...overrides,
    })
  }

  beforeEach(() => {
    provider = createMockProvider()
    memory = memoryDigestRepo()
  })

  it('envía una difusión con los artículos y registra el día', async () => {
    const result = await run()
    expect(result).toMatchObject({ status: 'sent', count: 3 })
    expect(provider.broadcasts).toHaveLength(1)
    expect(provider.broadcasts[0].html).toContain('https://grizzlytraders.example/articulos/titular-a')
    expect(provider.broadcasts[0].html).toContain('Calle 1, Miami, FL')
    expect(memory.rows.get('2026-10-27|es')).toMatchObject({ status: 'sent', postIds: ['a', 'b', 'c'] })
  })

  it('el mismo día no se envía dos veces', async () => {
    await run()
    const second = await run()
    expect(second).toEqual({ status: 'skipped', reason: 'already_sent' })
    expect(provider.broadcasts).toHaveLength(1)
  })

  it('cada idioma tiene su propio envío', async () => {
    await run()
    const english = await run({ locale: 'en', loadPosts: async () => posts.map((p) => ({ ...p, resolvedLocale: 'en' as const })) })
    expect(english.status).toBe('sent')
    expect(provider.broadcasts.map((b) => b.locale)).toEqual(['es', 'en'])
  })

  it('no envía ni reserva el día si hay pocos artículos', async () => {
    const result = await run({ loadPosts: async () => [post('a', 1)] })
    expect(result).toEqual({ status: 'skipped', reason: 'not_enough_posts' })
    expect(memory.rows.size).toBe(0)
    // Si luego aparecen más artículos ese mismo día, todavía se puede enviar
    expect((await run()).status).toBe('sent')
  })

  it('no envía sin dirección postal', async () => {
    const result = await run({ postalAddress: undefined })
    expect(result).toEqual({ status: 'skipped', reason: 'missing_postal_address' })
    expect(provider.broadcasts).toHaveLength(0)
  })

  it('si el proveedor falla marca el intento como fallido y permite reintentar', async () => {
    provider.failing.broadcast = true
    const failed = await run()
    expect(failed.status).toBe('failed')
    expect(memory.rows.get('2026-10-27|es')?.status).toBe('failed')

    provider.failing.broadcast = false
    expect((await run()).status).toBe('sent')
    expect(provider.broadcasts).toHaveLength(1)
  })

  it('si no se sabe si la difusión salió (respuesta perdida), el día NO se libera para no duplicar el envío', async () => {
    provider.failing.broadcastUnknown = true
    const result = await run()
    expect(result.status).toBe('failed')
    if (result.status === 'failed') expect(result.error).toContain('no se sabe si salió')
    // Sigue reservado como "sending": el cron siguiente no vuelve a enviarlo
    expect(memory.rows.get('2026-10-27|es')?.status).toBe('sending')

    provider.failing.broadcastUnknown = false
    expect(await run()).toEqual({ status: 'skipped', reason: 'already_sent' })
    expect(provider.broadcasts).toHaveLength(0)
  })

  it('la vista previa no envía nada ni reserva el día', async () => {
    const preview = await run({ dryRun: true })
    expect(preview).toMatchObject({ status: 'dry_run', count: 3 })
    if (preview.status === 'dry_run') expect(preview.html).toContain('Titular a')
    expect(provider.broadcasts).toHaveLength(0)
    expect(memory.rows.size).toBe(0)
  })

  it('la ventana ajustable solo se respeta en la vista previa', async () => {
    const old = [post('a', 30), post('b', 31), post('c', 32)]
    // Un envío real ignora la ventana pedida y usa las últimas 24 horas
    expect(await run({ loadPosts: async () => old, windowHours: 72 })).toEqual({ status: 'skipped', reason: 'not_enough_posts' })
    expect((await run({ loadPosts: async () => old, windowHours: 72, dryRun: true })).status).toBe('dry_run')
  })

  it('la vista previa funciona aunque falte la dirección postal', async () => {
    expect((await run({ dryRun: true, postalAddress: undefined })).status).toBe('dry_run')
  })
})

describe('toDigestPost', () => {
  const raw = {
    id: 'p1',
    title: 'Título base',
    slug: 'titulo-base',
    content_html: '<p>Contenido <b>largo</b> del artículo.</p>',
    meta_title: null,
    meta_description: null,
    original_locale: 'es',
    published_at: '2026-10-27T10:00:00Z',
    reading_time_minutes: 4,
    is_featured: false,
    category: { name: 'Equities' },
    source: [{ name: 'SEC' }],
    translations: [],
  }

  it('toma el título y el idioma del artículo y cae al contenido si no hay descripción', () => {
    const result = toDigestPost(raw, 'es')
    expect(result).toMatchObject({ title: 'Título base', category: 'Equities', sourceName: 'SEC', resolvedLocale: 'es', readingMinutes: 4 })
    expect(result?.description).toBe('Contenido largo del artículo.')
  })

  it('marca el artículo como en español cuando se pide el inglés y no hay traducción', () => {
    expect(toDigestPost(raw, 'en')?.resolvedLocale).toBe('es')
  })

  it('ignora los artículos sin fecha de publicación', () => {
    expect(toDigestPost({ ...raw, published_at: null }, 'es')).toBeNull()
  })
})
