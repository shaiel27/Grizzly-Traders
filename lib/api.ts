import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from './supabase/public'
import type { Category, Asset, AssetType, Tag, Source, AuthorProfile, PostWithRelations } from './types'

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

  const { tag_filter: _tagFilter, asset_filter: _assetFilter, ...rest } = raw

  return {
    ...rest,
    assets,
    tags,
    author: author ?? null,
    category: category ?? null,
    source: source ?? null,
  } as PostWithRelations
}

// `!inner` makes PostgREST filter the parent posts instead of only trimming the embedded rows.
// The *_filter aliases keep the displayed tags/assets complete while filtering.
function postListSelect({ category = false, tag = false, asset = false } = {}) {
  return [
    '*',
    'author:perfiles_autores(*)',
    `category:categorias${category ? '!inner' : ''}(*)`,
    'source:fuentes(*)',
    'assets:post_activos(asset:activos(*))',
    'tags:post_tags(tag:tags(*))',
    'translations:posts_translations!inner(*)',
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
}: {
  limit?: number
  offset?: number
  categorySlug?: string
  tagSlug?: string
  assetSymbol?: string
  search?: string
  locale?: 'es' | 'en'
} = {}) {
  const supabase = createPublicClient()

  let query = supabase
    .from('posts')
    .select(postListSelect({ category: !!categorySlug, tag: !!tagSlug, asset: !!assetSymbol }))
    .eq('status', 'published')
    .eq('translations.locale', locale)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

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

async function getPostBySlugRaw(slug: string, locale: 'es' | 'en' = 'es') {
  const supabase = createPublicClient()

  const { data: translation, error: tError } = await supabase
    .from('posts_translations')
    .select('post_id')
    .eq('slug', slug)
    .eq('locale', locale)
    .single()

  if (tError || !translation) throw tError ?? new Error('Translation not found')

  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:perfiles_autores(*),
      category:categorias(*),
      source:fuentes(*),
      assets:post_activos(asset:activos(*)),
      tags:post_tags(tag:tags(*))
    `)
    .eq('id', translation.post_id)
    .eq('status', 'published')
    .single()

  if (error) throw error

  const { data: translations } = await supabase
    .from('posts_translations')
    .select('*')
    .eq('post_id', translation.post_id)

  const normalized = normalizePost(post as Record<string, unknown>)
  normalized.translations = translations ?? []
  return normalized
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

async function getSourcesRaw() {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('fuentes')
    .select('*')
    .order('reliability_score', { ascending: false })

  if (error) throw error
  return data as Source[]
}

async function getRelatedPostsRaw(postId: string, categoryId: number | null, assetIds: number[], limit = 4) {
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
    .eq('translations.locale', 'es')
    .neq('id', postId)
    .or(relatedFilters.join(','))
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return normalizePosts((data ?? []) as unknown as Record<string, unknown>[])
}

export async function incrementViewCount(postId: string) {
  const { error } = await createPublicClient().rpc('increment_view_count', { post_id: postId })
  if (error) console.error('Failed to increment view count:', error)
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

async function getAssetsForTickerRaw() {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('activos')
    .select('id, symbol, name, tipo:tipos_activo(name)')
    .order('symbol')

  if (error) throw error
  return (data ?? []).map((item) => {
    const rawTipo = item.tipo as unknown
    let tipoName: string | null = null
    if (Array.isArray(rawTipo)) {
      tipoName = rawTipo[0]?.name ?? null
    } else if (rawTipo && typeof rawTipo === 'object') {
      tipoName = (rawTipo as { name: string }).name ?? null
    }
    return {
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      tipo: tipoName ? { name: tipoName } : null,
    }
  }) as { id: number; symbol: string; name: string; tipo: { name: string } | null }[]
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

async function getPostsByAuthorRaw(authorId: number, locale: 'es' | 'en' = 'es', limit = 20) {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      translation:posts_translations!posts_translations_post_id_fkey(*),
      category:categorias(*),
      source:fuentes(*),
      assets:post_activos(asset_id, asset:activos(*)),
      tags:post_tags(tag_id, tag:tags(*))
    `)
    .eq('author_id', authorId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return normalizePosts(data as Record<string, unknown>[])
}

async function getAuthorStatsRaw(authorId: number) {
  const { data, error } = await createPublicClient()
    .from('posts')
    .select('category_id, assets:post_activos(asset_id)')
    .eq('author_id', authorId)
    .eq('status', 'published')
    .limit(1000)

  if (error) throw error

  const rows = (data ?? []) as unknown as { category_id: number | null; assets: { asset_id: number }[] | null }[]
  const categories = new Set<number>()
  const assets = new Set<number>()
  for (const row of rows) {
    if (row.category_id) categories.add(row.category_id)
    for (const asset of row.assets ?? []) assets.add(asset.asset_id)
  }
  return { posts: rows.length, categories: categories.size, assets: assets.size }
}

async function getSentimentSummaryRaw(days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await createPublicClient()
    .from('posts')
    .select('sentiment')
    .eq('status', 'published')
    .gte('published_at', since)
    .limit(1000)

  if (error) throw error

  const summary = { bullish: 0, bearish: 0, neutral: 0, total: 0 }
  for (const row of (data ?? []) as { sentiment: string | null }[]) {
    const key = row.sentiment === 'bullish' || row.sentiment === 'bearish' ? row.sentiment : 'neutral'
    summary[key] += 1
    summary.total += 1
  }
  return summary
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
export const getSources = cached('getSources', getSourcesRaw, 'catalog')
export const getRelatedPosts = cached('getRelatedPosts', getRelatedPostsRaw, 'posts')
export const getPostsByCategory = cached('getPostsByCategory', getPostsByCategoryRaw, 'posts')
export const getAssetsForTicker = cached('getAssetsForTicker', getAssetsForTickerRaw, 'catalog')
export const getPostCount = cached('getPostCount', getPostCountRaw, 'posts')
export const searchPosts = cached('searchPosts', searchPostsRaw, 'posts', 60)
export const getAllAuthors = cached('getAllAuthors', getAllAuthorsRaw, 'catalog')
export const getAuthorBySlug = cached('getAuthorBySlug', getAuthorBySlugRaw, 'catalog')
export const getPostsByAuthor = cached('getPostsByAuthor', getPostsByAuthorRaw, 'posts')
export const getPostBySlug = cache(cached('getPostBySlug', getPostBySlugRaw, 'posts'))
export const getAuthorStats = cached('getAuthorStats', getAuthorStatsRaw, 'posts')
export const getSentimentSummary = cached('getSentimentSummary', getSentimentSummaryRaw, 'posts')
