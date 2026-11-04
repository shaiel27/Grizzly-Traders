import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createPublicClient } from './supabase/public'
import type { Category, Asset, AssetType, Tag, Source, AuthorProfile, PostTranslation, PostWithRelations } from './types'

// Supabase v2 returns nested joins as { asset: {...} } instead of flattening.
// This helper normalizes the response to match PostWithRelations type.
function normalizePost(raw: Record<string, unknown>): PostWithRelations {
  const assets = (raw.assets as { asset: Asset }[] | undefined)
    ?.map((a) => a.asset)
    .filter(Boolean) ?? []
  const tags = (raw.tags as { tag: Tag }[] | undefined)
    ?.map((t) => t.tag)
    .filter(Boolean) ?? []
  const rawAuthor = raw.author as Record<string, unknown> | null | undefined
  const author = rawAuthor && 'author' in rawAuthor
    ? (rawAuthor.author as AuthorProfile | null)
    : (rawAuthor as AuthorProfile | null)
  const rawCategory = raw.category as Record<string, unknown> | null | undefined
  const category = rawCategory && 'category' in rawCategory
    ? (rawCategory.category as Category | null)
    : (rawCategory as Category | null)
  const rawSource = raw.source as Record<string, unknown> | null | undefined
  const source = rawSource && 'source' in rawSource
    ? (rawSource.source as Source | null)
    : (rawSource as Source | null)

  // PostWithRelations promete `translations: PostTranslation[]`, y la cascada de idioma depende de
  // ello: si una consulta se olvida del join, mejor un array vacío explícito que un undefined que
  // el cast esconde.
  const translations = (raw.translations as PostTranslation[] | null | undefined) ?? []

  const { tag_filter: _tagFilter, asset_filter: _assetFilter, ...rest } = raw

  return {
    ...rest,
    assets,
    tags,
    translations,
    author: author ?? null,
    category: category ?? null,
    source: source ?? null,
  } as PostWithRelations
}

// `!inner` makes PostgREST filter the parent posts instead of only trimming the embedded rows.
// The *_filter aliases keep the displayed tags/assets complete while filtering.
//
// `translations` is intentionally a LEFT join (no `!inner`): with `!inner` + `.eq('translations.locale', locale)`,
// requesting the 'en' locale would exclude every post that has no 'en' translations.posts_translations row —
// and today the DB only has 'es' rows, so that would zero out every listing in EN. Left join + the same
// `.eq` filter instead just narrows the embedded `translations` array (empty when there's no match for the
// active locale), which is exactly what lib/feed.ts's localizedPost() needs to fall back to the post's base
// title/slug — que con el Modelo A están en `posts.original_locale`, no necesariamente en español.
// Columnas de una tarjeta de listado. NO se piden `content_html` completo, `search_vector` (~2,5 KB por fila), `embedding`
// ni `pipeline_*`: las tarjetas solo usan el extracto, que la base mantiene en `excerpt` (migración 0009). Se devuelve
// con el alias `content_html`, así `localizedPostContent` y `excerpt()` siguen funcionando sin cambios (en un listado
// ese campo trae el extracto de ~240 caracteres, no el artículo entero). Las etiquetas tampoco se piden: solo las muestra
// la página del artículo, que tiene su propia consulta.
const POST_CARD_COLUMNS = [
  'id',
  'title',
  'slug',
  'content_html:excerpt',
  'meta_title',
  'meta_description',
  'og_image_url',
  'twitter_card',
  'sentiment',
  'cover_image_url',
  'source_url',
  'source_id',
  'ai_assisted',
  'status',
  'format',
  'original_locale',
  'origen',
  'view_count',
  'reading_time_minutes',
  'is_featured',
  'author_id',
  'category_id',
  'published_at',
  'scheduled_at',
  'created_at',
  'updated_at',
].join(',')

function postListSelect({ category = false, tag = false, asset = false } = {}) {
  return [
    POST_CARD_COLUMNS,
    'author:perfiles_autores(id,slug,full_name,avatar_url)',
    `category:categorias${category ? '!inner' : ''}(*)`,
    'source:fuentes(*)',
    'assets:post_activos(asset:activos(id,symbol,name))',
    'translations:posts_translations(id,post_id,locale,title,slug,meta_title,meta_description,content_html:excerpt)',
    tag ? 'tag_filter:post_tags!inner(tag:tags!inner(slug))' : null,
    asset ? 'asset_filter:post_activos!inner(asset:activos!inner(symbol))' : null,
  ]
    .filter(Boolean)
    .join(',')
}

function normalizePosts(raws: Record<string, unknown>[]): PostWithRelations[] {
  return raws.map(normalizePost)
}

async function getPublishedPostsRaw({
  limit = 20,
  offset = 0,
  categorySlug,
  tagSlug,
  assetSymbol,
  search,
  locale = 'es',
  since,
}: {
  limit?: number
  offset?: number
  categorySlug?: string
  tagSlug?: string
  assetSymbol?: string
  search?: string
  locale?: 'es' | 'en'
  // ISO timestamp: only posts published at or after this instant (used for "today's news")
  since?: string
} = {}) {
  const supabase = createPublicClient()

  let query = supabase
    .from('posts')
    .select(postListSelect({ category: !!categorySlug, tag: !!tagSlug, asset: !!assetSymbol }))
    .eq('status', 'published')
    .eq('translations.locale', locale)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (since) {
    query = query.gte('published_at', since)
  }

  if (categorySlug) {
    query = query.eq('category.slug', categorySlug)
  }

  if (tagSlug) {
    query = query.eq('tag_filter.tag.slug', tagSlug)
  }

  if (assetSymbol) {
    query = query.eq('asset_filter.asset.symbol', assetSymbol)
  }

  if (search) {
    query = query.textSearch('search_vector', search, {
      type: 'websearch',
      config: locale === 'en' ? 'english' : 'spanish',
    })
  }

  const { data, error } = await query

  if (error) throw error
  return normalizePosts(data as unknown as Record<string, unknown>[])
}

// El slug identifica una fila de `posts_translations`, y cada idioma tiene el suyo. Filtrar además
// por `locale` daba 404 a cualquier URL cuyo slug no fuera del idioma activo: con el Modelo A un
// artículo con `original_locale='en'` tiene slug inglés, así que un lector en español que llegue por
// ese enlace (o al revés) perdía el artículo entero. Se busca el slug en cualquier idioma y el
// `locale` solo sirve para desempatar si dos filas comparten slug.
async function getPostBySlugRaw(slug: string, locale: 'es' | 'en' = 'es') {
  const supabase = createPublicClient()

  const { data: matches, error: tError } = await supabase
    .from('posts_translations')
    .select('post_id, locale')
    .eq('slug', slug)
    .limit(5)

  if (tError) throw tError
  const translation = matches?.find((row) => row.locale === locale) ?? matches?.[0]
  if (!translation) throw new Error('Translation not found')

  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:perfiles_autores(*),
      category:categorias(*),
      source:fuentes(*),
      assets:post_activos(asset:activos(*)),
      tags:post_tags(tag:tags(*)),
      translations:posts_translations(*)
    `)
    .eq('id', translation.post_id)
    .eq('status', 'published')
    .single()

  if (error) throw error

  return normalizePost(post as Record<string, unknown>)
}

async function getFeaturedPostsRaw(limit = 5, locale: 'es' | 'en' = 'es') {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('posts')
    .select(postListSelect())
    .eq('status', 'published')
    .eq('is_featured', true)
    .eq('translations.locale', locale)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return normalizePosts(data as unknown as Record<string, unknown>[])
}

async function getCategoriesRaw() {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('name')

  if (error) throw error
  return data as Category[]
}

async function getTagsRaw() {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name')

  if (error) throw error
  return data as Tag[]
}

// Solo el número de activos (la home lo muestra en el hero): antes descargaba el catálogo entero para hacer `.length`
async function getAssetCountRaw() {
  const { count, error } = await createPublicClient().from('activos').select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function getAssetsRaw() {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('activos')
    .select('*, tipo:tipos_activo(*)')
    .order('symbol')

  if (error) throw error
  return (data ?? []).map((item) => {
    const rawTipo = item.tipo as unknown
    let tipo: AssetType | null = null
    if (Array.isArray(rawTipo)) {
      tipo = rawTipo[0] as AssetType ?? null
    } else if (rawTipo && typeof rawTipo === 'object') {
      tipo = rawTipo as AssetType
    }
    return { ...item, tipo }
  }) as (Asset & { tipo: AssetType })[]
}

async function getAssetTypesRaw() {
  const supabase = createPublicClient()

  const { data, error } = await supabase.from('tipos_activo').select('*').order('name')

  if (error) throw error
  return (data ?? []) as AssetType[]
}

async function getSourcesRaw() {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('fuentes')
    .select('*')
    .order('reliability_score', { ascending: false })

  if (error) throw error
  return data as Source[]
}

async function getRelatedPostsRaw(postId: string, categoryId: number | null, assetIds: number[], limit = 4, locale: 'es' | 'en' = 'es') {
  const supabase = createPublicClient()

  const relatedFilters: string[] = []
  if (categoryId) relatedFilters.push(`category_id.eq.${categoryId}`)

  if (assetIds.length > 0) {
    const { data: sharing } = await supabase
      .from('post_activos')
      .select('post_id')
      .in('asset_id', assetIds)
      .neq('post_id', postId)
      .limit(50)

    const ids = [...new Set((sharing ?? []).map((row) => row.post_id))]
    if (ids.length > 0) relatedFilters.push(`id.in.(${ids.join(',')})`)
  }

  if (relatedFilters.length === 0) return []

  const { data, error } = await supabase
    .from('posts')
    .select(postListSelect())
    .eq('status', 'published')
    .eq('translations.locale', locale)
    .neq('id', postId)
    .or(relatedFilters.join(','))
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return normalizePosts((data ?? []) as unknown as Record<string, unknown>[])
}

// La función SQL es SECURITY DEFINER y ya no la puede ejecutar la llave anónima (migración 0008): la llama el servidor.
export async function incrementViewCount(postId: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.rpc('increment_view_count', { post_id: postId })
  if (error) console.error('Failed to increment view count:', error)
}

// Lectura del contador sin caché de datos: el lector la pide justo después de contar su visita.
export async function getPostViewCount(postId: string): Promise<number | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.from('posts').select('view_count').eq('id', postId).maybeSingle()
  if (error) {
    console.error('Failed to read view count:', error)
    return null
  }
  return data?.view_count ?? null
}

async function getPostsByCategoryRaw(categorySlug: string, limit = 3, locale: 'es' | 'en' = 'es') {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('posts')
    .select(postListSelect({ category: true }))
    .eq('status', 'published')
    .eq('translations.locale', locale)
    .eq('category.slug', categorySlug)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return normalizePosts(data as unknown as Record<string, unknown>[])
}

async function getPostCountRaw() {
  const supabase = createPublicClient()

  const { count, error } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')

  if (error) throw error
  return count ?? 0
}

async function searchPostsRaw(query: string, locale: 'es' | 'en' = 'es', limit = 20) {
  const supabase = createPublicClient()

  const { data, error } = await supabase.rpc('search_posts', {
    query_text: query,
    locale_param: locale,
    limit_count: limit,
  })

  if (error) throw error
  return normalizePosts((data ?? []) as Record<string, unknown>[])
}

async function getAllAuthorsRaw() {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('perfiles_autores')
    .select('*')
    .eq('listed', true)
    .order('full_name')

  if (error) throw error
  return data as AuthorProfile[]
}

async function getAuthorBySlugRaw(slug: string) {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('perfiles_autores')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) throw error
  return data as AuthorProfile
}

// El alias de la relación tiene que llamarse `translations`: con `translation:` (singular) PostgREST
// devolvía la clave equivocada, normalizePost no la mapeaba y `post.translations` llegaba vacío, así
// que las tarjetas de la página de autor caían siempre al título/slug base del post — es decir, al
// idioma original, ignorando el locale del lector. Aquí NO se filtra por locale a propósito: se traen
// todos los idiomas y decide la cascada de lib/feed.ts.
// `locale` sigue en la firma porque forma parte de la clave de caché de la versión cacheada.
async function getPostsByAuthorRaw(authorId: number, locale: 'es' | 'en' = 'es', limit = 20) {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('posts')
    .select(postListSelect())
    .eq('author_id', authorId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return normalizePosts(data as unknown as Record<string, unknown>[])
}

async function getAuthorStatsRaw(authorId: number) {
  const { data, error } = await createPublicClient().rpc('author_stats', { p_author_id: authorId })
  if (error) throw error
  const stats = (data ?? {}) as { posts?: number; categories?: number; assets?: number }
  return { posts: stats.posts ?? 0, categories: stats.categories ?? 0, assets: stats.assets ?? 0 }
}

// RSS y sitemap: antes cada petición iba a la base de datos (el sitemap hasta con 5000 filas) sin caché del servidor
async function getFeedPostsRaw() {
  const { data, error } = await createPublicClient()
    .from('posts')
    .select('title, published_at, created_at, translations:posts_translations!inner(slug, title, content_html, meta_description)')
    .eq('status', 'published')
    .eq('translations.locale', 'es')
    .order('published_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

async function getSitemapPostsRaw() {
  const { data, error } = await createPublicClient()
    .from('posts')
    .select('published_at, updated_at, translations:posts_translations!inner(slug)')
    .eq('status', 'published')
    .eq('translations.locale', 'es')
    .order('published_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  return data ?? []
}

const REVALIDATE_SECONDS = 300

// Public reads go through the data cache; publishing or editing invalidates the 'posts' tag (see lib/cache.ts).
function cached<Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>,
  tag: 'posts' | 'catalog',
  revalidate = REVALIDATE_SECONDS
) {
  return unstable_cache(fn, ['api', name], { tags: [tag], revalidate })
}

export const getPublishedPosts = cached('getPublishedPosts', getPublishedPostsRaw, 'posts')
export const getFeaturedPosts = cached('getFeaturedPosts', getFeaturedPostsRaw, 'posts')
export const getCategories = cached('getCategories', getCategoriesRaw, 'catalog')
export const getTags = cached('getTags', getTagsRaw, 'catalog')
export const getAssets = cached('getAssets', getAssetsRaw, 'catalog')
export const getAssetCount = cached('getAssetCount', getAssetCountRaw, 'catalog')
export const getSources = cached('getSources', getSourcesRaw, 'catalog')
export const getAssetTypes = cached('getAssetTypes', getAssetTypesRaw, 'catalog')
export const getRelatedPosts = cached('getRelatedPosts', getRelatedPostsRaw, 'posts')
export const getPostsByCategory = cached('getPostsByCategory', getPostsByCategoryRaw, 'posts')
export const getPostCount = cached('getPostCount', getPostCountRaw, 'posts')
export const searchPosts = cached('searchPosts', searchPostsRaw, 'posts', 60)
export const getAllAuthors = cached('getAllAuthors', getAllAuthorsRaw, 'catalog')
export const getAuthorBySlug = cached('getAuthorBySlug', getAuthorBySlugRaw, 'catalog')
export const getPostsByAuthor = cached('getPostsByAuthor', getPostsByAuthorRaw, 'posts')
export const getPostBySlug = cache(cached('getPostBySlug', getPostBySlugRaw, 'posts'))
export const getAuthorStats = cached('getAuthorStats', getAuthorStatsRaw, 'posts')
export const getFeedPosts = cached('getFeedPosts', getFeedPostsRaw, 'posts', 600)
export const getSitemapPosts = cached('getSitemapPosts', getSitemapPostsRaw, 'posts', 3600)
